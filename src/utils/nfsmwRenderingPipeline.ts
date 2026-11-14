import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { WeatherMode } from './weatherDynamics.ts';

/**
 * Pipeline gráfico avanzado inspirado en Need for Speed: Most Wanted (2005),
 * modernizado a estándares fotorrealistas PBR/HDR actuales sin alterar ni un solo
 * vértice, edificio, calzada o elemento de diseño de nivel del mapa existente.
 */

export interface NfsmwGradePreset {
  desaturation: number;
  warmTintStrength: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  lensFlareIntensity: number;
  horizonGlareIntensity: number;
  puddleAmount: number;
}

export const NFSMW_PRESET_BY_WEATHER: Record<WeatherMode, NfsmwGradePreset> = {
  sunny: {
    desaturation: 0.22,
    warmTintStrength: 0.78,
    bloomStrength: 0.62,
    bloomRadius: 0.52,
    bloomThreshold: 1.04,
    lensFlareIntensity: 0.88,
    horizonGlareIntensity: 0.54,
    puddleAmount: 0.74,
  },
  cloudy: {
    desaturation: 0.28,
    warmTintStrength: 0.56,
    bloomStrength: 0.46,
    bloomRadius: 0.48,
    bloomThreshold: 1.06,
    lensFlareIntensity: 0.48,
    horizonGlareIntensity: 0.36,
    puddleAmount: 0.80,
  },
  rain: {
    desaturation: 0.32,
    warmTintStrength: 0.38,
    bloomStrength: 0.50,
    bloomRadius: 0.52,
    bloomThreshold: 1.05,
    lensFlareIntensity: 0.26,
    horizonGlareIntensity: 0.24,
    puddleAmount: 0.96,
  },
  storm: {
    desaturation: 0.36,
    warmTintStrength: 0.28,
    bloomStrength: 0.56,
    bloomRadius: 0.54,
    bloomThreshold: 1.02,
    lensFlareIntensity: 0.20,
    horizonGlareIntensity: 0.18,
    puddleAmount: 1.0,
  },
  flood: {
    desaturation: 0.30,
    warmTintStrength: 0.34,
    bloomStrength: 0.48,
    bloomRadius: 0.52,
    bloomThreshold: 1.05,
    lensFlareIntensity: 0.28,
    horizonGlareIntensity: 0.22,
    puddleAmount: 1.0,
  },
};

export interface SunScreenProjection {
  uvX: number;
  uvY: number;
  visibility: number;
  forwardAlignment: number;
}

const _sunWorldTmp = new THREE.Vector3();
const _camForwardTmp = new THREE.Vector3();
const _sunDirNormTmp = new THREE.Vector3();

/**
 * Proyecta la dirección solar mundial al espacio UV de pantalla (0..1) y calcula
 * su visibilidad óptica para el destello de lente (lens flare) y resplandor de horizonte.
 */
export function computeSunScreenProjection(
  camera: THREE.Camera,
  sunDir: readonly [number, number, number],
): SunScreenProjection {
  _sunDirNormTmp.set(sunDir[0], sunDir[1], sunDir[2]).normalize();
  camera.getWorldDirection(_camForwardTmp);
  const forwardDot = _camForwardTmp.dot(_sunDirNormTmp);

  _sunWorldTmp.copy(camera.position).addScaledVector(_sunDirNormTmp, 600);
  _sunWorldTmp.project(camera);

  const uvX = _sunWorldTmp.x * 0.5 + 0.5;
  const uvY = _sunWorldTmp.y * 0.5 + 0.5;

  if (forwardDot <= 0.02) {
    return {
      uvX: Number.isFinite(uvX) ? uvX : 0.5,
      uvY: Number.isFinite(uvY) ? uvY : 0.75,
      visibility: 0,
      forwardAlignment: forwardDot,
    };
  }

  const offscreenDist = Math.hypot(Math.max(0, Math.abs(uvX - 0.5) - 0.5), Math.max(0, Math.abs(uvY - 0.5) - 0.5));
  const edgeFade = THREE.MathUtils.clamp(1 - offscreenDist * 1.85, 0, 1);
  const angleFade = THREE.MathUtils.smoothstep(forwardDot, 0.02, 0.48);

  return {
    uvX,
    uvY,
    visibility: edgeFade * angleFade,
    forwardAlignment: forwardDot,
  };
}

/**
 * Shader de post-procesado cinematográfico NFSMW (2005) modernizado:
 * - Gradación de color otoñal desaturada con sombras carbón-bronce, medios tonos ocre
 *   y altas luces doradas/ámbar preservando fotorrealismo.
 * - Destellos anamórficos sobre reflejos especulares intensos + Lens Flare multicapa
 *   (fantasmas ópticos hexagonales/anulares + halo cálido de horizonte).
 */
