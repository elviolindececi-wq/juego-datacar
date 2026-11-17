import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

import { PRESET_VEHICLES } from '../data/presetVehicles';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits';
import { InteractiveRacePhysics } from './interactiveRacePhysics';
import { evaluateAdasHudReadout } from './adasPresentationAudit';
import {
  getWenoBankMissionForCircuit,
  evaluateWenoBankRaceProgress,
} from './wenoBankMissions';
import {
  VEHICLE_3D_REGISTRY,
  BUNDLED_DEDICATED_GLB_URLS,
} from './vehicleModelRegistry';
import { createVehicleEntity } from './vehicle3DEntity';

const rootDir = process.cwd();

if (typeof globalThis.document === 'undefined') {
  const make2dCtx = () =>
    new Proxy(
      {
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        font: '10px sans-serif',
        textAlign: 'center',
        textBaseline: 'middle',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        measureText: (txt: string) => ({ width: String(txt).length * 6 }),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
      },
      {
        get(target, prop) {
          if (prop in target) return (target as Record<PropertyKey, unknown>)[prop];
          return () => {};
        },
        set(target, prop, value) {
          (target as Record<PropertyKey, unknown>)[prop] = value;
          return true;
        },
      },
    );
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 64,
          height: 64,
          getContext: () => make2dCtx(),
          toDataURL: () => 'data:image/png;base64,',
        };
      }
      return {};
    },
  };
}

test('V16 §1.1.A: Cinturón de seguridad emite confirmación breve sin subtítulo invasivo y mantiene penalización real', () => {
  const playerVehicle = PRESET_VEHICLES[0];
  const track = toRaceTrack(ASUNCION_CIRCUITS[0]);

  const engine = new InteractiveRacePhysics([playerVehicle], track, playerVehicle.id, false, {
    urbanTrafficRules: true,
    speedRaceMode: false,
  });

  assert.equal(engine.seatbeltBuckled, false);
  engine.setSeatbeltBuckled(true);
  assert.equal(engine.seatbeltBuckled, true);

  assert.ok(engine.lastTrafficNotice, 'Debe emitir aviso inmediato al abrochar cinturón');
  assert.equal(engine.lastTrafficNotice?.title, '✓ CINTURÓN ABROCHADO');
  assert.equal(engine.lastTrafficNotice?.subtitle, '');
  assert.equal(engine.lastTrafficNotice?.kind, 'ok');
});

test('V16 §1.1.B: ADAS muestra etiqueta compacta en reposo ("ADAS ✓" / "SIN ADAS") y expande solo en advertencia real', () => {
  const adasCar = PRESET_VEHICLES.find(v => v.id === 'chery-t4-pro-luxury-hev') ?? PRESET_VEHICLES[0];
  const noAdasCar = PRESET_VEHICLES.find(v => v.id === 'kia-carens-ex') ?? PRESET_VEHICLES[0];

  const standbyReadout = evaluateAdasHudReadout({
    vehicle: adasCar,
    playerX: 0,
    playerZ: 10,
    playerSpeedKmh: 45,
    targets: [],
  });
  assert.equal(standbyReadout.level, 'standby');
  assert.equal(standbyReadout.compactBadgeLabel, 'ADAS ✓');

  const noAdasReadout = evaluateAdasHudReadout({
    vehicle: noAdasCar,
    playerX: 0,
    playerZ: 10,
    playerSpeedKmh: 45,
    targets: [],
  });
  assert.equal(noAdasReadout.level, 'unavailable');
  assert.equal(noAdasReadout.compactBadgeLabel, 'SIN ADAS');

  const imminentReadout = evaluateAdasHudReadout({
    vehicle: adasCar,
    playerX: 0,
    playerZ: 10,
    playerSpeedKmh: 72,
    targets: [
      {
        id: 'rival-1',
        kind: 'vehicle',
        x: 0,
        z: 22,
        longitudinalSpeedMps: 0,
      },
    ],
  });
  assert.ok(
    imminentReadout.level === 'collision_warning' || imminentReadout.level === 'caution',
    `Debe escalar a advertencia real ante cierre rápido, recibido: ${imminentReadout.level}`,
  );
  assert.ok(imminentReadout.badgeLabel.length > imminentReadout.compactBadgeLabel.length);
});

