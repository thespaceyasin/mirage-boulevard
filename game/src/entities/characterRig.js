// Sculpted articulated 3D character factory (protagonist Mateo Cruz, pedestrians,
// Meridian Cartel gunmen, SBPD SWAT officers) with tailored jackets, collars,
// forearms, footwear, tactical vests/helmets, and distinct high-contrast 3D weapons.

import * as THREE from 'three';
import { WEAPON_SPECS } from '../engine/gameConfig.js';

let charShared = null;

function getCharShared() {
  if (charShared) return charShared;
  charShared = {
    torsoGeo: new THREE.CylinderGeometry(0.28, 0.21, 0.64, 12),
    pelvisGeo: new THREE.CylinderGeometry(0.21, 0.2, 0.22, 10),
    collarGeo: new THREE.CylinderGeometry(0.18, 0.22, 0.12, 10, 1, true),
    beltGeo: new THREE.BoxGeometry(0.44, 0.08, 0.31),
    headGeo: new THREE.SphereGeometry(0.18, 14, 12),
    hairGeo: new THREE.SphereGeometry(0.198, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.58),
    helmetGeo: new THREE.SphereGeometry(0.215, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    shoulderGeo: new THREE.SphereGeometry(0.115, 10, 8),
    upperArmGeo: new THREE.CapsuleGeometry(0.082, 0.2, 6, 8),
    forearmGeo: new THREE.CapsuleGeometry(0.068, 0.2, 6, 8),
    handGeo: new THREE.SphereGeometry(0.072, 8, 8),
    legGeo: new THREE.CapsuleGeometry(0.095, 0.48, 6, 8),
    shoeGeo: new THREE.BoxGeometry(0.15, 0.11, 0.28),
    shadeGeo: new THREE.BoxGeometry(0.3, 0.072, 0.08),
    gunMetal: new THREE.MeshStandardMaterial({ color: 0x1a212e, roughness: 0.28, metalness: 0.9 }),
    gunTrim: new THREE.MeshStandardMaterial({ color: 0x62708a, roughness: 0.36, metalness: 0.78 }),
    gunWood: new THREE.MeshStandardMaterial({ color: 0x6e472b, roughness: 0.65, metalness: 0.1 }),
    rpgAccent: new THREE.MeshStandardMaterial({ color: 0x3b5e40, roughness: 0.48, metalness: 0.35 }),
    shoeMat: new THREE.MeshStandardMaterial({ color: 0x171a22, roughness: 0.75, metalness: 0.1 }),
    shadowGeo: new THREE.CircleGeometry(0.56, 14),
    shadowMat: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
  };
  charShared.upperArmGeo.translate(0, -0.14, 0);
  charShared.forearmGeo.translate(0, -0.36, 0);
  charShared.legGeo.translate(0, -0.3, 0);
  charShared.shadowGeo.rotateX(-Math.PI / 2);
  return charShared;
}

function buildWeaponMesh(id, s) {
  const g = new THREE.Group();
  if (id === 'pistol') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.36), s.gunTrim);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.3), s.gunMetal);
    frame.position.set(0, -0.05, 0.01);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.16, 0.09), s.gunMetal);
    grip.position.set(0, -0.1, -0.09);
    grip.rotation.x = -0.15;
    g.add(slide, frame, grip);
  } else if (id === 'smg') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.54), s.gunMetal);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.06, 0.48), s.gunTrim);
    shroud.position.y = 0.05;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.08), s.gunTrim);
    mag.position.set(0, -0.17, 0.1);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 8), s.gunTrim);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.36);
    g.add(body, shroud, mag, barrel);
  } else if (id === 'shotgun') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.38), s.gunWood);
    stock.position.z = -0.22;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.34), s.gunMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.78, 8), s.gunTrim);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.32);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.28), s.gunWood);
    pump.position.set(0, -0.03, 0.34);
    g.add(stock, body, barrel, pump);
  } else if (id === 'carbine') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.15, 0.32), s.gunMetal);
    stock.position.set(0, -0.01, -0.28);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.64), s.gunMetal);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.05, 0.56), s.gunTrim);
    rail.position.set(0, 0.09, 0.04);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.56, 8), s.gunTrim);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.56);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.24, 8), s.gunTrim);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.14, 0.02);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.28, 0.1), s.gunTrim);
    mag.position.set(0, -0.17, 0.14);
    mag.rotation.x = 0.22;
    g.add(stock, body, rail, barrel, scope, mag);
  } else {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.38, 10), s.rpgAccent);
    tube.rotation.x = Math.PI / 2;
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 10), s.gunTrim);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.z = 0.8;
    g.add(tube, warhead);
  }
  return g;
}

