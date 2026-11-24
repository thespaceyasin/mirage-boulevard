// Urban road-graph traffic vehicle pool (lane-following, intersection signals,
// obstacle yielding, hijack replacement) + sidewalk/boardwalk pedestrian crowd AI.

import * as THREE from 'three';
import { CITY_CONFIG, VEHICLE_SPECS, createSeededRng } from '../engine/gameConfig.js';
import { VehicleEntity } from '../entities/vehiclePhysics.js';
import { createCharacterRig } from '../entities/characterRig.js';

const CIVILIAN_SPECS = ['metro_sedan', 'mirage_coupe', 'bayside_cruiser', 'harbor_hauler', 'apex_gt'];

export class TrafficSystem {
  constructor(scene, roadNetwork, vehiclesArray) {
    this.scene = scene;
    this.roadNetwork = roadNetwork;
    this.vehicles = vehiclesArray;
    this.rng = createSeededRng(40499);
    this.pedestrians = [];
    this.targetTrafficCount = 15;
    this.spawnTimer = 0;

    this._spawnInitialTraffic();
    this._spawnPedestrians(34);
  }

  _pickCivilianSpec() {
    const r = this.rng.next();
    if (r < 0.32) return 'metro_sedan';
    if (r < 0.56) return 'mirage_coupe';
    if (r < 0.74) return 'bayside_cruiser';
    if (r < 0.89) return 'harbor_hauler';
    return 'apex_gt';
  }

  spawnTrafficVehicle(nearPos = null, forcedSpec = null, forcedCoords = null) {
    const specId = forcedSpec || this._pickCivilianSpec();
    const spec = VEHICLE_SPECS[specId];
    const colorHex = this.rng.pick(spec.palette);

    let x; let z; let heading; let axis; let dir; let laneCoord;
    if (forcedCoords) {
      ({ x, z, heading, axis, dir, laneCoord } = forcedCoords);
    } else {
      axis = this.rng.next() < 0.58 ? 'z' : 'x';
      dir = this.rng.next() < 0.5 ? 1 : -1;
      if (axis === 'z') {
        const ax = this.rng.pick(CITY_CONFIG.avenuesX);
        laneCoord = ax + (dir > 0 ? this.roadNetwork.laneOffset : -this.roadNetwork.laneOffset);
        x = laneCoord;
        z = this.rng.range(-180, 180);
        heading = dir > 0 ? 0 : Math.PI;
      } else {
        const sz = this.rng.pick(CITY_CONFIG.streetsZ);
        laneCoord = sz + (dir > 0 ? -this.roadNetwork.laneOffset : this.roadNetwork.laneOffset);
        z = laneCoord;
        x = this.rng.range(-180, 90);
        heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (nearPos && Math.hypot(x - nearPos.x, z - nearPos.z) < 28) {
        z = ((z + 90 + 180) % 360) - 180;
      }
    }

    const veh = new VehicleEntity(this.scene, specId, x, z, heading, {
      role: 'traffic',
      colorHex,
      aiAxis: axis,
      aiDir: dir,
      aiLaneCoord: laneCoord,
      aiTargetSpeed: this.rng.range(11, 17.5),
    });
    this.vehicles.push(veh);
    return veh;
  }

  _spawnInitialTraffic() {
    // Guarantee lively oceanfront cars right along Mirage Boulevard & Marina!
    const guaranteed = [
      { spec: 'apex_gt', x: 100.6, z: -6, heading: 0, axis: 'z', dir: 1, laneCoord: 100.6 },
      { spec: 'bayside_cruiser', x: 91.4, z: -56, heading: Math.PI, axis: 'z', dir: -1, laneCoord: 91.4 },
      { spec: 'mirage_coupe', x: 100.6, z: -98, heading: 0, axis: 'z', dir: 1, laneCoord: 100.6 },
      { spec: 'metro_sedan', x: 91.4, z: 32, heading: Math.PI, axis: 'z', dir: -1, laneCoord: 91.4 },
      { spec: 'harbor_hauler', x: -4.6, z: 64, heading: Math.PI, axis: 'z', dir: -1, laneCoord: -4.6 },
    ];
    for (const g of guaranteed) {
      this.spawnTrafficVehicle(null, g.spec, g);
    }
    for (let i = guaranteed.length; i < this.targetTrafficCount; i += 1) {
      this.spawnTrafficVehicle();
    }
  }

  _spawnPedestrians(count) {
    const jackets = [0xff6b7a, 0x1de9d8, 0xffc857, 0x56aaff, 0xf2f4f8, 0x9b6bff, 0x45d483, 0xff8a4c];
    const skins = [0xf0c7a8, 0xdba27c, 0xb87e59, 0x8d5b3e];
    const pants = [0x243146, 0x3b485e, 0xdcd4c6, 0x1f2532];

    for (let i = 0; i < count; i += 1) {
      const rig = createCharacterRig('pedestrian', {
        jacket: this.rng.pick(jackets),
        skin: this.rng.pick(skins),
        pants: this.rng.pick(pants),
        hair: this.rng.pick([0x1a1512, 0x5e3b24, 0xd1a254, 0x262630]),
      });

      let x; let z; let heading;
      if (i < 16) {
        // Mirage Boulevard sidewalks & coastal boardwalk!
        x = i % 2 === 0 ? 111.5 + this.rng.range(-2.2, 4.0) : 83.8 + this.rng.range(-1.4, 1.4);
        z = this.rng.range(-145, 145);
        heading = this.rng.next() < 0.5 ? 0 : Math.PI;
      } else if (i < 24) {
        // Lantern Night Market & Saffron Downtown sidewalks
        x = (i % 2 === 0 ? -12.8 : 12.8) + this.rng.range(-1.2, 1.2);
        z = this.rng.range(-120, 155);
        heading = this.rng.next() < 0.5 ? 0 : Math.PI;
      } else {
        // Palm Heights & Torque Quarter
        x = (i % 2 === 0 ? -83.5 : -108.5) + this.rng.range(-1.2, 1.2);
        z = this.rng.range(-130, 145);
        heading = this.rng.next() < 0.5 ? 0 : Math.PI;
      }

      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = heading;
      this.scene.add(rig.root);

      this.pedestrians.push({
        rig,
        pos: new THREE.Vector3(x, 0, z),
        heading,
        baseSpeed: this.rng.range(1.6, 2.5),
        panicTimer: 0,
        panicDirX: 0,
        panicDirZ: 1,
        alive: true,
        respawnTimer: 0,
      });
    }
  }

  alertPanic(origin, radius = 34) {
    for (let i = 0; i < this.pedestrians.length; i += 1) {
      const p = this.pedestrians[i];
      if (!p.alive) continue;
      const dx = p.pos.x - origin.x;
      const dz = p.pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d < radius && d > 0.01) {
        p.panicTimer = 6.5;
        p.panicDirX = dx / d;
        p.panicDirZ = dz / d;
      }
    }
  }

