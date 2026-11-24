// Authored multi-part 3D vehicle models (7 distinct silhouettes with clearcoat
// metallic paint, tinted cabins, rotating wheels, glowing lightbars, and SBPD livery)
// plus the articulated SBPD Sky-Eye Police Helicopter with sweeping searchlight.

import * as THREE from 'three';
import { VEHICLE_SPECS } from '../engine/gameConfig.js';
import { createPoliceDoorTexture } from '../world/proceduralTextures.js';

let sharedAssets = null;

function getSharedVehicleAssets() {
  if (sharedAssets) return sharedAssets;

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10);
  rimGeo.rotateZ(Math.PI / 2);

  // Soft radial contact shadow plane
  const sc = document.createElement('canvas');
  sc.width = 128;
  sc.height = 128;
  const ctx = sc.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);

  sharedAssets = {
    wheelGeo,
    rimGeo,
    tireMat: new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.92, metalness: 0.05 }),
    rimMat: new THREE.MeshStandardMaterial({ color: 0xcbd5e2, roughness: 0.28, metalness: 0.92 }),
    glassMat: new THREE.MeshPhysicalMaterial({
      color: 0x162436,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
      envMapIntensity: 1.6,
    }),
    darkTrimMat: new THREE.MeshStandardMaterial({ color: 0x181d29, roughness: 0.55, metalness: 0.45 }),
    chromeMat: new THREE.MeshStandardMaterial({ color: 0xdde5ef, roughness: 0.2, metalness: 0.95 }),
    interiorMat: new THREE.MeshStandardMaterial({ color: 0xe6d3b8, roughness: 0.8 }),
    headlightMat: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xfff1cc), emissiveIntensity: 2.2 }),
    taillightMat: new THREE.MeshStandardMaterial({ color: 0x440808, emissive: new THREE.Color(0xff2442), emissiveIntensity: 1.8 }),
    policeDoorMat: new THREE.MeshStandardMaterial({ map: createPoliceDoorTexture(), roughness: 0.35, metalness: 0.2 }),
    policeNavyMat: new THREE.MeshPhysicalMaterial({ color: 0x13223d, roughness: 0.35, metalness: 0.25, clearcoat: 0.8 }),
    shadowMat: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    beamMat: new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    nitroMat: new THREE.MeshBasicMaterial({
      color: 0x2deeff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
  return sharedAssets;
}

export function createVehicleMesh(specId, customColorHex = null) {
  const spec = VEHICLE_SPECS[specId] || VEHICLE_SPECS.metro_sedan;
  const assets = getSharedVehicleAssets();
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const baseHex = customColorHex ?? spec.palette[0];
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: baseHex,
    metalness: spec.category === 'super' || spec.category === 'sport' ? 0.32 : 0.12,
    roughness: spec.category === 'super' ? 0.24 : 0.38,
    clearcoat: 0.92,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.25,
  });

  const w = spec.width;
  const l = spec.length;
  const h = spec.height;

  // Contact shadow disc
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.45, l * 1.28), assets.shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.04;
  root.add(contactShadow);

  // Lower chassis pan
  const lowerH = spec.category === 'truck' || spec.category === 'swat' ? 0.72 : 0.52;
  const lower = new THREE.Mesh(new THREE.BoxGeometry(w, lowerH, l), paintMat);
  lower.position.y = 0.38 + lowerH * 0.5;
  lower.castShadow = true;
  lower.receiveShadow = true;
  bodyGroup.add(lower);

  // Front aerodynamic splitter / grille bumper & rear diffuser
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.26, 0.34), assets.darkTrimMat);
  frontBumper.position.set(0, 0.42, l * 0.5 + 0.05);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.28, 0.32), assets.darkTrimMat);
  rearBumper.position.set(0, 0.44, -l * 0.5 - 0.04);
  bodyGroup.add(frontBumper, rearBumper);

  // Side skirts & sculpted fender flares
  const skirtGeo = new THREE.BoxGeometry(0.14, 0.22, l * 0.62);
  const leftSkirt = new THREE.Mesh(skirtGeo, assets.darkTrimMat);
  leftSkirt.position.set(-w * 0.51, 0.4, 0);
  const rightSkirt = new THREE.Mesh(skirtGeo, assets.darkTrimMat);
  rightSkirt.position.set(w * 0.51, 0.4, 0);
  bodyGroup.add(leftSkirt, rightSkirt);

  // Category-specific sculpted upper cabin & distinctive silhouette details
  if (spec.category === 'super') {
    // Low-slung wedge hood + teardrop glass canopy + GT rear wing + vents
    const hood = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.22, l * 0.42), paintMat);
    hood.position.set(0, 0.88, l * 0.22);
    hood.rotation.x = 0.14;
    hood.castShadow = true;

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.46, l * 0.42), assets.glassMat);
    cabin.position.set(0, 1.08, -0.18);
    cabin.castShadow = true;

    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.1, l * 0.28), paintMat);
    roofCap.position.set(0, 1.32, -0.22);

    // Wide GT rear spoiler wing + struts
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.08, 0.46), assets.darkTrimMat);
    wing.position.set(0, 1.24, -l * 0.46);
    wing.castShadow = true;
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.22), assets.darkTrimMat);
    strutL.position.set(-0.62, 1.06, -l * 0.44);
    const strutR = strutL.clone();
    strutR.position.x = 0.62;

    // Rear engine intake louvers
    const louver = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 0.08, 0.9), assets.darkTrimMat);
    louver.position.set(0, 0.95, -l * 0.26);

    bodyGroup.add(hood, cabin, roofCap, wing, strutL, strutR, louver);
  } else if (spec.category === 'sport') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.52, l * 0.48), assets.glassMat);
    cabin.position.set(0, 1.12, -0.16);
    cabin.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.1, l * 0.34), paintMat);
    roof.position.set(0, 1.38, -0.18);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, l * 0.96), assets.chromeMat);
    stripe.position.set(0, 0.93, 0);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.12, 0.25), assets.darkTrimMat);
    lip.position.set(0, 0.98, -l * 0.48);
    bodyGroup.add(cabin, roof, stripe, lip);
  } else if (spec.category === 'convertible') {
    // Open-top coastal roadster with cream seats & raked windshield
    const well = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.22, l * 0.42), assets.interiorMat);
    well.position.set(0, 0.86, -0.1);
    const seatL = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.24), assets.interiorMat);
    seatL.position.set(-0.42, 1.08, -0.52);
    const seatR = seatL.clone();
    seatR.position.x = 0.42;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.46, 0.1), assets.glassMat);
    windshield.position.set(0, 1.1, 0.62);
    windshield.rotation.x = -0.45;
    const chromeTrim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.08, l * 0.88), assets.chromeMat);
    chromeTrim.position.set(0, 0.68, 0);
    bodyGroup.add(well, seatL, seatR, windshield, chromeTrim);
  } else if (spec.category === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.82, l * 0.4), paintMat);
    cab.position.set(0, 1.48, 0.62);
    cab.castShadow = true;
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.93, 0.5, l * 0.34), assets.glassMat);
    cabGlass.position.set(0, 1.52, 0.64);
    const bedWallL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, l * 0.48), paintMat);
    bedWallL.position.set(-w * 0.45, 1.25, -1.12);
    const bedWallR = bedWallL.clone();
    bedWallR.position.x = w * 0.45;
    const rollbar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.62, 0.16), assets.darkTrimMat);
    rollbar.position.set(0, 1.56, -0.25);
    bodyGroup.add(cab, cabGlass, bedWallL, bedWallR, rollbar);
  } else if (spec.category === 'swat') {
    const hullUpper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.86, l * 0.72), paintMat);
    hullUpper.position.set(0, 1.48, -0.25);
    hullUpper.castShadow = true;
    const armorGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.36, l * 0.62), assets.glassMat);
    armorGlass.position.set(0, 1.56, -0.14);
    const ramWedge = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.62, 0.48), assets.darkTrimMat);
    ramWedge.position.set(0, 0.64, l * 0.54);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.16, l * 0.52), assets.darkTrimMat);
    rack.position.set(0, 1.98, -0.3);
    bodyGroup.add(hullUpper, armorGlass, ramWedge, rack);
  } else {
    // Sedan or SBPD Police Interceptor
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.58, l * 0.52), assets.glassMat);
    cabin.position.set(0, 1.18, -0.15);
    cabin.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.12, l * 0.4), spec.isPolice ? assets.policeNavyMat : paintMat);
    roof.position.set(0, 1.48, -0.15);
    bodyGroup.add(cabin, roof);

    if (spec.isPolice) {
      // Navy hood + trunk contrast + crisp SBPD side door decal panels + front bullbar
      const navyHood = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.54, l * 0.28), assets.policeNavyMat);
      navyHood.position.set(0, 0.65, l * 0.36);
      const navyTrunk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.54, l * 0.26), assets.policeNavyMat);
      navyTrunk.position.set(0, 0.65, -l * 0.37);
      const doorL = new THREE.Mesh(new THREE.PlaneGeometry(l * 0.42, 0.54), assets.policeDoorMat);
      doorL.rotation.y = -Math.PI / 2;
      doorL.position.set(-w * 0.506, 0.66, -0.04);
      const doorR = new THREE.Mesh(new THREE.PlaneGeometry(l * 0.42, 0.54), assets.policeDoorMat);
      doorR.rotation.y = Math.PI / 2;
      doorR.position.set(w * 0.506, 0.66, -0.04);
      const bullbar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.52, 0.28), assets.darkTrimMat);
      bullbar.position.set(0, 0.62, l * 0.54);
      bodyGroup.add(navyHood, navyTrunk, doorL, doorR, bullbar);
    }
  }

  // Headlights & volumetric cones + full-width tail-light bar
  const hlGeo = new THREE.BoxGeometry(0.42, 0.16, 0.08);
  const hlL = new THREE.Mesh(hlGeo, assets.headlightMat);
  hlL.position.set(-w * 0.34, 0.68, l * 0.505);
  const hlR = hlL.clone();
  hlR.position.x = w * 0.34;
  bodyGroup.add(hlL, hlR);

  const beamGeo = new THREE.ConeGeometry(1.75, 9.5, 12, 1, true);
  // Rotate so apex is at the headlight lens (local z=0) and wide cone opens FORWARD (+Z)!
  beamGeo.translate(0, -4.75, 0);
  beamGeo.rotateX(Math.PI / 2);
  const beamL = new THREE.Mesh(beamGeo, assets.beamMat);
  beamL.position.set(-w * 0.34, 0.64, l * 0.505);
  const beamR = beamL.clone();
  beamR.position.x = w * 0.34;
  beamL.visible = false;
  beamR.visible = false;
  bodyGroup.add(beamL, beamR);

  const tailBarMat = assets.taillightMat.clone();
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.15, 0.08), tailBarMat);
  tailBar.position.set(0, 0.72, -l * 0.505);
  bodyGroup.add(tailBar);

  // Dual exhaust pipes & toggleable nitro exhaust flame cones
  const flameGeo = new THREE.ConeGeometry(0.16, 1.35, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameL = new THREE.Mesh(flameGeo, assets.nitroMat);
  flameL.position.set(-0.46, 0.38, -l * 0.5 - 0.68);
  flameL.visible = false;
  const flameR = flameL.clone();
  flameR.position.x = 0.46;
  bodyGroup.add(flameL, flameR);

  // Police Roof Strobe Lightbar
  let strobeRedMat = null;
  let strobeBlueMat = null;
  if (spec.isPolice) {
    const barY = spec.category === 'swat' ? 2.12 : 1.62;
    const barMount = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.14, 0.32), assets.darkTrimMat);
    barMount.position.set(0, barY, 0.02);
    strobeRedMat = new THREE.MeshStandardMaterial({ color: 0x330008, emissive: new THREE.Color(0xff1e45), emissiveIntensity: 3.0 });
    strobeBlueMat = new THREE.MeshStandardMaterial({ color: 0x001233, emissive: new THREE.Color(0x2288ff), emissiveIntensity: 3.0 });
    const podL = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.34), strobeRedMat);
    podL.position.set(-0.36, barY + 0.08, 0.02);
    const podR = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.34), strobeBlueMat);
    podR.position.set(0.36, barY + 0.08, 0.02);
    bodyGroup.add(barMount, podL, podR);
  }

  // 4 Steerable / Rotating Wheels with Metallic Rims
  const wheelMeshes = [];
  const wheelSteerPivots = [];
  const wx = w * 0.48;
  const wzF = l * 0.31;
  const wzR = -l * 0.31;
  const wheelOffsets = [
    { x: -wx, z: wzF, front: true },
    { x: wx, z: wzF, front: true },
    { x: -wx, z: wzR, front: false },
    { x: wx, z: wzR, front: false },
  ];

  for (const wo of wheelOffsets) {
    const pivot = new THREE.Group();
    pivot.position.set(wo.x, 0.38, wo.z);
    const tire = new THREE.Mesh(assets.wheelGeo, assets.tireMat);
    const rim = new THREE.Mesh(assets.rimGeo, assets.rimMat);
    tire.castShadow = true;
    const wheelSpinGroup = new THREE.Group();
    wheelSpinGroup.add(tire, rim);
    pivot.add(wheelSpinGroup);
    root.add(pivot);
    wheelMeshes.push(wheelSpinGroup);
    if (wo.front) wheelSteerPivots.push(pivot);
  }

  return {
    root,
    bodyGroup,
    paintMat,
    tailBarMat,
    wheelMeshes,
    wheelSteerPivots,
    beams: [beamL, beamR],
    nitroFlames: [flameL, flameR],
    strobeRedMat,
    strobeBlueMat,
    setBodyColor(hex) {
      paintMat.color.setHex(hex);
    },
    setWrecked(isWrecked) {
      if (isWrecked) {
        paintMat.color.setHex(0x1b1918);
        paintMat.roughness = 0.95;
        paintMat.clearcoat = 0.0;
        beamL.visible = false;
        beamR.visible = false;
        flameL.visible = false;
        flameR.visible = false;
      }
    },
    updateVisuals({ elapsed, nightFactor, speed, steerAngle, braking, sirenActive, nitroActive, wrecked }) {
      if (!wrecked) {
        beamL.visible = nightFactor > 0.25;
        beamR.visible = nightFactor > 0.25;
        tailBarMat.emissiveIntensity = braking ? 4.2 : 1.4 + nightFactor * 0.8;
        flameL.visible = nitroActive;
        flameR.visible = nitroActive;
        if (nitroActive) {
          const flick = 0.85 + Math.sin(elapsed * 48) * 0.25;
          flameL.scale.set(1, 1, flick);
          flameR.scale.set(1, 1, flick);
        }
      }
      for (const p of wheelSteerPivots) p.rotation.y = steerAngle * 0.45;
      for (const wm of wheelMeshes) wm.rotation.x += speed * 0.055;

      if (strobeRedMat && strobeBlueMat) {
        if (sirenActive && !wrecked) {
          const pulse = Math.sin(elapsed * 18) > 0;
          strobeRedMat.emissiveIntensity = pulse ? 5.2 : 0.35;
          strobeBlueMat.emissiveIntensity = pulse ? 0.35 : 5.2;
        } else {
          strobeRedMat.emissiveIntensity = 0.25;
          strobeBlueMat.emissiveIntensity = 0.25;
        }
      }
    },
  };
}

