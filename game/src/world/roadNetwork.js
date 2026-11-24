// Solara Bay road lattice, intersection traffic signal controller,
// building AABB collision spatial queries, and GPS route computation.

import { CITY_CONFIG, getDistrictAt } from '../engine/gameConfig.js';

export class RoadNetwork {
  constructor() {
    this.avenuesX = CITY_CONFIG.avenuesX;
    this.streetsZ = CITY_CONFIG.streetsZ;
    this.roadWidth = CITY_CONFIG.roadWidth;
    this.halfRoad = this.roadWidth * 0.5;
    this.laneOffset = 4.6;
    this.buildings = [];
    this.ramps = [];
    this.intersections = [];
    this.signalTimer = 0;
    this.nsGreen = true;
    this.signalYellow = false;

    for (const x of this.avenuesX) {
      for (const z of this.streetsZ) {
        this.intersections.push({ x, z });
      }
    }
  }

  registerBuilding(minX, maxX, minZ, maxZ, height, district) {
    this.buildings.push({ minX, maxX, minZ, maxZ, height, district });
  }

  registerRamp(x, z, heading, length, width, peakHeight) {
    this.ramps.push({ x, z, heading, length, width, peakHeight });
  }

  updateSignals(dt) {
    this.signalTimer = (this.signalTimer + dt) % 16;
    if (this.signalTimer < 6.5) {
      this.nsGreen = true;
      this.signalYellow = false;
    } else if (this.signalTimer < 8.0) {
      this.nsGreen = true;
      this.signalYellow = true;
    } else if (this.signalTimer < 14.5) {
      this.nsGreen = false;
      this.signalYellow = false;
    } else {
      this.nsGreen = false;
      this.signalYellow = true;
    }
  }

  isGreenForAxis(axis) {
    if (this.signalYellow) return false;
    return axis === 'z' ? this.nsGreen : !this.nsGreen;
  }

  isOnRoad(x, z, margin = 0) {
    const hw = this.halfRoad + margin;
    for (const ax of this.avenuesX) {
      if (Math.abs(x - ax) <= hw && z >= -208 && z <= 208) return true;
    }
    for (const sz of this.streetsZ) {
      if (Math.abs(z - sz) <= hw && x >= -208 && x <= 112) return true;
    }
    return false;
  }

  isInsideBuilding(x, z, pad = 0) {
    for (let i = 0; i < this.buildings.length; i += 1) {
      const b = this.buildings[i];
      if (x >= b.minX - pad && x <= b.maxX + pad && z >= b.minZ - pad && z <= b.maxZ + pad) {
        return true;
      }
    }
    return false;
  }

  resolveCircleCollision(pos, radius) {
    let hit = false;
    let pushX = 0;
    let pushZ = 0;

    for (let i = 0; i < this.buildings.length; i += 1) {
      const b = this.buildings[i];
      const closestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        hit = true;
        if (distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          pos.x += nx * overlap;
          pos.z += nz * overlap;
          pushX += nx;
          pushZ += nz;
        } else {
          // Center penetrated box: push out toward nearest face
          const dLeft = Math.abs(pos.x - b.minX);
          const dRight = Math.abs(b.maxX - pos.x);
          const dTop = Math.abs(pos.z - b.minZ);
          const dBot = Math.abs(b.maxZ - pos.z);
          const m = Math.min(dLeft, dRight, dTop, dBot);
          if (m === dLeft) { pos.x = b.minX - radius; pushX -= 1; }
          else if (m === dRight) { pos.x = b.maxX + radius; pushX += 1; }
          else if (m === dTop) { pos.z = b.minZ - radius; pushZ -= 1; }
          else { pos.z = b.maxZ + radius; pushZ += 1; }
        }
      }
    }

