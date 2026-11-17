import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { PRESET_VEHICLES } from '../data/presetVehicles';
import {
  OFFICIAL_V18_GLB_URLS,
  VEHICLE_3D_REGISTRY,
  validateVehicleModelRegistry,
} from './vehicleModelRegistry';
import {
  clearGlbAvailabilityCache,
  clearVehicleModelDiagnostics,
  configureVehicleModelLoader,
  createCalibratedVehicle3DInstance,
  getVehicleModelDiagnostic,
  getVehicleModelLoaderConfig,
  loadVehicleGLTF,
  probeGlbUrlAvailable,
  resetVehicleModelLoaderConfig,
  resolveDedicatedVehicleGLTF,
} from './vehicle3DModelLoader';
import { createVehicleWheelRig } from './vehicleWheelRig';
import { createVehicleEntity } from './vehicle3DEntity';
import { shouldUseLightweightProceduralVehicle } from './mobilePerformanceProfile';

function installNodeDomAndImageStubs(): () => void {
  const g = globalThis as unknown as {
    self?: unknown;
    document?: unknown;
    Image?: unknown;
    createImageBitmap?: unknown;
  };
  const prevSelf = g.self;
  const prevDocument = g.document;
  const prevImage = g.Image;
  const prevCreateImageBitmap = g.createImageBitmap;
  g.self = globalThis;

  const noop = () => {};
  const makeGrad = () => ({ addColorStop: noop });
  const make2dCtx = () =>
    new Proxy(
      {
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        font: '12px sans-serif',
        textAlign: 'center',
        textBaseline: 'middle',
        globalAlpha: 1,
        createLinearGradient: makeGrad,
        createRadialGradient: makeGrad,
        measureText: (txt: string) => ({ width: String(txt).length * 6 }),
        createImageData: (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
        }),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
        }),
      },
      {
        get(target, prop) {
          if (prop in target) return (target as Record<PropertyKey, unknown>)[prop];
          return noop;
        },
        set(target, prop, value) {
          (target as Record<PropertyKey, unknown>)[prop] = value;
          return true;
        },
      },
    );

  const makeMockImg = () => {
    const listeners = new Map<string, Array<() => void>>();
    const img: Record<string, unknown> = {
      width: 64,
      height: 64,
      naturalWidth: 64,
      naturalHeight: 64,
      complete: true,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      addEventListener(type: string, cb: () => void) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type)!.push(cb);
      },
      removeEventListener(type: string, cb: () => void) {
        const arr = listeners.get(type);
        if (!arr) return;
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
      },
    };
    let currentSrc = '';
    Object.defineProperty(img, 'src', {
      get: () => currentSrc,
      set: (val: string) => {
        currentSrc = val;
        queueMicrotask(() => {
          if (typeof img.onload === 'function') (img.onload as () => void)();
          for (const cb of listeners.get('load') ?? []) cb();
        });
      },
    });
    return img;
  };

  g.document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 64,
          height: 64,
          getContext: () => make2dCtx(),
          toDataURL: () => 'data:image/png;base64,',
        };
      }
      if (tag === 'img') return makeMockImg();
      return {};
    },
    createElementNS: (_ns: string, tag: string) => {
      if (tag === 'img') return makeMockImg();
      if (tag === 'canvas') {
        return {
          width: 64,
          height: 64,
          getContext: () => make2dCtx(),
        };
      }
      return {};
    },
  };

  g.createImageBitmap = async () => ({
    width: 64,
    height: 64,
    close: noop,
  });

  return () => {
    if (prevSelf === undefined) delete g.self;
    else g.self = prevSelf;
    if (prevDocument === undefined) delete g.document;
    else g.document = prevDocument;
    if (prevImage === undefined) delete g.Image;
    else g.Image = prevImage;
    if (prevCreateImageBitmap === undefined) delete g.createImageBitmap;
    else g.createImageBitmap = prevCreateImageBitmap;
  };
}

function parseGlbBufferInNode(buf: Buffer): Promise<GLTF> {
  const loader = new GLTFLoader();
  const ab: ArrayBuffer = new Uint8Array(buf).buffer;
  return new Promise<GLTF>((resolve, reject) => {
    loader.parse(ab, '/models/', resolve, reject);
  });
}