export function createCharacterRig(role = 'pedestrian', colors = {}) {
  const s = getCharShared();
  const root = new THREE.Group();

  const defaults = {
    player: { skin: 0xd89f78, jacket: 0xff4b68, pants: 0x1b2436, hair: 0x1a1512, accent: 0x1de9d8 },
    police: { skin: 0xdcb08e, jacket: 0x152b54, pants: 0x101829, hair: 0x141d33, accent: 0x3b9eff },
    cartel: { skin: 0xd49d76, jacket: 0x9c1b3e, pants: 0x1b1824, hair: 0x1a1614, accent: 0xffb347 },
    pedestrian: { skin: 0xdfb292, jacket: 0x2dd4c5, pants: 0x36445c, hair: 0x2a1e18, accent: 0xffd166 },
  };
  const pal = { ...(defaults[role] || defaults.pedestrian), ...colors };

  const skinMat = new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.72 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: pal.jacket, roughness: 0.52, metalness: 0.08 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.76 });
  const hairMat = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.68 });
  const accentMat = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.32, metalness: 0.3 });

  const shadow = new THREE.Mesh(s.shadowGeo, s.shadowMat);
  shadow.position.y = 0.04;
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const pelvis = new THREE.Mesh(s.pelvisGeo, pantsMat);
  pelvis.position.y = 0.78;
  const belt = new THREE.Mesh(s.beltGeo, s.gunMetal);
  belt.position.y = 0.86;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.05), accentMat);
  buckle.position.set(0, 0.86, 0.16);

  const torso = new THREE.Mesh(s.torsoGeo, jacketMat);
  torso.position.y = 1.19;
  torso.scale.set(1.12, 1, 0.74);
  torso.castShadow = true;

  // Jacket collar, front/back lapel accent & SWAT tactical vest
  const collar = new THREE.Mesh(s.collarGeo, jacketMat);
  collar.position.y = 1.53;
  const vestTrim = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.54, 0.42), accentMat);
  vestTrim.position.y = 1.19;
  if (role === 'police') {
    const vestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.42), s.gunMetal);
    vestPlate.position.y = 1.22;
    bodyPivot.add(vestPlate);
  }

  // Sculpted head + styled hair or SWAT helmet
  const head = new THREE.Mesh(s.headGeo, skinMat);
  head.position.y = 1.7;
  head.scale.set(0.95, 1.07, 0.96);
  head.castShadow = true;

  if (role === 'police') {
    const helmet = new THREE.Mesh(s.helmetGeo, jacketMat);
    helmet.position.set(0, 1.72, 0);
    bodyPivot.add(helmet);
  } else {
    const hair = new THREE.Mesh(s.hairGeo, hairMat);
    hair.position.set(0, 1.73, -0.015);
    hair.scale.set(1.04, 1.08, 1.06);
    bodyPivot.add(hair);
  }

  if (role === 'player' || role === 'cartel' || role === 'police') {
    const shades = new THREE.Mesh(s.shadeGeo, s.gunMetal);
    shades.position.set(0, 1.71, 0.145);
    bodyPivot.add(shades);
  }

  // Left & Right articulated arms with jacket sleeve + forearm + hand
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.36, 1.44, 0);
  const leftSh = new THREE.Mesh(s.shoulderGeo, jacketMat);
  const leftUpper = new THREE.Mesh(s.upperArmGeo, jacketMat);
  const leftFore = new THREE.Mesh(s.forearmGeo, role === 'police' ? jacketMat : skinMat);
  const leftHand = new THREE.Mesh(s.handGeo, skinMat);
  leftHand.position.y = -0.49;
  leftUpper.castShadow = true;
  leftArm.add(leftSh, leftUpper, leftFore, leftHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.36, 1.44, 0);
  const rightSh = new THREE.Mesh(s.shoulderGeo, jacketMat);
  const rightUpper = new THREE.Mesh(s.upperArmGeo, jacketMat);
  const rightFore = new THREE.Mesh(s.forearmGeo, role === 'police' ? jacketMat : skinMat);
  const rightHand = new THREE.Mesh(s.handGeo, skinMat);
  rightHand.position.y = -0.49;
  rightUpper.castShadow = true;
  rightArm.add(rightSh, rightUpper, rightFore, rightHand);

  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(0.02, -0.48, 0.14);
  rightArm.add(weaponSocket);

  const weaponVisuals = {};
  for (const id of ['pistol', 'smg', 'shotgun', 'carbine', 'rpg']) {
    const wm = buildWeaponMesh(id, s);
    wm.position.z = id === 'pistol' ? 0.16 : 0.34;
    wm.visible = false;
    weaponSocket.add(wm);
    weaponVisuals[id] = wm;
  }

  // Articulated legs + sneakers/boots
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.72, 0);
  const leftLegMesh = new THREE.Mesh(s.legGeo, pantsMat);
  leftLegMesh.castShadow = true;
  const leftShoe = new THREE.Mesh(s.shoeGeo, s.shoeMat);
  leftShoe.position.set(0, -0.66, 0.05);
  leftLeg.add(leftLegMesh, leftShoe);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.72, 0);
  const rightLegMesh = new THREE.Mesh(s.legGeo, pantsMat);
  rightLegMesh.castShadow = true;
  const rightShoe = new THREE.Mesh(s.shoeGeo, s.shoeMat);
  rightShoe.position.set(0, -0.66, 0.05);
  rightLeg.add(rightLegMesh, rightShoe);

  bodyPivot.add(pelvis, belt, buckle, torso, collar, vestTrim, head, leftArm, rightArm, leftLeg, rightLeg);

  return {
    root,
    bodyPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponSocket,
    weaponVisuals,
    setWeapon(weaponId) {
      for (const [id, m] of Object.entries(weaponVisuals)) {
        m.visible = id === weaponId;
      }
    },
    animate(speed, elapsed, aiming = false, dead = false) {
      if (dead) {
        bodyPivot.rotation.x = -Math.PI / 2;
        bodyPivot.position.y = 0.22;
        return;
      }
      bodyPivot.rotation.x = 0;
      const moveFactor = Math.min(1, speed / 5.5);
      const stride = Math.sin(elapsed * (6.5 + moveFactor * 5.0)) * 0.65 * moveFactor;
      bodyPivot.position.y = Math.abs(Math.sin(elapsed * 11)) * 0.05 * moveFactor;

      leftLeg.rotation.x = stride;
      rightLeg.rotation.x = -stride;

      if (aiming) {
        rightArm.rotation.x = -Math.PI * 0.48;
        rightArm.rotation.y = -0.14;
        leftArm.rotation.x = -Math.PI * 0.36;
        leftArm.rotation.z = -0.28;
        weaponSocket.rotation.x = Math.PI * 0.48;
      } else {
        rightArm.rotation.x = -stride * 0.85;
        rightArm.rotation.y = 0;
        leftArm.rotation.x = stride * 0.85;
        leftArm.rotation.z = 0;
        weaponSocket.rotation.x = 0;
      }
    },
  };
}

