import * as THREE from 'three';
import { WEATHER_CONFIG, getWaterZones } from './weatherDynamics.ts';
import type { WeatherMode } from './weatherDynamics.ts';
import type { CurvedRoadPath } from './curvedRoadPath.ts';

/** Lluvia y encharcamientos livianos, anclados a la vista del jugador. */
export function createWeatherVisuals3D(scene: THREE.Scene, distance: number, profile?: string, roadPath?: CurvedRoadPath) {
  const count = 350;
  const positions = new Float32Array(count * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#c9e3ed', transparent: true, opacity: .36, depthWrite: false, toneMapped: false });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const drop = Array.from({ length: count }, (_, i) => ({
    x: Math.sin(i * 12.9898) * 23,
    y: 2 + (i * 19.83 % 14 + 14) % 14,
    z: Math.cos(i * 4.445) * 29,
    speed: 16 + (i % 7) * 1.8,
  }));
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const gradient = ctx.createRadialGradient(128, 128, 3, 128, 128, 126);
    gradient.addColorStop(0, 'rgba(91,128,147,.80)');
    gradient.addColorStop(.42, 'rgba(68,103,124,.48)');
    gradient.addColorStop(.8, 'rgba(83,109,122,.22)');
    gradient.addColorStop(1, 'rgba(92,118,131,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(190,214,223,.18)'; ctx.lineWidth = 2;
    for (let r = 27; r < 110; r += 31) { ctx.beginPath(); ctx.ellipse(128, 128, r, r * .7, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  const waterTex = new THREE.CanvasTexture(cv); waterTex.colorSpace = THREE.SRGBColorSpace;
  const waterGeo = new THREE.PlaneGeometry(2, 2);
  const waterMaterial = new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, depthWrite: false, opacity: .58, polygonOffset: true, polygonOffsetFactor: -1 });
  const water = new THREE.Group(); water.name = 'simulacion_raudales_y_charcos';
  const patches: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(waterGeo, waterMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = .05;
    mesh.visible = false;
    water.add(mesh);
    patches.push(mesh);
  }
  scene.add(water);
  let previousMode: WeatherMode | undefined;
  const changeMode = (mode: WeatherMode) => {
    if (previousMode === mode) return;
    previousMode = mode;
    const zones = getWaterZones(mode, distance, profile);
    patches.forEach((patch, i) => {
      const zone = zones[i]; patch.visible = Boolean(zone);
      if (!zone) return;
      const actual = roadPath?.world(zone.z, zone.x);
      patch.position.set(actual?.x ?? zone.x, .055, actual?.z ?? zone.z);
      patch.rotation.y = actual?.yaw ?? 0;
      patch.scale.set(zone.radiusX * 1.7, zone.radiusZ * 1.8, 1);
    });
  };
  const sky = new THREE.Color();
  const update = (mode: WeatherMode, dt: number, focusX: number, focusZ: number) => {
    changeMode(mode);
    const cfg = WEATHER_CONFIG[mode];
    sky.set(cfg.sky);
    scene.background = sky;
    if (scene.fog instanceof THREE.FogExp2) { scene.fog.color.copy(sky); scene.fog.density = mode === 'storm' || mode === 'flood' ? .0035 : mode === 'rain' ? .0028 : .0019; }
    rain.visible = cfg.rainIntensity > 0;
    if (!rain.visible) return;
    rain.position.set(focusX, 0, focusZ + 12);
    rainMaterial.opacity = .24 + cfg.rainIntensity * .18;
    const vy = cfg.rainIntensity;
    for (let i = 0; i < count; i++) {
      const d = drop[i];
      d.y -= dt * d.speed * (0.6 + vy * .8);
      d.x -= dt * (vy * 2.3);
      if (d.y < .15) { d.y += 14; d.x = Math.sin(i * 1.73 + focusZ * .002) * 22; }
      if (d.x < -24) d.x += 48;
      const n = i * 6;
      positions[n] = d.x; positions[n + 1] = d.y; positions[n + 2] = d.z;
      positions[n + 3] = d.x + .19 * vy; positions[n + 4] = d.y + .43 + vy * .42; positions[n + 5] = d.z + .04;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  };
  return {
    update,
    dispose() {
      scene.remove(rain, water);
      rainGeometry.dispose(); rainMaterial.dispose();
      waterGeo.dispose(); waterMaterial.dispose(); waterTex.dispose();
    },
  };
}
