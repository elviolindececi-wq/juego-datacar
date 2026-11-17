import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Vehicle } from '../types/vehicle';
import { getOfficialVehicleImageUrl } from '../data/presetVehicles';
import {
  createCalibratedVehicle3DInstance,
  resolveDedicatedVehicleGLTF,
} from '../utils/vehicle3DModelLoader';
import { createFaithfulVehicle3D } from '../utils/faithfulVehicleChassis3D';
import {
  acquireSharedComparatorRenderer,
  optimizeModelTexturesForComparator,
} from '../utils/comparatorSharedWebGL';
import { detectMobilePerformanceMode } from '../utils/mobilePerformanceProfile';

interface ComparatorDual3DStageProps {
  vehicles: [Vehicle, Vehicle];
  className?: string;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSingleBayScene(envMap: THREE.Texture, accentHex: number): {
  scene: THREE.Scene;
  turntable: THREE.Group;
  carSlot: THREE.Group;
} {
  const scene = new THREE.Scene();
  scene.environment = envMap;

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x09131f, 1.15);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.35);
  keyLight.position.set(4.2, 6.4, 5.2);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(accentHex, 1.4);
  rimLight.position.set(-4.5, 2.8, -4.2);
  scene.add(rimLight);

  const turntable = new THREE.Group();
  turntable.rotation.y = -0.58;
  scene.add(turntable);

  // Anillo de podio liviano + sombra de contacto suave (0 sombras proyectadas pesadas)
  const ringGeo = new THREE.RingGeometry(2.15, 2.26, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  turntable.add(ring);

  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.5),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  turntable.add(shadowDisc);

  const carSlot = new THREE.Group();
  turntable.add(carSlot);

  return { scene, turntable, carSlot };
}

/**
 * Escenario 3D dual optimizado para el Comparador:
 * Renderiza Auto A y Auto B lado a lado reutilizando UN ÚNICO `THREE.WebGLRenderer`
 * mediante `setScissorTest(true)` + texturas reducidas (`512px` en mobile) + `THREE.Cache.enabled = true`.
 */
