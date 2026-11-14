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
    zenithHex: '#2b4761',
    midSkyHex: '#6e8699',
    horizonHex: '#ebd0a3',
    sunDiscHex: '#fff6dc',
    sunGlowHex: '#ffc978',
    cloudTintHex: '#f6e4c6',
    cloudOpacity: 0.64,
    fogHex: '#dbc198',
    fogDensity: 0.00205,
    sunDir: norm3(0.56, 0.518, -0.646),
    sunLightHex: '#ffd694',
    sunIntensity: 3.18,
    hemiSkyHex: '#e2cfb2',
    hemiGroundHex: '#3e3328',
    hemiIntensity: 0.88,
    ambientHex: '#efe2ce',
    ambientIntensity: 0.26,
    rimLightHex: '#ffcf87',
    rimIntensity: 0.62,
    exposure: 1.08,
  },
  cloudy: {
    zenithHex: '#3a4e61',
    midSkyHex: '#738391',
    horizonHex: '#cbb99e',
    sunDiscHex: '#f5e8d3',
    sunGlowHex: '#ddb98a',
    cloudTintHex: '#d6cab8',
    cloudOpacity: 0.82,
    fogHex: '#bfb09a',
    fogDensity: 0.00235,
    sunDir: norm3(0.52, 0.525, -0.673),
    sunLightHex: '#f5dec0',
    sunIntensity: 2.25,
    hemiSkyHex: '#cabda8',
    hemiGroundHex: '#3c362f',
    hemiIntensity: 0.82,
    ambientHex: '#e5ddd2',
    ambientIntensity: 0.28,
    rimLightHex: '#eab36c',
    rimIntensity: 0.48,
    exposure: 1.04,
  },
  rain: {
    zenithHex: '#344657',
    midSkyHex: '#5c6e7d',
    horizonHex: '#9da19e',
    sunDiscHex: '#e2dfd8',
    sunGlowHex: '#b8ae9e',
    cloudTintHex: '#999d9c',
    cloudOpacity: 0.88,
    fogHex: '#8d928f',
    fogDensity: 0.00285,
    sunDir: norm3(0.46, 0.535, -0.708),
    sunLightHex: '#e4ded2',
    sunIntensity: 1.78,
    hemiSkyHex: '#a3a8a6',
    hemiGroundHex: '#34383b',
    hemiIntensity: 0.80,
    ambientHex: '#d1d5d8',
    ambientIntensity: 0.30,
    rimLightHex: '#cbd5e1',
    rimIntensity: 0.45,
    exposure: 1.02,
  },
  storm: {
    zenithHex: '#212d38',
    midSkyHex: '#3c4a56',
    horizonHex: '#6f7370',
    sunDiscHex: '#b4b2ab',
    sunGlowHex: '#87837a',
    cloudTintHex: '#646869',
    cloudOpacity: 0.94,
    fogHex: '#636868',
    fogDensity: 0.00345,
    sunDir: norm3(0.40, 0.54, -0.741),
    sunLightHex: '#cfc9be',
    sunIntensity: 1.38,
    hemiSkyHex: '#848a8e',
    hemiGroundHex: '#2a2e32',
    hemiIntensity: 0.74,
    ambientHex: '#a3aab0',
    ambientIntensity: 0.28,
    rimLightHex: '#94a3b8',
    rimIntensity: 0.38,
    exposure: 0.99,
  },
  flood: {
    zenithHex: '#2c3d4d',
    midSkyHex: '#4e6270',
    horizonHex: '#8c9492',
    sunDiscHex: '#d2cfc7',
    sunGlowHex: '#a49f92',
    cloudTintHex: '#7d8588',
    cloudOpacity: 0.90,
    fogHex: '#7d8687',
    fogDensity: 0.00315,
    sunDir: norm3(0.42, 0.535, -0.733),
    sunLightHex: '#dcd6c8',
    sunIntensity: 1.56,
    hemiSkyHex: '#959ea1',
    hemiGroundHex: '#30373c',
    hemiIntensity: 0.76,
    ambientHex: '#cbd0d4',
    ambientIntensity: 0.29,
    rimLightHex: '#b8c4ce',
    rimIntensity: 0.44,
    exposure: 1.01,
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
    float skyBand = clamp(h * 1.38, 0.0, 1.0);
    float zenithBand = pow(clamp(h, 0.0, 1.0), 0.75);
    vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.32, skyBand));
    col = mix(col, uZenithColor, smoothstep(0.20, 0.94, zenithBand));

    // Bruma aérea dorada sobre la franja del horizonte para fundir LODs lejanos y alimentar HDR bloom
    float horizonAerialGlow = exp(-max(0.0, dir.y) * 10.5) * smoothstep(-0.08, 0.01, dir.y);
    col += uSunColor * horizonAerialGlow * 0.34;

    // Dispersión Mie HDR cálida de sol vespertino bajo + disco sobrebrillante (> 1.0 para UnrealBloomPass)
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float mieWide = pow(sunDot, 5.0) * 0.46;
    float mieTight = pow(sunDot, 36.0) * 0.92;
    float sunDisc = smoothstep(0.9982, 0.9995, sunDot);
    col += uSunColor * (mieWide + mieTight + sunDisc * 3.2);

    // Nubes otoñales iluminadas desde abajo por el sol dorado de la tarde
    if (dir.y > 0.02) {
      vec2 cloudUv = dir.xz / (dir.y + 0.14) * 1.35 + vec2(uTime * 0.007, uTime * 0.0035);
      float n = fbmClouds(cloudUv);
      float cloudMask = smoothstep(0.45, 0.78, n) * smoothstep(0.02, 0.24, dir.y) * uCloudOpacity;
      vec3 cloudShadow = uCloudColor * 0.76;
      vec3 cloudHighlight = uCloudColor * 1.18 + uSunColor * 0.38;
      vec3 litCloud = mix(cloudShadow, cloudHighlight, clamp(pow(sunDot, 2.2) + horizonAerialGlow * 0.45, 0.0, 1.0));
      col = mix(col, litCloud, clamp(cloudMask, 0.0, 0.88));
    }

    // Fusión limpia debajo del horizonte para sondas de reflexión y ángulo dron
    if (dir.y < 0.0) {
      float below = clamp(-dir.y * 6.0, 0.0, 1.0);
      col = mix(uHorizonColor, uHorizonColor * 0.48, below);
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
    // Domo IBL otoñal de tarde: cenit azul-pizarra desaturado -> horizonte ámbar/ocre -> asfalto húmedo cálido
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0.0, '#264159');
    skyGrad.addColorStop(0.28, '#698196');
    skyGrad.addColorStop(0.46, '#e7c998');
    skyGrad.addColorStop(0.505, '#ffe3b3');
    skyGrad.addColorStop(0.535, '#473d31');
    skyGrad.addColorStop(0.74, '#2a2622');
    skyGrad.addColorStop(1.0, '#161514');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Sol de tarde bajo e intenso + corona dorada para reflejos especulares en carrocería, vidrio y charcos
    const sunGrad = ctx.createRadialGradient(356, 86, 3, 356, 86, 98);
    sunGrad.addColorStop(0.0, 'rgba(255, 250, 228, 1.0)');
    sunGrad.addColorStop(0.18, 'rgba(255, 218, 152, 0.92)');
    sunGrad.addColorStop(0.48, 'rgba(245, 178, 96, 0.36)');
    sunGrad.addColorStop(1.0, 'rgba(245, 178, 96, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(245, 0, 220, 185);

    // Bandas de nubes cálidas iluminadas al atardecer
    for (let i = 0; i < 18; i++) {
      const cx = (i * 83 + 24) % 512;
      const cy = 58 + ((i * 29) % 54);
      const rx = 28 + (i % 4) * 18;
      const ry = 8 + (i % 3) * 5;
      const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      cg.addColorStop(0, 'rgba(255, 236, 198, 0.44)');
      cg.addColorStop(1, 'rgba(255, 236, 198, 0)');
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
  options?: { skyRadius?: number; fogDensityMultiplier?: number },
): HyperrealEnvironmentController {
  const skyRadius = options?.skyRadius ?? 960;
  const fogScale = options?.fogDensityMultiplier ?? 1;
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

  const skyGeo = new THREE.SphereGeometry(skyRadius, 32, 20);
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
  scene.fog = new THREE.FogExp2(initial.fogHex, initial.fogDensity * fogScale);

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
    skyDome.position.set(camPos.x, camPos.y, camPos.z);
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
        scene.fog.density = spec.fogDensity * fogScale;
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
