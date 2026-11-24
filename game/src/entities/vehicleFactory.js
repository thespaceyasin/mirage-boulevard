// Authored sculpted 3D vehicle models (7 distinct non-boxy ExtrudeGeometry silhouettes
// with clearcoat metallic paint, raked tinted canopies, wheel-arch fenders, 5-spoke
// alloy rims, glowing LED headlights/taillights, dual-layer exhaust flames, and SBPD
// livery) plus the sculpted SBPD Sky-Eye Police Helicopter with rotor blur & searchlight.

import * as THREE from 'three';
import { VEHICLE_SPECS } from '../engine/gameConfig.js';
import { createPoliceDoorTexture } from '../world/proceduralTextures.js';

let sharedAssets = null;

function createExtrudedProfile(points, width, bevelSize = 0.05) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const innerW = Math.max(0.2, width - bevelSize * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerW,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(0, 0, -innerW * 0.5);
  geo.rotateY(-Math.PI / 2); // Maps shape +X -> +Z (vehicle forward)
  geo.computeVertexNormals();
  return geo;
}

function getSharedVehicleAssets() {
  if (sharedAssets) return sharedAssets;

  const wheelGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.32, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimOuterGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.335, 14);
  rimOuterGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.35, 0.055, 0.46);
  const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.36, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const caliperGeo = new THREE.BoxGeometry(0.18, 0.16, 0.12);

  // Soft radial contact shadow plane
  const sc = document.createElement('canvas');
  sc.width = 128;
  sc.height = 128;
  const ctx = sc.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  g.addColorStop(0, 'rgba(0,0,0,0.68)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.34)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);

  // Translucent rotor motion-blur disc texture for helicopter
  const rc = document.createElement('canvas');
  rc.width = 128;
  rc.height = 128;
  const rctx = rc.getContext('2d');
  const rg = rctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  rg.addColorStop(0, 'rgba(200,220,245,0.06)');
  rg.addColorStop(0.55, 'rgba(180,205,235,0.22)');
  rg.addColorStop(0.92, 'rgba(220,235,255,0.30)');
  rg.addColorStop(1, 'rgba(220,235,255,0.0)');
  rctx.fillStyle = rg;
  rctx.fillRect(0, 0, 128, 128);
  const rotorBlurTex = new THREE.CanvasTexture(rc);

  sharedAssets = {
    wheelGeo,
    rimOuterGeo,
    spokeGeo,
    hubGeo,
    caliperGeo,
    tireMat: new THREE.MeshStandardMaterial({ color: 0x101217, roughness: 0.9, metalness: 0.08 }),
    rimMat: new THREE.MeshStandardMaterial({ color: 0xd9e2ee, roughness: 0.22, metalness: 0.94 }),
    caliperMat: new THREE.MeshStandardMaterial({ color: 0xff3b52, roughness: 0.35, metalness: 0.4 }),
    glassMat: new THREE.MeshPhysicalMaterial({
      color: 0x101c2d,
      roughness: 0.05,
      metalness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.9,
    }),
    darkTrimMat: new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.48, metalness: 0.48 }),
    chromeMat: new THREE.MeshStandardMaterial({ color: 0xe3ebf5, roughness: 0.16, metalness: 0.96 }),
    interiorMat: new THREE.MeshStandardMaterial({ color: 0xe8d5b8, roughness: 0.78 }),
    headlightMat: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xfff3d4), emissiveIntensity: 2.6 }),
    taillightMat: new THREE.MeshStandardMaterial({ color: 0x4a050b, emissive: new THREE.Color(0xff2042), emissiveIntensity: 2.1 }),
    policeDoorMat: new THREE.MeshStandardMaterial({ map: createPoliceDoorTexture(), roughness: 0.32, metalness: 0.22 }),
    policeNavyMat: new THREE.MeshPhysicalMaterial({ color: 0x11203b, roughness: 0.3, metalness: 0.28, clearcoat: 0.88 }),
    emberMat: new THREE.MeshStandardMaterial({ color: 0x26120c, emissive: new THREE.Color(0xff5a18), emissiveIntensity: 2.4, roughness: 0.8 }),
    shadowMat: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    rotorBlurMat: new THREE.MeshBasicMaterial({ map: rotorBlurTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    beamMat: new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      transparent: true,
      opacity: 0.11,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    flameOuterMat: new THREE.MeshBasicMaterial({
      color: 0xff6b24,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    flameInnerMat: new THREE.MeshBasicMaterial({
      color: 0x8ef7ff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
  return sharedAssets;
}

function addWheelArchFlares(bodyGroup, w, l, assets, paintMat) {
  const wzF = l * 0.31;
  const wzR = -l * 0.31;
  const wellGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.22, 14, 1, false, 0, Math.PI);
  wellGeo.rotateZ(Math.PI / 2);
  const archGeo = new THREE.TorusGeometry(0.46, 0.065, 8, 14, Math.PI);
  archGeo.rotateY(Math.PI / 2);

  for (const wz of [wzF, wzR]) {
    for (const side of [-1, 1]) {
      const well = new THREE.Mesh(wellGeo, assets.darkTrimMat);
      well.position.set(side * (w * 0.45), 0.39, wz);
      const arch = new THREE.Mesh(archGeo, paintMat);
      arch.position.set(side * (w * 0.505), 0.39, wz);
      bodyGroup.add(well, arch);
    }
  }
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
    metalness: spec.category === 'super' || spec.category === 'sport' ? 0.36 : 0.16,
    roughness: spec.category === 'super' ? 0.2 : 0.34,
    clearcoat: 0.96,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.45,
  });

  const w = spec.width;
  const l = spec.length;
  const halfL = l * 0.5;

  // Ground contact shadow
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.48, l * 1.32), assets.shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.04;
  root.add(contactShadow);

  // Sculpted extruded hull & raked canopy per vehicle class
  let hullGeo;
  let glassGeo = null;

  if (spec.category === 'super') {
    // Low-slung wedge supercar: sharp nose splitter, rising fenders, swept fastback deck
    hullGeo = createExtrudedProfile([
      [-halfL, 0.38],
      [-halfL + 0.08, 0.96],
      [-halfL * 0.42, 1.02],
      [halfL * 0.24, 0.92],
      [halfL * 0.72, 0.78],
      [halfL, 0.54],
      [halfL - 0.12, 0.36],
      [-halfL + 0.1, 0.35],
    ], w * 0.98, 0.06);

    glassGeo = createExtrudedProfile([
      [-halfL * 0.52, 0.94],
      [-halfL * 0.16, 1.34],
      [halfL * 0.12, 1.34],
      [halfL * 0.44, 0.89],
    ], w * 0.78, 0.04);
  } else if (spec.category === 'sport') {
    hullGeo = createExtrudedProfile([
      [-halfL, 0.4],
      [-halfL + 0.08, 0.98],
      [-halfL * 0.45, 1.04],
      [halfL * 0.25, 0.98],
      [halfL * 0.78, 0.86],
      [halfL, 0.62],
      [halfL - 0.1, 0.36],
      [-halfL + 0.1, 0.36],
    ], w * 0.96, 0.055);

    glassGeo = createExtrudedProfile([
      [-halfL * 0.58, 0.98],
      [-halfL * 0.22, 1.4],
      [halfL * 0.12, 1.4],
      [halfL * 0.46, 0.94],
    ], w * 0.8, 0.04);
  } else if (spec.category === 'convertible') {
    hullGeo = createExtrudedProfile([
      [-halfL, 0.4],
      [-halfL + 0.08, 0.92],
      [halfL * 0.75, 0.86],
      [halfL, 0.6],
      [halfL - 0.1, 0.36],
      [-halfL + 0.1, 0.36],
    ], w * 0.95, 0.055);
  } else if (spec.category === 'truck') {
    hullGeo = createExtrudedProfile([
      [-halfL, 0.44],
      [-halfL, 1.24],
      [-halfL * 0.12, 1.24],
      [-halfL * 0.04, 1.88],
      [halfL * 0.42, 1.86],
      [halfL * 0.62, 1.28],
      [halfL, 1.14],
      [halfL, 0.44],
    ], w * 0.94, 0.05);

    glassGeo = createExtrudedProfile([
      [-halfL * 0.02, 1.28],
      [-halfL * 0.02, 1.78],
      [halfL * 0.38, 1.76],
      [halfL * 0.54, 1.28],
    ], w * 0.88, 0.03);
  } else if (spec.category === 'swat') {
    hullGeo = createExtrudedProfile([
      [-halfL, 0.46],
      [-halfL + 0.06, 1.88],
      [halfL * 0.42, 1.92],
      [halfL * 0.68, 1.32],
      [halfL, 1.18],
      [halfL, 0.46],
    ], w * 0.96, 0.06);

    glassGeo = createExtrudedProfile([
      [-halfL * 0.78, 1.3],
      [-halfL * 0.72, 1.76],
      [halfL * 0.36, 1.78],
      [halfL * 0.56, 1.3],
    ], w * 0.9, 0.03);
  } else {
    // Sculpted fastback sedan / SBPD Interceptor
    hullGeo = createExtrudedProfile([
      [-halfL, 0.4],
      [-halfL + 0.06, 1.02],
      [-halfL * 0.58, 1.06],
      [halfL * 0.36, 1.02],
      [halfL * 0.84, 0.88],
      [halfL, 0.64],
      [halfL - 0.08, 0.38],
      [-halfL + 0.08, 0.38],
    ], w * 0.96, 0.055);

    glassGeo = createExtrudedProfile([
      [-halfL * 0.6, 1.0],
      [-halfL * 0.24, 1.48],
      [halfL * 0.16, 1.48],
      [halfL * 0.48, 0.98],
    ], w * 0.82, 0.04);
  }

  const hullMesh = new THREE.Mesh(hullGeo, paintMat);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  if (glassGeo) {
    const canopyMesh = new THREE.Mesh(glassGeo, assets.glassMat);
    canopyMesh.name = 'cockpitGlass';
    canopyMesh.castShadow = true;
    bodyGroup.add(canopyMesh);
  }

  // Sculpted fender arches & wheel housings
  addWheelArchFlares(bodyGroup, w, l, assets, spec.isPolice && spec.category !== 'swat' ? assets.policeNavyMat : paintMat);

  // Lower splitter, side skirts, rear diffuser & dual chrome exhaust tips
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.12, 0.42), assets.darkTrimMat);
  splitter.position.set(0, 0.36, halfL - 0.04);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.22, 0.32), assets.darkTrimMat);
  diffuser.position.set(0, 0.4, -halfL + 0.02);
  const skirtGeo = new THREE.BoxGeometry(0.14, 0.16, l * 0.52);
  const skirtL = new THREE.Mesh(skirtGeo, assets.darkTrimMat);
  skirtL.position.set(-w * 0.49, 0.37, 0);
  const skirtR = skirtL.clone();
  skirtR.position.x = w * 0.49;
  bodyGroup.add(splitter, diffuser, skirtL, skirtR);

  // Dual exhaust pipes
  const exhaustGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.22, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  const exL = new THREE.Mesh(exhaustGeo, assets.chromeMat);
  exL.position.set(-0.52, 0.39, -halfL - 0.05);
  const exR = exL.clone();
  exR.position.x = 0.52;
  bodyGroup.add(exL, exR);

  // Side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.22, 0.11, 0.14);
  const mirL = new THREE.Mesh(mirrorGeo, spec.isPolice ? assets.policeNavyMat : paintMat);
  mirL.position.set(-w * 0.51, 0.98, halfL * 0.22);
  const mirR = mirL.clone();
  mirR.position.x = w * 0.51;
  bodyGroup.add(mirL, mirR);

  // Class-specific aerodynamic aero wings, vents & police livery
  let wreckHood = null;
  if (spec.category === 'super') {
    // Painted roof cap, side intake scoops, rear louver slats, swan-neck GT carbon wing + endplates
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.07, l * 0.22), paintMat);
    roofCap.position.set(0, 1.33, -0.08);
    const intakeGeo = new THREE.BoxGeometry(0.12, 0.28, 0.85);
    const inL = new THREE.Mesh(intakeGeo, assets.darkTrimMat);
    inL.position.set(-w * 0.48, 0.74, -0.25);
    const inR = inL.clone();
    inR.position.x = w * 0.48;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.07, 0.42), assets.darkTrimMat);
    wing.position.set(0, 1.24, -halfL + 0.18);
    wing.rotation.x = 0.08;
    wing.castShadow = true;
    const endplateGeo = new THREE.BoxGeometry(0.06, 0.22, 0.48);
    const epL = new THREE.Mesh(endplateGeo, paintMat);
    epL.position.set(-w * 0.54, 1.24, -halfL + 0.18);
    const epR = epL.clone();
    epR.position.x = w * 0.54;
    const strutGeo = new THREE.BoxGeometry(0.07, 0.34, 0.18);
    const stL = new THREE.Mesh(strutGeo, assets.darkTrimMat);
    stL.position.set(-0.56, 1.07, -halfL + 0.2);
    const stR = stL.clone();
    stR.position.x = 0.56;
    const louver = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.06, 0.82), assets.darkTrimMat);
    louver.position.set(0, 0.99, -halfL * 0.52);
    bodyGroup.add(roofCap, inL, inR, wing, epL, epR, stL, stR, louver);
  } else if (spec.category === 'sport') {
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.74, 0.07, l * 0.25), paintMat);
    roofCap.position.set(0, 1.4, -0.1);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, l * 0.38), assets.chromeMat);
    stripe.position.set(0, 0.89, halfL * 0.58);
    stripe.rotation.x = 0.18;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.14, 0.22), assets.darkTrimMat);
    lip.position.set(0, 1.02, -halfL + 0.1);
    bodyGroup.add(roofCap, stripe, lip);
  } else if (spec.category === 'convertible') {
    const well = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.18, l * 0.4), assets.interiorMat);
    well.position.set(0, 0.84, -0.1);
    const seatL = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.46, 0.24), assets.interiorMat);
    seatL.position.set(-0.4, 1.06, -0.48);
    const seatR = seatL.clone();
    seatR.position.x = 0.4;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.48, 0.09), assets.glassMat);
    windshield.position.set(0, 1.08, 0.62);
    windshield.rotation.x = -0.48;
    const chromeTrim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.06, l * 0.86), assets.chromeMat);
    chromeTrim.position.set(0, 0.68, 0);
    bodyGroup.add(well, seatL, seatR, windshield, chromeTrim);
  } else if (spec.category === 'swat') {
    const ramWedge = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.58, 0.44), assets.darkTrimMat);
    ramWedge.position.set(0, 0.66, halfL + 0.08);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.14, l * 0.5), assets.darkTrimMat);
    rack.position.set(0, 1.98, -0.3);
    bodyGroup.add(ramWedge, rack);
  } else if (spec.isPolice) {
    // SBPD Interceptor: navy front/rear livery, roof cap, crisp door decals, tubular PIT bullbar, popped wreck hood
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.08, l * 0.3), assets.policeNavyMat);
    roofCap.position.set(0, 1.48, -0.12);
    const navyHood = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.12, l * 0.28), assets.policeNavyMat);
    navyHood.position.set(0, 0.89, halfL * 0.58);
    navyHood.rotation.x = 0.17;
    wreckHood = navyHood;
    const navyTrunk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.12, l * 0.24), assets.policeNavyMat);
    navyTrunk.position.set(0, 1.03, -halfL * 0.68);
    const doorL = new THREE.Mesh(new THREE.PlaneGeometry(l * 0.42, 0.54), assets.policeDoorMat);
    doorL.rotation.y = -Math.PI / 2;
    doorL.position.set(-w * 0.488, 0.68, -0.02);
    const doorR = new THREE.Mesh(new THREE.PlaneGeometry(l * 0.42, 0.54), assets.policeDoorMat);
    doorR.rotation.y = Math.PI / 2;
    doorR.position.set(w * 0.488, 0.68, -0.02);
    const bullbar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 0.48, 0.24), assets.darkTrimMat);
    bullbar.position.set(0, 0.64, halfL + 0.08);
    bodyGroup.add(roofCap, navyHood, navyTrunk, doorL, doorR, bullbar);
  }

  // Glowing LED Headlight Strips + Volumetric Night Cones
  const hlGeo = new THREE.BoxGeometry(0.46, 0.12, 0.09);
  const hlL = new THREE.Mesh(hlGeo, assets.headlightMat);
  hlL.position.set(-w * 0.34, 0.64, halfL - 0.01);
  hlL.rotation.z = 0.08;
  const hlR = hlL.clone();
  hlR.position.x = w * 0.34;
  hlR.rotation.z = -0.08;
  bodyGroup.add(hlL, hlR);

  const beamGeo = new THREE.ConeGeometry(1.75, 9.5, 12, 1, true);
  beamGeo.translate(0, -4.75, 0);
  beamGeo.rotateX(Math.PI / 2);
  const beamL = new THREE.Mesh(beamGeo, assets.beamMat);
  beamL.position.set(-w * 0.34, 0.64, halfL);
  const beamR = beamL.clone();
  beamR.position.x = w * 0.34;
  beamL.visible = false;
  beamR.visible = false;
  bodyGroup.add(beamL, beamR);

  // Full-width sculpted LED taillight blade
  const tailBarMat = assets.taillightMat.clone();
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.11, 0.09), tailBarMat);
  tailBar.position.set(0, 0.82, -halfL + 0.02);
  bodyGroup.add(tailBar);

  // Dual-layer fiery Nitro & Drift afterburner exhaust flames
  const outerFlameGeo = new THREE.ConeGeometry(0.19, 1.55, 8);
  outerFlameGeo.rotateX(-Math.PI / 2);
  const innerFlameGeo = new THREE.ConeGeometry(0.1, 1.05, 8);
  innerFlameGeo.rotateX(-Math.PI / 2);

  const flameL = new THREE.Group();
  flameL.position.set(-0.52, 0.39, -halfL - 0.14);
  const flOuterL = new THREE.Mesh(outerFlameGeo, assets.flameOuterMat);
  flOuterL.position.z = -0.68;
  const flInnerL = new THREE.Mesh(innerFlameGeo, assets.flameInnerMat);
  flInnerL.position.z = -0.45;
  flameL.add(flOuterL, flInnerL);
  flameL.visible = false;

  const flameR = flameL.clone();
  flameR.position.x = 0.52;
  bodyGroup.add(flameL, flameR);

  // Engine ember bay (visible only when wrecked)
  const wreckEmber = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.16, 0.9), assets.emberMat);
  wreckEmber.position.set(0, 0.84, halfL * 0.52);
  wreckEmber.visible = false;
  bodyGroup.add(wreckEmber);

  // Police Roof Strobe Lightbar
  let strobeRedMat = null;
  let strobeBlueMat = null;
  if (spec.isPolice) {
    const barY = spec.category === 'swat' ? 2.1 : 1.58;
    const barMount = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.11, 0.32), assets.darkTrimMat);
    barMount.position.set(0, barY, -0.02);
    strobeRedMat = new THREE.MeshStandardMaterial({ color: 0x330008, emissive: new THREE.Color(0xff1e45), emissiveIntensity: 3.4 });
    strobeBlueMat = new THREE.MeshStandardMaterial({ color: 0x001233, emissive: new THREE.Color(0x2288ff), emissiveIntensity: 3.4 });
    const podL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.34), strobeRedMat);
    podL.position.set(-0.38, barY + 0.06, -0.02);
    const podR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.34), strobeBlueMat);
    podR.position.set(0.38, barY + 0.06, -0.02);
    bodyGroup.add(barMount, podL, podR);
  }

  // 4 Steerable / Rotating 5-Spoke Alloy Wheels + Brake Calipers
  const wheelMeshes = [];
  const wheelSteerPivots = [];
  const wx = w * 0.45;
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
    pivot.position.set(wo.x, 0.39, wo.z);
    const caliper = new THREE.Mesh(assets.caliperGeo, assets.caliperMat);
    caliper.position.set(wo.x > 0 ? -0.05 : 0.05, 0.06, -0.12);
    pivot.add(caliper);

    const wheelSpinGroup = new THREE.Group();
    const tire = new THREE.Mesh(assets.wheelGeo, assets.tireMat);
    const rim = new THREE.Mesh(assets.rimOuterGeo, assets.rimMat);
    const hub = new THREE.Mesh(assets.hubGeo, assets.darkTrimMat);
    const spokeA = new THREE.Mesh(assets.spokeGeo, assets.rimMat);
    const spokeB = new THREE.Mesh(assets.spokeGeo, assets.rimMat);
    spokeB.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    wheelSpinGroup.add(tire, rim, hub, spokeA, spokeB);
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
        wreckEmber.visible = true;
        if (wreckHood) {
          wreckHood.position.y += 0.28;
          wreckHood.rotation.x = -0.35;
        }
      }
    },
    updateVisuals({ elapsed, nightFactor, speed, steerAngle, braking, sirenActive, nitroActive, wrecked }) {
      if (!wrecked) {
        beamL.visible = nightFactor > 0.25;
        beamR.visible = nightFactor > 0.25;
        tailBarMat.emissiveIntensity = braking ? 4.4 : 1.7 + nightFactor * 0.9;
        flameL.visible = nitroActive;
        flameR.visible = nitroActive;
        if (nitroActive) {
          const flick = 0.88 + Math.sin(elapsed * 48) * 0.28;
          flameL.scale.set(1.05, 1.05, flick);
          flameR.scale.set(1.05, 1.05, flick);
        }
      }
      for (const p of wheelSteerPivots) p.rotation.y = steerAngle * 0.45;
      for (const wm of wheelMeshes) wm.rotation.x += speed * 0.055;

      if (strobeRedMat && strobeBlueMat) {
        if (sirenActive && !wrecked) {
          const pulse = Math.sin(elapsed * 18) > 0;
          strobeRedMat.emissiveIntensity = pulse ? 5.6 : 0.35;
          strobeBlueMat.emissiveIntensity = pulse ? 0.35 : 5.6;
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
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.3, metalness: 0.22 });

  // Sculpted tapered fuselage profile
  const heliHullGeo = createExtrudedProfile([
    [-2.8, -0.75],
    [-2.5, 0.85],
    [1.3, 0.95],
    [3.1, -0.05],
    [2.9, -0.82],
    [-1.8, -0.92],
  ], 2.4, 0.14);
  const cabin = new THREE.Mesh(heliHullGeo, fuselageMat);
  cabin.castShadow = true;

  const noseGlassGeo = createExtrudedProfile([
    [1.15, 0.82],
    [2.95, 0.02],
    [2.75, -0.68],
    [1.15, -0.58],
  ], 2.1, 0.08);
  const noseGlass = new THREE.Mesh(noseGlassGeo, assets.glassMat);

  const whiteBand = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.36, 4.8), stripeMat);
  whiteBand.position.set(0, -0.25, -0.2);

  // Twin top turbine cowlings
  const cowlGeo = new THREE.CylinderGeometry(0.42, 0.48, 2.4, 12);
  cowlGeo.rotateX(Math.PI / 2);
  const cowlL = new THREE.Mesh(cowlGeo, assets.darkTrimMat);
  cowlL.position.set(-0.48, 1.15, -0.55);
  const cowlR = cowlL.clone();
  cowlR.position.x = 0.48;

  // Tapered tail boom & swept vertical fin
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 6.2, 10), fuselageMat);
  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 0.28, -5.2);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 1.25), stripeMat);
  tailFin.position.set(0, 0.85, -8.0);
  tailFin.rotation.x = -0.25;

  // Landing skids
  const skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.8, 8);
  skidGeo.rotateX(Math.PI / 2);
  const skidL = new THREE.Mesh(skidGeo, assets.darkTrimMat);
  skidL.position.set(-1.35, -1.65, 0.3);
  const skidR = skidL.clone();
  skidR.position.x = 1.35;
  const strutGeo = new THREE.BoxGeometry(0.1, 0.9, 0.12);
  for (const sx of [-1.2, 1.2]) {
    for (const sz of [-1.2, 1.6]) {
      const s = new THREE.Mesh(strutGeo, assets.darkTrimMat);
      s.position.set(sx, -1.2, sz);
      root.add(s);
    }
  }

  // Spinning Main Rotor (4 blades + translucent motion-blur disc)
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.62, 0.1);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), assets.darkTrimMat);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.07, 0.34), assets.darkTrimMat);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 11.8), assets.darkTrimMat);
  const rotorDisc = new THREE.Mesh(new THREE.CircleGeometry(5.9, 32), assets.rotorBlurMat);
  rotorDisc.rotation.x = -Math.PI / 2;
  rotorDisc.position.y = 0.04;
  mainRotor.add(mast, blade1, blade2, rotorDisc);

  // Spinning Tail Rotor
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.36, 0.85, -8.1);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.2), assets.chromeMat);
  tailRotor.add(tb);

  // Red & Blue belly strobe beacons
  const redPod = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: new THREE.Color(0xff1e45), emissiveIntensity: 4.5 }),
  );
  redPod.position.set(-1.25, -0.95, 1.2);
  const bluePod = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2288ff, emissive: new THREE.Color(0x2288ff), emissiveIntensity: 4.5 }),
  );
  bluePod.position.set(1.25, -0.95, 1.2);

  // Volumetric sweeping searchlight cone + ground projection spotlight disc
  const searchCone = new THREE.Mesh(
    new THREE.ConeGeometry(7.2, 34, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xe6f4ff,
      transparent: true,
      opacity: 0.17,
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

  root.add(cabin, noseGlass, whiteBand, cowlL, cowlR, tailBoom, tailFin, skidL, skidR, mainRotor, tailRotor, redPod, bluePod, searchCone);

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
      redPod.material.emissiveIntensity = pulse ? 5.2 : 0.4;
      bluePod.material.emissiveIntensity = pulse ? 0.4 : 5.2;

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
