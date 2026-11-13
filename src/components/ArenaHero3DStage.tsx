import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Box, RefreshCw, RotateCcw } from 'lucide-react';
import type { Vehicle } from '../types/vehicle';
import { getOfficialVehicleImageUrl } from '../data/presetVehicles';
import {
  clearGlbAvailabilityCache,
  createCalibratedVehicle3DInstance,
  getVehicle3DConfig,
  resolveDedicatedVehicleGLTF,
} from '../utils/vehicle3DModelLoader';
import { createVehicleWheelRig, type VehicleWheelRig } from '../utils/vehicleWheelRig';

interface ArenaHero3DStageProps {
  vehicle: Vehicle;
  compact?: boolean;
  pngOnly?: boolean;
  imageBadgeLabel?: string | null;
  onOpen360Modal?: (vehicleId: string) => void;
}

export interface CutoutStop {
  angle: 'front34' | 'front' | 'side' | 'rear34' | 'rear';
  flipX: boolean;
  label: string;
}

export const CUTOUT_ORBIT_STOPS: CutoutStop[] = [
  { angle: 'front34', flipX: false, label: '3/4 Delantera' },
  { angle: 'front', flipX: false, label: 'Frontal' },
  { angle: 'front34', flipX: true, label: '3/4 Delantera Der.' },
  { angle: 'side', flipX: true, label: 'Perfil Der.' },
  { angle: 'rear34', flipX: true, label: '3/4 Trasera Der.' },
  { angle: 'rear', flipX: false, label: 'Trasera' },
  { angle: 'rear34', flipX: false, label: '3/4 Trasera Izq.' },
  { angle: 'side', flipX: false, label: 'Perfil Izq.' },
];

const DEFAULT_HERO_YAW = -0.58; // Ángulo protagonista 3/4 delantero izquierdo
const DEFAULT_HERO_PITCH = 0.045; // Altura de cámara automotriz natural alineada al horizonte del estadio

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

function createShowroomContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 124);
    grad.addColorStop(0, 'rgba(1, 4, 9, 0.96)');
    grad.addColorStop(0.5, 'rgba(2, 6, 12, 0.72)');
    grad.addColorStop(0.78, 'rgba(2, 6, 12, 0.26)');
    grad.addColorStop(1, 'rgba(2, 6, 12, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Escenario protagonista 3D WebGL (`.glb` con soporte de ruedas independientes) o recorte oficial `.webp` / `.png`
 * integrado sobre el asfalto del estadio con sombra de contacto suave.
 */
export const ArenaHero3DStage: React.FC<ArenaHero3DStageProps> = ({
  vehicle,
  compact = false,
  pngOnly = false,
  imageBadgeLabel = 'Vista PNG · Garage',
  onOpen360Modal,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const compactRef = useRef(compact);
  compactRef.current = compact;

  const [glbStatus, setGlbStatus] = useState<'loading' | 'ready' | 'pending'>(pngOnly ? 'pending' : 'loading');
  const [wheelSplitDetected, setWheelSplitDetected] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [cutoutStopIndex, setCutoutStopIndex] = useState(0);
  const [isRotated, setIsRotated] = useState(false);

  const stageRuntimeRef = useRef<{
    turntable: THREE.Group;
    envMap: THREE.Texture;
    currentYaw: number;
    targetYaw: number;
    currentPitch: number;
    targetPitch: number;
    rollMeters: number;
    wheelRig: VehicleWheelRig | null;
    onNextFrameRendered: (() => void) | null;
    requestRender: () => void;
    syncCameraFraming: () => void;
  } | null>(null);

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    accumulatedDx: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    accumulatedDx: 0,
  });

  // Inicialización única y estable del contexto Three.js WebGL (omitido en modo Garage PNG-only)
  useEffect(() => {
    if (pngOnly) return;
    const mount = canvasMountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      preserveDrawingBuffer: isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    const envMap = envTarget.texture;
    scene.environment = envMap;
    pmremGenerator.dispose();

    // Lente automotriz teleobjetivo (25.5° ≈ 80mm equivalente): elimina distorsión de ojo de pez
    // y alinea la línea de horizonte 3D exactamente con el asfalto del estadio/garaje.
    const camera = new THREE.PerspectiveCamera(25.5, 16 / 9, 0.25, 65);

    // Iluminación neutra y calibrada 1:1 para respetar fielmente los colores y texturas originales del .glb
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.68);
    hemiLight.position.set(0, 12, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.32);
    keyLight.position.set(4.2, 7.6, 5.8);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      const d = 3.4;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 0.8;
      keyLight.shadow.camera.far = 22;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const cyanStadiumFill = new THREE.DirectionalLight(0x38bdf8, 0.34);
    cyanStadiumFill.position.set(-6.4, 2.8, 3.8);
    scene.add(cyanStadiumFill);

    const amberStadiumRim = new THREE.DirectionalLight(0xfbbf24, 0.28);
    amberStadiumRim.position.set(6.2, 2.6, -4.4);
    scene.add(amberStadiumRim);

    // Receptor de sombra proyectada invisible sobre la foto real del asfalto (sin cajas ni discos grises)
    const shadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.ShadowMaterial({ opacity: 0.48 }),
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = 0.002;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);

    // Plataforma giratoria del vehículo y su sombra de oclusión de contacto suave bajo las 4 ruedas
    const turntable = new THREE.Group();
    turntable.rotation.y = DEFAULT_HERO_YAW;
    turntable.visible = false;
    scene.add(turntable);

    const contactShadowTex = createShowroomContactShadowTexture();
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 5.25),
      contactShadowMat,
    );
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.006;
    turntable.add(contactShadowMesh);

    let lastWidth = 0;
    let lastHeight = 0;
    const syncCameraFraming = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      camera.aspect = aspect;

      // Calibración de distancia para lente de 25.5° + altura de ojos baja (1.02m..1.25m)
      // Así las ruedas apoyan exactamente en el tercio inferior sobre el asfalto del estadio.
      const baseDist = compactRef.current ? 7.35 : 7.05;
      const narrowBoost = aspect < 1.42 ? (1.42 - aspect) * 3.15 : 0;
      const dist = baseDist + narrowBoost;

      const pitch = stageRuntimeRef.current?.currentPitch ?? DEFAULT_HERO_PITCH;
      const targetY = compactRef.current ? 0.64 : 0.62;
      const eyeY = targetY + 0.34 + Math.sin(pitch) * dist * 0.48;
      const eyeZ = Math.cos(pitch * 0.6) * dist;

      camera.position.set(0, eyeY, eyeZ);
      camera.lookAt(0, targetY, 0);
      camera.updateProjectionMatrix();
      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width;
        lastHeight = height;
        renderer.setSize(width, height, false);
      }
    };

    syncCameraFraming();

    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTimeMs = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      let polls = 0;
      const poll = () => {
        if (disposed) return;
        polls += 1;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED && polls < 40) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((nowMs) => {
        if (disposed) return;
        renderDirty = false;
        const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTimeMs) / 1000));
        lastTimeMs = nowMs;

        const rt = stageRuntimeRef.current;
        let needsMoreFrames = false;
        if (rt) {
          const yawDiff = rt.targetYaw - rt.currentYaw;
          const pitchDiff = rt.targetPitch - rt.currentPitch;
          if (Math.abs(yawDiff) > 0.0008 || Math.abs(pitchDiff) > 0.0008) {
            rt.currentYaw = THREE.MathUtils.damp(rt.currentYaw, rt.targetYaw, 11, dt);
            rt.currentPitch = THREE.MathUtils.damp(rt.currentPitch, rt.targetPitch, 10, dt);
            rt.turntable.rotation.y = rt.currentYaw;
            syncCameraFraming();
            needsMoreFrames = true;
          } else {
            rt.currentYaw = rt.targetYaw;
            rt.currentPitch = rt.targetPitch;
            rt.turntable.rotation.y = rt.currentYaw;
          }
        }

        const frameReadyCb = rt?.onNextFrameRendered ?? null;
        if (rt) {
          rt.onNextFrameRendered = null;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          frameReadyCb?.();
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    stageRuntimeRef.current = {
      turntable,
      envMap,
      currentYaw: DEFAULT_HERO_YAW,
      targetYaw: DEFAULT_HERO_YAW,
      currentPitch: DEFAULT_HERO_PITCH,
      targetPitch: DEFAULT_HERO_PITCH,
      rollMeters: 0,
      wheelRig: null,
      onNextFrameRendered: null,
      requestRender,
      syncCameraFraming,
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            syncCameraFraming();
            requestRender();
          })
        : null;
    resizeObserver?.observe(mount);

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      stageRuntimeRef.current = null;
      while (turntable.children.length > 1) {
        const prevChild = turntable.children[turntable.children.length - 1];
        prevChild.userData?.disposeMaterials?.();
        turntable.remove(prevChild);
      }
      contactShadowTex.dispose();
      contactShadowMat.dispose();
      contactShadowMesh.geometry.dispose();
      shadowFloor.geometry.dispose();
      (shadowFloor.material as THREE.Material).dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [pngOnly]);

  // Carga reactiva del modelo `.glb` cuando cambia el vehículo seleccionado (omitido en PNG-only)
  useEffect(() => {
    let cancelled = false;
    setCutoutStopIndex(0);
    setIsRotated(false);
    setWheelSplitDetected(false);

    const fallbackImg = new Image();
    fallbackImg.src = vehicle.imageUrl || getOfficialVehicleImageUrl(vehicle.id);

    if (pngOnly) {
      setGlbStatus('pending');
      return () => {
        cancelled = true;
      };
    }

    setGlbStatus('loading');

    const rt = stageRuntimeRef.current;
    if (rt) {
      rt.currentYaw = DEFAULT_HERO_YAW;
      rt.targetYaw = DEFAULT_HERO_YAW;
      rt.currentPitch = DEFAULT_HERO_PITCH;
      rt.targetPitch = DEFAULT_HERO_PITCH;
      rt.rollMeters = 0;
      rt.turntable.rotation.y = DEFAULT_HERO_YAW;
      rt.turntable.visible = false;
      rt.wheelRig = null;
      rt.onNextFrameRendered = null;
      while (rt.turntable.children.length > 1) {
        const prevChild = rt.turntable.children[rt.turntable.children.length - 1];
        prevChild.userData?.disposeMaterials?.();
        rt.turntable.remove(prevChild);
      }
      rt.syncCameraFraming();
      rt.requestRender();
    }

    resolveDedicatedVehicleGLTF(vehicle.id)
      .then((resolved) => {
        if (cancelled) return;
        const activeRt = stageRuntimeRef.current;
        if (!resolved || !activeRt) {
          setGlbStatus('pending');
          return;
        }

        while (activeRt.turntable.children.length > 1) {
          const prevChild = activeRt.turntable.children[activeRt.turntable.children.length - 1];
          prevChild.userData?.disposeMaterials?.();
          activeRt.turntable.remove(prevChild);
        }

        const instance = createCalibratedVehicle3DInstance(
          resolved.config,
          resolved.gltf,
          activeRt.envMap,
        );
        const calibratedModel = instance.children[0] as THREE.Group | undefined;
        let rig: VehicleWheelRig | null = null;
        if (calibratedModel) {
          rig = createVehicleWheelRig(calibratedModel, calibratedModel.scale.x);
          rig?.setSteeringRadians(0.21, 1);
          rig?.setDistanceMeters(0);
        }

        activeRt.onNextFrameRendered = null;
        activeRt.wheelRig = rig;
        activeRt.turntable.add(instance);
        activeRt.turntable.visible = true;
        setWheelSplitDetected(Boolean(rig && rig.wheelCount >= 4));
        activeRt.syncCameraFraming();
        activeRt.onNextFrameRendered = () => {
          if (!cancelled) {
            setGlbStatus('ready');
          }
        };
        activeRt.requestRender();
      })
      .catch(() => {
        if (!cancelled) {
          setGlbStatus('pending');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [vehicle.id, pngOnly, reloadNonce]);

  useEffect(() => {
    if (!pngOnly && glbStatus === 'ready') {
      const rt = stageRuntimeRef.current;
      rt?.syncCameraFraming();
      rt?.requestRender();
    }
  }, [pngOnly, glbStatus]);

  const resetAngle = useCallback(() => {
    setCutoutStopIndex(0);
    setIsRotated(false);
    const rt = stageRuntimeRef.current;
    if (rt) {
      rt.targetYaw = DEFAULT_HERO_YAW;
      rt.targetPitch = DEFAULT_HERO_PITCH;
      rt.rollMeters = 0;
      rt.wheelRig?.setSteeringRadians(0.21, 1);
      rt.wheelRig?.setDistanceMeters(0);
      rt.requestRender();
    }
  }, []);

  const retryGlbCheck = useCallback(() => {
    clearGlbAvailabilityCache();
    setReloadNonce((n) => n + 1);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement)?.closest('button')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      accumulatedDx: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.lastX;
    const dy = e.clientY - st.lastY;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    st.accumulatedDx += dx;

    if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) > 6) {
      setIsRotated(true);
    }

    const rt = stageRuntimeRef.current;
    if (glbStatus === 'ready' && rt) {
      rt.targetYaw += dx * 0.011;
      rt.targetPitch = THREE.MathUtils.clamp(rt.targetPitch + dy * 0.0022, -0.015, 0.22);
      rt.rollMeters += dx * 0.008;
      rt.wheelRig?.setDistanceMeters(rt.rollMeters);
      rt.wheelRig?.setSteeringRadians(THREE.MathUtils.clamp(dx * 0.025, -0.32, 0.32), 0.12);
      rt.requestRender();
      return;
    }

    if (Math.abs(st.accumulatedDx) >= 36) {
      const steps = Math.trunc(st.accumulatedDx / 36);
      st.accumulatedDx -= steps * 36;
      setCutoutStopIndex(
        (prev) => (prev - steps + CUTOUT_ORBIT_STOPS.length * 8) % CUTOUT_ORBIT_STOPS.length,
      );
    }
  };

  const endPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    st.active = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const activeCutout = useMemo(
    () => CUTOUT_ORBIT_STOPS[cutoutStopIndex] || CUTOUT_ORBIT_STOPS[0],
    [cutoutStopIndex],
  );

  const expectedGlbFile = useMemo(() => {
    const cfg = getVehicle3DConfig(vehicle.id);
    const primary = cfg?.candidateUrls?.[0] || cfg?.glbUrl || `/models/${vehicle.id}.glb`;
    return primary.replace(/^\/models\//, '');
  }, [vehicle.id]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing touch-none"
      data-glb-status={pngOnly ? 'image' : glbStatus}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      onDoubleClick={resetAngle}
      role="region"
      aria-label={`Escenario 3D de ${vehicle.brand} ${vehicle.name}. Arrastrá para girar en perspectiva 360 grados.`}
    >
      {/* Reflejos atmosféricos sobre el asfalto mojado */}
      <div
        className="dc-arena-floor-glow pointer-events-none absolute bottom-[4%] left-[10%] right-[10%] h-[24%] rounded-full opacity-90"
        aria-hidden="true"
      />

      {/* Contenedor WebGL dedicado para el modelo 3D `.glb` (omitido si pngOnly) */}
      {!pngOnly && (
        <div
          ref={canvasMountRef}
          className="absolute inset-0 z-10 pointer-events-none"
        />
      )}

      {/* Visualización de estudio PNG (siempre activa en Garage pngOnly o mientras GLB esté pendiente) */}
      {(pngOnly || glbStatus !== 'ready') && (
        <div className="relative w-full h-full flex items-end justify-center pb-[5.5%] sm:pb-[4.5%] px-4 sm:px-8 pointer-events-none z-20">
          <div
            className="dc-arena-contact-shadow absolute bottom-[4.5%] w-[76%] max-w-[640px] h-[14%] rounded-full"
            aria-hidden="true"
          />
          <img
            key={vehicle.id}
            src={vehicle.imageUrl || getOfficialVehicleImageUrl(vehicle.id)}
            alt={`${vehicle.brand} ${vehicle.name}`}
            referrerPolicy="no-referrer"
            draggable={false}
            className={`dc-arena-cutout-img relative z-10 w-auto object-contain transition-transform duration-150 ${
              compact
                ? 'max-h-[34dvh] sm:max-h-[42dvh] md:max-h-[48dvh] max-w-[88%]'
                : 'max-h-[34dvh] sm:max-h-[44dvh] lg:max-h-[52dvh] max-w-[90%]'
            } ${activeCutout.flipX ? '-scale-x-100' : ''}`}
          />
        </div>
      )}

      {/* Indicador de estado 3D GLB o Vista WebP/PNG Estudio y controles discretos */}
      <div className="absolute top-2 right-2 sm:right-6 z-30 flex flex-wrap items-center justify-end gap-1.5">
        {pngOnly ? (
          imageBadgeLabel ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#06141d]/90 border border-[#00E5F5]/40 text-[10px] font-bold uppercase tracking-wider text-cyan-200 whitespace-nowrap">
              <span>{imageBadgeLabel}</span>
            </span>
          ) : null
        ) : glbStatus === 'ready' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#06141d]/90 border border-[#00E5F5]/45 text-[10px] font-bold uppercase tracking-wider text-[#00E5F5] whitespace-nowrap">
            <Box size={11} />
            <span>3D GLB{wheelSplitDetected ? ' · Ruedas Split' : ''}</span>
          </span>
        ) : glbStatus === 'loading' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#06141d]/90 border border-[#00E5F5]/35 text-[10px] font-bold uppercase tracking-wider text-cyan-200 whitespace-nowrap">
            <Box size={11} />
            <span>Cargando 3D GLB…</span>
          </span>
        ) : glbStatus === 'pending' ? (
          <button
            type="button"
            onClick={retryGlbCheck}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#06141d]/90 border border-amber-400/45 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:border-amber-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title={`Archivo public/models/${expectedGlbFile} aún no cargado · Mostrando imagen oficial. Clic para volver a comprobar.`}
          >
            <RefreshCw size={11} />
            <span className="hidden sm:inline">Sin {expectedGlbFile} · Vista WebP</span>
            <span className="sm:hidden">Vista WebP</span>
          </button>
        ) : null}

        {isRotated && (
          <button
            type="button"
            onClick={resetAngle}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#061219]/90 border border-[#00E5F5]/45 text-[10px] font-bold uppercase tracking-wider text-[#00E5F5] hover:border-[#00E5F5] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Restablecer ángulo protagonista"
          >
            <RotateCcw size={12} />
            <span>Vista 3/4</span>
          </button>
        )}

        {onOpen360Modal && (
          <button
            type="button"
            onClick={() => onOpen360Modal(vehicle.id)}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#061219]/85 border border-slate-500/40 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-[#00E5F5]/60 hover:text-[#00E5F5] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Visor 360°</span>
          </button>
        )}
      </div>
    </div>
  );
};
