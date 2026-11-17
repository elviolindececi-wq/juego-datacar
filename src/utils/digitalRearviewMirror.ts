import * as THREE from 'three';

/**
 * DATACAR ARENA — Sistema de Espejos Retrovisores Digitales (Central + Laterales Izquierdo/Derecho)
 * Renderizado GPU directo por recorte de viewport/scissor sobre el backbuffer principal antes de la pasada
 * principal + copia acelerada `ctx2d.drawImage` con inversión horizontal de espejo:
 * - Cero llamadas síncronas `readRenderTargetPixels` (`gl.readPixels`) que bloqueaban el hilo principal.
 * - Cero `WebGLRenderTarget` extra ni bucles CPU píxel por píxel.
 * - Estrictamente a lo sumo UNA cámara secundaria renderizada por frame (escalonamiento round-robin).
 */

export interface DigitalRearviewMirrorController {
  camera: THREE.PerspectiveCamera;
  renderFrame: (args: {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    targetCanvas: HTMLCanvasElement | null;
    leftCanvas?: HTMLCanvasElement | null;
    rightCanvas?: HTMLCanvasElement | null;
    showSideMirrors?: boolean;
    vehicleWorldX: number;
    vehicleWorldY: number;
    vehicleWorldZ: number;
    vehicleYawRad: number;
    elapsedSec: number;
    enabled: boolean;
    beforeRender?: () => void;
    afterRender?: () => void;
  }) => boolean;
  dispose: () => void;
}

