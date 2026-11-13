import * as THREE from 'three';

/**
 * DATACAR ARENA — Sistema de Espejos Retrovisores Digitales (Central + Laterales Izquierdo/Derecho)
 * Cámaras secundarias reales de Three.js con actualización escalonada (máximo 1 readback GPU por frame)
 * para mostrar tráfico trasero y puntos ciegos sin afectar fluidez en desktop ni mobile.
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
  }) => void;
  dispose: () => void;
}

export function createDigitalRearviewMirror(args: {
  isSoftwareGl: boolean;
}): DigitalRearviewMirrorController {
  const centerW = args.isSoftwareGl ? 192 : 288;
  const centerH = args.isSoftwareGl ? 60 : 90;
  const sideW = args.isSoftwareGl ? 80 : 112;
  const sideH = args.isSoftwareGl ? 48 : 68;

  const centerIntervalSec = args.isSoftwareGl ? 0.22 : 0.068;
  const sideIntervalSec = args.isSoftwareGl ? 0.48 : 0.14;

  const centerRT = new THREE.WebGLRenderTarget(centerW, centerH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  centerRT.texture.colorSpace = THREE.SRGBColorSpace;

  const sideRT = new THREE.WebGLRenderTarget(sideW, sideH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  sideRT.texture.colorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(58, centerW / centerH, 0.55, 1200);
  const sideCamera = new THREE.PerspectiveCamera(54, sideW / sideH, 0.45, 1200);

  const centerPixelBuffer = new Uint8Array(centerW * centerH * 4);
  const sidePixelBuffer = new Uint8Array(sideW * sideH * 4);

  let centerScratch: HTMLCanvasElement | null = null;
  let centerCtx: CanvasRenderingContext2D | null = null;
  let centerImgData: ImageData | null = null;

  let sideScratch: HTMLCanvasElement | null = null;
  let sideCtx: CanvasRenderingContext2D | null = null;
  let sideImgData: ImageData | null = null;

  if (typeof document !== 'undefined') {
    centerScratch = document.createElement('canvas');
    centerScratch.width = centerW;
    centerScratch.height = centerH;
    centerCtx = centerScratch.getContext('2d');
    if (centerCtx) centerImgData = centerCtx.createImageData(centerW, centerH);

    sideScratch = document.createElement('canvas');
    sideScratch.width = sideW;
    sideScratch.height = sideH;
    sideCtx = sideScratch.getContext('2d');
    if (sideCtx) sideImgData = sideCtx.createImageData(sideW, sideH);
  }

  let lastCenterAt = -999;
  let lastLeftAt = -999;
  let lastRightAt = -999;

  const lookTarget = new THREE.Vector3();
  const prevTargetSave: { target: THREE.WebGLRenderTarget | null } = { target: null };

  const blitTargetToCanvas = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    rt: THREE.WebGLRenderTarget,
    cam: THREE.PerspectiveCamera,
    w: number,
    h: number,
    pixelBuffer: Uint8Array,
    scratch: HTMLCanvasElement,
    sCtx: CanvasRenderingContext2D,
    imgData: ImageData,
    destCanvas: HTMLCanvasElement,
    beforeRender?: () => void,
    afterRender?: () => void,
  ) => {
    prevTargetSave.target = renderer.getRenderTarget();
    const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;

    try {
      beforeRender?.();
      renderer.setRenderTarget(rt);
      renderer.clear(true, true, false);
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixelBuffer);
    } finally {
      renderer.setRenderTarget(prevTargetSave.target);
      renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
      afterRender?.();
    }

    const dst = imgData.data;
    const rowStride = w * 4;
    for (let y = 0; y < h; y++) {
      const srcRowOffset = (h - 1 - y) * rowStride;
      const dstRowOffset = y * rowStride;
      for (let x = 0; x < w; x++) {
        const srcIdx = srcRowOffset + (w - 1 - x) * 4;
        const dstIdx = dstRowOffset + x * 4;
        dst[dstIdx] = pixelBuffer[srcIdx];
        dst[dstIdx + 1] = pixelBuffer[srcIdx + 1];
        dst[dstIdx + 2] = pixelBuffer[srcIdx + 2];
        dst[dstIdx + 3] = 255;
      }
    }
    sCtx.putImageData(imgData, 0, 0);

    if (destCanvas.width !== w || destCanvas.height !== h) {
      destCanvas.width = w;
      destCanvas.height = h;
    }
    const outCtx = destCanvas.getContext('2d');
    if (outCtx) {
      outCtx.drawImage(scratch, 0, 0);
    }
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
    if (!enabled) return;

    const forwardX = Math.sin(vehicleYawRad);
    const forwardZ = Math.cos(vehicleYawRad);
    // Vector derecho del vehículo (observado hacia +Z)
    const rightX = -forwardZ;
    const rightZ = forwardX;

    // Primer frame inicial: poblar espejo central y laterales una sola vez para evitar cuadros negros en 1er render;
    // luego mantener a lo sumo UN readback GPU por frame para cero lag en SwiftShader/mobile.
    const isInitialPrime = lastCenterAt < 0 && lastLeftAt < 0 && lastRightAt < 0;
    const centerDue =
      Boolean(targetCanvas && centerScratch && centerCtx && centerImgData) &&
      elapsedSec - lastCenterAt >= centerIntervalSec;
    if (centerDue && targetCanvas && centerScratch && centerCtx && centerImgData) {
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
      blitTargetToCanvas(
        renderer,
        scene,
        centerRT,
        camera,
        centerW,
        centerH,
        centerPixelBuffer,
        centerScratch,
        centerCtx,
        centerImgData,
        targetCanvas,
        beforeRender,
        afterRender,
      );
      if (!isInitialPrime) return;
    }

    if (!showSideMirrors || !sideScratch || !sideCtx || !sideImgData) return;

    const leftDue = Boolean(leftCanvas) && elapsedSec - lastLeftAt >= sideIntervalSec;
    const rightDue = Boolean(rightCanvas) && elapsedSec - lastRightAt >= sideIntervalSec;

    if (leftDue && (isInitialPrime || !rightDue || lastLeftAt <= lastRightAt) && leftCanvas) {
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
      blitTargetToCanvas(
        renderer,
        scene,
        sideRT,
        sideCamera,
        sideW,
        sideH,
        sidePixelBuffer,
        sideScratch,
        sideCtx,
        sideImgData,
        leftCanvas,
        beforeRender,
        afterRender,
      );
      if (!isInitialPrime) return;
    }

    if (rightDue && rightCanvas) {
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
      blitTargetToCanvas(
        renderer,
        scene,
        sideRT,
        sideCamera,
        sideW,
        sideH,
        sidePixelBuffer,
        sideScratch,
        sideCtx,
        sideImgData,
        rightCanvas,
        beforeRender,
        afterRender,
      );
    }
  };

  return {
    camera,
    renderFrame,
    dispose: () => {
      centerRT.dispose();
      sideRT.dispose();
    },
  };
}