  update(dt, elapsed, playerPos, nightFactor, vfx) {
    // Keep traffic pool populated
    this.spawnTimer += dt;
    if (this.spawnTimer > 2.4) {
      this.spawnTimer = 0;
      let trafficAlive = 0;
      for (let i = 0; i < this.vehicles.length; i += 1) {
        if (this.vehicles[i].role === 'traffic' && !this.vehicles[i].wrecked) trafficAlive += 1;
      }
      if (trafficAlive < this.targetTrafficCount) {
        this.spawnTrafficVehicle(playerPos);
      }
    }

    // Update each traffic vehicle
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const v = this.vehicles[i];
      if (v.role !== 'traffic') continue;

      if (v.wrecked) {
        v.stepPhysics(dt, { throttle: 0, steer: 0, handbrake: true, nitro: false }, this.roadNetwork, null, vfx, elapsed, nightFactor);
        continue;
      }

      // Compute forward obstacle distance & red-light braking
      const sinH = Math.sin(v.heading);
      const cosH = Math.cos(v.heading);
      let shouldStop = false;

      // Check traffic light before entering intersection
      const checkX = v.pos.x + sinH * 11;
      const checkZ = v.pos.z + cosH * 11;
      if (!this.roadNetwork.isGreenForAxis(v.aiAxis)) {
        for (let k = 0; k < this.roadNetwork.intersections.length; k += 1) {
          const inter = this.roadNetwork.intersections[k];
          const dNow = Math.hypot(inter.x - v.pos.x, inter.z - v.pos.z);
          const dAhead = Math.hypot(inter.x - checkX, inter.z - checkZ);
          if (dNow > 11 && dNow < 22 && dAhead < dNow) {
            shouldStop = true;
            break;
          }
        }
      }

      // Yield to any vehicle or player right in front
      if (!shouldStop) {
        for (let j = 0; j < this.vehicles.length; j += 1) {
          if (i === j) continue;
          const other = this.vehicles[j];
          const dx = other.pos.x - v.pos.x;
          const dz = other.pos.z - v.pos.z;
          const fwdDist = dx * sinH + dz * cosH;
          const latDist = Math.abs(dx * cosH - dz * sinH);
          if (fwdDist > 0 && fwdDist < 12.5 && latDist < 3.0) {
            shouldStop = true;
            break;
          }
        }
      }

      // Gentle lane alignment steering
      let targetHeading = v.aiAxis === 'z'
        ? (v.aiDir > 0 ? 0 : Math.PI)
        : (v.aiDir > 0 ? Math.PI / 2 : -Math.PI / 2);

      // Turn around cleanly at boulevard limits
      if (v.aiAxis === 'z' && Math.abs(v.pos.z) > 194) {
        v.aiDir *= -1;
        const baseAx = Math.round(v.pos.x / 96) * 96;
        v.aiLaneCoord = baseAx + (v.aiDir > 0 ? this.roadNetwork.laneOffset : -this.roadNetwork.laneOffset);
        v.pos.x = v.aiLaneCoord;
        v.heading = v.aiDir > 0 ? 0 : Math.PI;
        targetHeading = v.heading;
      } else if (v.aiAxis === 'x' && (v.pos.x > 104 || v.pos.x < -194)) {
        v.aiDir *= -1;
        const baseSz = Math.round(v.pos.z / 96) * 96;
        v.aiLaneCoord = baseSz + (v.aiDir > 0 ? -this.roadNetwork.laneOffset : this.roadNetwork.laneOffset);
        v.pos.z = v.aiLaneCoord;
        v.heading = v.aiDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        targetHeading = v.heading;
      }

      const laneErr = v.aiAxis === 'z' ? (v.aiLaneCoord - v.pos.x) * v.aiDir : (v.pos.z - v.aiLaneCoord) * v.aiDir;
      const desiredYaw = targetHeading + THREE.MathUtils.clamp(laneErr * 0.08, -0.35, 0.35);
      const yawDiff = Math.atan2(Math.sin(desiredYaw - v.heading), Math.cos(desiredYaw - v.heading));
      const steer = THREE.MathUtils.clamp(-yawDiff * 1.8, -1, 1);

      const throttle = shouldStop ? -0.9 : (v.forwardSpeed < v.aiTargetSpeed ? 0.65 : 0.08);
      v.stepPhysics(
        dt,
        { throttle, steer, handbrake: shouldStop && v.speed < 2, nitro: false },
        this.roadNetwork,
        null,
        vfx,
        elapsed,
        nightFactor,
      );
    }

