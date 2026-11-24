// Three.js WebGL renderer, procedural PMREM environment reflections,
// custom GLSL atmospheric sky dome, 3 time-of-day moods, shadow-tracking sun,
// and pooled dynamic lights for strobes, explosions, and neon districts.

import * as THREE from 'three';

export const MOOD_PRESETS = {
  golden: {
    id: 'golden',
    label: 'GOLDEN HR',
    clock: '17:48',
    skyTop: 0x263f80,
    skyMid: 0xd96b70,
    skyHorizon: 0xffb36c,
    sunColor: 0xffd084,
    sunDir: new THREE.Vector3(0.68, 0.22, 0.70).normalize(),
    sunIntensity: 3.35,
    hemiSky: 0xffb98a,
    hemiGround: 0x3b334f,
    hemiIntensity: 1.08,
    fogColor: 0xe89678,
    fogNear: 165,
    fogFar: 490,
    exposure: 1.2,
    nightFactor: 0.3,
    envIntensity: 1.25,
  },
  day: {
    id: 'day',
    label: 'SUN NOON',
    clock: '13:15',
    skyTop: 0x1668c4,
    skyMid: 0x4ca9eb,
    skyHorizon: 0xbfe9fa,
    sunColor: 0xfff8e6,
    sunDir: new THREE.Vector3(0.42, 0.78, -0.46).normalize(),
    sunIntensity: 3.25,
    hemiSky: 0x9fd8ff,
    hemiGround: 0x6b6458,
    hemiIntensity: 1.18,
    fogColor: 0xaedff4,
    fogNear: 175,
    fogFar: 520,
    exposure: 1.12,
    nightFactor: 0.0,
    envIntensity: 1.15,
  },
  night: {
    id: 'night',
    label: 'NEON NIGHT',
    clock: '23:20',
    skyTop: 0x050919,
    skyMid: 0x121d42,
    skyHorizon: 0x2d2458,
    sunColor: 0x89b4ff,
    sunDir: new THREE.Vector3(-0.38, 0.56, -0.74).normalize(),
    sunIntensity: 1.05,
    hemiSky: 0x3a5299,
    hemiGround: 0x1b152d,
    hemiIntensity: 0.75,
    fogColor: 0x141a38,
    fogNear: 105,
    fogFar: 360,
    exposure: 1.24,
    nightFactor: 1.0,
    envIntensity: 0.85,
  },
};

