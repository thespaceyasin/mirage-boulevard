// 5-Star Wanted Escalation & SBPD Tactical Police Dispatch System:
// RAM & FLANK Interceptors, armored Tactical SUV roadblocks, SWAT deployments,
// SBPD Sky-Eye Police Helicopter with sweeping searchlight, and evasion cooldown.

import * as THREE from 'three';
import { createSeededRng } from '../engine/gameConfig.js';
import { createPoliceHelicopterMesh } from '../entities/vehicleFactory.js';
import { VehicleEntity } from '../entities/vehiclePhysics.js';

const STAR_THRESHOLDS = [0, 18, 46, 85, 138, 210];

export class PoliceDispatchSystem {
  constructor(scene, roadNetwork, vehiclesArray) {
    this.scene = scene;
    this.roadNetwork = roadNetwork;
    this.vehicles = vehiclesArray;
    this.rng = createSeededRng(91124);

    this.heatPoints = 0;
    this.wantedLevel = 0;
    this.heatPeak = 0;
    this.inSight = false;
    this.evasionProgress = 0; // 0..1 when out of sight
    this.lastCrimeReason = '';

    this.policeUnits = [];
    this.spawnTimer = 0;
    this.swatSpawnTimer = 0;

    // SBPD Sky-Eye Helicopter
    this.heli = createPoliceHelicopterMesh();
    this.heli.root.visible = false;
    this.heli.groundSpot.visible = false;
    scene.add(this.heli.root);
    scene.add(this.heli.groundSpot);
    this.heliActive = false;
    this.heliPos = new THREE.Vector3(140, 32, -120);
    this.heliHealth = 220;
    this.heliOrbitAngle = 0;
    this.heliFireTimer = 0;
    this.heliRespawnTimer = 0;
  }

  reportCrime(points, reason = 'DISTURBANCE') {
    this.heatPoints = Math.min(260, this.heatPoints + points);
    this.lastCrimeReason = reason;
    this.evasionProgress = 0;
    this._syncWantedLevel();
  }

  setWantedLevel(stars) {
    const clamped = Math.max(0, Math.min(5, stars));
    this.wantedLevel = clamped;
    this.heatPoints = STAR_THRESHOLDS[clamped] + (clamped > 0 ? 12 : 0);
    this.heatPeak = Math.max(this.heatPeak, clamped);
    this.evasionProgress = 0;
    if (clamped === 0) {
      this.clearHeat();
    }
  }

  clearHeat() {
    this.heatPoints = 0;
    this.wantedLevel = 0;
    this.evasionProgress = 0;
    this.inSight = false;
    this.heliActive = false;
    this.heli.root.visible = false;
    this.heli.groundSpot.visible = false;
    for (let i = 0; i < this.policeUnits.length; i += 1) {
      this.policeUnits[i].sirenActive = false;
      this.policeUnits[i].role = 'parked';
    }
    this.policeUnits.length = 0;
  }

  triggerBlackout(playerPos, duration = 6.5) {
    let affected = 0;
    for (let i = 0; i < this.policeUnits.length; i += 1) {
      const u = this.policeUnits[i];
      if (!u.wrecked && u.pos.distanceTo(playerPos) < 85) {
        u.disabledTimer = duration;
        u.vel.multiplyScalar(0.35);
        affected += 1;
      }
    }
    if (this.wantedLevel > 1) {
      this.heatPoints = Math.max(STAR_THRESHOLDS[this.wantedLevel - 1], this.heatPoints - 38);
      this._syncWantedLevel();
    }
    this.evasionProgress = Math.min(0.85, this.evasionProgress + 0.45);
    return affected;
  }

  damageHelicopter(amount, vfx, audio) {
    if (!this.heliActive) return;
    this.heliHealth -= amount;
    if (vfx) vfx.spawnSparks(this.heliPos.x, this.heliPos.y, this.heliPos.z, 10);
    if (this.heliHealth <= 0) {
      if (vfx) vfx.spawnExplosion(this.heliPos, 2.0);
      if (audio) audio.playExplosion(1.2);
      this.heliActive = false;
      this.heli.root.visible = false;
      this.heli.groundSpot.visible = false;
      this.heliRespawnTimer = 26;
      this.reportCrime(40, 'AIR-1 DOWN');
    }
  }