    // Update pedestrians
    for (let i = 0; i < this.pedestrians.length; i += 1) {
      const p = this.pedestrians[i];
      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.pos.set(112, 0, this.rng.range(-120, 120));
          p.rig.root.visible = true;
        }
        continue;
      }

      let spd = p.baseSpeed;
      if (p.panicTimer > 0) {
        p.panicTimer -= dt;
        spd = 6.2;
        p.heading = Math.atan2(p.panicDirX, p.panicDirZ);
      } else {
        // Flip patrol direction near north/south map edges
        if (p.pos.z > 175) p.heading = Math.PI;
        if (p.pos.z < -175) p.heading = 0;
      }

      p.pos.x += Math.sin(p.heading) * spd * dt;
      p.pos.z += Math.cos(p.heading) * spd * dt;
      p.pos.y = this.roadNetwork.sampleGroundHeight(p.pos.x, p.pos.z);

      const col = this.roadNetwork.resolveCircleCollision(p.pos, 0.45);
      if (col.hit) {
        p.heading += Math.PI * 0.75;
      }

      // Check high-speed vehicle strike on pedestrian
      for (let vIdx = 0; vIdx < this.vehicles.length; vIdx += 1) {
        const veh = this.vehicles[vIdx];
        if (veh.speed < 8) continue;
        const d = Math.hypot(veh.pos.x - p.pos.x, veh.pos.z - p.pos.z);
        if (d < veh.radius + 0.55) {
          p.alive = false;
          p.respawnTimer = 14;
          p.rig.animate(0, elapsed, false, true);
          if (vfx) vfx.spawnSparks(p.pos.x, 1.0, p.pos.z, 5);
          break;
        }
      }

      p.rig.root.position.copy(p.pos);
      p.rig.root.rotation.y = p.heading;
      p.rig.animate(spd, elapsed + i * 0.7, false, !p.alive);
    }
  }
}