export function createDigitalRearviewMirror(args: {
  isSoftwareGl: boolean;
}): DigitalRearviewMirrorController {
  const centerW = args.isSoftwareGl ? 176 : 256;
  const centerH = args.isSoftwareGl ? 54 : 80;
  const sideW = args.isSoftwareGl ? 76 : 104;
  const sideH = args.isSoftwareGl ? 46 : 64;

  const centerIntervalSec = args.isSoftwareGl ? 0.20 : 0.066;
  const sideIntervalSec = args.isSoftwareGl ? 0.38 : 0.13;

  // Plano lejano de 1050m para incluir la bóveda atmosférica (skyRadius <= 960m); los edificios lejanos ya se descartan por LOD
  const camera = new THREE.PerspectiveCamera(58, centerW / centerH, 0.55, 1050);
  const sideCamera = new THREE.PerspectiveCamera(54, sideW / sideH, 0.45, 1050);

  let lastCenterAt = -999;
  let lastLeftAt = -999;
  let lastRightAt = -999;
  let roundRobinCursor = 0;
  let paintedCanvases = new WeakSet<HTMLCanvasElement>();

  const lookTarget = new THREE.Vector3();
  const prevViewport = new THREE.Vector4();
  const prevScissor = new THREE.Vector4();

  const renderMirrorViewportToCanvas = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    cam: THREE.PerspectiveCamera,
    targetW: number,
    targetH: number,
    destCanvas: HTMLCanvasElement,
    beforeRender?: () => void,
    afterRender?: () => void,
  ): boolean => {
    const domCanvas = renderer.domElement;
    if (!domCanvas || domCanvas.width <= 0 || domCanvas.height <= 0) return false;

    const dpr = Math.max(0.5, renderer.getPixelRatio() || 1);
    const physW = Math.max(1, Math.min(targetW, domCanvas.width));
    const physH = Math.max(1, Math.min(targetH, domCanvas.height));
    const cssW = physW / dpr;
    const cssH = physH / dpr;

    const prevTarget = renderer.getRenderTarget();
    const prevScissorTest = renderer.getScissorTest();
    const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const prevAutoClear = renderer.autoClear;
    renderer.getViewport(prevViewport);
    renderer.getScissor(prevScissor);

    renderer.shadowMap.autoUpdate = false;

    try {
      beforeRender?.();
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, cssW, cssH);
      renderer.setScissor(0, 0, cssW, cssH);
      renderer.setScissorTest(true);
      renderer.autoClear = false;
      renderer.clear(true, true, false);
      renderer.render(scene, cam);
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setViewport(prevViewport);
      renderer.setScissor(prevScissor);
      renderer.setScissorTest(prevScissorTest);
      renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
      renderer.autoClear = prevAutoClear;
      afterRender?.();
    }

    if (destCanvas.width !== targetW || destCanvas.height !== targetH) {
      destCanvas.width = targetW;
      destCanvas.height = targetH;
    }
    const outCtx = destCanvas.getContext('2d');
    if (outCtx) {
      const sy = Math.max(0, domCanvas.height - physH);
      outCtx.save();
      outCtx.translate(targetW, 0);
      outCtx.scale(-1, 1);
      outCtx.drawImage(domCanvas, 0, sy, physW, physH, 0, 0, targetW, targetH);
      outCtx.restore();
      paintedCanvases.add(destCanvas);
    }
    return true;
  };

  const renderCenterPass = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    targetCanvas: HTMLCanvasElement,
    vehicleWorldX: number,
    vehicleWorldY: number,
    vehicleWorldZ: number,
    forwardX: number,
    forwardZ: number,
    elapsedSec: number,
    beforeRender?: () => void,
    afterRender?: () => void,
  ) => {
    lastCenterAt = elapsedSec;
    camera.position.set(
      vehicleWorldX - forwardX * 1.65,
      vehicleWorldY + 1.52,
      vehicleWorldZ - forwardZ * 1.65,
    );
    lookTarget.set(
      vehicleWorldX - forwardX * 36.0,
      vehicleWorldY + 1.08,
      vehicleWorldZ - forwardZ * 36.0,
    );
    camera.lookAt(lookTarget);
    return renderMirrorViewportToCanvas(
      renderer,
      scene,
      camera,
      centerW,
      centerH,
      targetCanvas,
      beforeRender,
      afterRender,
    );
  };

  const renderLeftPass = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    leftCanvas: HTMLCanvasElement,
    vehicleWorldX: number,
    vehicleWorldY: number,
    vehicleWorldZ: number,
    forwardX: number,
    forwardZ: number,
    rightX: number,
    rightZ: number,
    elapsedSec: number,
    beforeRender?: () => void,
    afterRender?: () => void,
  ) => {
    lastLeftAt = elapsedSec;
    sideCamera.position.set(
      vehicleWorldX - rightX * 1.02 + forwardX * 0.35,
      vehicleWorldY + 1.15,
      vehicleWorldZ - rightZ * 1.02 + forwardZ * 0.35,
    );
    lookTarget.set(
      vehicleWorldX - rightX * 4.8 - forwardX * 26.0,
      vehicleWorldY + 0.96,
      vehicleWorldZ - rightZ * 4.8 - forwardZ * 26.0,
    );
    sideCamera.lookAt(lookTarget);
    return renderMirrorViewportToCanvas(
      renderer,
      scene,
      sideCamera,
      sideW,
      sideH,
      leftCanvas,
      beforeRender,
      afterRender,
    );
  };

  const renderRightPass = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    rightCanvas: HTMLCanvasElement,
    vehicleWorldX: number,
    vehicleWorldY: number,
    vehicleWorldZ: number,
    forwardX: number,
    forwardZ: number,
    rightX: number,
    rightZ: number,
    elapsedSec: number,
    beforeRender?: () => void,
    afterRender?: () => void,
  ) => {
    lastRightAt = elapsedSec;
    sideCamera.position.set(
      vehicleWorldX + rightX * 1.02 + forwardX * 0.35,
      vehicleWorldY + 1.15,
      vehicleWorldZ + rightZ * 1.02 + forwardZ * 0.35,
    );
    lookTarget.set(
      vehicleWorldX + rightX * 4.8 - forwardX * 26.0,
      vehicleWorldY + 0.96,
      vehicleWorldZ + rightZ * 4.8 - forwardZ * 26.0,
    );
    sideCamera.lookAt(lookTarget);
    return renderMirrorViewportToCanvas(
      renderer,
      scene,
      sideCamera,
      sideW,
      sideH,
      rightCanvas,
      beforeRender,
      afterRender,
    );
  };

  const renderFrame: DigitalRearviewMirrorController['renderFrame'] = ({
    renderer,
    scene,
    targetCanvas,
    leftCanvas,
    rightCanvas,
    showSideMirrors = true,
    vehicleWorldX,
    vehicleWorldY,
    vehicleWorldZ,
    vehicleYawRad,
    elapsedSec,
    enabled,
    beforeRender,
    afterRender,
  }) => {
    if (!enabled) {
      paintedCanvases = new WeakSet<HTMLCanvasElement>();
      return false;
    }

    const forwardX = Math.sin(vehicleYawRad);
    const forwardZ = Math.cos(vehicleYawRad);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    // Si algún canvas recién montado aún no tiene primer pintado, inicializarlo de inmediato para evitar espejos vacíos
    let seededAny = false;
    if (targetCanvas && !paintedCanvases.has(targetCanvas)) {
      seededAny =
        renderCenterPass(
          renderer,
          scene,
          targetCanvas,
          vehicleWorldX,
          vehicleWorldY,
          vehicleWorldZ,
          forwardX,
          forwardZ,
          elapsedSec,
          beforeRender,
          afterRender,
        ) || seededAny;
    }
    if (showSideMirrors && leftCanvas && !paintedCanvases.has(leftCanvas)) {
      seededAny =
        renderLeftPass(
          renderer,
          scene,
          leftCanvas,
          vehicleWorldX,
          vehicleWorldY,
          vehicleWorldZ,
          forwardX,
          forwardZ,
          rightX,
          rightZ,
          elapsedSec,
          beforeRender,
          afterRender,
        ) || seededAny;
    }
    if (showSideMirrors && rightCanvas && !paintedCanvases.has(rightCanvas)) {
      seededAny =
        renderRightPass(
          renderer,
          scene,
          rightCanvas,
          vehicleWorldX,
          vehicleWorldY,
          vehicleWorldZ,
          forwardX,
          forwardZ,
          rightX,
          rightZ,
          elapsedSec,
          beforeRender,
          afterRender,
        ) || seededAny;
    }
    if (seededAny) return true;

    const centerDue = Boolean(targetCanvas) && elapsedSec - lastCenterAt >= centerIntervalSec;
    const leftDue =
      showSideMirrors && Boolean(leftCanvas) && elapsedSec - lastLeftAt >= sideIntervalSec;
    const rightDue =
      showSideMirrors && Boolean(rightCanvas) && elapsedSec - lastRightAt >= sideIntervalSec;

    // En régimen continuo: estrictamente UNA SOLA cámara secundaria por frame (escalonamiento round-robin)
    for (let step = 0; step < 3; step++) {
      const slot = (roundRobinCursor + step) % 3;
      if (slot === 0 && centerDue && targetCanvas) {
        roundRobinCursor = 1;
        return renderCenterPass(
          renderer,
          scene,
          targetCanvas,
          vehicleWorldX,
          vehicleWorldY,
          vehicleWorldZ,
          forwardX,
          forwardZ,
          elapsedSec,
          beforeRender,
          afterRender,
        );
      }

      if (slot === 1 && leftDue && leftCanvas) {
        roundRobinCursor = 2;
        return renderLeftPass(
          renderer,
          scene,
          leftCanvas,
          vehicleWorldX,
          vehicleWorldY,
          vehicleWorldZ,
          forwardX,
          forwardZ,
          rightX,
          rightZ,
          elapsedSec,
          beforeRender,
          afterRender,
        );
      }

      if (slot === 2 && rightDue && rightCanvas) {
        roundRobinCursor = 0;
        return renderRightPass(
          renderer,
          scene,
          rightCanvas,
          vehicleWorldX,
          vehicleWorldY,
          vehicleWorldZ,
          forwardX,
          forwardZ,
          rightX,
          rightZ,
          elapsedSec,
          beforeRender,
          afterRender,
        );
      }
    }

    return false;
  };

  return {
    camera,
    renderFrame,
    dispose: () => {
      // Sin WebGLRenderTargets dedicados que liberar
    },
  };
}