export const ComparatorDual3DStage: React.FC<ComparatorDual3DStageProps> = ({
  vehicles,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [loadingCount, setLoadingCount] = useState(2);

  const [carA, carB] = vehicles;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const shared = acquireSharedComparatorRenderer();
    if (!shared) {
      setWebglFailed(true);
      return;
    }

    const { renderer, envMap, isSoftwareRenderer } = shared;
    const isMobile = detectMobilePerformanceMode();
    const maxTexDim = isMobile || isSoftwareRenderer ? 512 : 1024;
    const dpr = isSoftwareRenderer
      ? 1
      : Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.65);

    renderer.setPixelRatio(dpr);
    const dom = renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    dom.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(dom);

    const bayA = createSingleBayScene(envMap, 0x00e5f5);
    const bayB = createSingleBayScene(envMap, 0xffaa12);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.2, 45);
    camera.position.set(0, 1.85, 6.9);
    camera.lookAt(0, 0.68, 0);

    let disposed = false;
    let needsDraw = true;
    let isDragging = false;
    let prevX = 0;
    let spinVelocity = 0.004;

    const syncSize = () => {
      const w = Math.max(240, container.clientWidth || 320);
      const h = Math.max(160, container.clientHeight || 220);
      renderer.setSize(w, h, false);
      needsDraw = true;
    };
    syncSize();

    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    const disposers: Array<() => void> = [];

    const populateVehicleSlot = async (vehicle: Vehicle, slot: THREE.Group) => {
      // Mostrar silueta 3D fiel inmediata mientras el GLB cacheado resuelve (0 pantalla vacía)
      const procedural = createFaithfulVehicle3D(vehicle);
      let proceduralDisposed = false;
      const disposeProcedural = () => {
        if (!proceduralDisposed) {
          proceduralDisposed = true;
          procedural.dispose();
        }
      };
      disposers.push(disposeProcedural);
      slot.add(procedural.group);
      needsDraw = true;

      try {
        const resolved = await resolveDedicatedVehicleGLTF(vehicle.id);
        if (disposed || !resolved) return;
        const instance = createCalibratedVehicle3DInstance(
          resolved.config,
          resolved.gltf,
          envMap,
        );
        optimizeModelTexturesForComparator(instance, maxTexDim);
        slot.clear();
        disposeProcedural();
        slot.add(instance);
        disposers.push(() => {
          instance.userData?.disposeMaterials?.();
        });
        needsDraw = true;
      } catch {
        // Conserva el modelo procedural 3D si falla la red
      }
    };

    setLoadingCount(2);
    Promise.all([
      populateVehicleSlot(carA, bayA.carSlot).finally(() => {
        if (!disposed) setLoadingCount((c) => Math.max(0, c - 1));
      }),
      populateVehicleSlot(carB, bayB.carSlot).finally(() => {
        if (!disposed) setLoadingCount((c) => Math.max(0, c - 1));
      }),
    ]);

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      spinVelocity = 0;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        // Ignorar si el puntero ya se liberó
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      bayA.turntable.rotation.y += dx * 0.011;
      bayB.turntable.rotation.y += dx * 0.011;
      needsDraw = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      spinVelocity = 0.0035;
      try {
        if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);

    let rafId = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const frameIntervalMs = isSoftwareRenderer ? 90 : isMobile ? 33 : 16;

    const renderDualView = () => {
      if (disposed) return;
      if (!isDragging && Math.abs(spinVelocity) > 0.0001) {
        bayA.turntable.rotation.y += spinVelocity;
        bayB.turntable.rotation.y += spinVelocity;
        if (isSoftwareRenderer) {
          // En renderizador por software rotamos suavemente unos cuadros y descansamos bajo demanda
          spinVelocity *= 0.78;
        }
        needsDraw = true;
      }

      if (needsDraw) {
        needsDraw = false;
        const w = Math.max(240, container.clientWidth || 320);
        const h = Math.max(160, container.clientHeight || 220);
        const halfW = Math.floor(w / 2);

        renderer.setScissorTest(true);

        // Mitad izquierda: Auto A
        const aspectA = Math.max(0.45, halfW / h);
        const camZLeft = aspectA < 1.05 ? 6.9 + (1.05 - aspectA) * 5.2 : 6.9;
        camera.position.set(0, 1.85, camZLeft);
        camera.lookAt(0, 0.65, 0);
        camera.aspect = aspectA;
        camera.updateProjectionMatrix();
        renderer.setViewport(0, 0, halfW, h);
        renderer.setScissor(0, 0, halfW, h);
        renderer.clear();
        renderer.render(bayA.scene, camera);

        // Mitad derecha: Auto B
        const rightW = w - halfW;
        const aspectB = Math.max(0.45, rightW / h);
        const camZRight = aspectB < 1.05 ? 6.9 + (1.05 - aspectB) * 5.2 : 6.9;
        camera.position.set(0, 1.85, camZRight);
        camera.lookAt(0, 0.65, 0);
        camera.aspect = aspectB;
        camera.updateProjectionMatrix();
        renderer.setViewport(halfW, 0, rightW, h);
        renderer.setScissor(halfW, 0, rightW, h);
        renderer.render(bayB.scene, camera);

        renderer.setScissorTest(false);
      }

      timerId = setTimeout(() => {
        rafId = requestAnimationFrame(renderDualView);
      }, frameIntervalMs);
    };

    rafId = requestAnimationFrame(renderDualView);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (timerId !== null) clearTimeout(timerId);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      renderer.setScissorTest(false);
      disposers.forEach((fn) => fn());
      if (dom.parentElement === container) {
        container.removeChild(dom);
      }
    };
  }, [carA, carB]);

  if (webglFailed) {
    return (
      <div className={`grid grid-cols-2 gap-3 rounded-2xl border border-cyan-500/35 bg-[#05101c] p-3 ${className}`}>
        {[carA, carB].map((v, idx) => (
          <div key={v.id} className="flex flex-col items-center justify-center p-2 text-center">
            <span className="text-[10px] font-mono font-black uppercase text-cyan-300">
              {idx === 0 ? 'AUTO A' : 'AUTO B'}
            </span>
            <img
              src={v.imageUrl || getOfficialVehicleImageUrl(v.id)}
              alt={`${v.brand} ${v.name}`}
              className="h-28 object-contain"
            />
            <strong className="mt-1 font-display text-sm font-black uppercase text-white">
              {v.brand} {v.name}
            </strong>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="comparator-dual-3d-stage"
      className={`relative w-full h-52 sm:h-64 rounded-2xl border border-cyan-400/40 bg-gradient-to-b from-[#081b2c] to-[#040b14] overflow-hidden select-none ${className}`}
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute inset-y-3 left-1/2 w-px bg-gradient-to-b from-transparent via-cyan-400/45 to-transparent" />
      <div className="pointer-events-none absolute top-2 left-2.5 rounded-lg border border-cyan-400/45 bg-[#04101d]/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-200">
        A · {carA.brand} {carA.name}
      </div>
      <div className="pointer-events-none absolute top-2 right-2.5 rounded-lg border border-amber-400/55 bg-[#171105]/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200">
        B · {carB.brand} {carB.name}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-cyan-400/35 bg-[#030914]/92 px-3 py-1 text-[10px] font-mono font-bold text-slate-200 whitespace-nowrap flex items-center gap-2 shadow-lg">
        {loadingCount > 0 ? (
          <>
            <span
              className="inline-block h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0"
              aria-hidden="true"
            />
            <span>Cargando modelos 3D ({2 - loadingCount}/2)…</span>
            <span className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-slate-800 border border-slate-700">
              <span
                className="block h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${Math.max(20, ((2 - loadingCount) / 2) * 100)}%` }}
              />
            </span>
          </>
        ) : (
          <span>Arrastrá para girar ambos autos en 360°</span>
        )}
      </div>
    </div>
  );
};