test('V18 §1: Registro de los 8 modelos GLB oficiales válido y auto del jugador usa siempre su GLB definitivo en escritorio y móvil', () => {
  const entries = validateVehicleModelRegistry();
  assert.equal(entries.length, 7, 'Deben validarse los 7 vehículos conducibles del catálogo');
  for (const entry of entries) {
    assert.equal(entry.valid, true, `Configuración inválida para ${entry.vehicleId}`);
  }
  assert.equal(OFFICIAL_V18_GLB_URLS.length, 8, 'Deben figurar los 8 modelos GLB principales de V18');
  assert.ok(OFFICIAL_V18_GLB_URLS.includes('/models/tracker-rs-wheels.glb'));
  assert.ok(
    OFFICIAL_V18_GLB_URLS.includes(
      '/models/Meshy_AI_Convertible_1966_thun_1115235921_texture.glb',
    ),
  );

  for (const car of PRESET_VEHICLES) {
    assert.equal(
      shouldUseLightweightProceduralVehicle({
        isMobilePerf: false,
        experience: 'race',
        vehicleId: car.id,
        playerVehicleId: car.id,
      }),
      false,
      `Escritorio debe usar GLB definitivo para ${car.id}`,
    );
    assert.equal(
      shouldUseLightweightProceduralVehicle({
        isMobilePerf: true,
        experience: 'race',
        vehicleId: car.id,
        playerVehicleId: car.id,
      }),
      false,
      `Móvil debe usar GLB definitivo para el auto elegido (${car.id})`,
    );
  }
});

test('V18 §1: Timeouts configurables, respaldo Range ante HEAD bloqueado, reintentos sin bloqueo permanente y progreso real en bytes', async () => {
  const restoreDom = installNodeDomAndImageStubs();
  const prevFetch = globalThis.fetch;
  const gForce = globalThis as { __DATACAR_FORCE_FETCH_IN_NODE__?: boolean };
  gForce.__DATACAR_FORCE_FETCH_IN_NODE__ = true;

  const limoBytes = fs.readFileSync(
    path.resolve(process.cwd(), 'public/models/presidential-limousine.glb'),
  );

  try {
    clearGlbAvailabilityCache(true);
    clearVehicleModelDiagnostics();
    configureVehicleModelLoader({
      headTimeoutMs: 1200,
      loadTimeoutMs: 4000,
      maxRetries: 2,
      retryBaseDelayMs: 25,
      negativeCacheTtlMs: 5000,
    });
    assert.equal(getVehicleModelLoaderConfig().headTimeoutMs, 1200);
    assert.equal(getVehicleModelLoaderConfig().maxRetries, 2);

    // Escenario A: HEAD devuelve 405, pero GET Range entrega cabecera mágica glTF ("glTF")
    let rangeCalled = false;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 405 });
      }
      const headers = new Headers(init?.headers);
      if (headers.get('Range')) {
        rangeCalled = true;
        return new Response(limoBytes.subarray(0, 20), {
          status: 206,
          headers: { 'content-type': 'model/gltf-binary' },
        });
      }
      return new Response(limoBytes, {
        status: 200,
        headers: {
          'content-type': 'model/gltf-binary',
          'content-length': String(limoBytes.byteLength),
        },
      });
    }) as typeof fetch;

    const availableViaRange = await probeGlbUrlAvailable('/models/nissan-kicks-2027.glb');
    assert.equal(availableViaRange, true);
    assert.equal(rangeCalled, true, 'Debe verificar por GET Range cuando HEAD devuelve 405');

    // Escenario B: Error temporal (503 / red lenta) NO bloquea permanentemente el vehículo;
    // los reintentos controlados descargan el GLB en streaming y emiten progreso real en bytes
    clearGlbAvailabilityCache(true);
    let getAttempts = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { 'content-type': 'model/gltf-binary' },
        });
      }
      getAttempts += 1;
      if (getAttempts === 1) {
        return new Response('Gateway Timeout', { status: 503 });
      }
      const half = Math.floor(limoBytes.byteLength / 2);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(limoBytes.subarray(0, half)));
          controller.enqueue(new Uint8Array(limoBytes.subarray(half)));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'model/gltf-binary',
          'content-length': String(limoBytes.byteLength),
        },
      });
    }) as typeof fetch;

    const progressEvents: Array<[number, number]> = [];
    const loadedGltf = await loadVehicleGLTF(
      '/models/kia-carens-ex.glb',
      (loaded, total) => progressEvents.push([loaded, total]),
      { vehicleId: 'kia-carens-ex' },
    );

    assert.ok(loadedGltf.scene, 'Debe decodificar la escena GLTF tras reintento controlado');
    assert.equal(getAttempts, 2, 'Debe recuperarse en el segundo intento tras fallo temporal 503');
    assert.ok(progressEvents.length >= 2, 'Debe emitir múltiples eventos de progreso en streaming');
    assert.equal(
      progressEvents[progressEvents.length - 1][0],
      limoBytes.byteLength,
      'El progreso final debe coincidir con el tamaño total en bytes del GLB',
    );
    const diag = getVehicleModelDiagnostic('kia-carens-ex');
    assert.equal(diag?.stage, 'decoded');
    assert.equal(diag?.progressPercent, 100);
    assert.equal(diag?.attempts, 2);

    // Escenario C: chevrolet-tracker-lite prioriza /models/tracker-rs-wheels.glb cuando está disponible en servidor
    clearGlbAvailabilityCache(true);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.includes('tracker-rs-wheels.glb')) {
        if (init?.method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: { 'content-type': 'model/gltf-binary' },
          });
        }
        return new Response(limoBytes, {
          status: 200,
          headers: {
            'content-type': 'model/gltf-binary',
            'content-length': String(limoBytes.byteLength),
          },
        });
      }
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
    }) as typeof fetch;

    const resolvedTracker = await resolveDedicatedVehicleGLTF('chevrolet-tracker-lite');
    assert.ok(resolvedTracker);
    assert.equal(
      resolvedTracker.url,
      '/models/tracker-rs-wheels.glb',
      'Chevrolet Tracker debe priorizar tracker-rs-wheels.glb con ruedas separadas cuando existe en Vercel/GitHub',
    );
  } finally {
    delete gForce.__DATACAR_FORCE_FETCH_IN_NODE__;
    globalThis.fetch = prevFetch;
    resetVehicleModelLoaderConfig();
    clearGlbAvailabilityCache(true);
    restoreDom();
  }
});