export class PlayerController {
  constructor(scene) {
    this.rig = createCharacterRig('player');
    this.root = this.rig.root;
    scene.add(this.root);

    this.pos = new THREE.Vector3(96, 0, -24);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.radius = 0.55;
    this.grounded = true;

    this.health = 100;
    this.maxHealth = 100;
    this.armor = 75;
    this.maxArmor = 100;
    this.cash = 3500;
    this.dead = false;

    this.vehicle = null;
    this.weaponIndex = 0;
    this.ammo = WEAPON_SPECS.map((w) => ({
      mag: w.magSize,
      reserve: w.reserveMax,
    }));
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.aiming = false;

    this.rig.setWeapon(WEAPON_SPECS[0].id);
    this.syncTransform();
  }

  get currentWeapon() {
    return WEAPON_SPECS[this.weaponIndex];
  }

  get currentAmmo() {
    return this.ammo[this.weaponIndex];
  }

  selectWeapon(idx) {
    const clamped = ((idx % WEAPON_SPECS.length) + WEAPON_SPECS.length) % WEAPON_SPECS.length;
    if (clamped !== this.weaponIndex) {
      this.weaponIndex = clamped;
      this.reloadTimer = 0;
      this.rig.setWeapon(this.currentWeapon.id);
    }
  }