  _syncWantedLevel() {
    let stars = 0;
    for (let s = 1; s <= 5; s += 1) {
      if (this.heatPoints >= STAR_THRESHOLDS[s]) stars = s;
    }
    if (stars > this.wantedLevel) {
      this.wantedLevel = stars;
      this.heatPeak = Math.max(this.heatPeak, stars);
    }
  }

  spawnPoliceUnit(playerPos, playerHeading, forcedRole = null, forcedPos = null) {
    const unitNum = this.policeUnits.length + 1;
    const isSwat = (this.wantedLevel >= 4 && unitNum % 2 === 0) || forcedRole === 'ROADBLOCK';
    const specId = isSwat ? 'sbpd_tactical' : 'sbpd_interceptor';
    const dispatchRole = forcedRole || (unitNum % 3 === 0 ? 'FLANK' : unitNum % 2 === 0 ? 'RAM' : 'INTERCEPT');

    let sx; let sz; let heading;
    if (forcedPos) {
      sx = forcedPos.x;
      sz = forcedPos.z;
      heading = forcedPos.heading ?? playerHeading;
    } else if (dispatchRole === 'ROADBLOCK') {
      const aheadDist = 52;
      sx = Math.max(-196, Math.min(104, playerPos.x + Math.sin(playerHeading) * aheadDist));
      sz = Math.max(-196, Math.min(196, playerPos.z + Math.cos(playerHeading) * aheadDist));
      heading = playerHeading + Math.PI / 2;
    } else {
      const side = unitNum % 2 === 0 ? 1 : -1;
      const dist = dispatchRole === 'FLANK' ? 38 : 48;
      sx = Math.max(-196, Math.min(104, playerPos.x - Math.sin(playerHeading) * dist + Math.cos(playerHeading) * side * 12));
      sz = Math.max(-196, Math.min(196, playerPos.z - Math.cos(playerHeading) * dist - Math.sin(playerHeading) * side * 12));
      heading = playerHeading;
    }

    const posVec = new THREE.Vector3(sx, 0, sz);
    this.roadNetwork.resolveCircleCollision(posVec, 3.2);

    const veh = new VehicleEntity(this.scene, specId, posVec.x, posVec.z, heading, {
      role: 'police',
      sirenActive: true,
      dispatchRole,
      callsign: isSwat ? `SWAT-${unitNum}` : `UNIT-${unitNum}`,
    });
    this.vehicles.push(veh);
    this.policeUnits.push(veh);
    return veh;
  }

  getActiveDispatchSummary() {
    const list = [];
    for (let i = 0; i < this.policeUnits.length; i += 1) {
      const u = this.policeUnits[i];
      if (u.wrecked) continue;
      list.push({
        callsign: u.callsign,
        role: u.disabledTimer > 0 ? 'JAMMED' : u.dispatchRole,
        kind: u.dispatchRole === 'RAM' ? 'ram' : 'std',
      });
      if (list.length >= 3) break;
    }
    if (this.heliActive) {
      list.push({ callsign: 'AIR-1 SKY-EYE', role: 'HELI', kind: 'heli' });
    }
    return list;
  }