test('V18 §2: Las 4 ruedas giran hacia adelante al avanzar (+Z), invierten giro en reversa (-Z), paran en 0 m/s y doblan delante sin anular la rodadura', () => {
  const restoreDom = installNodeDomAndImageStubs();
  try {
    // Probar AMBAS orientaciones de exportación GLB:
    // 1) Z-longitudinal (rotationY = 0)
    // 2) X-longitudinal (rotationY = +Math.PI / 2, usada por Meshy / Corolla Cross / Tracker)
    for (const exportAxis of ['Z_LONGITUDINAL', 'X_LONGITUDINAL'] as const) {
      const container = new THREE.Group();
      const calibratedModel = new THREE.Group();
      if (exportAxis === 'X_LONGITUDINAL') {
        calibratedModel.rotation.y = Math.PI / 2;
      }
      calibratedModel.scale.setScalar(1);
      container.add(calibratedModel);

      const bodyGeo =
        exportAxis === 'X_LONGITUDINAL'
          ? new THREE.BoxGeometry(4.3, 1.1, 1.78)
          : new THREE.BoxGeometry(1.78, 1.1, 4.3);
      const bodyMesh = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial());
      bodyMesh.name = 'model_part0';
      bodyMesh.position.set(0, 0.85, 0);
      calibratedModel.add(bodyMesh);

      const wheelRadius = 0.36;
      const wheelSpots =
        exportAxis === 'X_LONGITUDINAL'
          ? [
              // Con rotation.y = +PI/2: local -X -> +Z (frente), local +Z -> +X (izquierda)
              { name: 'model_part1', pos: [-1.32, wheelRadius, 0.82] }, // FL
              { name: 'model_part2', pos: [-1.32, wheelRadius, -0.82] }, // FR
              { name: 'model_part3', pos: [1.32, wheelRadius, 0.82] }, // RL
              { name: 'model_part4', pos: [1.32, wheelRadius, -0.82] }, // RR
            ]
          : [
              { name: 'Wheel_FL', pos: [0.82, wheelRadius, 1.32] },
              { name: 'Wheel_FR', pos: [-0.82, wheelRadius, 1.32] },
              { name: 'Wheel_RL', pos: [0.82, wheelRadius, -1.32] },
              { name: 'Wheel_RR', pos: [-0.82, wheelRadius, -1.32] },
            ];

      for (const w of wheelSpots) {
        const wGeo =
          exportAxis === 'X_LONGITUDINAL'
            ? new THREE.BoxGeometry(wheelRadius * 2, wheelRadius * 2, 0.24)
            : new THREE.BoxGeometry(0.24, wheelRadius * 2, wheelRadius * 2);
        const wMesh = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial());
        wMesh.name = w.name;
        wMesh.position.set(w.pos[0], w.pos[1], w.pos[2]);
        calibratedModel.add(wMesh);
      }

      const rig = createVehicleWheelRig(calibratedModel, 1);
      assert.ok(rig, `Debe crearse rig válido para ${exportAxis}`);
      assert.equal(rig.wheelCount, 4);

      const states0 = rig.getWheelStates!();
      assert.equal(states0.length, 4);

      // Marcar un punto físico en la CIMA (+Y del espacio vehículo) de cada rueda y verificar su movimiento mundial:
      // Al avanzar un pequeño paso positivo (+0.08 m), la cima de las 4 ruedas DEBE desplazarse hacia +Z (adelante).
      container.updateMatrixWorld(true);
      const topWorldAtZero = new Map<string, THREE.Vector3>();
      for (const st of states0) {
        const pivotWorld = st.rollingPivot.getWorldPosition(new THREE.Vector3());
        const topWorld = pivotWorld.clone().add(new THREE.Vector3(0, wheelRadius, 0));
        const localTop = st.rollingPivot.worldToLocal(topWorld.clone());
        st.rollingPivot.userData.localTopMarker = localTop;
        topWorldAtZero.set(st.id, topWorld);
      }

      // 2.1 Avance hacia adelante (+0.08 m): ω = d / r
      rig.setDistanceMeters(0.08);
      container.updateMatrixWorld(true);
      for (const st of rig.getWheelStates!()) {
        const movedTop = st.rollingPivot.localToWorld(
          (st.rollingPivot.userData.localTopMarker as THREE.Vector3).clone(),
        );
        const zeroTop = topWorldAtZero.get(st.id)!;
        assert.ok(
          movedTop.z > zeroTop.z + 0.04,
          `[${exportAxis} ${st.id}] Al avanzar, la cima del neumático debe moverse hacia +Z (antes=${zeroTop.z.toFixed(4)}, ahora=${movedTop.z.toFixed(4)})`,
        );
        assert.ok(Math.abs(st.rollAngleRad - 0.08 / st.radiusMeters) < 1e-6);
      }

      // 2.2 Marcha atrás (-0.08 m): sentido exactamente inverso (cima hacia -Z)
      rig.setDistanceMeters(-0.08);
      container.updateMatrixWorld(true);
      for (const st of rig.getWheelStates!()) {
        const movedTop = st.rollingPivot.localToWorld(
          (st.rollingPivot.userData.localTopMarker as THREE.Vector3).clone(),
        );
        const zeroTop = topWorldAtZero.get(st.id)!;
        assert.ok(
          movedTop.z < zeroTop.z - 0.04,
          `[${exportAxis} ${st.id}] En reversa, la cima del neumático debe moverse hacia -Z (antes=${zeroTop.z.toFixed(4)}, ahora=${movedTop.z.toFixed(4)})`,
        );
      }

      // 2.3 Dirección delantera + rotación simultánea; traseras sin ángulo de dirección
      rig.setSteeringRadians(0.35, 1.0);
      rig.setDistanceMeters(2.4);
      const steeredStates = rig.getWheelStates!();
      for (const st of steeredStates) {
        if (st.front) {
          assert.ok(Math.abs(st.steerAngleRad - 0.35) < 1e-4, `${st.id} debe girar dirección`);
        } else {
          assert.equal(st.steerAngleRad, 0, `${st.id} trasera no debe girar dirección`);
        }
        assert.ok(st.rollAngleRad > 4, `${st.id} debe seguir rodando mientras dobla`);
      }

      // Retorno suave al centro al soltar dirección
      for (let i = 0; i < 30; i++) {
        rig.setSteeringRadians(0, 1 / 60);
      }
      for (const st of rig.getWheelStates!()) {
        assert.ok(Math.abs(st.steerAngleRad) < 0.005, `${st.id} debe volver suavemente a 0 rad`);
      }

      // 2.5 Suspensión por esquina
      const prevFLPivotY = rig.getWheelStates!().find((s) => s.id === 'FL')!.pivotY;
      rig.setSuspensionContact({ FL: 0.09, FR: 0, RL: 0, RR: 0 }, 0, 0, 0, 0.5);
      const nextFLPivotY = rig.getWheelStates!().find((s) => s.id === 'FL')!.pivotY;
      assert.ok(nextFLPivotY > prevFLPivotY + 0.02, 'FL debe acompañar el desnivel del asfalto');

      rig.dispose?.();
    }

    // Verificar integración con VehicleEntityRunner: velocidad proporcional, parada total, reversa y bloqueo de freno
    const entity = createVehicleEntity(
      PRESET_VEHICLES[0],
      0,
      1,
      undefined,
      undefined,
      null,
      undefined,
      { preferProceduralModel: true },
    );
    const cam = new THREE.Vector3(0, 2, -6);
    const rig = entity.getWheelRig!()!;
    assert.equal(rig.wheelCount, 4);

    // Parado (0 m/s): 0 rotación
    entity.updateState(10, 0, 0, false, cam, false, 0, 0.1, {
      x: 0,
      z: 10,
      yaw: 0,
      slip: 0,
      bump: 0,
      signedSpeedMps: 0,
    });
    const rollStopped = rig.getWheelStates!()[0].rollAngleRad;
    assert.equal(rollStopped, 0);

    // Baja velocidad (5 m/s durante 0.1 s) vs alta velocidad (25 m/s durante 0.1 s)
    entity.updateState(10.5, 18, 0.1, false, cam, false, 0, 0.1, {
      x: 0,
      z: 10.5,
      yaw: 0,
      slip: 0,
      bump: 0,
      signedSpeedMps: 5,
    });
    const rollSlow = rig.getWheelStates!()[0].rollAngleRad;
    assert.ok(rollSlow > 0);

    entity.updateState(13.0, 90, 0.2, false, cam, false, 0, 0.1, {
      x: 0,
      z: 13.0,
      yaw: 0,
      slip: 0,
      bump: 0,
      signedSpeedMps: 25,
    });
    const rollFastDelta = rig.getWheelStates!()[0].rollAngleRad - rollSlow;
    assert.ok(
      Math.abs(rollFastDelta / rollSlow - 5) < 0.05,
      `A 5x mayor velocidad, el incremento angular debe ser 5x mayor (lento=${rollSlow}, rápido=${rollFastDelta})`,
    );

    // Reversa (-8 m/s durante 0.5 s): ángulo disminuye (gira hacia atrás)
    const beforeReverse = rig.getWheelStates!()[0].rollAngleRad;
    entity.updateState(9.0, 28.8, 0, false, cam, false, 0, 0.5, {
      x: 0,
      z: 9.0,
      yaw: 0,
      slip: 0,
      bump: 0,
      signedSpeedMps: -8,
    });
    const afterReverse = rig.getWheelStates!()[0].rollAngleRad;
    assert.ok(
      afterReverse < beforeReverse - 5,
      `En marcha atrás las ruedas deben girar en sentido inverso (${afterReverse} < ${beforeReverse})`,
    );

    // Frenada con bloqueo severo (wheelLock = 1): reduce drásticamente el giro respecto a rodadura libre
    const beforeLock = rig.getWheelStates!()[0].rollAngleRad;
    entity.updateState(11.0, 72, -0.8, true, cam, false, 0, 0.1, {
      x: 0,
      z: 11.0,
      yaw: 0,
      slip: 0.4,
      bump: 0,
      signedSpeedMps: 20,
      wheelLock: 1.0,
      brakeSlip: 0.9,
      absActive: false,
    });
    const lockedDelta = rig.getWheelStates!()[0].rollAngleRad - beforeLock;
    const freeRollDeltaAt20 = (20 * 0.1) / rig.getWheelStates!()[0].radiusMeters;
    assert.ok(
      lockedDelta < freeRollDeltaAt20 * 0.25,
      `Con rueda bloqueada el giro debe caer drásticamente (${lockedDelta} << ${freeRollDeltaAt20})`,
    );

    entity.dispose();
  } finally {
    restoreDom();
  }
});