const NFSMW_AUTUMN_GRADE_AND_FLARE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAspect: { value: 16 / 9 },
    uDesaturation: { value: 0.22 },
    uWarmTintStrength: { value: 0.78 },
    uSunScreenUv: { value: new THREE.Vector2(0.72, 0.78) },
    uSunVisibility: { value: 0.0 },
    uFlareIntensity: { value: 0.88 },
    uHorizonGlare: { value: 0.52 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAspect;
    uniform float uDesaturation;
    uniform float uWarmTintStrength;
    uniform vec2 uSunScreenUv;
    uniform float uSunVisibility;
    uniform float uFlareIntensity;
    uniform float uHorizonGlare;
    uniform float uTime;
    varying vec2 vUv;

    float ghostDisc(vec2 uv, vec2 center, float radius, float softness) {
      vec2 d = (uv - center) * vec2(uAspect, 1.0);
      float r = length(d);
      return smoothstep(radius, radius * (1.0 - softness), r);
    }

    float ghostRing(vec2 uv, vec2 center, float radius, float thickness) {
      vec2 d = (uv - center) * vec2(uAspect, 1.0);
      float r = length(d);
      return smoothstep(thickness, 0.0, abs(r - radius));
    }

    void main() {
      // Sutil aberración óptica periférica de lente real
      vec2 centered = vUv - 0.5;
      float edgeR2 = dot(centered, centered);
      vec2 caShift = centered * (0.0016 * edgeR2);

      float rCh = texture2D(tDiffuse, clamp(vUv + caShift, 0.001, 0.999)).r;
      vec4 baseSample = texture2D(tDiffuse, vUv);
      float bCh = texture2D(tDiffuse, clamp(vUv - caShift, 0.001, 0.999)).b;
      vec3 col = vec3(rCh, baseSample.g, bCh);

      // Destello anamórfico horizontal donde el sol golpea superficies reflectivas y el horizonte
      float tapOff1 = 0.0055;
      float tapOff2 = 0.0135;
      vec3 left1 = texture2D(tDiffuse, clamp(vUv - vec2(tapOff1, 0.0), 0.001, 0.999)).rgb;
      vec3 right1 = texture2D(tDiffuse, clamp(vUv + vec2(tapOff1, 0.0), 0.001, 0.999)).rgb;
      vec3 left2 = texture2D(tDiffuse, clamp(vUv - vec2(tapOff2, 0.0), 0.001, 0.999)).rgb;
      vec3 right2 = texture2D(tDiffuse, clamp(vUv + vec2(tapOff2, 0.0), 0.001, 0.999)).rgb;

      float specLuma1 = max(0.0, max(dot(left1, vec3(0.333)), dot(right1, vec3(0.333))) - 0.93);
      float specLuma2 = max(0.0, max(dot(left2, vec3(0.333)), dot(right2, vec3(0.333))) - 0.96);
      vec3 specularFlare = vec3(1.0, 0.79, 0.44) * (specLuma1 * 0.38 + specLuma2 * 0.22) * uFlareIntensity;
      col += specularFlare;

      // Resplandor dorado cálido de horizonte vespertino (dispersión frontal baja)
      float horizonBand = exp(-pow((vUv.y - 0.54) * 5.2, 2.0)) * (1.0 - abs(vUv.x - 0.5) * 0.45);
      float skyBrightness = smoothstep(0.58, 0.96, dot(col, vec3(0.299, 0.587, 0.114)));
      col += vec3(1.0, 0.76, 0.42) * horizonBand * skyBrightness * uHorizonGlare * 0.16;

      // Lens Flare óptico real cuando el disco solar o su corona entran en encuadre
      if (uSunVisibility > 0.002) {
        vec2 sunVec = vec2(0.5) - uSunScreenUv;
        vec2 dSun = (vUv - uSunScreenUv) * vec2(uAspect, 1.0);
        float distSun = length(dSun);

        // Corona cálida + trazo anamórfico ámbar del sol
        float sunHalo = exp(-distSun * 4.8) * 0.34 + exp(-distSun * 16.0) * 0.42;
        float anamorphicStreak = exp(-abs(dSun.y) * 46.0) * exp(-abs(dSun.x) * 2.6) * 0.38;
        float starburst = pow(max(0.0, cos(atan(dSun.y, dSun.x) * 6.0 + uTime * 0.08)), 10.0) * exp(-distSun * 7.5) * 0.18;

        // Fantasmas internos de lente a lo largo del eje óptico
        vec2 g1 = uSunScreenUv + sunVec * 0.48;
        vec2 g2 = uSunScreenUv + sunVec * 0.92;
        vec2 g3 = uSunScreenUv + sunVec * 1.38;
        vec2 g4 = uSunScreenUv + sunVec * 1.78;

        vec3 ghosts = vec3(0.0);
        ghosts += vec3(1.0, 0.78, 0.42) * ghostDisc(vUv, g1, 0.055, 0.55) * 0.16;
        ghosts += vec3(0.96, 0.62, 0.28) * ghostRing(vUv, g2, 0.085, 0.018) * 0.22;
        ghosts += vec3(0.85, 0.88, 0.58) * ghostDisc(vUv, g3, 0.038, 0.65) * 0.18;
        ghosts += vec3(1.0, 0.72, 0.36) * ghostRing(vUv, g4, 0.125, 0.022) * 0.15;

        vec3 totalFlare = (vec3(1.0, 0.82, 0.48) * (sunHalo + anamorphicStreak + starburst) + ghosts)
          * uSunVisibility * uFlareIntensity;
        col += totalFlare;
      }

      // 1. GRADACIÓN DE COLOR CINEMATOGRÁFICA OTOÑAL (NFSMW 2005 modernizado a fotorrealismo)
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

      // Desaturación parcial estilo bleach-bypass controlado (conserva naturalidad de materiales)
      col = mix(col, vec3(luma), uDesaturation);

      // Separación tonal: sombras profundas carbón-oliva, medios tonos ocre/bronce, altas luces ámbar dorado
      vec3 shadowGrade = vec3(0.93, 0.95, 0.98);
      vec3 midtoneGrade = vec3(1.06, 0.99, 0.86);
      vec3 highlightGrade = vec3(1.10, 0.98, 0.80);

      float shadowWeight = 1.0 - smoothstep(0.0, 0.42, luma);
      float highlightWeight = smoothstep(0.46, 0.95, luma);
      float midWeight = clamp(1.0 - shadowWeight - highlightWeight, 0.0, 1.0);

      vec3 graded = col * (
        shadowGrade * shadowWeight +
        midtoneGrade * midWeight +
        highlightGrade * highlightWeight
      );

      // Curva en S suave cinematográfica para contraste nítido sin empastar negros
      vec3 sCurve = smoothstep(vec3(-0.02), vec3(1.03), graded);
      graded = mix(graded, sCurve, 0.32);

      col = mix(col, graded, uWarmTintStrength);

      // Viñeta óptica muy sutil para profundidad de encuadre
      float vignette = 1.0 - smoothstep(0.32, 0.92, edgeR2 * 1.45) * 0.22;
      col *= vignette;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), baseSample.a);
    }
  `,
};

export interface NfsmwPostProcessorController {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  gradePass: ShaderPass;
  render: (weatherMode: WeatherMode, sunDir: readonly [number, number, number], timeSec: number) => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
}

export function createNfsmwPostProcessor(args: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  pixelRatio: number;
  isMobilePerf: boolean;
}): NfsmwPostProcessorController {
  const { renderer, scene, camera, width, height, pixelRatio, isMobilePerf } = args;
  const effW = Math.max(1, Math.floor(width * pixelRatio));
  const effH = Math.max(1, Math.floor(height * pixelRatio));

  const hdrRenderTarget = new THREE.WebGLRenderTarget(effW, effH, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.LinearSRGBColorSpace,
  });

  const composer = new EffectComposer(renderer, hdrRenderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomDivisor = isMobilePerf ? 3 : 2;
  const initialPreset = NFSMW_PRESET_BY_WEATHER.sunny;
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(64, Math.floor(width / bloomDivisor)), Math.max(64, Math.floor(height / bloomDivisor))),
    initialPreset.bloomStrength,
    initialPreset.bloomRadius,
    initialPreset.bloomThreshold,
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const gradePass = new ShaderPass(NFSMW_AUTUMN_GRADE_AND_FLARE_SHADER);
  gradePass.uniforms.uAspect.value = width / Math.max(1, height);
  composer.addPass(gradePass);

  return {
    composer,
    bloomPass,
    gradePass,
    render: (weatherMode, sunDir, timeSec) => {
      const preset = NFSMW_PRESET_BY_WEATHER[weatherMode] || NFSMW_PRESET_BY_WEATHER.sunny;
      bloomPass.strength = preset.bloomStrength;
      bloomPass.radius = preset.bloomRadius;
      bloomPass.threshold = preset.bloomThreshold;

      const proj = computeSunScreenProjection(camera, sunDir);
      gradePass.uniforms.uDesaturation.value = preset.desaturation;
      gradePass.uniforms.uWarmTintStrength.value = preset.warmTintStrength;
      gradePass.uniforms.uSunScreenUv.value.set(proj.uvX, proj.uvY);
      gradePass.uniforms.uSunVisibility.value = proj.visibility;
      gradePass.uniforms.uFlareIntensity.value = preset.lensFlareIntensity;
      gradePass.uniforms.uHorizonGlare.value = preset.horizonGlareIntensity;
      gradePass.uniforms.uTime.value = timeSec;

      composer.render();
    },
    setSize: (w, h, dpr) => {
      const safeW = Math.max(1, w);
      const safeH = Math.max(1, h);
      composer.setPixelRatio(dpr);
      composer.setSize(safeW, safeH);
      bloomPass.resolution.set(
        Math.max(64, Math.floor(safeW / bloomDivisor)),
        Math.max(64, Math.floor(safeH / bloomDivisor)),
      );
      gradePass.uniforms.uAspect.value = safeW / safeH;
    },
    dispose: () => {
      bloomPass.dispose();
      outputPass.dispose();
      gradePass.dispose();
      composer.dispose();
      hdrRenderTarget.dispose();
    },
  };
}

/**
 * Sonda de reflexión dinámica en tiempo real (CubeCamera modernizada con mipmaps PMREM-like)
 * que captura los edificios, puentes/viaductos, arboleda y cielo circundantes para reflejarlos
 * sobre charcos del asfalto, torres vidriadas y superficies brillantes.
 */
export interface DynamicReflectionProbeController {
  texture: THREE.CubeTexture;
  cubeCamera: THREE.CubeCamera;
  update: (args: {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    focusX: number;
    focusY: number;
    focusZ: number;
    timeSec: number;
    isSoftwareGl: boolean;
    hiddenObjects?: Array<THREE.Object3D | null | undefined>;
  }) => void;
  dispose: () => void;
}

export function createDynamicReflectionProbe(
  scene: THREE.Scene,
  options?: { resolution?: number; far?: number },
): DynamicReflectionProbeController {
  const res = options?.resolution ?? 128;
  const cubeTarget = new THREE.WebGLCubeRenderTarget(res, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const cubeCamera = new THREE.CubeCamera(0.65, options?.far ?? 460, cubeTarget);
  cubeCamera.name = 'nfsmw_realtime_reflection_probe';
  scene.add(cubeCamera);

  let hasCapturedInitial = false;
  let lastCaptureX = Infinity;
  let lastCaptureZ = Infinity;
  let lastCaptureTimeSec = -Infinity;
  const prevVisibilities: boolean[] = [];

  return {
    texture: cubeTarget.texture,
    cubeCamera,
    update: ({ renderer, scene: activeScene, focusX, focusY, focusZ, timeSec, isSoftwareGl, hiddenObjects }) => {
      const distMoved = Math.hypot(focusX - lastCaptureX, focusZ - lastCaptureZ);
      const minInterval = isSoftwareGl ? 3.5 : 0.42;
      const minDist = isSoftwareGl ? 42 : 12;

      if (hasCapturedInitial && (timeSec - lastCaptureTimeSec < minInterval || distMoved < minDist)) {
        return;
      }

      hasCapturedInitial = true;
      lastCaptureX = focusX;
      lastCaptureZ = focusZ;
      lastCaptureTimeSec = timeSec;

      cubeCamera.position.set(focusX, Math.max(1.35, focusY + 1.15), focusZ + 3.5);

      prevVisibilities.length = 0;
      if (hiddenObjects) {
        for (let i = 0; i < hiddenObjects.length; i++) {
          const obj = hiddenObjects[i];
          prevVisibilities.push(obj ? obj.visible : false);
          if (obj) obj.visible = false;
        }
      }

      const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      try {
        cubeCamera.update(renderer, activeScene);
      } finally {
        renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
        if (hiddenObjects) {
          for (let i = 0; i < hiddenObjects.length; i++) {
            const obj = hiddenObjects[i];
            if (obj) obj.visible = prevVisibilities[i];
          }
        }
      }
    },
    dispose: () => {
      scene.remove(cubeCamera);
      cubeTarget.dispose();
    },
  };
}

export interface AsphaltVehicleLightUniformState {
  headLeft: THREE.Vector3;
  headRight: THREE.Vector3;
  headDir: THREE.Vector3;
  headIntensity: number;
  brakeLeft: THREE.Vector3;
  brakeRight: THREE.Vector3;
  brakeIntensity: number;
}

export interface AsphaltPuddleShaderOptions {
  detailNormalMap?: THREE.Texture | null;
  trackSeed?: number;
}

export interface AsphaltPuddleShaderHandle {
  setPuddleState: (puddleAmount: number, timeSec: number) => void;
  setSunDirection: (sunX: number, sunY: number, sunZ: number) => void;
  setVehicleLightState: (state: AsphaltVehicleLightUniformState) => void;
}

/**
 * Extiende el MeshStandardMaterial existente del asfalto mediante onBeforeCompile
 * conservando 100% la geometría de la calzada, sombras PCFSoftShadowMap, niebla y charcos CubeCamera,
 * e incorporando micro-detalle de árido en primer plano (multi-layer normal maps), fisuras selladas
 * con alquitrán, micro-destellos solares rasantes y reflejos simétricos de faros delanteros y doble luz de freno.
 */
export function enhanceAsphaltMaterialWithPuddles(
  roadMat: THREE.MeshStandardMaterial,
  dynamicEnvMap: THREE.Texture,
  options?: AsphaltPuddleShaderOptions,
): AsphaltPuddleShaderHandle {
  roadMat.envMap = dynamicEnvMap;
  roadMat.envMapIntensity = 1.55;

  const detailTex = options?.detailNormalMap ?? null;
  const trackSeed = options?.trackSeed ?? 1.0;

  const customUniforms = {
    uPuddleAmount: { value: 0.72 },
    uWetTime: { value: 0.0 },
    uTrackSeed: { value: trackSeed },
    uDetailNormalMap: { value: detailTex },
    uHasDetailNormal: { value: detailTex ? 1.0 : 0.0 },
    uSunDir: { value: new THREE.Vector3(-0.62, 0.28, 0.73).normalize() },
    uHeadPosL: { value: new THREE.Vector3(0, -50, 0) },
    uHeadPosR: { value: new THREE.Vector3(0, -50, 0) },
    uHeadDir: { value: new THREE.Vector3(0, -0.08, 1).normalize() },
    uHeadIntensity: { value: 0.0 },
    uBrakePosL: { value: new THREE.Vector3(0, -50, 0) },
    uBrakePosR: { value: new THREE.Vector3(0, -50, 0) },
    uBrakeIntensity: { value: 0.0 },
  };

  roadMat.customProgramCacheKey = () =>
    detailTex ? 'nfsmw_damp_puddle_closeup_asphalt_v2_tex' : 'nfsmw_damp_puddle_closeup_asphalt_v2_proc';

  roadMat.onBeforeCompile = (shader) => {
    shader.uniforms.uPuddleAmount = customUniforms.uPuddleAmount;
    shader.uniforms.uWetTime = customUniforms.uWetTime;
    shader.uniforms.uTrackSeed = customUniforms.uTrackSeed;
    shader.uniforms.uDetailNormalMap = customUniforms.uDetailNormalMap;
    shader.uniforms.uHasDetailNormal = customUniforms.uHasDetailNormal;
    shader.uniforms.uSunDir = customUniforms.uSunDir;
    shader.uniforms.uHeadPosL = customUniforms.uHeadPosL;
    shader.uniforms.uHeadPosR = customUniforms.uHeadPosR;
    shader.uniforms.uHeadDir = customUniforms.uHeadDir;
    shader.uniforms.uHeadIntensity = customUniforms.uHeadIntensity;
    shader.uniforms.uBrakePosL = customUniforms.uBrakePosL;
    shader.uniforms.uBrakePosR = customUniforms.uBrakePosR;
    shader.uniforms.uBrakeIntensity = customUniforms.uBrakeIntensity;

    shader.vertexShader =
      `
      varying vec3 vNfsmwWorldPos;
      varying vec3 vNfsmwUpView;
      varying vec3 vNfsmwEastView;
      varying vec3 vNfsmwSouthView;
      ` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vNfsmwWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vNfsmwUpView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vNfsmwEastView = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vNfsmwSouthView = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
        `,
      );

    shader.fragmentShader =
      `
      uniform float uPuddleAmount;
      uniform float uWetTime;
      uniform float uTrackSeed;
      uniform sampler2D uDetailNormalMap;
      uniform float uHasDetailNormal;
      uniform vec3 uSunDir;
      uniform vec3 uHeadPosL;
      uniform vec3 uHeadPosR;
      uniform vec3 uHeadDir;
      uniform float uHeadIntensity;
      uniform vec3 uBrakePosL;
      uniform vec3 uBrakePosR;
      uniform float uBrakeIntensity;
      varying vec3 vNfsmwWorldPos;
      varying vec3 vNfsmwUpView;
      varying vec3 vNfsmwEastView;
      varying vec3 vNfsmwSouthView;

      float nfsmwHash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      float nfsmwNoise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = nfsmwHash21(i);
        float b = nfsmwHash21(i + vec2(1.0, 0.0));
        float c = nfsmwHash21(i + vec2(0.0, 1.0));
        float d = nfsmwHash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      vec2 nfsmwEvaluateWetness(vec2 worldXZ, float amount) {
        vec2 seededXZ = worldXZ + vec2(uTrackSeed * 7.3, uTrackSeed * 19.1);
        float macro = nfsmwNoise2(seededXZ * vec2(0.085, 0.045));
        float detail = nfsmwNoise2(seededXZ * vec2(0.29, 0.19) + vec2(11.3, 4.7));
        float micro = nfsmwNoise2(seededXZ * 0.85);
        float field = macro * 0.58 + detail * 0.30 + micro * 0.12;
        float gutterBias = smoothstep(3.2, 9.2, abs(worldXZ.x)) * 0.10;
        float combined = field + gutterBias;

        float threshold = mix(0.80, 0.46, clamp(amount, 0.0, 1.0));
        float dampMask = smoothstep(threshold - 0.14, threshold + 0.04, combined) * clamp(amount * 1.15, 0.0, 1.0);
        float puddleMask = smoothstep(threshold + 0.02, threshold + 0.15, combined) * clamp(amount, 0.0, 1.0);
        return vec2(dampMask, puddleMask);
      }

      float nfsmwEvaluateTarCracks(vec2 worldXZ) {
        vec2 p = worldXZ * vec2(0.24, 0.17) + vec2(uTrackSeed * 5.1, uTrackSeed * 13.7);
        float warp1 = nfsmwNoise2(p * 2.3) * 0.65 + nfsmwNoise2(p * 6.1) * 0.22;
        float ridgeA = abs(nfsmwNoise2(p + vec2(warp1, -warp1 * 0.7)) - 0.50);
        float ridgeB = abs(nfsmwNoise2(p * 1.45 + vec2(-warp1 * 0.8, warp1)) - 0.50);
        float presence = smoothstep(0.46, 0.66, nfsmwNoise2(worldXZ * 0.055 + vec2(uTrackSeed * 3.1, 8.4)));
        float seamA = (1.0 - smoothstep(0.004, 0.020, ridgeA)) * presence;
        float seamB = (1.0 - smoothstep(0.003, 0.015, ridgeB)) * presence * 0.75;
        return clamp(max(seamA, seamB), 0.0, 1.0);
      }

      vec3 nfsmwSampleMicroDetail(vec2 worldXZ, float closeMask) {
        mat2 rot2 = mat2(0.819, -0.574, 0.574, 0.819);
        vec2 uvCoarse = worldXZ * 1.55;
        vec2 uvFine = (rot2 * worldXZ) * 5.15;
        vec2 slope = vec2(0.0);
        float pebbleTone = 0.0;
        if (uHasDetailNormal > 0.5) {
          vec2 n1 = texture2D(uDetailNormalMap, uvCoarse).xy * 2.0 - 1.0;
          vec2 n2 = texture2D(uDetailNormalMap, uvFine).xy * 2.0 - 1.0;
          slope = (n1 * 0.62 + n2 * 0.48) * closeMask;
          pebbleTone = (n1.x + n2.y) * 0.5;
        } else {
          float g1 = nfsmwNoise2(worldXZ * 26.0);
          float g2 = nfsmwNoise2((rot2 * worldXZ) * 68.0);
          slope = vec2(g1 - 0.5, g2 - 0.5) * 0.95 * closeMask;
          pebbleTone = (g1 - 0.5) * 1.4;
        }
        return vec3(slope, pebbleTone);
      }

      vec3 nfsmwEvalHeadlightCone(vec3 worldPos, vec3 lightPos, vec3 lightDir, vec3 worldN, vec3 worldV, float rough) {
        vec3 toSurf = worldPos - lightPos;
        float dist = length(toSurf);
        if (dist < 0.15 || dist > 30.0) return vec3(0.0);
        vec3 L = -toSurf / dist;
        float forwardProj = dot(-L, lightDir);
        float cone = smoothstep(0.84, 0.985, forwardProj);
        float atten = cone / (1.0 + 0.085 * dist + 0.022 * dist * dist);
        float ndl = max(dot(worldN, vec3(-L.x, abs(L.y) + 0.24, -L.z)), 0.0);
        vec3 H = normalize(L + worldV);
        float shininess = mix(96.0, 18.0, clamp(rough, 0.05, 1.0));
        float spec = pow(max(dot(worldN, H), 0.0), shininess) * mix(1.35, 0.28, rough);
        return vec3(0.86, 0.94, 1.06) * atten * (ndl * 0.48 + spec * 0.92);
      }

      vec3 nfsmwEvalBrakePool(vec3 worldPos, vec3 lampPos, vec3 worldN, vec3 worldV, float rough) {
        vec3 toSurf = worldPos - lampPos;
        float dist = length(toSurf);
        if (dist < 0.12 || dist > 15.0) return vec3(0.0);
        vec3 L = -toSurf / dist;
        // Proyección hacia atrás del vehículo y sobre el pavimento cercano a cada óptica trasera
        float atten = (1.0 - smoothstep(1.8, 14.5, dist)) / (0.42 + 0.11 * dist * dist);
        vec3 H = normalize(vec3(L.x, abs(L.y) + 0.24, L.z) + worldV);
        float shininess = mix(76.0, 12.0, clamp(rough, 0.05, 1.0));
        float spec = pow(max(dot(worldN, H), 0.0), shininess) * mix(1.95, 0.58, rough);
        float diff = max(dot(worldN, vec3(0.0, 1.0, 0.0)), 0.0) * 0.45;
        return vec3(3.85, 0.15, 0.075) * atten * (diff + spec);
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float nfsmwCamDist = length(cameraPosition - vNfsmwWorldPos);
          float nfsmwCloseMask = 1.0 - smoothstep(6.0, 42.0, nfsmwCamDist);
          vec2 nfsmwWet = nfsmwEvaluateWetness(vNfsmwWorldPos.xz, uPuddleAmount);
          float nfsmwDampMask = nfsmwWet.x;
          float nfsmwPuddleMask = nfsmwWet.y;
          float nfsmwTarMask = nfsmwEvaluateTarCracks(vNfsmwWorldPos.xz) * (1.0 - nfsmwPuddleMask * 0.85);
          vec3 nfsmwMicro = nfsmwSampleMicroDetail(vNfsmwWorldPos.xz, nfsmwCloseMask);

          // Grano de árido mineral nítido en primer plano + desgaste de carril
          float nfsmwPebbleGrain = nfsmwMicro.z * 0.16 * nfsmwCloseMask * (1.0 - nfsmwPuddleMask);
          diffuseColor.rgb *= (1.0 + nfsmwPebbleGrain);

          // Costuras de alquitrán negro sellado sobre fisuras del pavimento
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.020, 0.023, 0.028), nfsmwTarMask * 0.90);

          // Oscurecimiento físico de asfalto poroso húmedo + película de agua cálida
          diffuseColor.rgb *= mix(1.0, 0.50, nfsmwDampMask * 0.68);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.84, 0.78), nfsmwPuddleMask * 0.65);
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          #include <roughnessmap_fragment>
          // Costuras de alquitrán brillantes (baja rugosidad) y micro-variación de piedras en primer plano
          roughnessFactor = mix(roughnessFactor, 0.16, nfsmwTarMask * 0.85);
          roughnessFactor = clamp(roughnessFactor - nfsmwMicro.z * 0.09 * nfsmwCloseMask, 0.04, 0.98);
          roughnessFactor = mix(roughnessFactor, 0.28, nfsmwDampMask * 0.76);
          roughnessFactor = mix(roughnessFactor, 0.035, nfsmwPuddleMask * 0.96);
          `,
        )
        .replace(
          '#include <metalnessmap_fragment>',
          `
          #include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 0.18, nfsmwTarMask * 0.55);
          metalnessFactor = mix(metalnessFactor, 0.34, nfsmwPuddleMask * 0.88);
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          #include <normal_fragment_maps>
          float nfsmwDrySurface = 1.0 - nfsmwPuddleMask * 0.92;
          if (nfsmwCloseMask > 0.005 && nfsmwDrySurface > 0.02) {
            vec3 detailPerturb =
              vNfsmwEastView * (nfsmwMicro.x * 0.46) +
              vNfsmwSouthView * (nfsmwMicro.y * 0.46);
            normal = normalize(normal + detailPerturb * nfsmwDrySurface);
          }
          if (nfsmwPuddleMask > 0.01) {
            float ripX = sin(vNfsmwWorldPos.x * 13.0 + uWetTime * 2.2) * cos(vNfsmwWorldPos.z * 9.5 - uWetTime * 1.7) * 0.011;
            float ripZ = cos(vNfsmwWorldPos.z * 14.0 + uWetTime * 1.9) * 0.011;
            vec3 puddleNormal = normalize(vNfsmwUpView + vNfsmwEastView * ripX + vNfsmwSouthView * ripZ);
            normal = normalize(mix(normal, puddleNormal, nfsmwPuddleMask * 0.94));
          }
          `,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          {
            vec3 nfsmwWorldV = normalize(cameraPosition - vNfsmwWorldPos);
            vec3 nfsmwWorldN = normalize(vec3(
              -nfsmwMicro.x * 0.55 * (1.0 - nfsmwPuddleMask),
              1.0,
              -nfsmwMicro.y * 0.55 * (1.0 - nfsmwPuddleMask)
            ));

            // Micro-destellos minerales del árido (micro-glints) al sol dorado de ángulo bajo
            vec3 sunHalf = normalize(normalize(uSunDir) + nfsmwWorldV);
            float facetGlint = pow(max(dot(nfsmwWorldN, sunHalf), 0.0), mix(110.0, 28.0, roughnessFactor));
            float sparkleGrain = smoothstep(0.68, 0.96, nfsmwHash21(floor(vNfsmwWorldPos.xz * 78.0)));
            float sunGlintStrength = facetGlint * (0.32 + sparkleGrain * 0.95 * nfsmwCloseMask) * mix(1.15, 0.30, roughnessFactor);
            totalEmissiveRadiance += vec3(1.0, 0.78, 0.44) * sunGlintStrength * 0.42;

            // Iluminación rasante simétrica de ambos faros delanteros sobre el grano de asfalto cercano
            if (uHeadIntensity > 0.01) {
              vec3 headDirNorm = normalize(uHeadDir);
              vec3 hlL = nfsmwEvalHeadlightCone(vNfsmwWorldPos, uHeadPosL, headDirNorm, nfsmwWorldN, nfsmwWorldV, roughnessFactor);
              vec3 hlR = nfsmwEvalHeadlightCone(vNfsmwWorldPos, uHeadPosR, headDirNorm, nfsmwWorldN, nfsmwWorldV, roughnessFactor);
              totalEmissiveRadiance += (hlL + hlR) * uHeadIntensity;
            }

            // Reflejo rojo simétrico de las DOS luces traseras de freno sobre árido, fisuras y parches húmedos
            if (uBrakeIntensity > 0.01) {
              vec3 brL = nfsmwEvalBrakePool(vNfsmwWorldPos, uBrakePosL, nfsmwWorldN, nfsmwWorldV, roughnessFactor);
              vec3 brR = nfsmwEvalBrakePool(vNfsmwWorldPos, uBrakePosR, nfsmwWorldN, nfsmwWorldV, roughnessFactor);
              totalEmissiveRadiance += (brL + brR) * uBrakeIntensity;
            }
          }
          `,
        );
  };
  roadMat.needsUpdate = true;

  return {
    setPuddleState: (puddleAmount, timeSec) => {
      customUniforms.uPuddleAmount.value = puddleAmount;
      customUniforms.uWetTime.value = timeSec;
    },
    setSunDirection: (sunX, sunY, sunZ) => {
      customUniforms.uSunDir.value.set(sunX, sunY, sunZ).normalize();
    },
    setVehicleLightState: (state) => {
      customUniforms.uHeadPosL.value.copy(state.headLeft);
      customUniforms.uHeadPosR.value.copy(state.headRight);
      customUniforms.uHeadDir.value.copy(state.headDir).normalize();
      customUniforms.uHeadIntensity.value = state.headIntensity;
      customUniforms.uBrakePosL.value.copy(state.brakeLeft);
      customUniforms.uBrakePosR.value.copy(state.brakeRight);
      customUniforms.uBrakeIntensity.value = state.brakeIntensity;
    },
  };
}

/**
 * Estado puro y determinista de partículas ambientales otoñales (hojas secas + motas de polvo en haces solares).
 * Desacoplado para pruebas unitarias rápidas con 0 GC en el bucle de render.
 */
export interface AutumnLeafParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  scale: number;
  phase: number;
}

export function createAutumnLeafParticlePool(count: number, seed = 2005): AutumnLeafParticle[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const leaves: AutumnLeafParticle[] = [];
  for (let i = 0; i < count; i++) {
    leaves.push({
      x: (rand() - 0.5) * 48,
      y: 0.06 + rand() * 2.6,
      z: -12 + rand() * 68,
      vx: 2.2 + rand() * 3.4,
      vy: (rand() - 0.45) * 0.65,
      vz: -1.4 + rand() * 2.8,
      rotX: rand() * Math.PI * 2,
      rotY: rand() * Math.PI * 2,
      rotZ: rand() * Math.PI * 2,
      spinX: (rand() - 0.5) * 6.4,
      spinY: (rand() - 0.5) * 5.2,
      spinZ: (rand() - 0.5) * 7.0,
      scale: 0.78 + rand() * 0.58,
      phase: rand() * Math.PI * 2,
    });
  }
  return leaves;
}

export function stepAutumnLeafParticlePool(
  leaves: AutumnLeafParticle[],
  anchorX: number,
  anchorZ: number,
  timeSec: number,
  dt: number,
): void {
  const clampedDt = Math.min(0.08, Math.max(0, dt));
  const halfSpanX = 26;
  const backSpanZ = 18;
  const frontSpanZ = 54;
  const spanZ = backSpanZ + frontSpanZ;

  for (let i = 0; i < leaves.length; i++) {
    const p = leaves[i];
    const gust = Math.sin(timeSec * 1.65 + p.phase + p.z * 0.08) * 1.45;
    const updraft = Math.sin(timeSec * 2.7 + p.phase * 1.9 + p.x * 0.14) * 0.55;

    p.x += (p.vx + gust) * clampedDt;
    p.y += (p.vy + updraft - 0.28) * clampedDt;
    p.z += (p.vz + Math.cos(timeSec * 1.2 + p.phase) * 0.75) * clampedDt;

    if (p.y < 0.04) {
      p.y = 0.04 + Math.abs(Math.sin(timeSec * 4.0 + p.phase)) * 0.22;
      p.vy = 0.35 + (i % 5) * 0.12;
    } else if (p.y > 3.6) {
      p.y = 0.35 + (i % 7) * 0.28;
      p.vy = -0.15;
    }

    p.rotX += p.spinX * clampedDt;
    p.rotY += p.spinY * clampedDt;
    p.rotZ += p.spinZ * clampedDt;

    // Envolver de forma continua dentro del volumen alrededor del jugador/cámara
    const dx = p.x - anchorX;
    if (dx > halfSpanX) p.x -= halfSpanX * 2;
    else if (dx < -halfSpanX) p.x += halfSpanX * 2;

    const minZ = anchorZ - backSpanZ;
    const maxZ = anchorZ + frontSpanZ;
    if (p.z < minZ) p.z += spanZ;
    else if (p.z > maxZ) p.z -= spanZ;
  }
}

function createCurledAutumnLeafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.22, 0.13, 3, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    // Silueta ahusada de hoja seca con curvatura orgánica
    const normX = lx / 0.11;
    const taper = Math.max(0.18, 1.0 - normX * normX * 0.72);
    const curlZ = (normX * normX * 0.022) - Math.abs(ly / 0.065) * 0.014;
    pos.setY(i, ly * taper);
    pos.setZ(i, curlZ);
  }
  geo.computeVertexNormals();
  return geo;
}

export interface AutumnAtmosphericParticlesController {
  group: THREE.Group;
  update: (
    anchorX: number,
    anchorY: number,
    anchorZ: number,
    sunDir: readonly [number, number, number],
    weatherMode: WeatherMode,
    timeSec: number,
    dt: number,
  ) => void;
  dispose: () => void;
}

export function createAutumnAtmosphericParticles(options?: {
  isMobilePerf?: boolean;
}): AutumnAtmosphericParticlesController {
  const isMobile = Boolean(options?.isMobilePerf);
  const leafCount = isMobile ? 56 : 112;
  const moteCount = isMobile ? 96 : 190;

  const group = new THREE.Group();
  group.name = 'nfsmw_atmospheric_particles';

  // 1. Hojas secas de otoño cruzando la calzada con el viento
  const leafPool = createAutumnLeafParticlePool(leafCount, 200511);
  const leafGeo = createCurledAutumnLeafGeometry();
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.74,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const leafInstanced = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  leafInstanced.name = 'nfsmw_autumn_blowing_leaves';
  leafInstanced.castShadow = false;
  leafInstanced.receiveShadow = true;
  leafInstanced.frustumCulled = false;
  leafInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const leafPalette = [
    new THREE.Color('#c96a24'), // Ámbar cobrizo
    new THREE.Color('#d99b26'), // Ocre dorado
    new THREE.Color('#a34222'), // Rojizo hoja seca
    new THREE.Color('#b67d30'), // Bronce otoñal
    new THREE.Color('#8c5627'), // Siena tostado
  ];
  for (let i = 0; i < leafCount; i++) {
    leafInstanced.setColorAt(i, leafPalette[i % leafPalette.length]);
  }
  if (leafInstanced.instanceColor) leafInstanced.instanceColor.needsUpdate = true;
  group.add(leafInstanced);

  // 2. Motas de polvo doradas flotando en haces de luz solar (sunbeams)
  const moteOffsets = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount);
  let mSeed = 918273;
  const mRand = () => {
    mSeed = (Math.imul(mSeed, 1664525) + 1013904223) >>> 0;
    return mSeed / 4294967296;
  };
  for (let i = 0; i < moteCount; i++) {
    moteOffsets[i * 3] = (mRand() - 0.5) * 40;
    moteOffsets[i * 3 + 1] = 0.4 + mRand() * 6.8;
    moteOffsets[i * 3 + 2] = -10 + mRand() * 52;
    moteSeeds[i] = mRand() * Math.PI * 2;
  }

  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteOffsets, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeeds, 1));

  const moteUniforms = {
    uAnchor: { value: new THREE.Vector3(0, 1.5, 0) },
    uSunDir: { value: new THREE.Vector3(0.56, 0.52, -0.65).normalize() },
    uTime: { value: 0 },
    uOpacity: { value: 0.62 },
  };

  const moteMat = new THREE.ShaderMaterial({
    uniforms: moteUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform vec3 uAnchor;
      uniform vec3 uSunDir;
      uniform float uTime;
      varying float vBeamAlpha;

      void main() {
        vec3 local = position;
        // Deriva suave en el aire cálido vespertino envuelta alrededor de la cámara
        float wx = mod(local.x + uTime * 0.42 + sin(uTime * 0.7 + aSeed) * 0.8 - uAnchor.x + 20.0, 40.0) - 20.0 + uAnchor.x;
        float wy = 0.35 + mod(local.y + sin(uTime * 0.55 + aSeed * 1.7) * 0.45, 6.8);
        float wz = mod(local.z + cos(uTime * 0.38 + aSeed) * 0.7 - uAnchor.z + 12.0, 52.0) - 12.0 + uAnchor.z;
        vec3 worldPos = vec3(wx, wy, wz);

        // Modular brillo dentro de haces diagonales de luz solar entre edificios y copas
        float sunShaft = smoothstep(0.15, 0.88, sin(worldPos.x * 0.34 - worldPos.y * 0.28 + worldPos.z * 0.21) * 0.5 + 0.5);
        vec3 toCam = normalize(cameraPosition - worldPos);
        float miePhase = 0.45 + 0.55 * pow(max(0.0, dot(-toCam, normalize(uSunDir))), 3.0);
        vBeamAlpha = sunShaft * miePhase * (0.55 + 0.45 * sin(uTime * 2.1 + aSeed * 3.1));

        vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(24.0 / max(1.0, -mvPos.z), 1.5, 6.5);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vBeamAlpha;

      void main() {
        vec2 p = gl_PointCoord - vec2(0.5);
        float r2 = dot(p, p);
        if (r2 > 0.25) discard;
        float soft = exp(-r2 * 14.0);
        vec3 warmGold = vec3(1.0, 0.83, 0.50);
        gl_FragColor = vec4(warmGold, soft * vBeamAlpha * uOpacity);
      }
    `,
  });

  const dustMotes = new THREE.Points(moteGeo, moteMat);
  dustMotes.name = 'nfsmw_sunbeam_dust_motes';
  dustMotes.frustumCulled = false;
  group.add(dustMotes);

  // Helpers pre-alocados (0 GC en tick)
  const _mat = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _euler = new THREE.Euler();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();

  return {
    group,
    update: (anchorX, anchorY, anchorZ, sunDir, weatherMode, timeSec, dt) => {
      const heavyRain = weatherMode === 'storm' || weatherMode === 'flood';
      stepAutumnLeafParticlePool(leafPool, anchorX, anchorZ, timeSec, heavyRain ? dt * 1.45 : dt);

      for (let i = 0; i < leafCount; i++) {
        const p = leafPool[i];
        _pos.set(p.x, p.y, p.z);
        _euler.set(p.rotX, p.rotY, p.rotZ, 'XYZ');
        _quat.setFromEuler(_euler);
        _scale.setScalar(p.scale);
        _mat.compose(_pos, _quat, _scale);
        leafInstanced.setMatrixAt(i, _mat);
      }
      leafInstanced.instanceMatrix.needsUpdate = true;

      moteUniforms.uAnchor.value.set(anchorX, anchorY, anchorZ);
      moteUniforms.uSunDir.value.set(sunDir[0], sunDir[1], sunDir[2]).normalize();
      moteUniforms.uTime.value = timeSec;
      moteUniforms.uOpacity.value =
        weatherMode === 'sunny' ? 0.65 : weatherMode === 'cloudy' ? 0.34 : 0.12;
    },
    dispose: () => {
      leafGeo.dispose();
      leafMat.dispose();
      moteGeo.dispose();
      moteMat.dispose();
    },
  };
}
