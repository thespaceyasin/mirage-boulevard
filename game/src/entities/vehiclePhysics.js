// Arcade-sim vehicle dynamics: forward/lateral slip drift physics, nitro surge,
// suspension body roll/pitch, stunt ramp airtime, building/vehicle collisions,
// and progressive vehicle damage -> smoke -> engine fire -> chain explosion.

import * as THREE from 'three';
import { VEHICLE_SPECS } from '../engine/gameConfig.js';
import { createVehicleMesh } from './vehicleFactory.js';

let nextVehicleId = 1;

export class VehicleEntity {
  constructor(scene, specId, x, z, heading = 0, options = {}) {
    this.id = nextVehicleId++;
    this.specId = specId;
    this.spec = VEHICLE_SPECS[specId] || VEHICLE_SPECS.metro_sedan;
    this.role = options.role || (this.spec.isPolice ? 'police' : 'traffic'); // player | traffic | police | parked | mission
    this.colorHex = options.colorHex ?? this.spec.palette[0];
    this.visual = createVehicleMesh(specId, this.colorHex);
    this.root = this.visual.root;
    scene.add(this.root);

    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.heading = heading;
    this.steerAngle = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.drifting = false;
    this.driftScoreTimer = 0;
    this.nitro = 100;
    this.nitroActive = false;
    this.braking = false;
    this.sirenActive = Boolean(options.sirenActive);
    this.grounded = true;
    this.radius = Math.max(this.spec.width, this.spec.length) * 0.44;

    this.maxHealth = this.spec.maxHealth;
    this.health = this.maxHealth;
    this.wrecked = false;
    this.wreckFireTimer = 0;
    this.smokeCooldown = 0;
    this.disabledTimer = 0; // Set by Nadia's Signal Blackout!

    // Police/AI tactical properties
    this.dispatchRole = options.dispatchRole || 'PURSUIT';
    this.callsign = options.callsign || `UNIT-${this.id}`;
    this.aiAxis = options.aiAxis || 'z';
    this.aiDir = options.aiDir || 1;
    this.aiLaneCoord = options.aiLaneCoord ?? x;
    this.aiTargetSpeed = options.aiTargetSpeed ?? 16;

    this.syncTransform();
  }

  applyGarageUpgrades(upgrades) {
    const armorBonus = 1 + (upgrades.armor || 0) * 0.35;
    this.maxHealth = Math.round(this.spec.maxHealth * armorBonus);
    this.health = this.maxHealth;
  }

  repairFull() {
    this.wrecked = false;
    this.health = this.maxHealth;
    this.nitro = 100;
    this.visual.paintMat.color.setHex(this.colorHex);
    this.visual.paintMat.roughness = this.spec.category === 'super' ? 0.24 : 0.38;
    this.visual.paintMat.clearcoat = 0.92;
  }

  setPaint(hex) {
    this.colorHex = hex;
    this.visual.setBodyColor(hex);
  }

