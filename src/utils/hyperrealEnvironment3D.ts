import * as THREE from 'three';
import type { WeatherMode } from './weatherDynamics.ts';

export interface HyperrealAtmosphereSpec {
  zenithHex: string;
  midSkyHex: string;
  horizonHex: string;
  sunDiscHex: string;
  sunGlowHex: string;
  cloudTintHex: string;
  cloudOpacity: number;
  fogHex: string;
  fogDensity: number;
  sunDir: readonly [number, number, number];
  sunLightHex: string;
  sunIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  ambientHex: string;
  ambientIntensity: number;
  rimLightHex: string;
  rimIntensity: number;
  exposure: number;
}

function norm3(x: number, y: number, z: number): readonly [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

const ATMOSPHERE_BY_WEATHER: Record<WeatherMode, HyperrealAtmosphereSpec> = {
  sunny: {
    zenithHex: '#1d4f8c',
    midSkyHex: '#4f91cf',
    horizonHex: '#c6dff2',
    sunDiscHex: '#fff9e6',
    sunGlowHex: '#ffdca8',
    cloudTintHex: '#f8fbff',
    cloudOpacity: 0.68,
    fogHex: '#b4d0e6',
    fogDensity: 0.00125,
    sunDir: norm3(0.46, 0.64, 0.61),
    sunLightHex: '#fff3db',
    sunIntensity: 1.95,
    hemiSkyHex: '#93c5fd',
    hemiGroundHex: '#333f4a',
    hemiIntensity: 0.72,
    ambientHex: '#dbeafe',
    ambientIntensity: 0.20,
    rimLightHex: '#7dd3fc',
    rimIntensity: 0.48,
    exposure: 1.0,
  },
  cloudy: {
    zenithHex: '#35587a',
    midSkyHex: '#6386a6',
    horizonHex: '#aec4d6',
    sunDiscHex: '#eef4f8',
    sunGlowHex: '#c4d4e2',
    cloudTintHex: '#cfdbe6',
    cloudOpacity: 0.84,
    fogHex: '#9fb6c9',
    fogDensity: 0.00175,
    sunDir: norm3(0.41, 0.60, 0.68),
    sunLightHex: '#eef4fa',
    sunIntensity: 1.65,
    hemiSkyHex: '#9cb8cf',
    hemiGroundHex: '#2c3742',
    hemiIntensity: 0.70,
    ambientHex: '#dbeafe',
    ambientIntensity: 0.22,
    rimLightHex: '#93c5fd',
    rimIntensity: 0.44,
    exposure: 0.98,
  },
  rain: {
    zenithHex: '#364d63',
    midSkyHex: '#59738a',
    horizonHex: '#8da3b5',
    sunDiscHex: '#dce6ee',
    sunGlowHex: '#9db4c6',
    cloudTintHex: '#8d9fae',
    cloudOpacity: 0.88,
    fogHex: '#7d93a6',
    fogDensity: 0.0024,
    sunDir: norm3(0.35, 0.56, 0.75),
    sunLightHex: '#dce7f3',
    sunIntensity: 1.55,
    hemiSkyHex: '#8ea8bd',
    hemiGroundHex: '#252f38',
    hemiIntensity: 0.72,
    ambientHex: '#cbd5e1',
    ambientIntensity: 0.26,
    rimLightHex: '#93c5fd',
    rimIntensity: 0.45,
    exposure: 1.0,
  },
  storm: {
    zenithHex: '#1f2e3d',
    midSkyHex: '#35485a',
    horizonHex: '#5f7385',
    sunDiscHex: '#9fb4c7',
    sunGlowHex: '#6e8396',
    cloudTintHex: '#5a6b7a',
    cloudOpacity: 0.94,
    fogHex: '#596e80',
    fogDensity: 0.0031,
    sunDir: norm3(0.28, 0.48, 0.83),
    sunLightHex: '#b6c9dc',
    sunIntensity: 1.15,
    hemiSkyHex: '#70869a',
    hemiGroundHex: '#1b242c',
    hemiIntensity: 0.64,
    ambientHex: '#94a3b8',
    ambientIntensity: 0.24,
    rimLightHex: '#64748b',
    rimIntensity: 0.36,
    exposure: 0.94,
  },
  flood: {
    zenithHex: '#293e52',
    midSkyHex: '#466178',
    horizonHex: '#7691a6',
    sunDiscHex: '#c6dae8',
    sunGlowHex: '#88a4ba',
    cloudTintHex: '#72889b',
    cloudOpacity: 0.90,
    fogHex: '#6d879c',
    fogDensity: 0.0029,
    sunDir: norm3(0.32, 0.52, 0.79),
    sunLightHex: '#cbe0f2',
    sunIntensity: 1.32,
    hemiSkyHex: '#7d98ae',
    hemiGroundHex: '#1e2c38',
    hemiIntensity: 0.68,
    ambientHex: '#cbd5e1',
    ambientIntensity: 0.25,
    rimLightHex: '#7dd3fc',
    rimIntensity: 0.44,
    exposure: 0.98,
  },
};

export function getHyperrealAtmosphere(weatherMode: WeatherMode): HyperrealAtmosphereSpec {
  return ATMOSPHERE_BY_WEATHER[weatherMode] || ATMOSPHERE_BY_WEATHER.sunny;
}

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 uZenithColor;
  uniform vec3 uMidSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uCloudColor;
  uniform float uCloudOpacity;
  uniform float uTime;
  varying vec3 vWorldDir;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbmClouds(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 4; i++) {
      v += a * noise2(p);
      p = p * 2.03 + vec2(13.1, 7.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, -0.15, 1.0);
    float skyBand = clamp(h * 1.45, 0.0, 1.0);
    float zenithBand = pow(clamp(h, 0.0, 1.0), 0.72);
    vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.28, skyBand));
    col = mix(col, uZenithColor, smoothstep(0.18, 0.92, zenithBand));

    // Dispersión atmosférica cálida alrededor del sol
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float mieGlow = pow(sunDot, 7.0) * 0.34 + pow(sunDot, 42.0) * 0.42;
    float sunDisc = smoothstep(0.9985, 0.9996, sunDot);
    col += uSunColor * (mieGlow + sunDisc * 1.35);

    // Nubes suaves realistas sobre el plano celestial
    if (dir.y > 0.025) {
      vec2 cloudUv = dir.xz / (dir.y + 0.14) * 1.35 + vec2(uTime * 0.008, uTime * 0.004);
      float n = fbmClouds(cloudUv);
      float cloudMask = smoothstep(0.46, 0.78, n) * smoothstep(0.025, 0.22, dir.y) * uCloudOpacity;
      vec3 litCloud = mix(uCloudColor * 0.86, uCloudColor * 1.12 + uSunColor * 0.14, pow(sunDot, 3.0));
      col = mix(col, litCloud, clamp(cloudMask, 0.0, 0.88));
    }

    // Fusión limpia debajo del horizonte para espejos / ángulo dron
    if (dir.y < 0.0) {
      float below = clamp(-dir.y * 6.0, 0.0, 1.0);
      col = mix(uHorizonColor, uHorizonColor * 0.55, below);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createProceduralOutdoorEquirectTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Cielo superior -> horizonte luminoso -> suelo cálido/asfalto inferior para IBL real en carrocerías
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0.0, '#174278');
    skyGrad.addColorStop(0.28, '#4c8ec9');
    skyGrad.addColorStop(0.47, '#cfe4f5');
    skyGrad.addColorStop(0.505, '#e8eef2');
    skyGrad.addColorStop(0.53, '#3c4940');
    skyGrad.addColorStop(0.74, '#242b30');
    skyGrad.addColorStop(1.0, '#14181d');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Disco solar brillante + corona para reflejos especulares nítidos en pintura clearcoat y vidrios
    const sunGrad = ctx.createRadialGradient(340, 62, 3, 340, 62, 84);
    sunGrad.addColorStop(0.0, 'rgba(255, 252, 236, 1.0)');
    sunGrad.addColorStop(0.14, 'rgba(255, 236, 195, 0.88)');
    sunGrad.addColorStop(0.45, 'rgba(255, 214, 150, 0.25)');
    sunGrad.addColorStop(1.0, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(250, 0, 180, 155);

    // Bandas suaves de nubes iluminadas en el domo para reflejos realistas sobre capós y parabrisas
    for (let i = 0; i < 18; i++) {
      const cx = (i * 83 + 24) % 512;
      const cy = 54 + ((i * 29) % 56);
      const rx = 28 + (i % 4) * 18;
      const ry = 8 + (i % 3) * 5;
      const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      cg.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      cg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export interface HyperrealEnvironmentController {
  skyDome: THREE.Mesh;
  envMap: THREE.Texture;
  update: (weatherMode: WeatherMode, camPos: THREE.Vector3, timeSec: number, lightningFlash01?: number) => void;
  dispose: () => void;
}

export function createHyperrealSkyAndIBL(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): HyperrealEnvironmentController {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const equirectTex = createProceduralOutdoorEquirectTexture();
  const envTarget = pmrem.fromEquirectangular(equirectTex);
  const envMap = envTarget.texture;
  scene.environment = envMap;

  const initial = getHyperrealAtmosphere('sunny');
  const uniforms = {
    uZenithColor: { value: new THREE.Color(initial.zenithHex) },
    uMidSkyColor: { value: new THREE.Color(initial.midSkyHex) },
    uHorizonColor: { value: new THREE.Color(initial.horizonHex) },
    uSunColor: { value: new THREE.Color(initial.sunGlowHex) },
    uSunDir: { value: new THREE.Vector3(...initial.sunDir).normalize() },
    uCloudColor: { value: new THREE.Color(initial.cloudTintHex) },
    uCloudOpacity: { value: initial.cloudOpacity },
    uTime: { value: 0 },
  };

  const skyGeo = new THREE.SphereGeometry(960, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.name = 'hyperreal_atmospheric_sky_dome';
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -10;
  scene.add(skyDome);

  // Mantener color de fallback limpio y niebla calibrada con el horizonte del domo
  scene.background = new THREE.Color(initial.horizonHex);
  scene.fog = new THREE.FogExp2(initial.fogHex, initial.fogDensity);

  let appliedWeather: WeatherMode | null = null;
  let lastFlashApplied = 0;
  const _targetZenith = new THREE.Color();
  const _targetMid = new THREE.Color();
  const _targetHorizon = new THREE.Color();
  const _targetCloud = new THREE.Color();
  const _targetSun = new THREE.Color();
  const _targetFog = new THREE.Color();
  const _flashSkyTint = new THREE.Color('#dbeafe');
  const _flashCloudTint = new THREE.Color('#f0f9ff');

  const update = (
    weatherMode: WeatherMode,
    camPos: THREE.Vector3,
    timeSec: number,
    lightningFlash01 = 0,
  ) => {
    skyDome.position.set(camPos.x, 0, camPos.z);
    uniforms.uTime.value = timeSec;

    const spec = getHyperrealAtmosphere(weatherMode);
    if (appliedWeather !== weatherMode) {
      appliedWeather = weatherMode;
      _targetZenith.set(spec.zenithHex);
      _targetMid.set(spec.midSkyHex);
      _targetHorizon.set(spec.horizonHex);
      _targetCloud.set(spec.cloudTintHex);
      _targetSun.set(spec.sunGlowHex);
      _targetFog.set(spec.fogHex);

      uniforms.uZenithColor.value.copy(_targetZenith);
      uniforms.uMidSkyColor.value.copy(_targetMid);
      uniforms.uHorizonColor.value.copy(_targetHorizon);
      uniforms.uCloudColor.value.copy(_targetCloud);
      uniforms.uSunColor.value.copy(_targetSun);
      uniforms.uSunDir.value.set(...spec.sunDir).normalize();
      uniforms.uCloudOpacity.value = spec.cloudOpacity;

      if (scene.background instanceof THREE.Color) {
        scene.background.copy(_targetHorizon);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_targetFog);
        scene.fog.density = spec.fogDensity;
      }
    }

    if (lightningFlash01 > 0.005 || lastFlashApplied > 0.005) {
      lastFlashApplied = lightningFlash01;
      const f = Math.min(1, Math.max(0, lightningFlash01));
      uniforms.uZenithColor.value.copy(_targetZenith).lerp(_flashSkyTint, f * 0.55);
      uniforms.uMidSkyColor.value.copy(_targetMid).lerp(_flashSkyTint, f * 0.68);
      uniforms.uHorizonColor.value.copy(_targetHorizon).lerp(_flashCloudTint, f * 0.62);
      uniforms.uCloudColor.value.copy(_targetCloud).lerp(_flashCloudTint, f * 0.92);
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(_targetHorizon).lerp(_flashCloudTint, f * 0.52);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_targetFog).lerp(_flashSkyTint, f * 0.48);
      }
    }
  };

  return {
    skyDome,
    envMap,
    update,
    dispose: () => {
      scene.remove(skyDome);
      skyGeo.dispose();
      skyMat.dispose();
      envTarget.dispose();
      equirectTex.dispose();
      pmrem.dispose();
    },
  };
}
