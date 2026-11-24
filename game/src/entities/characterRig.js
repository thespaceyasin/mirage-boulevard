// Sculpted articulated 3D character factory (protagonist Mateo Cruz, pedestrians,
// Meridian Cartel gunmen, SBPD SWAT officers) using smooth capsules/cylinders,
// styled silhouettes, procedural walk/sprint/aim animation, and detailed 3D weapons.

import * as THREE from 'three';
import { WEAPON_SPECS } from '../engine/gameConfig.js';

let charShared = null;

function getCharShared() {
  if (charShared) return charShared;
  charShared = {
    torsoGeo: new THREE.CylinderGeometry(0.27, 0.22, 0.66, 10),
    pelvisGeo: new THREE.CylinderGeometry(0.22, 0.21, 0.22, 10),
    headGeo: new THREE.SphereGeometry(0.18, 12, 10),
    hairGeo: new THREE.SphereGeometry(0.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    shoulderGeo: new THREE.SphereGeometry(0.11, 8, 8),
    armGeo: new THREE.CapsuleGeometry(0.085, 0.42, 6, 8),
    legGeo: new THREE.CapsuleGeometry(0.1, 0.52, 6, 8),
    shadeGeo: new THREE.BoxGeometry(0.3, 0.075, 0.08),
    gunMetal: new THREE.MeshStandardMaterial({ color: 0x1e2534, roughness: 0.3, metalness: 0.88 }),
    gunTrim: new THREE.MeshStandardMaterial({ color: 0x4b576d, roughness: 0.42, metalness: 0.72 }),
    rpgAccent: new THREE.MeshStandardMaterial({ color: 0x3b5e40, roughness: 0.5, metalness: 0.35 }),
    shadowGeo: new THREE.CircleGeometry(0.56, 14),
    shadowMat: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.36, depthWrite: false }),
  };
  charShared.armGeo.translate(0, -0.25, 0);
  charShared.legGeo.translate(0, -0.32, 0);
  charShared.shadowGeo.rotateX(-Math.PI / 2);
  return charShared;
}

function buildWeaponMesh(id, s) {
  const g = new THREE.Group();
  if (id === 'pistol') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.32), s.gunMetal);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), s.gunTrim);
    grip.position.set(0, -0.08, -0.08);
    g.add(slide, grip);
  } else if (id === 'smg') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.13, 0.46), s.gunMetal);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.07), s.gunTrim);
    mag.position.set(0, -0.14, 0.08);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), s.gunTrim);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.3);
    g.add(body, mag, barrel);
  } else if (id === 'shotgun') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.32), s.gunTrim);
    stock.position.z = -0.18;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.68, 8), s.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.24);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.24), s.gunTrim);
    pump.position.set(0, -0.02, 0.28);
    g.add(stock, barrel, pump);
  } else if (id === 'carbine') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.14, 0.56), s.gunMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.42, 8), s.gunTrim);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.44);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 8), s.gunTrim);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.11, 0.02);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.08), s.gunMetal);
    mag.position.set(0, -0.14, 0.12);
    mag.rotation.x = 0.2;
    g.add(body, barrel, scope, mag);
  } else {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1.25, 10), s.rpgAccent);
    tube.rotation.x = Math.PI / 2;
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 10), s.gunTrim);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.z = 0.72;
    g.add(tube, warhead);
  }
  return g;
}

export function createCharacterRig(role = 'pedestrian', colors = {}) {
  const s = getCharShared();
  const root = new THREE.Group();

  const defaults = {
    player: { skin: 0xd89f78, jacket: 0xff5568, pants: 0x1d2638, hair: 0x1a1512, accent: 0x1de9d8 },
    police: { skin: 0xdcb08e, jacket: 0x162b52, pants: 0x10192b, hair: 0x141d33, accent: 0x3b9eff },
    cartel: { skin: 0xd49d76, jacket: 0x991b3b, pants: 0x1c1824, hair: 0x1a1614, accent: 0xffb347 },
    pedestrian: { skin: 0xdfb292, jacket: 0x2dd4c5, pants: 0x36445c, hair: 0x2a1e18, accent: 0xffd166 },
  };
  const pal = { ...(defaults[role] || defaults.pedestrian), ...colors };

  const skinMat = new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.72 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: pal.jacket, roughness: 0.58 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.76 });
  const hairMat = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.68 });
  const accentMat = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.36, metalness: 0.25 });

  const shadow = new THREE.Mesh(s.shadowGeo, s.shadowMat);
  shadow.position.y = 0.04;
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const pelvis = new THREE.Mesh(s.pelvisGeo, pantsMat);
  pelvis.position.y = 0.78;
  const torso = new THREE.Mesh(s.torsoGeo, jacketMat);
  torso.position.y = 1.18;
  torso.scale.set(1.08, 1, 0.72);
  torso.castShadow = true;

  // Jacket lapel / tactical back stripe
  const vestTrim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.54, 0.39), accentMat);
  vestTrim.position.y = 1.19;

  // Collar + rounded sculpted head + styled hair crown
  const head = new THREE.Mesh(s.headGeo, skinMat);
  head.position.y = 1.7;
  head.scale.set(0.95, 1.06, 0.96);
  head.castShadow = true;

  const hair = new THREE.Mesh(s.hairGeo, hairMat);
  hair.position.set(0, 1.72, -0.01);

  if (role === 'player' || role === 'cartel' || role === 'police') {
    const shades = new THREE.Mesh(s.shadeGeo, s.gunMetal);
    shades.position.set(0, 1.71, 0.14);
    bodyPivot.add(shades);
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.34, 1.44, 0);
  const leftSh = new THREE.Mesh(s.shoulderGeo, jacketMat);
  const leftArmMesh = new THREE.Mesh(s.armGeo, jacketMat);
  leftArmMesh.castShadow = true;
  leftArm.add(leftSh, leftArmMesh);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.34, 1.44, 0);
  const rightSh = new THREE.Mesh(s.shoulderGeo, jacketMat);
  const rightArmMesh = new THREE.Mesh(s.armGeo, jacketMat);
  rightArmMesh.castShadow = true;
  rightArm.add(rightSh, rightArmMesh);

  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(0, -0.45, 0.16);
  rightArm.add(weaponSocket);

  const weaponVisuals = {};
  for (const id of ['pistol', 'smg', 'shotgun', 'carbine', 'rpg']) {
    const wm = buildWeaponMesh(id, s);
    wm.position.z = id === 'pistol' ? 0.14 : 0.26;
    wm.visible = false;
    weaponSocket.add(wm);
    weaponVisuals[id] = wm;
  }

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.72, 0);
  const leftLegMesh = new THREE.Mesh(s.legGeo, pantsMat);
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.72, 0);
  const rightLegMesh = new THREE.Mesh(s.legGeo, pantsMat);
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);

  bodyPivot.add(pelvis, torso, vestTrim, head, hair, leftArm, rightArm, leftLeg, rightLeg);

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
        leftArm.rotation.x = -Math.PI * 0.34;
        leftArm.rotation.z = -0.26;
        weaponSocket.rotation.x = Math.PI * 0.48;
      } else {
        rightArm.rotation.x = -stride * 0.85;
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