  takeDamage(amount, vfx, audio, onExplode) {
    if (this.wrecked) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.explode(vfx, audio, onExplode);
      return true;
    }
    return false;
  }

  explode(vfx, audio, onExplode) {
    if (this.wrecked) return;
    this.wrecked = true;
    this.health = 0;
    this.sirenActive = false;
    this.nitroActive = false;
    this.wreckFireTimer = 18;
    this.vel.y = 7.5;
    this.grounded = false;
    this.visual.setWrecked(true);
    if (vfx) vfx.spawnExplosion(this.pos, 1.35);
    if (audio) audio.playExplosion(1.0);
    if (onExplode) onExplode(this);
  }

  stepPhysics(dt, controls, roadNetwork, upgrades = null, vfx = null, elapsed = 0, nightFactor = 0) {
    if (this.disabledTimer > 0) {
      this.disabledTimer = Math.max(0, this.disabledTimer - dt);
    }

    const engineMult = upgrades ? 1 + (upgrades.engine || 0) * 0.14 : 1;
    const handlingMult = upgrades ? 1 + (upgrades.handling || 0) * 0.12 : 1;
    const nitroMult = upgrades ? 1 + (upgrades.nitro || 0) * 0.3 : 1;

    const activeControls = this.wrecked || this.disabledTimer > 0
      ? { throttle: 0, steer: 0, handbrake: true, nitro: false }
      : controls;

    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);

    let fwd = this.vel.x * sinH + this.vel.z * cosH;
    let lat = this.vel.x * cosH - this.vel.z * sinH;

    // Nitro boost logic
    this.nitroActive = Boolean(activeControls.nitro && this.nitro > 1 && activeControls.throttle > 0.1);
    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - (26 / nitroMult) * dt);
    } else if (this.nitro < 100) {
      this.nitro = Math.min(100, this.nitro + (7.5 * nitroMult) * dt);
    }

    const maxSpd = this.spec.topSpeed * engineMult * (this.nitroActive ? 1.32 : 1.0);
    const accelForce = this.spec.accel * engineMult * (this.nitroActive ? 1.65 : 1.0);
    this.braking = activeControls.throttle < -0.1 && fwd > 1.5 || Boolean(activeControls.handbrake && Math.abs(fwd) > 2);

    if (this.grounded) {
      if (activeControls.throttle > 0) {
        fwd += activeControls.throttle * accelForce * dt;
      } else if (activeControls.throttle < 0) {
        if (fwd > 1.2) {
          fwd += activeControls.throttle * this.spec.brake * dt;
        } else {
          fwd += activeControls.throttle * (accelForce * 0.55) * dt;
        }
      } else {
        // Natural rolling resistance
        fwd *= Math.exp(-dt * (this.wrecked ? 4.5 : 1.35));
      }

      if (activeControls.handbrake) {
        fwd *= Math.exp(-dt * 2.1);
      }

      fwd = THREE.MathUtils.clamp(fwd, -maxSpd * 0.38, maxSpd);

      // Steering rate scales cleanly with speed & handbrake drift
      const speedFactor = THREE.MathUtils.clamp(Math.abs(fwd) / 9.5, 0, 1);
      const reverseSign = fwd >= -0.2 ? 1 : -1;
      const targetSteer = -activeControls.steer;
      this.steerAngle += (targetSteer - this.steerAngle) * (1 - Math.exp(-dt * 12));

      const driftTurnBoost = activeControls.handbrake ? 1.38 : 1.0;
      const highSpeedDamp = 1.0 - THREE.MathUtils.clamp(Math.abs(fwd) / 85, 0, 0.35);
      this.heading += this.steerAngle * this.spec.steerRate * handlingMult * driftTurnBoost * highSpeedDamp * speedFactor * reverseSign * dt;

      // Lateral traction: crisp grip normally, smooth drift slide with Space
      const grip = activeControls.handbrake ? this.spec.driftGrip * 0.32 : 0.88 * handlingMult;
      const lateralDamp = Math.exp(-dt * (activeControls.handbrake ? 2.4 : 8.5 * grip));
      lat *= lateralDamp;

      // Reconstruct world velocity
      const nSin = Math.sin(this.heading);
      const nCos = Math.cos(this.heading);
      this.vel.x = nSin * fwd + nCos * lat;
      this.vel.z = nCos * fwd - nSin * lat;
    }

    // Integrate position & check ramp elevation / gravity
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    const groundY = roadNetwork.sampleGroundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= groundY + 0.08 && this.vel.y <= 0) {
      // Launch up stunt ramp slope if moving fast
      const aheadY = roadNetwork.sampleGroundHeight(this.pos.x + sinH * 1.4, this.pos.z + cosH * 1.4);
      const slope = (aheadY - groundY) / 1.4;
      this.pos.y = groundY;
      if (slope > 0.12 && fwd > 14) {
        this.vel.y = Math.min(11.5, fwd * slope * 0.9);
        this.grounded = false;
      } else {
        this.vel.y = 0;
        this.grounded = true;
      }
    } else {
      this.vel.y -= 24 * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= groundY) {
        this.pos.y = groundY;
        this.vel.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }

    // Building & city perimeter collision with elastic slide + impact damage
    const col = roadNetwork.resolveCircleCollision(this.pos, this.radius);
    let impactSpeed = 0;
    if (col.hit) {
      const len = Math.hypot(col.nx, col.nz) || 1;
      const nx = col.nx / len;
      const nz = col.nz / len;
      const vn = this.vel.x * nx + this.vel.z * nz;
      if (vn < 0) {
        impactSpeed = -vn;
        this.vel.x -= 1.32 * vn * nx;
        this.vel.z -= 1.32 * vn * nz;
        this.vel.multiplyScalar(0.76);
      }
    }

    this.forwardSpeed = fwd;
    this.lateralSpeed = lat;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.drifting = this.grounded && !this.wrecked && Math.abs(lat) > 4.2 && this.speed > 11;

    if (this.drifting) {
      this.driftScoreTimer += dt;
      if (vfx && Math.floor(elapsed * 30) % 2 === 0) {
        const rearX = this.pos.x - Math.sin(this.heading) * (this.spec.length * 0.36);
        const rearZ = this.pos.z - Math.cos(this.heading) * (this.spec.length * 0.36);
        vfx.spawnDriftSmoke(rearX, this.pos.y + 0.18, rearZ);
      }
    } else {
      this.driftScoreTimer = Math.max(0, this.driftScoreTimer - dt * 2);
    }

    // Damage smoke / engine fire VFX
    if (vfx) {
      this.smokeCooldown -= dt;
      if (this.wrecked && this.wreckFireTimer > 0) {
        this.wreckFireTimer -= dt;
        if (this.smokeCooldown <= 0) {
          this.smokeCooldown = 0.08;
          vfx.spawnFirePlume(this.pos.x, this.pos.y + 1.15, this.pos.z, 1.15);
        }
      } else if (!this.wrecked && this.health < this.maxHealth * 0.45 && this.smokeCooldown <= 0) {
        const critical = this.health < this.maxHealth * 0.24;
        this.smokeCooldown = critical ? 0.07 : 0.14;
        const hoodX = this.pos.x + Math.sin(this.heading) * (this.spec.length * 0.34);
        const hoodZ = this.pos.z + Math.cos(this.heading) * (this.spec.length * 0.34);
        if (critical) vfx.spawnFirePlume(hoodX, this.pos.y + 0.95, hoodZ, 0.72);
        else vfx.spawnSmoke(hoodX, this.pos.y + 0.95, hoodZ, 0.7);
      }
    }

    // Suspension roll & pitch animation
    const targetRoll = THREE.MathUtils.clamp(-this.steerAngle * (fwd / 44) * 0.14, -0.14, 0.14);
    const targetPitch = THREE.MathUtils.clamp(
      (this.braking ? 0.065 : activeControls.throttle > 0.2 ? -0.045 : 0) - (this.nitroActive ? 0.04 : 0),
      -0.1,
      0.1,
    );
    this.visual.bodyGroup.rotation.z += (targetRoll - this.visual.bodyGroup.rotation.z) * (1 - Math.exp(-dt * 10));
    this.visual.bodyGroup.rotation.x += (targetPitch - this.visual.bodyGroup.rotation.x) * (1 - Math.exp(-dt * 10));

    this.syncTransform();
    this.visual.updateVisuals({
      elapsed,
      nightFactor,
      speed: this.forwardSpeed,
      steerAngle: this.steerAngle,
      braking: this.braking,
      sirenActive: this.sirenActive && this.disabledTimer <= 0,
      nitroActive: this.nitroActive,
      wrecked: this.wrecked,
    });

    return impactSpeed;
  }

  syncTransform() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
  }
}

