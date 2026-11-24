// High-density InstancedMesh world prop kit for Solara Bay:
// curved coastal palm trees with wind sway, Art-Deco streetlamps, synced traffic
// signals, beach umbrellas & loungers, Night Market glowing lantern strings & street stalls,
// shipping containers, spinning Golden Palm collectibles, and glowing 3D objective beacons.

import * as THREE from 'three';
import { CITY_CONFIG, GOLDEN_PALMS, createSeededRng } from '../engine/gameConfig.js';

export function buildCityProps(scene, roadNetwork) {
  const rng = createSeededRng(77001);
  const propGroup = new THREE.Group();
  propGroup.name = 'SolaraBayProps';
  scene.add(propGroup);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // ---------------- 1. INSTANCED COASTAL PALM TREES (WITH WIND SWAY) ----------------
  const palmPositions = [];
  for (let z = -196; z <= 196; z += 18) {
    if (Math.abs(z % 96) < 14) continue;
    palmPositions.push({ x: 109.5, z, scale: rng.range(0.95, 1.28), rot: rng.range(0, Math.PI * 2) });
    palmPositions.push({ x: 83.2, z: z + 5, scale: rng.range(0.9, 1.18), rot: rng.range(0, Math.PI * 2) });
  }
  for (let z = -180; z <= 160; z += 24) {
    palmPositions.push({ x: 124 + rng.range(0, 9), z, scale: rng.range(0.98, 1.32), rot: rng.range(0, Math.PI * 2) });
  }
  for (const ax of [-192, -96, 0]) {
    for (let z = -170; z <= 170; z += 34) {
      if (Math.abs(z % 96) < 16) continue;
      palmPositions.push({ x: ax + 12.6, z, scale: rng.range(0.84, 1.1), rot: rng.range(0, Math.PI * 2) });
    }
  }

  // Curved palm trunk geometry — clamp t >= 0 so Math.pow never returns NaN!
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 8.8, 8, 6);
  const posAttr = trunkGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i += 1) {
    const y = Math.max(0, posAttr.getY(i) + 4.4);
    const t = Math.max(0, Math.min(1, y / 8.8));
    posAttr.setY(i, y);
    posAttr.setX(i, posAttr.getX(i) + Math.pow(t, 1.75) * 1.15);
  }
  trunkGeo.computeVertexNormals();
  trunkGeo.computeBoundingSphere();

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x876246, roughness: 0.88, metalness: 0.02 });
  const palmTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);
  palmTrunks.castShadow = true;
  palmTrunks.receiveShadow = true;

  // Lush arched palm frond geometry
  const frondGeo = new THREE.BoxGeometry(0.72, 0.08, 3.85, 1, 1, 6);
  const fPos = frondGeo.attributes.position;
  for (let i = 0; i < fPos.count; i += 1) {
    const z = Math.max(0, fPos.getZ(i) + 1.925);
    const t = Math.max(0, Math.min(1, z / 3.85));
    fPos.setZ(i, z);
    fPos.setY(i, fPos.getY(i) + Math.sin(t * Math.PI) * 0.52 - t * t * 0.96);
    fPos.setX(i, fPos.getX(i) * (1.0 - t * 0.74));
  }
  frondGeo.computeVertexNormals();
  frondGeo.computeBoundingSphere();

  const frondMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.04 });
  frondMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    frondMat.userData.shader = shader;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
       #else
         float ph = 0.0;
       #endif
       float tip = clamp(position.z / 3.85, 0.0, 1.0);
       transformed.y += sin(uTime * 1.85 + ph) * 0.18 * tip;
       transformed.x += cos(uTime * 1.35 + ph) * 0.12 * tip;`
    );
  };
  frondMat.customProgramCacheKey = () => 'solara-palm-sway';

  const frondsPerPalm = 7;
  const palmFronds = new THREE.InstancedMesh(frondGeo, frondMat, palmPositions.length * frondsPerPalm);
  palmFronds.castShadow = true;

  for (let i = 0; i < palmPositions.length; i += 1) {
    const p = palmPositions[i];
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(i, dummy.matrix);

    const topX = p.x + Math.cos(p.rot) * 1.15 * p.scale;
    const topZ = p.z - Math.sin(p.rot) * 1.15 * p.scale;
    const topY = 8.68 * p.scale;

    for (let f = 0; f < frondsPerPalm; f += 1) {
      const idx = i * frondsPerPalm + f;
      const angle = p.rot + (f / frondsPerPalm) * Math.PI * 2 + 0.2;
      dummy.position.set(topX, topY, topZ);
      dummy.rotation.set(0.1, angle, 0);
      dummy.scale.setScalar(p.scale * (0.9 + (f % 2) * 0.16));
      dummy.updateMatrix();
      palmFronds.setMatrixAt(idx, dummy.matrix);
      color.setHex(f % 2 === 0 ? 0x299958 : 0x3ec26b);
      palmFronds.setColorAt(idx, color);
    }
  }
  palmTrunks.instanceMatrix.needsUpdate = true;
  palmFronds.instanceMatrix.needsUpdate = true;
  if (palmFronds.instanceColor) palmFronds.instanceColor.needsUpdate = true;
  propGroup.add(palmTrunks, palmFronds);

  // ---------------- 2. INSTANCED ART-DECO STREETLAMPS ----------------
  const lampList = [];
  for (const ax of CITY_CONFIG.avenuesX) {
    for (let z = -176; z <= 176; z += 32) {
      if (Math.abs(z % 96) < 14) continue;
      lampList.push({ x: ax - 11.4, z, dir: 1 });
      lampList.push({ x: ax + 11.4, z, dir: -1 });
    }
  }

  const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 7.6, 6);
  poleGeo.translate(0, 3.8, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x263142, roughness: 0.38, metalness: 0.78 });
  const lampPoles = new THREE.InstancedMesh(poleGeo, poleMat, lampList.length);

  const bulbGeo = new THREE.SphereGeometry(0.36, 8, 8);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff2cc,
    emissive: new THREE.Color(0xffca7a),
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  const lampBulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampList.length);

  const poolGeo = new THREE.CircleGeometry(5.2, 12);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffc778,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lampPools = new THREE.InstancedMesh(poolGeo, poolMat, lampList.length);

  for (let i = 0; i < lampList.length; i += 1) {
    const l = lampList[i];
    dummy.position.set(l.x, 0, l.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);

    dummy.position.set(l.x + l.dir * 0.85, 7.52, l.z);
    dummy.updateMatrix();
    lampBulbs.setMatrixAt(i, dummy.matrix);

    dummy.position.set(l.x + l.dir * 1.35, 0.06, l.z);
    dummy.updateMatrix();
    lampPools.setMatrixAt(i, dummy.matrix);
  }
  lampPoles.instanceMatrix.needsUpdate = true;
  lampBulbs.instanceMatrix.needsUpdate = true;
  lampPools.instanceMatrix.needsUpdate = true;
  propGroup.add(lampPoles, lampBulbs, lampPools);

  // ---------------- 3. BEACH UMBRELLAS & SUN LOUNGERS ----------------
  const umbrellaCount = 38;
  const umbConeGeo = new THREE.ConeGeometry(2.3, 0.82, 8);
  const umbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 });
  const umbCanopies = new THREE.InstancedMesh(umbConeGeo, umbMat, umbrellaCount);
  const umbPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), poleMat, umbrellaCount);
  const loungerGeo = new THREE.BoxGeometry(0.85, 0.25, 2.1);
  const loungerMat = new THREE.MeshStandardMaterial({ color: 0xf7f2e8, roughness: 0.72 });
  const loungers = new THREE.InstancedMesh(loungerGeo, loungerMat, umbrellaCount);
  const umbPalette = [0xff5e6c, 0x1de9d8, 0xffb347, 0x56aaff, 0xfff5e0];

  for (let i = 0; i < umbrellaCount; i += 1) {
    const ux = 128 + (i % 3) * 7.5 + rng.range(-1.6, 1.6);
    const uz = -182 + i * 9.8;
    dummy.position.set(ux, 2.15, uz);
    dummy.rotation.set(rng.range(-0.1, 0.1), rng.range(0, 3), rng.range(-0.1, 0.1));
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    umbCanopies.setMatrixAt(i, dummy.matrix);
    color.setHex(umbPalette[i % umbPalette.length]);
    umbCanopies.setColorAt(i, color);

    dummy.position.set(ux, 1.0, uz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    umbPoles.setMatrixAt(i, dummy.matrix);

    dummy.position.set(ux + 1.4, 0.05, uz);
    dummy.rotation.set(0, Math.PI / 2 + 0.12, 0);
    dummy.updateMatrix();
    loungers.setMatrixAt(i, dummy.matrix);
  }
  umbCanopies.instanceMatrix.needsUpdate = true;
  if (umbCanopies.instanceColor) umbCanopies.instanceColor.needsUpdate = true;
  umbPoles.instanceMatrix.needsUpdate = true;
  loungers.instanceMatrix.needsUpdate = true;
  propGroup.add(umbCanopies, umbPoles, loungers);

  // ---------------- 4. LANTERN NIGHT MARKET COLORFUL LANTERNS & NEON STALLS ----------------
  const lanternCoords = [];
  for (let z = 44; z <= 164; z += 14) {
    for (let x = -12; x <= 12; x += 4.0) {
      const sag = Math.cos((x / 12) * Math.PI * 0.5) * 0.85;
      lanternCoords.push({ x, y: 7.4 - sag, z });
    }
  }
  const lanternGeo = new THREE.SphereGeometry(0.28, 10, 8);
  // MeshBasicMaterial preserves vivid per-instance neon red/gold/cyan/pink without washing to white!
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, lanternCoords.length);
  const lanternHex = [0xff3864, 0xffb838, 0x1de9d8, 0xff42c8, 0xff6d3b];
  for (let i = 0; i < lanternCoords.length; i += 1) {
    const lc = lanternCoords[i];
    dummy.position.set(lc.x, lc.y, lc.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.95, 1.25, 0.95);
    dummy.updateMatrix();
    lanterns.setMatrixAt(i, dummy.matrix);
    color.setHex(lanternHex[i % lanternHex.length]);
    lanterns.setColorAt(i, color);
  }
  lanterns.instanceMatrix.needsUpdate = true;
  if (lanterns.instanceColor) lanterns.instanceColor.needsUpdate = true;
  propGroup.add(lanterns);

  // Sidewalk Night Market Neon Kiosks / Food Stalls
  const stallCoords = [];
  for (let z = 62; z <= 142; z += 16) {
    if (Math.abs(z - 96) < 12) continue;
    stallCoords.push({ x: -13.8, z, hex: 0xff42b3 });
    stallCoords.push({ x: 13.8, z, hex: 0x1de9d8 });
  }
  const stallBaseGeo = new THREE.BoxGeometry(2.8, 1.15, 4.4);
  const stallRoofGeo = new THREE.BoxGeometry(3.2, 0.28, 4.8);
  const stallBaseMat = new THREE.MeshStandardMaterial({ color: 0x262038, roughness: 0.6 });
  const stallRoofMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const stallBases = new THREE.InstancedMesh(stallBaseGeo, stallBaseMat, stallCoords.length);
  const stallRoofs = new THREE.InstancedMesh(stallRoofGeo, stallRoofMat, stallCoords.length);
  for (let i = 0; i < stallCoords.length; i += 1) {
    const sc = stallCoords[i];
    dummy.position.set(sc.x, 0.58, sc.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    stallBases.setMatrixAt(i, dummy.matrix);

    dummy.position.set(sc.x, 2.75, sc.z);
    dummy.updateMatrix();
    stallRoofs.setMatrixAt(i, dummy.matrix);
    color.setHex(sc.hex);
    stallRoofs.setColorAt(i, color);
  }
  stallBases.instanceMatrix.needsUpdate = true;
  stallRoofs.instanceMatrix.needsUpdate = true;
  if (stallRoofs.instanceColor) stallRoofs.instanceColor.needsUpdate = true;
  propGroup.add(stallBases, stallRoofs);

  // ---------------- 5. TORQUE QUARTER SHIPPING CONTAINERS ----------------
  const containerCoords = [
    { x: -168, z: 68, rot: 0, hex: 0xd94852 },
    { x: -168, z: 68, y: 2.8, rot: 0.04, hex: 0x2b7cb3 },
    { x: -160, z: 68, rot: 0, hex: 0xe69f32 },
    { x: -166, z: 164, rot: Math.PI / 2, hex: 0x2aa87b },
    { x: -116, z: 124, rot: 0, hex: 0xd94852 },
  ];
  const contGeo = new THREE.BoxGeometry(3.2, 2.8, 9.2);
  const contMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.35 });
  const containers = new THREE.InstancedMesh(contGeo, contMat, containerCoords.length);
  containers.castShadow = true;
  containers.receiveShadow = true;
  for (let i = 0; i < containerCoords.length; i += 1) {
    const cc = containerCoords[i];
    dummy.position.set(cc.x, (cc.y || 0) + 1.4, cc.z);
    dummy.rotation.set(0, cc.rot, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    containers.setMatrixAt(i, dummy.matrix);
    color.setHex(cc.hex);
    containers.setColorAt(i, color);
  }
  containers.instanceMatrix.needsUpdate = true;
  if (containers.instanceColor) containers.instanceColor.needsUpdate = true;
  propGroup.add(containers);

  // ---------------- 6. TRAFFIC SIGNAL LIGHTS (LIVE RED / GREEN) ----------------
  const signalCount = roadNetwork.intersections.length;
  const sigBoxGeo = new THREE.BoxGeometry(0.9, 1.8, 0.9);
  const sigBoxMat = new THREE.MeshStandardMaterial({ color: 0x161b26, roughness: 0.5 });
  const sigBoxes = new THREE.InstancedMesh(sigBoxGeo, sigBoxMat, signalCount);
  const sigBulbNS = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 6, 6), new THREE.MeshBasicMaterial({ color: 0x2ee59d }), signalCount);
  const sigBulbEW = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3355 }), signalCount);

  for (let i = 0; i < signalCount; i += 1) {
    const inter = roadNetwork.intersections[i];
    dummy.position.set(inter.x + 11.2, 6.2, inter.z + 11.2);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    sigBoxes.setMatrixAt(i, dummy.matrix);

    dummy.position.set(inter.x + 11.2, 6.45, inter.z + 10.6);
    dummy.updateMatrix();
    sigBulbNS.setMatrixAt(i, dummy.matrix);

    dummy.position.set(inter.x + 10.6, 6.45, inter.z + 11.2);
    dummy.updateMatrix();
    sigBulbEW.setMatrixAt(i, dummy.matrix);
  }
  sigBoxes.instanceMatrix.needsUpdate = true;
  sigBulbNS.instanceMatrix.needsUpdate = true;
  sigBulbEW.instanceMatrix.needsUpdate = true;
  propGroup.add(sigBoxes, sigBulbNS, sigBulbEW);

  // ---------------- 7. GOLDEN PALM COLLECTIBLES & OBJECTIVE BEACON ----------------
  const goldenPalmMeshes = [];
  const gpMat = new THREE.MeshStandardMaterial({
    color: 0xffd24c,
    emissive: new THREE.Color(0xff9d1c),
    emissiveIntensity: 0.9,
    metalness: 0.85,
    roughness: 0.18,
  });
  const gpGeo = new THREE.OctahedronGeometry(0.95, 0);
  for (const gp of GOLDEN_PALMS) {
    const m = new THREE.Mesh(gpGeo, gpMat);
    m.position.set(gp.x, 1.8, gp.z);
    m.userData.palmId = gp.id;
    propGroup.add(m);
    goldenPalmMeshes.push(m);
  }

  const beaconGroup = new THREE.Group();
  const beaconBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 2.4, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  beaconBeam.position.y = 17;
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.6, 28),
    new THREE.MeshBasicMaterial({ color: 0xffc857, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.12;
  beaconGroup.add(beaconBeam, beaconRing);
  propGroup.add(beaconGroup);

  return {
    group: propGroup,
    goldenPalmMeshes,
    beaconGroup,
    setBeacon(x, z, colorHex = 0xffb347, visible = true) {
      beaconGroup.visible = visible;
      if (visible) {
        beaconGroup.position.set(x, 0, z);
        beaconBeam.material.color.setHex(colorHex);
        beaconRing.material.color.setHex(colorHex);
      }
    },
    update(elapsed, moodPreset, collectedPalms) {
      if (frondMat.userData.shader) {
        frondMat.userData.shader.uniforms.uTime.value = elapsed;
      }
      const night = moodPreset.nightFactor;
      bulbMat.emissiveIntensity = 0.4 + night * 2.2;
      poolMat.opacity = night * 0.24;

      sigBulbNS.material.color.setHex(
        roadNetwork.nsGreen ? (roadNetwork.signalYellow ? 0xffbb33 : 0x2ee59d) : 0xff2e55,
      );
      sigBulbEW.material.color.setHex(
        !roadNetwork.nsGreen ? (roadNetwork.signalYellow ? 0xffbb33 : 0x2ee59d) : 0xff2e55,
      );

      for (let i = 0; i < goldenPalmMeshes.length; i += 1) {
        const m = goldenPalmMeshes[i];
        const taken = collectedPalms && collectedPalms.has(m.userData.palmId);
        m.visible = !taken;
        if (!taken) {
          m.rotation.y = elapsed * 2.2 + i;
          m.position.y = 1.85 + Math.sin(elapsed * 2.8 + i) * 0.35;
        }
      }

      if (beaconGroup.visible) {
        const s = 1 + Math.sin(elapsed * 4.2) * 0.12;
        beaconRing.scale.set(s, s, 1);
      }
    },
  };
}