test('V16 §1.1.C: Weno Bank separa porcentaje, provee shortAlertText sin truncado y conserva alertText completo', () => {
  const mission = getWenoBankMissionForCircuit('oliva', 'Calle Oliva y Piribebuy');
  const snap = evaluateWenoBankRaceProgress(45, 240, mission);

  assert.equal(typeof snap.antagonistPercent, 'number');
  assert.ok(snap.shortAlertText.length > 0 && snap.shortAlertText.length <= 24);
  assert.ok(!snap.shortAlertText.endsWith('...'), 'shortAlertText nunca debe depender de truncado con puntos suspensivos');
  assert.ok(snap.alertText.length >= snap.shortAlertText.length);
});

test('V16 §2: Espejos eliminan gl.readPixels / readRenderTargetPixels y limitan a <= 1 pase por fotograma; faros no recompilan shaders', () => {
  const mirrorSrc = fs.readFileSync(path.join(rootDir, 'src/utils/digitalRearviewMirror.ts'), 'utf8');
  assert.ok(
    !mirrorSrc.includes('.readRenderTargetPixels(') && !mirrorSrc.includes('new THREE.WebGLRenderTarget('),
    'digitalRearviewMirror.ts no debe invocar readRenderTargetPixels ni WebGLRenderTarget (bloqueo síncrono GPU->CPU)',
  );
  assert.ok(
    mirrorSrc.includes('outCtx.drawImage(domCanvas'),
    'digitalRearviewMirror.ts debe copiar con aceleración 2D desde el canvas WebGL',
  );

  const prevFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 404, headers: { get: () => 'text/html' } })) as unknown as typeof fetch;
  try {
    const playerVehicle = PRESET_VEHICLES[0];
    const playerEntity = createVehicleEntity(
      playerVehicle,
      0,
      1,
      undefined,
      undefined,
      null,
      undefined,
      { preferProceduralModel: false },
    );

    const spotLights: THREE.SpotLight[] = [];
    playerEntity.group.traverse(obj => {
      if (obj instanceof THREE.SpotLight) spotLights.push(obj);
    });
    assert.equal(spotLights.length, 2, 'El vehículo del jugador conserva 2 SpotLights frontales');

    const visBefore = spotLights[0].visible;
    playerEntity.setHeadlights?.(false, true, 1.0);
    assert.equal(spotLights[0].visible, visBefore, 'SpotLight.visible nunca debe alternar (evita recompilar shaders PBR)');
    assert.equal(spotLights[0].intensity, 0);

    playerEntity.setHeadlights?.(true, true, 1.0);
    assert.equal(spotLights[0].visible, visBefore);
    assert.ok(spotLights[0].intensity > 0);

    // Los rivales de tráfico ligeros no agregan SpotLights al grafo PBR
    const trafficEntity = createVehicleEntity(
      playerVehicle,
      0,
      1,
      undefined,
      undefined,
      null,
      undefined,
      { preferProceduralModel: true },
    );
    let trafficSpotLights = 0;
    trafficEntity.group.traverse(obj => {
      if (obj instanceof THREE.SpotLight) trafficSpotLights++;
    });
    assert.equal(trafficSpotLights, 0);

    playerEntity.dispose();
    trafficEntity.dispose();
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test('V16 §4: Registro diferido de candidatos .glb cubre los 7 vehículos de DATACAR + limusina presidencial', () => {
  const expectedCandidates: Record<string, string[]> = {
    'nissan-kicks-2027': ['/models/nissan-kicks-2027.glb', '/models/nissan-kicks.glb', '/models/kicks.glb'],
    'kia-carens-ex': ['/models/kia-carens-ex.glb', '/models/kia-carens.glb', '/models/carens.glb'],
    'toyota-corolla-cross-seg-2027': [
      '/models/toyota-corolla-cross-seg-2027-light.glb',
      '/models/toyota-corolla-cross.glb',
      '/models/corolla-cross.glb',
    ],
    'chevrolet-tracker-lite': ['/models/tracker-rs.glb', '/models/tracker-rs-wheels.glb', '/models/chevrolet-tracker.glb'],
    'chery-t4-pro-luxury-hev': ['/models/chery-t4-pro-luxury-hev.glb'],
    'chery-t2-pro-max': ['/models/chery-t2-pro-max.glb'],
    'suzuki-fronx': ['/models/suzuki-fronx.glb'],
  };

  for (const [vehicleId, requiredPaths] of Object.entries(expectedCandidates)) {
    const cfg = VEHICLE_3D_REGISTRY[vehicleId];
    assert.ok(cfg, `Falta configuración 3D para ${vehicleId}`);
    for (const reqPath of requiredPaths) {
      assert.ok(
        cfg.candidateUrls?.includes(reqPath),
        `El vehículo ${vehicleId} debe admitir carga diferida de ${reqPath}`,
      );
    }
  }
  assert.equal(BUNDLED_DEDICATED_GLB_URLS.has('/models/presidential-limousine.glb'), true);

  const observedModes: boolean[] = [];
  const entity = createVehicleEntity(
    PRESET_VEHICLES[0],
    0,
    1,
    undefined,
    undefined,
    null,
    undefined,
    {
      preferProceduralModel: true,
      onModelModeChange: (isProvisional) => observedModes.push(isProvisional),
    },
  );
  assert.equal(entity.usesProceduralModel, true);
  assert.deepEqual(observedModes, [true]);
  entity.dispose();
});

test('V16 §5: Señaleros y balizas 3D ámbar se anclan a las 4 ópticas del chasis (+X izq / -X der) sin alterar las luces de freno rojas', () => {
  const vehicle = PRESET_VEHICLES[0];
  const entity = createVehicleEntity(
    vehicle,
    0,
    1,
    undefined,
    undefined,
    null,
    undefined,
    { preferProceduralModel: true },
  );

  const internal = entity as unknown as {
    rearBrakeGroup: THREE.Group;
    brakeLensLeft: THREE.Mesh;
    brakeLensRight: THREE.Mesh;
    turnSignalLeftGroup: THREE.Group;
    turnSignalRightGroup: THREE.Group;
  };

  assert.ok(internal.brakeLensLeft instanceof THREE.Mesh);
  assert.ok(internal.brakeLensRight instanceof THREE.Mesh);

  assert.equal(internal.turnSignalLeftGroup.visible, false);
  assert.equal(internal.turnSignalRightGroup.visible, false);

  entity.setTurnSignals?.(true, false);
  assert.equal(internal.turnSignalLeftGroup.visible, true);
  assert.equal(internal.turnSignalRightGroup.visible, false);

  entity.setTurnSignals?.(true, true); // Balizas (4 esquinas simultáneas)
  assert.equal(internal.turnSignalLeftGroup.visible, true);
  assert.equal(internal.turnSignalRightGroup.visible, true);

  // En el sistema local del vehículo (+X = izquierda, -X = derecha, +Z = frente, -Z = zaga)
  const leftPositions = internal.turnSignalLeftGroup.children.map(c => c.position.clone());
  assert.ok(leftPositions.some(p => p.z > 1.0 && p.x > 0.4), 'Debe existir óptica ámbar delantera izquierda (+X, +Z)');
  assert.ok(leftPositions.some(p => p.z < -1.0 && p.x > 0.4), 'Debe existir óptica ámbar trasera izquierda (+X, -Z)');

  const rightPositions = internal.turnSignalRightGroup.children.map(c => c.position.clone());
  assert.ok(rightPositions.some(p => p.z > 1.0 && p.x < -0.4), 'Debe existir óptica ámbar delantera derecha (-X, +Z)');
  assert.ok(rightPositions.some(p => p.z < -1.0 && p.x < -0.4), 'Debe existir óptica ámbar trasera derecha (-X, -Z)');

  entity.dispose();
});
