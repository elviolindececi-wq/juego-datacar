import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isChunkLoadError,
  reloadForNewDeploymentOnce,
  retryDynamicImport,
} from './chunkRecovery';
import {
  BUNDLED_DEDICATED_GLB_URLS,
  VEHICLE_3D_REGISTRY,
} from './vehicleModelRegistry';
import { probeGlbUrlAvailable } from './vehicle3DModelLoader';
import { DEALERSHIP_VEHICLES } from '../data/presetVehicles';

test('V16 — isChunkLoadError detecta errores 404 de chunks dinámicos en Chrome, Safari y Firefox', () => {
  assert.equal(
    isChunkLoadError(
      new TypeError(
        'Failed to fetch dynamically imported module: https://juego-datacar.vercel.app/assets/MobileGameExperience-0NWj4cQd.js',
      ),
    ),
    true,
  );
  assert.equal(
    isChunkLoadError(new TypeError('Importing a module script failed.')),
    true,
  );
  assert.equal(
    isChunkLoadError(new Error('Unable to preload CSS for /assets/index-CD_F6SHt.css')),
    true,
  );
  assert.equal(isChunkLoadError(new Error('Regular validation error')), false);
  assert.equal(isChunkLoadError(null), false);
});

test('V16 — retryDynamicImport se recupera ante micro-cortes de red y respeta cooldown anti-bucle en recarga', async () => {
  let attempts = 0;
  const result = await retryDynamicImport(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new TypeError('Failed to fetch dynamically imported module');
    }
    return { ok: true };
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(attempts, 2, 'Debe reintentar y resolver en el segundo intento sin recargar');

  // Cooldown de sessionStorage evita bucles infinitos de recarga
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };
  const prevWindow = (globalThis as { window?: unknown }).window;
  let replacedUrl = '';
  (globalThis as { window?: unknown }).window = {
    location: {
      href: 'https://juego-datacar.vercel.app/',
      replace: (url: string) => {
        replacedUrl = url;
      },
    },
  };
  try {
    const firstReload = reloadForNewDeploymentOnce(mockStorage);
    assert.equal(firstReload, true);
    assert.ok(replacedUrl.includes('?v='), 'Agrega parámetro cache-busting ?v= al recargar');

    const immediateSecondReload = reloadForNewDeploymentOnce(mockStorage);
    assert.equal(
      immediateSecondReload,
      false,
      'No debe disparar una segunda recarga dentro de la ventana de enfriamiento de 20s',
    );
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
});

test('V16 — BUNDLED_DEDICATED_GLB_URLS prioriza binarios reales en candidateUrls sin peticiones HEAD 404', async () => {
  assert.equal(
    VEHICLE_3D_REGISTRY['toyota-corolla-cross-seg-2027'].candidateUrls?.[0],
    '/models/toyota-corolla-cross-seg-2027-light.glb',
  );
  assert.equal(
    VEHICLE_3D_REGISTRY['chevrolet-tracker-lite'].candidateUrls?.[0],
    '/models/tracker-rs.glb',
  );
  for (const bundledUrl of BUNDLED_DEDICATED_GLB_URLS) {
    const diskPath = path.join(process.cwd(), 'public', bundledUrl);
    assert.equal(fs.existsSync(diskPath), true, `Binario registrado debe existir en disco: ${diskPath}`);
    const available = await probeGlbUrlAvailable(bundledUrl);
    assert.equal(available, true);
  }
});

test('V16 — createVehicleEntity monta instantáneamente el auto del jugador (Chery T4 Pro y Tracker) sin bloquear la largada', async () => {
  const prevDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }),
  };
  try {
    const { createVehicleEntity } = await import('./vehicle3DEntity');
    for (const id of ['chery-t4-pro-luxury-hev', 'chevrolet-tracker-lite']) {
      const car = DEALERSHIP_VEHICLES.find((v) => v.id === id)!;
      let loadedImmediately = false;
      const entity = createVehicleEntity(
        car,
        0,
        1,
        () => {
          loadedImmediately = true;
        },
        undefined,
        null,
      );
      assert.equal(
        loadedImmediately,
        true,
        `El vehículo del jugador (${id}) debe notificar onLoaded en < 5ms sin congelar la pantalla en 72%`,
      );
      entity.dispose();
    }
  } finally {
    if (prevDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDocument;
    }
  }
});

test('V16 — Etapa 3 PREPARAR nunca descarga fallbacks de 22 MB ni bloquea el botón ¡EMPEZAR CARRERA!, y configura cabeceras anti-caché en Vercel', () => {
  const root = process.cwd();
  const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const mobileSrc = fs.readFileSync(
    path.join(root, 'src/components/mobile/MobileGameExperience.tsx'),
    'utf8',
  );
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const vercelJson = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

  assert.equal(
    appSrc.includes('allowFallback: true'),
    false,
    'App.tsx nunca debe forzar allowFallback: true (descarga 22 MB innecesarios para Chery T4 Pro / Kicks / Carens / Fronx)',
  );
  assert.ok(
    appSrc.includes('const [briefingLoadPercent, setBriefingLoadPercent] = useState(100)'),
    'App.tsx debe iniciar briefingLoadPercent en 100 para habilitar de inmediato ¡EMPEZAR CARRERA!',
  );
  assert.ok(
    mobileSrc.includes('const [briefingPercent,setBriefingPercent]=useState(100)'),
    'MobileGameExperience debe iniciar briefingPercent en 100',
  );
  assert.ok(
    indexHtml.includes('href="/favicon.svg"'),
    'index.html debe enlazar /favicon.svg para eliminar el 404 de favicon en producción',
  );
  assert.equal(
    fs.existsSync(path.join(root, 'public/favicon.svg')),
    true,
    'Debe existir public/favicon.svg',
  );
  assert.equal(
    fs.existsSync(path.join(root, 'src/components/ChunkErrorBoundary.tsx')),
    true,
    'Debe existir ChunkErrorBoundary.tsx para evitar pantallas negras ante chunks obsoletos',
  );
  assert.ok(
    Array.isArray(vercelJson.headers) && vercelJson.headers.length >= 3,
    'vercel.json debe definir cabeceras Cache-Control para index.html y /assets/',
  );
});