test('V18 §2.6: Inspección y rig real sobre los 3 binarios .glb locales (Corolla Cross multi-malla, Limusina multi-primitiva y Tracker malla única separada)', async () => {
  const restoreDom = installNodeDomAndImageStubs();
  try {
    // 1. presidential-limousine.glb (nodos Wheel_FL/FR/RL/RR con 2 primitivas cada uno: neumático + llanta)
    const limoBuf = fs.readFileSync(
      path.resolve(process.cwd(), 'public/models/presidential-limousine.glb'),
    );
    const limoGltf = await parseGlbBufferInNode(limoBuf);
    const limoCalibrated = createCalibratedVehicle3DInstance(
      {
        ...VEHICLE_3D_REGISTRY['toyota-corolla-cross-seg-2027'],
        modelId: 'presidential-limousine',
        targetLengthMeters: 5.45,
        rotationY: 0,
      },
      limoGltf,
    );
    const limoInner = limoCalibrated.children[0] as THREE.Group;
    const limoRig = createVehicleWheelRig(limoInner, limoInner.scale.x);
    assert.ok(limoRig, 'presidential-limousine.glb debe generar rig de 4 ruedas');
    assert.equal(limoRig.wheelCount, 4);
    assert.equal(limoRig.mode, 'native_nodes');

    // 2. toyota-corolla-cross-seg-2027-light.glb (8 mallas: model_part0 carrocería + 7 sub-mallas de rueda en las 4 esquinas)
    const corollaBuf = fs.readFileSync(
      path.resolve(process.cwd(), 'public/models/toyota-corolla-cross-seg-2027-light.glb'),
    );
    const corollaGltf = await parseGlbBufferInNode(corollaBuf);
    const corollaCfg = VEHICLE_3D_REGISTRY['toyota-corolla-cross-seg-2027'];
    const corollaCalibrated = createCalibratedVehicle3DInstance(corollaCfg, corollaGltf);
    corollaCalibrated.updateMatrixWorld(true);
    const corollaBox = new THREE.Box3().setFromObject(corollaCalibrated);
    assert.ok(Math.abs(corollaBox.min.y) < 0.02, `Corolla Cross debe apoyar en Y≈0 (${corollaBox.min.y})`);
    assert.ok(
      Math.abs(corollaBox.max.z - corollaBox.min.z - 4.46) < 0.08,
      'Corolla Cross debe calibrarse a ~4.46m en eje Z',
    );

    const corollaInner = corollaCalibrated.children[0] as THREE.Group;
    const corollaRig = createVehicleWheelRig(corollaInner, corollaInner.scale.x);
    assert.ok(corollaRig, 'toyota-corolla-cross-seg-2027-light.glb debe generar rig de 4 ruedas');
    assert.equal(corollaRig.wheelCount, 4);
    assert.equal(corollaRig.mode, 'native_nodes');

    // 3. tracker-rs.glb (1 malla única soldada output_unwrapped -> separación cilíndrica segura de las 4 ruedas + guardaplast)
    const trackerBuf = fs.readFileSync(
      path.resolve(process.cwd(), 'public/models/tracker-rs.glb'),
    );
    const trackerGltf = await parseGlbBufferInNode(trackerBuf);
    const trackerCfg = VEHICLE_3D_REGISTRY['chevrolet-tracker-lite'];
    const trackerCalibrated = createCalibratedVehicle3DInstance(trackerCfg, trackerGltf);
    trackerCalibrated.updateMatrixWorld(true);
    const trackerBox = new THREE.Box3().setFromObject(trackerCalibrated);
    assert.ok(Math.abs(trackerBox.min.y) < 0.02, `Tracker debe apoyar en Y≈0 (${trackerBox.min.y})`);

    const trackerInner = trackerCalibrated.children[0] as THREE.Group;
    const trackerRig = createVehicleWheelRig(trackerInner, trackerInner.scale.x);
    assert.ok(trackerRig, 'tracker-rs.glb (malla única) debe separar y animar sus 4 ruedas');
    assert.equal(trackerRig.wheelCount, 4);
    assert.equal(trackerRig.mode, 'separated_submesh');

    trackerRig.setDistanceMeters(1.5);
    trackerRig.setSteeringRadians(0.28, 1.0);
    const trackerStates = trackerRig.getWheelStates!();
    assert.ok(trackerStates.every((s) => s.rollAngleRad > 3));
    assert.ok(trackerStates.filter((s) => s.front).every((s) => Math.abs(s.steerAngleRad - 0.28) < 1e-4));
    assert.ok(trackerStates.filter((s) => !s.front).every((s) => s.steerAngleRad === 0));

    limoRig.dispose?.();
    corollaRig.dispose?.();
    trackerRig.dispose?.();
  } finally {
    restoreDom();
  }
});