export function createPoliceHelicopterMesh() {
  const assets = getSharedVehicleAssets();
  const root = new THREE.Group();
  root.name = 'SBPDSkyEyeHeli';

  const fuselageMat = assets.policeNavyMat;
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.32, metalness: 0.2 });

  // Main cabin body
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 5.4), fuselageMat);
  cabin.castShadow = true;
  const noseGlass = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.35, 2.2), assets.glassMat);
  noseGlass.position.set(0, -0.1, 2.6);
  noseGlass.rotation.x = 0.24;
  const whiteBand = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.44, 5.48), stripeMat);
  whiteBand.position.y = -0.25;

  // Tail boom & fins
  const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, 6.2), fuselageMat);
  tailBoom.position.set(0, 0.25, -5.2);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.0, 1.3), stripeMat);
  tailFin.position.set(0, 0.75, -8.0);

  // Landing skids
  const skidGeo = new THREE.BoxGeometry(0.18, 0.18, 5.8);
  const skidL = new THREE.Mesh(skidGeo, assets.darkTrimMat);
  skidL.position.set(-1.35, -1.65, 0.3);
  const skidR = skidL.clone();
  skidR.position.x = 1.35;
  const strutGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
  for (const sx of [-1.2, 1.2]) {
    for (const sz of [-1.2, 1.6]) {
      const s = new THREE.Mesh(strutGeo, assets.darkTrimMat);
      s.position.set(sx, -1.2, sz);
      root.add(s);
    }
  }

  // Spinning Main Rotor (4 blades)
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.48, 0.2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), assets.darkTrimMat);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.08, 0.36), assets.darkTrimMat);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 11.5), assets.darkTrimMat);
  mainRotor.add(mast, blade1, blade2);

  // Spinning Tail Rotor
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.36, 0.75, -8.1);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.2), assets.chromeMat);
  tailRotor.add(tb);

  // Red & Blue belly strobe beacons
  const redPod = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: new THREE.Color(0xff1e45), emissiveIntensity: 4.0 }),
  );
  redPod.position.set(-1.25, -0.95, 1.2);
  const bluePod = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2288ff, emissive: new THREE.Color(0x2288ff), emissiveIntensity: 4.0 }),
  );
  bluePod.position.set(1.25, -0.95, 1.2);

  // Volumetric sweeping searchlight cone + ground projection spotlight disc
  const searchCone = new THREE.Mesh(
    new THREE.ConeGeometry(7.2, 34, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xe6f4ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  searchCone.position.set(0, -17.5, 2.2);

  const groundSpot = new THREE.Mesh(
    new THREE.CircleGeometry(7.0, 22),
    new THREE.MeshBasicMaterial({
      color: 0xe8f6ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  groundSpot.rotation.x = -Math.PI / 2;

  root.add(cabin, noseGlass, whiteBand, tailBoom, tailFin, skidL, skidR, mainRotor, tailRotor, redPod, bluePod, searchCone);

  return {
    root,
    mainRotor,
    tailRotor,
    searchCone,
    groundSpot,
    redPod,
    bluePod,
    update(dt, elapsed, targetPos) {
      mainRotor.rotation.y += dt * 26;
      tailRotor.rotation.x += dt * 32;
      const pulse = Math.sin(elapsed * 16) > 0;
      redPod.material.emissiveIntensity = pulse ? 5.0 : 0.4;
      bluePod.material.emissiveIntensity = pulse ? 0.4 : 5.0;

      if (targetPos && root.visible) {
        const dx = targetPos.x - root.position.x;
        const dy = (targetPos.y + 0.2) - root.position.y;
        const dz = targetPos.z - root.position.z;
        const dist = Math.max(8, Math.sqrt(dx * dx + dy * dy + dz * dz));
        searchCone.scale.set(1, dist / 34, 1);
        searchCone.position.set(0, -dist * 0.48, 2.0);
        groundSpot.visible = true;
        groundSpot.position.set(targetPos.x, 0.14, targetPos.z);
      } else {
        groundSpot.visible = false;
      }
    },
  };
}