  enterVehicle(veh) {
    this.vehicle = veh;
    veh.role = 'player';
    this.root.visible = false;
    this.aiming = false;
  }

  exitVehicle(roadNetwork) {
    if (!this.vehicle) return null;
    const oldVeh = this.vehicle;
    const sideX = Math.cos(oldVeh.heading);
    const sideZ = -Math.sin(oldVeh.heading);
    this.pos.set(
      oldVeh.pos.x - sideX * (oldVeh.spec.width * 0.5 + 1.15),
      oldVeh.pos.y,
      oldVeh.pos.z - sideZ * (oldVeh.spec.width * 0.5 + 1.15),
    );
    roadNetwork.resolveCircleCollision(this.pos, this.radius);
    this.heading = oldVeh.heading;
    this.vel.set(0, 0, 0);
    this.vehicle = null;
    oldVeh.role = 'parked';
    this.root.visible = true;
    this.syncTransform();
    return oldVeh;
  }

  takeDamage(amount) {
    if (this.dead) return;
    let rem = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rem * 0.72);
      this.armor -= absorbed;
      rem -= absorbed;
    }
    this.health = Math.max(0, this.health - rem);
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  refillAmmoAndVitals() {
    this.health = this.maxHealth;
    this.armor = this.maxArmor;
    this.dead = false;
    for (let i = 0; i < WEAPON_SPECS.length; i += 1) {
      this.ammo[i].mag = WEAPON_SPECS[i].magSize;
      this.ammo[i].reserve = WEAPON_SPECS[i].reserveMax;
    }
  }

  updateOnFoot(dt, elapsed, input, cameraYaw, roadNetwork, vehicles) {
    if (this.vehicle) {
      this.pos.copy(this.vehicle.pos);
      this.heading = this.vehicle.heading;
      return;
    }

    const axes = input.getMoveAxes();
    const isAim = input.rightMouseDown || input.mouseDown;
    this.aiming = isAim;

    const sinC = Math.sin(cameraYaw);
    const cosC = Math.cos(cameraYaw);
    const moveX = sinC * axes.forward - cosC * axes.right;
    const moveZ = cosC * axes.forward + sinC * axes.right;
    const moveMag = Math.hypot(moveX, moveZ);

    const maxSpd = axes.sprint && !isAim ? 11.2 : isAim ? 5.2 : 7.0;
    if (moveMag > 0.05) {
      const nx = moveX / moveMag;
      const nz = moveZ / moveMag;
      this.vel.x += (nx * maxSpd - this.vel.x) * (1 - Math.exp(-dt * 12));
      this.vel.z += (nz * maxSpd - this.vel.z) * (1 - Math.exp(-dt * 12));
      if (!isAim) {
        const targetH = Math.atan2(nx, nz);
        const diff = Math.atan2(Math.sin(targetH - this.heading), Math.cos(targetH - this.heading));
        this.heading += diff * (1 - Math.exp(-dt * 14));
      }
    } else {
      this.vel.x *= Math.exp(-dt * 13);
      this.vel.z *= Math.exp(-dt * 13);
    }

    if (isAim) {
      const diff = Math.atan2(Math.sin(cameraYaw - this.heading), Math.cos(cameraYaw - this.heading));
      this.heading += diff * (1 - Math.exp(-dt * 18));
    }

    if (axes.handbrake && this.grounded) {
      this.vel.y = 8.4;
      this.grounded = false;
    }

    this.vel.y -= 24 * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    const groundY = roadNetwork.sampleGroundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= groundY) {
      this.pos.y = groundY;
      this.vel.y = 0;
      this.grounded = true;
    }

    roadNetwork.resolveCircleCollision(this.pos, this.radius);

    for (let i = 0; i < vehicles.length; i += 1) {
      const v = vehicles[i];
      const dx = this.pos.x - v.pos.x;
      const dz = this.pos.z - v.pos.z;
      const minD = this.radius + v.radius * 0.92;
      const dSq = dx * dx + dz * dz;
      if (dSq > 0.0001 && dSq < minD * minD) {
        const d = Math.sqrt(dSq);
        this.pos.x += (dx / d) * (minD - d);
        this.pos.z += (dz / d) * (minD - d);
      }
    }

    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.rig.animate(horizSpeed, elapsed, this.aiming, this.dead);
    this.syncTransform();
  }

  syncTransform() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
  }
}