export function resolveVehiclePairCollisions(vehicles, vfx, audio, onExplode, onPlayerCrash) {
  for (let i = 0; i < vehicles.length; i += 1) {
    const a = vehicles[i];
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const b = vehicles[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const minDist = a.radius + b.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq > 0.0001 && distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = (minDist - dist) * 0.52;

        const invA = a.wrecked ? 0.15 : 1 / a.spec.mass;
        const invB = b.wrecked ? 0.15 : 1 / b.spec.mass;
        const invSum = invA + invB;

        a.pos.x -= nx * overlap * (invA / invSum) * 2;
        a.pos.z -= nz * overlap * (invA / invSum) * 2;
        b.pos.x += nx * overlap * (invB / invSum) * 2;
        b.pos.z += nz * overlap * (invB / invSum) * 2;

        const rvx = b.vel.x - a.vel.x;
        const rvz = b.vel.z - a.vel.z;
        const relVel = rvx * nx + rvz * nz;
        if (relVel < 0) {
          const impulse = -(1.25 * relVel) / invSum;
          a.vel.x -= impulse * invA * nx;
          a.vel.z -= impulse * invA * nz;
          b.vel.x += impulse * invB * nx;
          b.vel.z += impulse * invB * nz;

          const severity = -relVel;
          if (severity > 10) {
            const hitX = (a.pos.x + b.pos.x) * 0.5;
            const hitZ = (a.pos.z + b.pos.z) * 0.5;
            if (vfx) vfx.spawnSparks(hitX, 0.9, hitZ, 10);
            const dmg = (severity - 8) * 1.45;
            if (a.role !== 'player') a.takeDamage(dmg, vfx, audio, onExplode);
            else a.takeDamage(dmg * 0.55, vfx, audio, onExplode);
            if (b.role !== 'player') b.takeDamage(dmg, vfx, audio, onExplode);
            else b.takeDamage(dmg * 0.55, vfx, audio, onExplode);

            if ((a.role === 'player' || b.role === 'player') && onPlayerCrash) {
              onPlayerCrash(a.role === 'player' ? b : a, severity);
            }
          }
        }
      }
    }
  }
}
