// Procedural 3D metropolis builder for Solara Bay:
// 6 distinct architectural districts, custom GLSL ocean waves & sun reflections,
// golden beach & boardwalk, Coral Cove Marina piers/yachts/lighthouse,
// Lantern Night Market arches, Solara Customs Garage, and stunt ramps.

import * as THREE from 'three';
import { CITY_CONFIG, createSeededRng, getDistrictAt } from '../engine/gameConfig.js';
import { createBillboardTexture, createFacadeSet, createRoadTextures } from './proceduralTextures.js';

export function buildSolaraBayCity(scene, roadNetwork) {
  const rng = createSeededRng(202606);
  const cityGroup = new THREE.Group();
  cityGroup.name = 'SolaraBayCity';
  scene.add(cityGroup);

  const roadTex = createRoadTextures();
  const nightMaterials = [];
  const animatedObjects = {
    oceanUniforms: null,
    yachts: [],
    lighthouseBeam: null,
    garageRing: null,
    neonStrips: [],
  };

  // ---------------- 1. GROUND, SIDEWALKS, BEACH & BOARDWALK ----------------
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: roadTex.sidewalk,
    roughness: 0.88,
    metalness: 0.04,
  });
  const cityBase = new THREE.Mesh(new THREE.PlaneGeometry(400, 540), sidewalkMat);
  cityBase.rotation.x = -Math.PI / 2;
  cityBase.position.set(-80, -0.04, 0);
  cityBase.receiveShadow = true;
  cityGroup.add(cityBase);

  // Golden Beach Sand strip along East coast
  const sandMat = new THREE.MeshStandardMaterial({
    map: roadTex.sand,
    roughness: 0.94,
    metalness: 0.0,
  });
  const beachMesh = new THREE.Mesh(new THREE.PlaneGeometry(76, 580), sandMat);
  beachMesh.rotation.x = -Math.PI / 2;
  beachMesh.position.set(148, -0.22, 0);
  beachMesh.rotation.y = 0;
  beachMesh.receiveShadow = true;
  cityGroup.add(beachMesh);

  // Wooden Mirage Boardwalk right between Mirage Boulevard & the Golden Beach
  const boardwalkMat = new THREE.MeshStandardMaterial({
    map: roadTex.boardwalk,
    roughness: 0.82,
    metalness: 0.04,
  });
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(10, 0.24, 460), boardwalkMat);
  boardwalk.position.set(113, 0.06, 0);
  boardwalk.receiveShadow = true;
  cityGroup.add(boardwalk);

  // Turquoise coastal guardrail posts along boardwalk
  const railMat = new THREE.MeshStandardMaterial({ color: 0xeaf4fa, roughness: 0.45, metalness: 0.25 });
  const railBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 456), railMat);
  railBeam.position.set(117.7, 0.96, 0);
  cityGroup.add(railBeam);

  // ---------------- 2. CUSTOM GLSL SPARKLING OCEAN ----------------
  const oceanUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.74, 0.24, -0.62).normalize() },
    uSunColor: { value: new THREE.Color(0xffd28c) },
    uShallow: { value: new THREE.Color(0x22d1d6) },
    uDeep: { value: new THREE.Color(0x0c3f75) },
    uNight: { value: 0.32 },
  };
  animatedObjects.oceanUniforms = oceanUniforms;

  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 pos = position;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        float w1 = sin(wp.x * 0.12 + uTime * 1.8) * cos(wp.z * 0.08 + uTime * 1.2) * 0.28;
        float w2 = sin(wp.z * 0.24 - uTime * 2.2 + wp.x * 0.06) * 0.12;
        pos.z += w1 + w2;
        vWave = w1 + w2;
        vec4 finalW = modelMatrix * vec4(pos, 1.0);
        vWorldPos = finalW.xyz;
        gl_Position = projectionMatrix * viewMatrix * finalW;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform float uNight;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        float shore = clamp((vWorldPos.x - 156.0) / 85.0, 0.0, 1.0);
        vec3 waterCol = mix(uShallow, uDeep, smoothstep(0.0, 1.0, shore));
        waterCol = mix(waterCol, vec3(0.03, 0.08, 0.20), uNight * 0.72);

        // Normal perturbation from wave ripples
        float nx = cos(vWorldPos.x * 0.35 + uTime * 2.1) * 0.14 + sin(vWorldPos.z * 0.55 - uTime * 1.7) * 0.08;
        float nz = sin(vWorldPos.z * 0.38 + uTime * 1.9) * 0.14;
        vec3 N = normalize(vec3(nx, 1.0, nz));
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);

        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
        float spec = pow(max(dot(N, H), 0.0), 96.0) * 1.8 + pow(max(dot(N, H), 0.0), 18.0) * 0.32;

        // Animated shoreline foam
        float foamWave = sin(vWorldPos.z * 0.28 + uTime * 2.4) * 1.8;
        float foam = (1.0 - smoothstep(0.0, 6.5, (vWorldPos.x - 156.0) + foamWave)) * 0.85;
        vec3 col = waterCol + vec3(0.18, 0.36, 0.48) * fres * (1.0 - uNight * 0.5);
        col += uSunColor * spec * mix(1.2, 0.45, uNight);
        col = mix(col, vec3(0.95, 0.98, 1.0), clamp(foam, 0.0, 0.9) * (1.0 - uNight * 0.55));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(540, 860, 56, 72), oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(428, -0.58, 0);
  cityGroup.add(oceanMesh);

  // ---------------- 3. ROADS & ZEBRA INTERSECTIONS ----------------
  const roadMatNS = new THREE.MeshStandardMaterial({
    map: roadTex.road.clone(),
    roughness: 0.78,
    metalness: 0.06,
  });
  roadMatNS.map.repeat.set(1, 22);
  roadMatNS.map.needsUpdate = true;

  const roadMatEW = new THREE.MeshStandardMaterial({
    map: roadTex.road.clone(),
    roughness: 0.78,
    metalness: 0.06,
  });
  roadMatEW.map.repeat.set(1, 16);
  roadMatEW.map.needsUpdate = true;

  const interMat = new THREE.MeshStandardMaterial({
    map: roadTex.intersection,
    roughness: 0.78,
    metalness: 0.06,
  });

  // North-South Avenues
  for (const ax of CITY_CONFIG.avenuesX) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(CITY_CONFIG.roadWidth, 424), roadMatNS);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(ax, 0.01, 0);
    strip.receiveShadow = true;
    cityGroup.add(strip);
  }

  // East-West Cross Streets
  for (const sz of CITY_CONFIG.streetsZ) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(CITY_CONFIG.roadWidth, 316), roadMatEW);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = Math.PI / 2;
    strip.position.set(-48, 0.015, sz);
    strip.receiveShadow = true;
    cityGroup.add(strip);
  }

  // Crisp Crosswalk Intersections
  const interGeo = new THREE.PlaneGeometry(CITY_CONFIG.roadWidth + 1.2, CITY_CONFIG.roadWidth + 1.2);
  for (const ax of CITY_CONFIG.avenuesX) {
    for (const sz of CITY_CONFIG.streetsZ) {
      const box = new THREE.Mesh(interGeo, interMat);
      box.rotation.x = -Math.PI / 2;
      box.position.set(ax, 0.03, sz);
      box.receiveShadow = true;
      cityGroup.add(box);
    }
  }

  // ---------------- 4. ARCHITECTURAL SKYLINE ACROSS 6 DISTRICTS ----------------
  const facadeMaterials = {
    artdeco: [0, 1, 2].map((i) => {
      const f = createFacadeSet('artdeco', 200 + i * 31);
      const m = new THREE.MeshStandardMaterial({
        map: f.map,
        emissiveMap: f.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.42,
        roughness: 0.62,
        metalness: 0.08,
      });
      nightMaterials.push(m);
      return m;
    }),
    downtown: [0, 1].map((i) => {
      const f = createFacadeSet('downtown', 400 + i * 29);
      const m = new THREE.MeshStandardMaterial({
        map: f.map,
        emissiveMap: f.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.68,
        envMapIntensity: 1.35,
      });
      nightMaterials.push(m);
      return m;
    }),
    market: [0, 1].map((i) => {
      const f = createFacadeSet('market', 600 + i * 19);
      const m = new THREE.MeshStandardMaterial({
        map: f.map,
        emissiveMap: f.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.85,
        roughness: 0.55,
        metalness: 0.14,
      });
      nightMaterials.push(m);
      return m;
    }),
    villa: [0, 1].map((i) => {
      const f = createFacadeSet('villa', 800 + i * 41);
      const m = new THREE.MeshStandardMaterial({
        map: f.map,
        emissiveMap: f.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35,
        roughness: 0.72,
        metalness: 0.05,
      });
      nightMaterials.push(m);
      return m;
    }),
    industrial: [0].map((i) => {
      const f = createFacadeSet('industrial', 950 + i * 17);
      const m = new THREE.MeshStandardMaterial({
        map: f.map,
        emissiveMap: f.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35,
        roughness: 0.68,
        metalness: 0.38,
      });
      nightMaterials.push(m);
      return m;
    }),
  };

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b4454, roughness: 0.85, metalness: 0.12 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0xc96647, roughness: 0.78, metalness: 0.05 });
  const neonColors = [0xff4b8b, 0x1de9d8, 0xffb347, 0x56aaff];
  const neonMats = neonColors.map((hex) => new THREE.MeshStandardMaterial({
    color: 0x111520,
    emissive: new THREE.Color(hex),
    emissiveIntensity: 1.8,
    roughness: 0.3,
  }));

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const instDummy = new THREE.Object3D();
  const instCol = new THREE.Color();

  // Batch rooftop crowns, spires & neon trims into InstancedMeshes to cut draw calls dramatically!
  const crownEntries = [];
  const neonEntries = [];

  const addBuilding = (cx, cz, bw, bd, bh, style, districtId, addNeonTrim = false) => {
    const matList = facadeMaterials[style] || facadeMaterials.artdeco;
    const mat = rng.pick(matList);
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(bw, bh, bd);
    mesh.position.set(cx, bh * 0.5, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cityGroup.add(mesh);

    const crownH = style === 'downtown' ? rng.range(3.2, 6.8) : rng.range(1.2, 2.8);
    crownEntries.push({
      x: cx, y: bh + crownH * 0.5, z: cz,
      sx: bw * 0.76, sy: crownH, sz: bd * 0.76,
      hex: style === 'villa' ? 0xc96647 : 0x3b4454,
    });

    if (style === 'downtown' && bh > 36) {
      crownEntries.push({
        x: cx, y: bh + crownH + 5, z: cz,
        sx: 0.45, sy: rng.range(6, 14), sz: 0.45,
        hex: 0x4c586b,
      });
    }

    if (addNeonTrim) {
      neonEntries.push({
        x: cx, y: bh - 0.5, z: cz,
        sx: bw + 0.48, sy: 0.55, sz: bd + 0.48,
        hex: rng.pick(neonColors),
      });
    }

    roadNetwork.registerBuilding(cx - bw * 0.5, cx + bw * 0.5, cz - bd * 0.5, cz + bd * 0.5, bh, districtId);
  };

  // Populate every city block between avenues & cross streets
  const blocksX = [
    { x0: -176, x1: -112 },
    { x0: -80, x1: -16 },
    { x0: 16, x1: 80 },
  ];
  const blocksZ = [
    { z0: -176, z1: -112 },
    { z0: -80, z1: -16 },
    { z0: 16, z1: 80 },
    { z0: 112, z1: 176 },
  ];

  for (let bx = 0; bx < blocksX.length; bx += 1) {
    for (let bz = 0; bz < blocksZ.length; bz += 1) {
      const bX = blocksX[bx];
      const bZ = blocksZ[bz];
      const midX = (bX.x0 + bX.x1) * 0.5;
      const midZ = (bZ.z0 + bZ.z1) * 0.5;
      const district = getDistrictAt(midX, midZ);

      // Reserve open plaza / Solara Customs Garage in southwest block (bx=0, bz=3)
      if (bx === 0 && bz === 3) {
        addBuilding(-162, 128, 22, 20, 14, 'industrial', district.id, true);
        addBuilding(-122, 166, 20, 18, 12, 'industrial', district.id, false);
        continue;
      }

      // Reserve Lantern Night Market central bazaar combat lane (bx=1, bz=3 & bz=2)
      if (bx === 1 && bz === 2) {
        addBuilding(-64, 34, 24, 24, 18, 'market', district.id, true);
        addBuilding(-30, 34, 22, 24, 22, 'market', district.id, true);
        addBuilding(-64, 66, 24, 22, 16, 'market', district.id, true);
        addBuilding(-30, 66, 22, 22, 20, 'market', district.id, true);
        continue;
      }

      // 2x2 sub-lots inside each city block with rich height variation
      const subCoords = [
        [bX.x0 + 16, bZ.z0 + 16],
        [bX.x1 - 16, bZ.z0 + 16],
        [bX.x0 + 16, bZ.z1 - 16],
        [bX.x1 - 16, bZ.z1 - 16],
      ];

      for (const [sx, sz] of subCoords) {
        let style = 'artdeco';
        let bh = rng.range(16, 30);
        let neon = false;

        if (bx === 2) {
          // Oceanfront Art-Deco Strip facing Mirage Boulevard (pure sunlit pastel hotels!)
          style = 'artdeco';
          bh = rng.range(18, 36);
          neon = true;
        } else if (bx === 1 && bz <= 1) {
          // Saffron Downtown gleaming high-rise skyline!
          style = 'downtown';
          bh = rng.range(34, 64);
          neon = rng.next() < 0.5;
        } else if (bx === 1 && bz >= 2) {
          // Lantern Night Market dense neon towers
          style = 'market';
          bh = rng.range(16, 28);
          neon = true;
        } else if (bx === 0 && bz <= 1) {
          // Palm Heights Mediterranean luxury villas & hillside mid-rises
          style = 'villa';
          bh = rng.range(11, 21);
          neon = false;
        } else {
          // Torque Quarter industrial warehouses
          style = 'industrial';
          bh = rng.range(12, 22);
          neon = rng.next() < 0.35;
        }

        const bw = rng.range(20, 26);
        const bd = rng.range(20, 26);
        addBuilding(sx, sz, bw, bd, bh, style, district.id, neon);
      }
    }
  }

  // Far outer skyline backdrop rings (West, North, South) for dramatic horizon depth
  for (let i = -3; i <= 3; i += 1) {
    addBuilding(-224, i * 62, 24, 34, rng.range(16, 32), i < 0 ? 'villa' : 'industrial', 'palm_heights', false);
    addBuilding(i * 44 - 55, -224, 28, 22, rng.range(24, 48), i >= 0 ? 'downtown' : 'villa', 'saffron_downtown', i === 1);
    addBuilding(i * 44 - 55, 224, 28, 22, rng.range(16, 30), i >= 0 ? 'market' : 'industrial', 'lantern_market', i >= 0);
  }

  // Finalize instanced crowns & rooftop neon strips (2 draw calls instead of ~180!)
  const crownInst = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.14 }), crownEntries.length);
  crownInst.castShadow = true;
  crownInst.receiveShadow = true;
  for (let i = 0; i < crownEntries.length; i += 1) {
    const c = crownEntries[i];
    instDummy.position.set(c.x, c.y, c.z);
    instDummy.rotation.set(0, 0, 0);
    instDummy.scale.set(c.sx, c.sy, c.sz);
    instDummy.updateMatrix();
    crownInst.setMatrixAt(i, instDummy.matrix);
    instCol.setHex(c.hex);
    crownInst.setColorAt(i, instCol);
  }
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  cityGroup.add(crownInst);

  const neonInst = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), neonEntries.length);
  for (let i = 0; i < neonEntries.length; i += 1) {
    const n = neonEntries[i];
    instDummy.position.set(n.x, n.y, n.z);
    instDummy.rotation.set(0, 0, 0);
    instDummy.scale.set(n.sx, n.sy, n.sz);
    instDummy.updateMatrix();
    neonInst.setMatrixAt(i, instDummy.matrix);
    instCol.setHex(n.hex);
    neonInst.setColorAt(i, instCol);
  }
  neonInst.instanceMatrix.needsUpdate = true;
  if (neonInst.instanceColor) neonInst.instanceColor.needsUpdate = true;
  cityGroup.add(neonInst);

  // ---------------- 5. ICONIC LANDMARKS & GLOWING BILLBOARDS ----------------
  const billboards = [
    { x: 81.5, y: 20, z: -48, rotY: Math.PI / 2, w: 16, h: 6, t: 'MIRAGE PALMS', s: 'OCEANFRONT RESORT', c: '#ff5e6c' },
    { x: 81.5, y: 22, z: 36, rotY: Math.PI / 2, w: 16, h: 6, t: 'HOTEL CORAL', s: 'ROOFTOP LOUNGE', c: '#1de9d8' },
    { x: 15.5, y: 30, z: -42, rotY: Math.PI / 2, w: 18, h: 6.5, t: 'SAFFRON BANK', s: 'SOLARA FINANCIAL TOWER', c: '#56b4ff' },
    { x: -4, y: 12.5, z: 86, rotY: 0, w: 18, h: 5.5, t: 'LANTERN BAZAAR', s: 'NIGHT MARKET DISTRICT', c: '#ff4eb8' },
    { x: -138, y: 11, z: 136, rotY: 0, w: 16, h: 5.2, t: 'SOLARA CUSTOMS', s: 'UPGRADES · RESPRAY · HEAT WIPE', c: '#2ee59d' },
    { x: 96, y: 11.5, z: -158, rotY: 0, w: 20, h: 5.0, t: 'APEX DRIFT CLUB', s: 'COASTAL STREET RACE START', c: '#ffb347' },
  ];

  for (const bb of billboards) {
    const tex = createBillboardTexture(bb.t, bb.s, bb.c);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.25,
      roughness: 0.3,
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(bb.w, bb.h, 0.55), mat);
    sign.position.set(bb.x, bb.y, bb.z);
    sign.rotation.y = bb.rotY;
    cityGroup.add(sign);
  }

  // Lantern Night Market Overhead Neon Archway (at x=-4, z=86 and z=114)
  const archMetal = new THREE.MeshStandardMaterial({ color: 0x1d2336, roughness: 0.4, metalness: 0.75 });
  const buildNeonArch = (ax, az, span, height, neonHex) => {
    const pillarGeo = new THREE.BoxGeometry(1.0, height, 1.0);
    const leftP = new THREE.Mesh(pillarGeo, archMetal);
    leftP.position.set(ax - span * 0.5, height * 0.5, az);
    const rightP = new THREE.Mesh(pillarGeo, archMetal);
    rightP.position.set(ax + span * 0.5, height * 0.5, az);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 1.6, 1.0, 1.1), archMetal);
    beam.position.set(ax, height, az);
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(span + 0.6, 0.38, 1.25),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(neonHex), emissiveIntensity: 2.2 }),
    );
    tube.position.set(ax, height - 0.5, az);
    cityGroup.add(leftP, rightP, beam, tube);
  };
  buildNeonArch(-4, 86, 22, 9.5, 0xff4eb8);
  buildNeonArch(-4, 114, 22, 9.5, 0x1de9d8);
  buildNeonArch(96, -158, 22, 9.2, 0xffb347); // Street Race starting gantry!

  // ---------------- 6. SOLARA CUSTOMS GARAGE (Torque Quarter) ----------------
  const gPos = CITY_CONFIG.garagePos;
  const gWallMat = new THREE.MeshStandardMaterial({ color: 0x263144, roughness: 0.5, metalness: 0.45 });
  const gBack = new THREE.Mesh(new THREE.BoxGeometry(18, 8.5, 1.2), gWallMat);
  gBack.position.set(gPos.x, 4.25, gPos.z - 8);
  const gLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.5, 16), gWallMat);
  gLeft.position.set(gPos.x - 8.6, 4.25, gPos.z);
  const gRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.5, 16), gWallMat);
  gRight.position.set(gPos.x + 8.6, 4.25, gPos.z);
  const gRoof = new THREE.Mesh(new THREE.BoxGeometry(18.8, 1.0, 17), gWallMat);
  gRoof.position.set(gPos.x, 8.7, gPos.z);
  const gNeon = new THREE.Mesh(
    new THREE.BoxGeometry(19.2, 0.45, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x101010, emissive: new THREE.Color(0x2ee59d), emissiveIntensity: 2.4 }),
  );
  gNeon.position.set(gPos.x, 8.3, gPos.z + 8.6);
  const gPad = new THREE.Mesh(
    new THREE.RingGeometry(4.2, 5.2, 32),
    new THREE.MeshBasicMaterial({ color: 0x2ee59d, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  gPad.rotation.x = -Math.PI / 2;
  gPad.position.set(gPos.x, 0.08, gPos.z + 2);
  animatedObjects.garageRing = gPad;
  cityGroup.add(gBack, gLeft, gRight, gRoof, gNeon, gPad);

  // ---------------- 7. CORAL COVE MARINA PIERS, YACHTS & LIGHTHOUSE ----------------
  const pierWood = boardwalkMat;
  for (const pz of [92, 134, 174]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(58, 0.55, 7.5), pierWood);
    pier.position.set(148, 0.35, pz);
    pier.castShadow = true;
    pier.receiveShadow = true;
    cityGroup.add(pier);
  }

  // Coastal Lighthouse at Marina Point
  const lhBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.8, 22, 16),
    new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.55 }),
  );
  lhBase.position.set(172, 11, 174);
  lhBase.castShadow = true;
  const lhBand = new THREE.Mesh(
    new THREE.CylinderGeometry(2.9, 3.3, 5.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xff4b68, roughness: 0.5 }),
  );
  lhBand.position.set(172, 13, 174);
  const lhTop = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3.2, 14),
    new THREE.MeshStandardMaterial({ color: 0x151515, emissive: new THREE.Color(0xffe08a), emissiveIntensity: 2.8 }),
  );
  lhTop.position.set(172, 23.2, 174);
  const lhBeam = new THREE.Mesh(
    new THREE.ConeGeometry(5.5, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  lhBeam.rotation.z = Math.PI / 2;
  lhBeam.position.set(21, 0, 0);
  const lhPivot = new THREE.Group();
  lhPivot.position.set(172, 23.2, 174);
  lhPivot.add(lhBeam);
  animatedObjects.lighthouseBeam = lhPivot;
  cityGroup.add(lhBase, lhBand, lhTop, lhPivot);

  // Luxury Yachts & Sailboats bobbing in Coral Cove & Mirage Ocean
  const yachtHullMat = new THREE.MeshStandardMaterial({ color: 0xf7fafd, roughness: 0.25, metalness: 0.15 });
  const yachtDeckMat = new THREE.MeshStandardMaterial({ color: 0x1c2c47, roughness: 0.35, metalness: 0.4 });
  const yachtTrimMat = new THREE.MeshStandardMaterial({ color: 0x1de9d8, roughness: 0.3 });
  const yachtCoords = [
    { x: 185, z: 72, rot: 0.2, scale: 1.2 },
    { x: 196, z: 114, rot: -0.15, scale: 1.35 },
    { x: 188, z: 156, rot: 0.35, scale: 1.1 },
    { x: 222, z: -26, rot: -0.4, scale: 1.45 },
    { x: 215, z: -110, rot: 0.12, scale: 1.25 },
  ];
  for (let i = 0; i < yachtCoords.length; i += 1) {
    const yc = yachtCoords[i];
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 2.0, 4.4), yachtHullMat);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.8, 3.2), yachtDeckMat);
    cabin.position.set(-0.6, 1.6, 0);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.35, 4.5), yachtTrimMat);
    stripe.position.set(0, 0.5, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8), yachtHullMat);
    mast.position.set(1.8, 4.5, 0);
    g.add(hull, cabin, stripe, mast);
    g.position.set(yc.x, 0.25, yc.z);
    g.rotation.y = yc.rot;
    g.scale.setScalar(yc.scale);
    cityGroup.add(g);
    animatedObjects.yachts.push({ group: g, baseY: 0.25, phase: i * 1.4 });
  }

  // ---------------- 8. STUNT JUMP RAMPS ----------------
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xffa732, roughness: 0.45, metalness: 0.3 });
  const addStuntRamp = (x, z, heading) => {
    const length = 11;
    const width = 6.2;
    const peak = 2.6;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, peak);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(-length * 0.5, 0, -width * 0.5);
    geo.rotateY(Math.PI / 2);
    const ramp = new THREE.Mesh(geo, rampMat);
    ramp.position.set(x, 0, z);
    ramp.rotation.y = heading;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    cityGroup.add(ramp);
    roadNetwork.registerRamp(x, z, heading, length, width, peak);
  };
  addStuntRamp(102, 54, 0);
  addStuntRamp(46, -96, Math.PI / 2);

  return {
    group: cityGroup,
    nightMaterials,
    animatedObjects,
    update(elapsed, moodPreset) {
      oceanUniforms.uTime.value = elapsed;
      oceanUniforms.uSunDir.value.copy(moodPreset.sunDir);
      oceanUniforms.uSunColor.value.setHex(moodPreset.sunColor);
      oceanUniforms.uNight.value = moodPreset.nightFactor;

      const emissiveTarget = moodPreset.id === 'night' ? 1.25 : moodPreset.id === 'golden' ? 0.56 : 0.02;
      for (let i = 0; i < nightMaterials.length; i += 1) {
        nightMaterials[i].emissiveIntensity = emissiveTarget;
      }
      neonInst.visible = moodPreset.nightFactor > 0.15;

      for (let i = 0; i < animatedObjects.yachts.length; i += 1) {
        const y = animatedObjects.yachts[i];
        y.group.position.y = y.baseY + Math.sin(elapsed * 1.4 + y.phase) * 0.22;
        y.group.rotation.z = Math.sin(elapsed * 1.1 + y.phase) * 0.035;
      }

      if (animatedObjects.lighthouseBeam) {
        animatedObjects.lighthouseBeam.rotation.y = elapsed * 0.65;
        animatedObjects.lighthouseBeam.visible = moodPreset.nightFactor > 0.2;
      }
      if (animatedObjects.garageRing) {
        const pulse = 1 + Math.sin(elapsed * 3.4) * 0.06;
        animatedObjects.garageRing.scale.set(pulse, pulse, 1);
      }
    },
  };
}