  update(dt, elapsed, context) {
    const { player, renderer, combat, vfx, audio, nightFactor } = context;

    // Clean out destroyed/far police units
    for (let i = this.policeUnits.length - 1; i >= 0; i -= 1) {
      const u = this.policeUnits[i];
      if (u.role !== 'police') {
        this.policeUnits.splice(i, 1);
      }
    }

    if (this.wantedLevel <= 0) {
      renderer.dynamicLights.strobeRed.intensity = 0;
      renderer.dynamicLights.strobeBlue.intensity = 0;
      return;
    }

    // Target unit count scales with Wanted Stars (1->1, 2->2, 3->3+Heli, 4->4+SWAT+Heli, 5->5+SWAT+Heli)
    const desiredUnits = Math.min(5, this.wantedLevel + (this.wantedLevel >= 3 ? 1 : 0));
    let activeUnits = 0;
    for (let i = 0; i < this.policeUnits.length; i += 1) {
      if (!this.policeUnits[i].wrecked) activeUnits += 1;
    }

    this.spawnTimer += dt;
    if (activeUnits < desiredUnits && this.spawnTimer > 2.2) {
      this.spawnTimer = 0;
      const role = this.wantedLevel >= 3 && activeUnits === 2 ? 'ROADBLOCK' : null;
      this.spawnPoliceUnit(player.pos, player.heading, role);
    }

    // Deploy on-foot SBPD SWAT officers at 3-5 stars when player is on foot or slow
    this.swatSpawnTimer += dt;
    if (this.wantedLevel >= 3 && this.swatSpawnTimer > 7.5 && combat) {
      let activeCopsOnFoot = 0;
      for (const e of combat.enemies) if (e.alive && e.role === 'police') activeCopsOnFoot += 1;
      if (activeCopsOnFoot < Math.min(4, this.wantedLevel - 1)) {
        this.swatSpawnTimer = 0;
        const ang = this.rng.range(0, Math.PI * 2);
        const sx = player.pos.x + Math.cos(ang) * 26;
        const sz = player.pos.z + Math.sin(ang) * 26;
        const p = new THREE.Vector3(sx, 0, sz);
        this.roadNetwork.resolveCircleCollision(p, 1.0);
        combat.spawnEnemy('police', p.x, p.z, 'sbpd_swat');
      }
    }

    // Helicopter activation at 3+ stars
    if (this.wantedLevel >= 3 && !this.heliActive) {
      if (this.heliRespawnTimer > 0) {
        this.heliRespawnTimer -= dt;
      } else {
        this.heliActive = true;
        this.heliHealth = 220;
        this.heliPos.set(player.pos.x + 55, 32, player.pos.z - 55);
        this.heli.root.visible = true;
      }
    }

    // Update each active Police Vehicle with tactical RAM / FLANK / ROADBLOCK AI
    let closestSirenUnit = null;
    let closestSirenDist = Infinity;
    let anyInSight = false;

    for (let i = 0; i < this.policeUnits.length; i += 1) {
      const u = this.policeUnits[i];
      const dist = u.pos.distanceTo(player.pos);
      if (!u.wrecked && dist < 58 && u.disabledTimer <= 0) {
        anyInSight = true;
      }
      if (!u.wrecked && u.sirenActive && u.disabledTimer <= 0 && dist < closestSirenDist) {
        closestSirenDist = dist;
        closestSirenUnit = u;
      }

      if (u.wrecked) {
        u.stepPhysics(dt, { throttle: 0, steer: 0, handbrake: true, nitro: false }, this.roadNetwork, null, vfx, elapsed, nightFactor);
        continue;
      }

      // Compute tactical pursuit aimpoint
      let targetX = player.pos.x;
      let targetZ = player.pos.z;
      const pFwdX = Math.sin(player.heading);
      const pFwdZ = Math.cos(player.heading);

      if (u.dispatchRole === 'FLANK') {
        targetX += pFwdX * 16 + pFwdZ * 6;
        targetZ += pFwdZ * 16 - pFwdX * 6;
      } else if (u.dispatchRole === 'RAM') {
        targetX += pFwdX * 6;
        targetZ += pFwdZ * 6;
      }

      let controls;
      if (u.dispatchRole === 'ROADBLOCK' && dist > 18) {
        controls = { throttle: 0, steer: 0, handbrake: true, nitro: false };
      } else {
        const dx = targetX - u.pos.x;
        const dz = targetZ - u.pos.z;
        const desiredHeading = Math.atan2(dx, dz);
        const diff = Math.atan2(Math.sin(desiredHeading - u.heading), Math.cos(desiredHeading - u.heading));
        const steer = THREE.MathUtils.clamp(-diff * 1.9, -1, 1);
        const throttle = Math.abs(diff) > 1.7 ? -0.65 : 1.0;
        const handbrake = Math.abs(diff) > 1.05 && u.speed > 18;
        controls = { throttle, steer, handbrake, nitro: dist > 26 && Math.abs(diff) < 0.35 };
      }

      u.stepPhysics(dt, controls, this.roadNetwork, null, vfx, elapsed, nightFactor);
    }

    // Update SBPD Sky-Eye Helicopter orbit, searchlight & strafing bursts
    if (this.heliActive) {
      this.heliOrbitAngle += dt * 0.48;
      const orbitR = 26;
      const desiredX = player.pos.x + Math.cos(this.heliOrbitAngle) * orbitR;
      const desiredZ = player.pos.z + Math.sin(this.heliOrbitAngle) * orbitR;
      const desiredY = 25 + Math.sin(elapsed * 1.6) * 1.8;

      this.heliPos.x += (desiredX - this.heliPos.x) * (1 - Math.exp(-dt * 2.4));
      this.heliPos.y += (desiredY - this.heliPos.y) * (1 - Math.exp(-dt * 2.4));
      this.heliPos.z += (desiredZ - this.heliPos.z) * (1 - Math.exp(-dt * 2.4));

      this.heli.root.position.copy(this.heliPos);
      this.heli.root.rotation.order = 'YXZ';
      const hYaw = Math.atan2(player.pos.x - this.heliPos.x, player.pos.z - this.heliPos.z);
      this.heli.root.rotation.set(0.14, hYaw, -0.14);
      this.heli.update(dt, elapsed, player.pos);

      if (this.heliPos.distanceTo(player.pos) < 75) anyInSight = true;

      // Air support strafing bursts at 4-5 stars
      if (this.wantedLevel >= 4 && !player.dead && combat) {
        this.heliFireTimer -= dt;
        if (this.heliFireTimer <= 0) {
          this.heliFireTimer = 2.4;
          const dir = player.pos.clone().sub(this.heliPos).normalize();
          dir.x += (this.rng.next() - 0.5) * 0.14;
          dir.z += (this.rng.next() - 0.5) * 0.14;
          dir.normalize();
          combat._resolveBulletRay(this.heliPos.clone(), dir, 95, 8, 0xffc857, false, context);
          if (audio) audio.playWeaponShot('carbine', 0.3);
        }
      }
    }

    // Drive real red/blue dynamic point lights from closest pursuing police cruiser
    if (closestSirenUnit && closestSirenDist < 75) {
      const redPhase = Math.sin(elapsed * 18) > 0;
      const p = closestSirenUnit.pos;
      renderer.dynamicLights.strobeRed.position.set(p.x - 1.2, p.y + 3.2, p.z);
      renderer.dynamicLights.strobeBlue.position.set(p.x + 1.2, p.y + 3.2, p.z);
      renderer.dynamicLights.strobeRed.intensity = redPhase ? 28 : 2;
      renderer.dynamicLights.strobeBlue.intensity = redPhase ? 2 : 28;
    } else {
      renderer.dynamicLights.strobeRed.intensity = 0;
      renderer.dynamicLights.strobeBlue.intensity = 0;
    }

    // Evasion cooldown timer when player breaks line-of-sight
    this.inSight = anyInSight;
    if (anyInSight) {
      this.evasionProgress = Math.max(0, this.evasionProgress - dt * 0.15);
    } else {
      const evadeDuration = 8 + this.wantedLevel * 2.5;
      this.evasionProgress = Math.min(1, this.evasionProgress + dt / evadeDuration);
      if (this.evasionProgress >= 1) {
        this.clearHeat();
        if (context.showToast) context.showToast('PURSUIT EVADED — HEAT CLEARED');
      }
    }
  }
}