    // Clamp to playable city + beach shoreline (do not drive deep into the ocean)
    const maxLandX = pos.z > 65 && pos.z < 160 ? 156 : 152;
    if (pos.x < CITY_CONFIG.minX) { pos.x = CITY_CONFIG.minX; hit = true; pushX += 1; }
    if (pos.x > maxLandX) { pos.x = maxLandX; hit = true; pushX -= 1; }
    if (pos.z < CITY_CONFIG.minZ) { pos.z = CITY_CONFIG.minZ; hit = true; pushZ += 1; }
    if (pos.z > CITY_CONFIG.maxZ) { pos.z = CITY_CONFIG.maxZ; hit = true; pushZ -= 1; }

    return { hit, nx: pushX, nz: pushZ };
  }

  sampleGroundHeight(x, z) {
    let h = 0;
    // Slight beach slope toward water
    if (x > CITY_CONFIG.beachStartX) {
      const t = Math.min(1, (x - CITY_CONFIG.beachStartX) / (CITY_CONFIG.waterStartX - CITY_CONFIG.beachStartX));
      h = -t * 0.55;
    }
    // Check stunt ramps
    for (let i = 0; i < this.ramps.length; i += 1) {
      const r = this.ramps[i];
      const dx = x - r.x;
      const dz = z - r.z;
      const cos = Math.cos(-r.heading);
      const sin = Math.sin(-r.heading);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= r.width * 0.5 && Math.abs(lz) <= r.length * 0.5) {
        const rampT = (lz + r.length * 0.5) / r.length;
        h = Math.max(h, rampT * r.peakHeight);
      }
    }
    return h;
  }

  raycastBuildings(origin, dir, maxDist) {
    let closest = maxDist;
    for (let i = 0; i < this.buildings.length; i += 1) {
      const b = this.buildings[i];
      if (origin.y > b.height + 1 && dir.y >= 0) continue;
      let tmin = 0;
      let tmax = closest;

      // X slab
      if (Math.abs(dir.x) < 1e-6) {
        if (origin.x < b.minX || origin.x > b.maxX) continue;
      } else {
        let t1 = (b.minX - origin.x) / dir.x;
        let t2 = (b.maxX - origin.x) / dir.x;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      // Z slab
      if (Math.abs(dir.z) < 1e-6) {
        if (origin.z < b.minZ || origin.z > b.maxZ) continue;
      } else {
        let t1 = (b.minZ - origin.z) / dir.z;
        let t2 = (b.maxZ - origin.z) / dir.z;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      const hitY = origin.y + dir.y * tmin;
      if (tmin > 0.1 && tmin < closest && hitY >= 0 && hitY <= b.height) {
        closest = tmin;
      }
    }
    return closest < maxDist ? closest : null;
  }

  getNearestRoadSpawn(targetX, targetZ) {
    let bestX = this.avenuesX[3];
    let bestZ = this.streetsZ[2];
    let bestD = Infinity;
    for (const ax of this.avenuesX) {
      const d = Math.abs(targetX - ax);
      if (d < bestD) { bestD = d; bestX = ax; }
    }
    bestD = Infinity;
    for (const sz of this.streetsZ) {
      const d = Math.abs(targetZ - sz);
      if (d < bestD) { bestD = d; bestZ = sz; }
    }
    return { x: bestX + this.laneOffset, z: Math.max(-185, Math.min(185, targetZ)), heading: 0, altZ: bestZ };
  }

  getGpsPolyline(fromX, fromZ, toX, toZ) {
    // Snap intermediate corner onto closest avenue + cross-street for realistic GPS path
    let nearAx = this.avenuesX[0];
    let bestAxDist = Infinity;
    for (const ax of this.avenuesX) {
      const d = Math.abs(fromX - ax);
      if (d < bestAxDist) { bestAxDist = d; nearAx = ax; }
    }
    let nearSz = this.streetsZ[0];
    let bestSzDist = Infinity;
    for (const sz of this.streetsZ) {
      const d = Math.abs(toZ - sz);
      if (d < bestSzDist) { bestSzDist = d; nearSz = sz; }
    }
    return [
      { x: fromX, z: fromZ },
      { x: nearAx, z: fromZ },
      { x: nearAx, z: nearSz },
      { x: toX, z: nearSz },
      { x: toX, z: toZ },
    ];
  }

  getDistrictName(x, z) {
    return getDistrictAt(x, z).name;
  }
}