export class RendererPipeline {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xe8997c, 150, 460);

    this.camera = new THREE.PerspectiveCamera(
      56,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.35,
      900,
    );

    this.currentMood = 'golden';
    this.nightFactor = 0.32;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTargets = {};

    this._setupLights();
    this._setupSkyDome();
    this._setupDynamicLights();
    this.setMood('golden');

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  _setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffb98a, 0x3b334f, 1.05);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffcf88, 3.1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 290;
    const frustum = 96;
    this.sunLight.shadow.camera.left = -frustum;
    this.sunLight.shadow.camera.right = frustum;
    this.sunLight.shadow.camera.top = frustum;
    this.sunLight.shadow.camera.bottom = -frustum;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.04;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Subtle rim light opposite the sun for crisp silhouette separation
    this.rimLight = new THREE.DirectionalLight(0x5ed9ff, 0.55);
    this.rimLight.position.set(-70, 45, 75);
    this.scene.add(this.rimLight);
  }

  _setupSkyDome() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color(0x263f80) },
      uMid: { value: new THREE.Color(0xd96b70) },
      uHorizon: { value: new THREE.Color(0xffb36c) },
      uSunColor: { value: new THREE.Color(0xffe1a8) },
      uSunDir: { value: new THREE.Vector3(0.74, 0.24, -0.62).normalize() },
      uNight: { value: 0.32 },
      uTime: { value: 0 },
    };

    const skyGeo = new THREE.SphereGeometry(720, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uNight;
        uniform float uTime;

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

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 lower = mix(uHorizon, uMid, smoothstep(0.0, 0.24, h));
          vec3 col = mix(lower, uTop, smoothstep(0.18, 0.78, h));

          // Soft coastal cumulus clouds
          if (dir.y > 0.03) {
            vec2 cuv = dir.xz / (dir.y + 0.26) * 1.45 + vec2(uTime * 0.008, -uTime * 0.004);
            float n = noise2(cuv) * 0.62 + noise2(cuv * 2.3 + 5.1) * 0.38;
            float cloud = smoothstep(0.56, 0.84, n) * smoothstep(0.03, 0.25, dir.y) * (1.0 - smoothstep(0.65, 0.95, dir.y));
            vec3 cloudCol = mix(vec3(1.0, 0.97, 0.94), uHorizon * 1.18, 0.45);
            cloudCol = mix(cloudCol, vec3(0.22, 0.24, 0.42), uNight * 0.85);
            col = mix(col, cloudCol, cloud * 0.55);
          }

          // Sun or Moon disc + atmospheric halo
          float sunDot = clamp(dot(dir, normalize(uSunDir)), 0.0, 1.0);
          float disc = smoothstep(0.9985, 0.9994, sunDot);
          float halo = pow(sunDot, 12.0) * mix(0.45, 0.12, uNight) + pow(sunDot, 90.0) * 0.55;
          col += uSunColor * (disc * 2.4 + halo);

          // Twinkling stars at night
          if (uNight > 0.4 && dir.y > 0.08) {
            vec2 suv = floor(dir.xz / (dir.y + 0.15) * 140.0);
            float s = hash21(suv);
            float star = step(0.9965, s) * smoothstep(0.4, 0.95, uNight) * smoothstep(0.08, 0.38, dir.y);
            col += vec3(0.85, 0.92, 1.0) * star * (0.7 + 0.3 * sin(uTime * 2.4 + s * 60.0));
          }

          // Subtle coastal neon skyline haze near night horizon
          float neonBand = (1.0 - smoothstep(0.0, 0.16, abs(dir.y))) * uNight;
          col += vec3(0.22, 0.06, 0.28) * neonBand * 0.7;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);
  }

  _buildEnvironmentMap(moodKey) {
    if (this.envTargets[moodKey]) return this.envTargets[moodKey].texture;
    const preset = MOOD_PRESETS[moodKey];
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(preset.skyMid);

    const upper = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 10),
      new THREE.MeshBasicMaterial({ color: preset.skyTop, side: THREE.BackSide }),
    );
    envScene.add(upper);

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(18, 18, 8, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: preset.skyHorizon, side: THREE.BackSide }),
    );
    envScene.add(band);

    const sunCard = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 10, 10),
      new THREE.MeshBasicMaterial({ color: preset.sunColor }),
    );
    sunCard.position.copy(preset.sunDir).multiplyScalar(14);
    envScene.add(sunCard);

    // Extra coastal neon accent reflections for night & sunset cars
    const accentA = new THREE.Mesh(
      new THREE.BoxGeometry(8, 2.5, 1),
      new THREE.MeshBasicMaterial({ color: moodKey === 'night' ? 0x1de9d8 : 0xff9870 }),
    );
    accentA.position.set(-12, 3, 8);
    envScene.add(accentA);

    const accentB = new THREE.Mesh(
      new THREE.BoxGeometry(8, 2.5, 1),
      new THREE.MeshBasicMaterial({ color: moodKey === 'night' ? 0xff3b9a : 0x79c6ff }),
    );
    accentB.position.set(12, 3, -8);
    envScene.add(accentB);

    const rt = this.pmrem.fromScene(envScene, 0.04);
    this.envTargets[moodKey] = rt;
    return rt.texture;
  }

  _setupDynamicLights() {
    this.dynamicLights = {
      strobeRed: new THREE.PointLight(0xff1e45, 0, 26, 1.6),
      strobeBlue: new THREE.PointLight(0x2080ff, 0, 26, 1.6),
      explosion: new THREE.PointLight(0xff7722, 0, 42, 1.5),
      muzzle: new THREE.PointLight(0xffcb66, 0, 18, 2.0),
      neonA: new THREE.PointLight(0xff38a8, 0, 45, 1.4),
      neonB: new THREE.PointLight(0x1de9d8, 0, 45, 1.4),
    };
    for (const light of Object.values(this.dynamicLights)) {
      this.scene.add(light);
    }
  }

  setMood(moodKey) {
    const preset = MOOD_PRESETS[moodKey] || MOOD_PRESETS.golden;
    this.currentMood = preset.id;
    this.nightFactor = preset.nightFactor;

    this.skyUniforms.uTop.value.setHex(preset.skyTop);
    this.skyUniforms.uMid.value.setHex(preset.skyMid);
    this.skyUniforms.uHorizon.value.setHex(preset.skyHorizon);
    this.skyUniforms.uSunColor.value.setHex(preset.sunColor);
    this.skyUniforms.uSunDir.value.copy(preset.sunDir);
    this.skyUniforms.uNight.value = preset.nightFactor;

    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;
    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;
    this.rimLight.color.setHex(preset.id === 'night' ? 0xff4cb8 : 0x62d9ff);
    this.rimLight.intensity = preset.id === 'night' ? 0.85 : 0.52;

    this.scene.fog.color.setHex(preset.fogColor);
    this.scene.fog.near = preset.fogNear;
    this.scene.fog.far = preset.fogFar;
    this.renderer.toneMappingExposure = preset.exposure;
    this.scene.environment = this._buildEnvironmentMap(preset.id);
    this.scene.environmentIntensity = preset.envIntensity;

    // Position ambient district neon fill lights for Lantern Night Market & Mirage Strip
    const neonStrength = preset.id === 'night' ? 42 : preset.id === 'golden' ? 14 : 0;
    this.dynamicLights.neonA.position.set(-4, 9, 98);
    this.dynamicLights.neonA.intensity = neonStrength;
    this.dynamicLights.neonB.position.set(96, 10, -24);
    this.dynamicLights.neonB.intensity = neonStrength * 0.85;

    return preset;
  }

  cycleMood() {
    const order = ['golden', 'day', 'night'];
    const idx = (order.indexOf(this.currentMood) + 1) % order.length;
    return this.setMood(order[idx]);
  }

  updateLighting(anchorPos, elapsed) {
    this.skyUniforms.uTime.value = elapsed;
    this.skyMesh.position.set(anchorPos.x, 0, anchorPos.z);

    // Snap directional shadow frustum to texel grid around the player
    const snap = 2.0;
    const sx = Math.round(anchorPos.x / snap) * snap;
    const sz = Math.round(anchorPos.z / snap) * snap;
    const sunDir = MOOD_PRESETS[this.currentMood].sunDir;
    this.sunLight.target.position.set(sx, 0, sz);
    this.sunLight.position.set(
      sx + sunDir.x * 130,
      Math.max(28, sunDir.y * 130),
      sz + sunDir.z * 130,
    );
  }

  pulseExplosionLight(pos, intensity = 55) {
    this.dynamicLights.explosion.position.set(pos.x, pos.y + 3.2, pos.z);
    this.dynamicLights.explosion.intensity = Math.max(this.dynamicLights.explosion.intensity, intensity);
  }

  pulseMuzzleLight(pos) {
    this.dynamicLights.muzzle.position.set(pos.x, pos.y + 1.4, pos.z);
    this.dynamicLights.muzzle.intensity = 22;
  }

  decayTransientLights(dt) {
    this.dynamicLights.explosion.intensity = Math.max(0, this.dynamicLights.explosion.intensity - dt * 52);
    this.dynamicLights.muzzle.intensity = Math.max(0, this.dynamicLights.muzzle.intensity - dt * 190);
  }

  resize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getDiagnostics() {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      mood: this.currentMood,
    };
  }
}
