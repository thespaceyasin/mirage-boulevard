// 5-Weapon Combat System (Coastal 9mm, Viper SMG, Breaker Shotgun, Meridian Carbine,
// Sunburst RPG), hitscan + rocket projectiles, drive-by shooting, tactical AI enemies
// (Meridian Cartel & SBPD SWAT), and collectible Health/Armor/Cash pickups.

import * as THREE from 'three';
import { WEAPON_SPECS, createSeededRng } from '../engine/gameConfig.js';
import { createCharacterRig } from '../entities/characterRig.js';

export class CombatSystem {
  constructor(scene, roadNetwork) {
    this.scene = scene;
    this.roadNetwork = roadNetwork;
    this.rng = createSeededRng(88421);

    this.enemies = [];
    this.rockets = [];
    this.pickups = [];
    this.hitmarkerTimer = 0;

    this._rocketGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.75, 8);
    this._rocketGeo.rotateX(Math.PI / 2);
    this._rocketMat = new THREE.MeshStandardMaterial({
      color: 0xffd278,
      emissive: new THREE.Color(0xff5a22),
      emissiveIntensity: 3.2,
    });
    this._pickupGeo = new THREE.OctahedronGeometry(0.45, 0);
  }

  spawnEnemy(role, x, z, missionTag = null) {
    const rig = createCharacterRig(role);
    const weaponId = role === 'police' ? (this.rng.next() < 0.45 ? 'shotgun' : 'carbine') : (this.rng.next() < 0.5 ? 'smg' : 'carbine');
    rig.setWeapon(weaponId);
    rig.root.position.set(x, 0, z);
    this.scene.add(rig.root);

    const enemy = {
      id: Math.floor(this.rng.next() * 1e7),
      role,
      missionTag,
      rig,
      pos: new THREE.Vector3(x, 0, z),
      heading: 0,
      health: role === 'police' ? 95 : 80,
      maxHealth: role === 'police' ? 95 : 80,
      alive: true,
      fireCooldown: this.rng.range(0.4, 1.3),
      strafeDir: this.rng.next() < 0.5 ? 1 : -1,
      strafeTimer: this.rng.range(1.5, 3.2),
      despawnTimer: 0,
      weaponId,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  clearMissionEnemies(missionTag) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (!missionTag || e.missionTag === missionTag) {
        this.scene.remove(e.rig.root);
        this.enemies.splice(i, 1);
      }
    }
  }

  spawnPickup(x, z, type = 'health') {
    const colorMap = { health: 0x2ee59d, armor: 0x1de9d8, cash: 0xffc857, ammo: 0xff7086 };
    const mat = new THREE.MeshStandardMaterial({
      color: colorMap[type] || 0x2ee59d,
      emissive: new THREE.Color(colorMap[type] || 0x2ee59d),
      emissiveIntensity: 1.5,
      roughness: 0.25,
    });
    const mesh = new THREE.Mesh(this._pickupGeo, mat);
    mesh.position.set(x, 0.85, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, x, z, type, age: 0 });
  }

  tryPlayerFire(player, camera, context) {
    const weapon = player.currentWeapon;
    const ammo = player.currentAmmo;
    if (player.dead || player.reloadTimer > 0 || player.fireCooldown > 0) return false;
    if (player.vehicle && !weapon.driveBy) return false;

    if (ammo.mag <= 0) {
      this.startReload(player, context.audio);
      return false;
    }

    ammo.mag -= 1;
    const focusBoost = context.focusActive ? 1.5 : 1.0;
    player.fireCooldown = weapon.fireRate * (context.focusActive ? 0.72 : 1.0);

    // Muzzle origin
    const origin = player.vehicle
      ? new THREE.Vector3(player.vehicle.pos.x, player.vehicle.pos.y + 1.55, player.vehicle.pos.z)
      : new THREE.Vector3(
        player.pos.x + Math.sin(player.heading) * 0.65,
        player.pos.y + 1.48,
        player.pos.z + Math.cos(player.heading) * 0.65,
      );

    // Compute aim direction directly from camera look ray with gentle target assist
    const aimDir = new THREE.Vector3();
    camera.getWorldDirection(aimDir);
    aimDir.normalize();

    if (context.renderer) context.renderer.pulseMuzzleLight(origin);
    if (context.vfx) context.vfx.spawnMuzzleFlash(origin, weapon.id === 'shotgun' ? 2.2 : 1.45);
    if (context.audio) context.audio.playWeaponShot(weapon.id);
    if (context.cameraRig) context.cameraRig.addTrauma(weapon.isRocket ? 0.34 : weapon.id === 'shotgun' ? 0.2 : 0.08);
    if (context.traffic) context.traffic.alertPanic(origin, 42);
    if (context.police) context.police.reportCrime(weapon.isRocket ? 28 : 5, 'GUNFIRE');

    if (weapon.isRocket) {
      const mesh = new THREE.Mesh(this._rocketGeo, this._rocketMat);
      mesh.position.copy(origin);
      mesh.lookAt(origin.clone().add(aimDir));
      this.scene.add(mesh);
      this.rockets.push({
        mesh,
        pos: origin.clone(),
        vel: aimDir.clone().multiplyScalar(58),
        life: 3.2,
        damage: weapon.damage * focusBoost,
        splashRadius: weapon.splashRadius,
        fromPlayer: true,
      });
      return true;
    }

    // Hitscan pellets
    for (let p = 0; p < weapon.pellets; p += 1) {
      const dir = aimDir.clone();
      dir.x += (this.rng.next() - 0.5) * weapon.spread;
      dir.y += (this.rng.next() - 0.5) * weapon.spread * 0.75;
      dir.z += (this.rng.next() - 0.5) * weapon.spread;
      dir.normalize();

      this._resolveBulletRay(origin, dir, weapon.range, weapon.damage * focusBoost, weapon.color, true, context);
    }

    if (ammo.mag === 0 && ammo.reserve > 0) {
      this.startReload(player, context.audio);
    }
    return true;
  }

  startReload(player, audio) {
    const weapon = player.currentWeapon;
    const ammo = player.currentAmmo;
    if (player.reloadTimer > 0 || ammo.mag >= weapon.magSize) return;
    if (ammo.reserve <= 0 && weapon.id !== 'pistol') return;
    player.reloadTimer = weapon.reloadTime;
    if (audio) audio.playUiClick(520);
  }

  _resolveBulletRay(origin, dir, maxDist, damage, tracerColor, fromPlayer, context) {
    let bestT = maxDist;
    let hitType = 'none';
    let hitEntity = null;

    // 1. Buildings
    const bDist = this.roadNetwork.raycastBuildings(origin, dir, bestT);
    if (bDist !== null && bDist < bestT) {
      bestT = bDist;
      hitType = 'world';
    }

    // 2. Ground plane
    if (dir.y < -0.01) {
      const gt = -origin.y / dir.y;
      if (gt > 0.2 && gt < bestT) {
        bestT = gt;
        hitType = 'world';
      }
    }

    if (fromPlayer) {
      // 3. Enemies (with generous cylinder radius for fun third-person shooting)
      for (let i = 0; i < this.enemies.length; i += 1) {
        const e = this.enemies[i];
        if (!e.alive) continue;
        const toE = new THREE.Vector3(e.pos.x - origin.x, (e.pos.y + 1.15) - origin.y, e.pos.z - origin.z);
        const proj = toE.dot(dir);
        if (proj > 0.5 && proj < bestT) {
          const perpSq = toE.lengthSq() - proj * proj;
          if (perpSq < 1.15 * 1.15) {
            bestT = proj;
            hitType = 'enemy';
            hitEntity = e;
          }
        }
      }

      // 4. Vehicles
      for (let i = 0; i < context.vehicles.length; i += 1) {
        const v = context.vehicles[i];
        if (v === context.player.vehicle) continue;
        const toV = new THREE.Vector3(v.pos.x - origin.x, (v.pos.y + 1.0) - origin.y, v.pos.z - origin.z);
        const proj = toV.dot(dir);
        if (proj > 0.5 && proj < bestT) {
          const perpSq = toV.lengthSq() - proj * proj;
          if (perpSq < (v.radius * 0.92) ** 2) {
            bestT = proj;
            hitType = 'vehicle';
            hitEntity = v;
          }
        }
      }

      // 5. SBPD Police Helicopter
      if (context.police && context.police.heliActive) {
        const hp = context.police.heliPos;
        const toH = new THREE.Vector3(hp.x - origin.x, hp.y - origin.y, hp.z - origin.z);
        const proj = toH.dot(dir);
        if (proj > 2 && proj < bestT) {
          const perpSq = toH.lengthSq() - proj * proj;
          if (perpSq < 4.0 * 4.0) {
            bestT = proj;
            hitType = 'heli';
          }
        }
      }
    } else {
      // Enemy bullet hitting player or player's car
      const targetPos = context.player.vehicle ? context.player.vehicle.pos : context.player.pos;
      const toP = new THREE.Vector3(targetPos.x - origin.x, (targetPos.y + 1.1) - origin.y, targetPos.z - origin.z);
      const proj = toP.dot(dir);
      const hitRad = context.player.vehicle ? 2.2 : 0.72;
      if (proj > 0.5 && proj < bestT) {
        const perpSq = toP.lengthSq() - proj * proj;
        if (perpSq < hitRad * hitRad) {
          bestT = proj;
          hitType = 'player';
        }
      }
    }

    const endPos = origin.clone().addScaledVector(dir, bestT);
    if (context.vfx) {
      context.vfx.spawnTracer(origin, endPos, tracerColor);
      if (hitType !== 'none') {
        context.vfx.spawnSparks(endPos.x, Math.max(0.15, endPos.y), endPos.z, hitType === 'world' ? 4 : 8);
      }
    }

    if (hitType === 'enemy' && hitEntity) {
      this.hitmarkerTimer = 0.16;
      hitEntity.health -= damage;
      if (hitEntity.health <= 0 && hitEntity.alive) {
        this._killEnemy(hitEntity, context);
      }
    } else if (hitType === 'vehicle' && hitEntity) {
      this.hitmarkerTimer = 0.14;
      hitEntity.takeDamage(damage * 1.15, context.vfx, context.audio, (veh) => this.handleExplosionSplash(veh.pos, 10, 120, context));
      if (hitEntity.spec.isPolice && context.police) context.police.reportCrime(14, 'ATTACKING SBPD');
    } else if (hitType === 'heli' && context.police) {
      this.hitmarkerTimer = 0.18;
      context.police.damageHelicopter(damage, context.vfx, context.audio);
    } else if (hitType === 'player') {
      if (context.player.vehicle) {
        context.player.vehicle.takeDamage(damage * 0.45, context.vfx, context.audio, (veh) => this.handleExplosionSplash(veh.pos, 10, 90, context));
        context.player.takeDamage(damage * 0.18);
      } else {
        context.player.takeDamage(damage * 0.52);
        if (context.cameraRig) context.cameraRig.addTrauma(0.18);
      }
    }
  }

  _killEnemy(enemy, context) {
    enemy.alive = false;
    enemy.despawnTimer = 14;
    enemy.rig.animate(0, 0, false, true);
    const dropType = this.rng.next() < 0.36 ? 'health' : this.rng.next() < 0.65 ? 'armor' : 'cash';
    this.spawnPickup(enemy.pos.x, enemy.pos.z, dropType);
    context.player.cash += enemy.role === 'police' ? 120 : 185;
    if (context.police) {
      context.police.reportCrime(enemy.role === 'police' ? 35 : 12, enemy.role === 'police' ? 'OFFICER DOWN' : 'SHOOTOUT');
    }
    if (context.onEnemyKilled) context.onEnemyKilled(enemy);
  }

  handleExplosionSplash(center, radius, maxDamage, context) {
    if (context.renderer) context.renderer.pulseExplosionLight(center, 68);
    if (context.cameraRig) {
      const distToCam = center.distanceTo(context.player.pos);
      if (distToCam < 65) {
        context.cameraRig.addTrauma(Math.max(0.25, 0.78 * (1 - distToCam / 65)));
        context.cameraRig.punchFov(6);
      }
    }
    if (context.triggerFlash) context.triggerFlash();
    if (context.traffic) context.traffic.alertPanic(center, 55);
    if (context.police) context.police.reportCrime(32, 'EXPLOSIVES');

    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const d = e.pos.distanceTo(center);
      if (d < radius) {
        e.health -= maxDamage * (1 - d / radius);
        if (e.health <= 0) this._killEnemy(e, context);
      }
    }
    for (let i = 0; i < context.vehicles.length; i += 1) {
      const v = context.vehicles[i];
      if (v.wrecked) continue;
      const d = v.pos.distanceTo(center);
      if (d > 0.5 && d < radius) {
        v.takeDamage(maxDamage * 0.9 * (1 - d / radius), context.vfx, context.audio, (other) => {
          this.handleExplosionSplash(other.pos, 9, 95, context);
        });
      }
    }
    if (context.police && context.police.heliActive) {
      const hd = context.police.heliPos.distanceTo(center);
      if (hd < radius * 1.45) {
        context.police.damageHelicopter(maxDamage * 1.35, context.vfx, context.audio);
      }
    }
  }

  update(dt, elapsed, context) {
    const { player, vfx, audio } = context;
    if (this.hitmarkerTimer > 0) this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
    if (player.fireCooldown > 0) player.fireCooldown = Math.max(0, player.fireCooldown - dt);

    if (player.reloadTimer > 0) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        player.reloadTimer = 0;
        const w = player.currentWeapon;
        const a = player.currentAmmo;
        const need = w.magSize - a.mag;
        if (w.id === 'pistol' && a.reserve < need) {
          a.mag = w.magSize; // Coastal 9mm never leaves player stranded
        } else {
          const take = Math.min(need, a.reserve);
          a.mag += take;
          a.reserve -= take;
        }
      }
    }

    // Update flying RPG rockets
    for (let i = this.rockets.length - 1; i >= 0; i -= 1) {
      const r = this.rockets[i];
      r.life -= dt;
      const step = r.vel.clone().multiplyScalar(dt);
      const nextPos = r.pos.clone().add(step);
      if (vfx) vfx.spawnSmoke(r.pos.x, r.pos.y, r.pos.z, 0.55);

      let exploded = r.life <= 0 || nextPos.y <= 0.25 || this.roadNetwork.isInsideBuilding(nextPos.x, nextPos.z, 0.4);
      if (!exploded) {
        for (let vIdx = 0; vIdx < context.vehicles.length; vIdx += 1) {
          const v = context.vehicles[vIdx];
          if (v === player.vehicle) continue;
          if (nextPos.distanceTo(v.pos) < v.radius + 1.0) {
            exploded = true;
            break;
          }
        }
      }
      if (!exploded && context.police && context.police.heliActive) {
        if (nextPos.distanceTo(context.police.heliPos) < 4.5) exploded = true;
      }

      r.pos.copy(nextPos);
      r.mesh.position.copy(r.pos);
      if (exploded) {
        if (vfx) vfx.spawnExplosion(r.pos, 1.55);
        if (audio) audio.playExplosion(1.1);
        this.handleExplosionSplash(r.pos, r.splashRadius, r.damage, context);
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      }
    }

    // Update hostile NPCs (Cartel & SBPD SWAT)
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (!e.alive) {
        e.despawnTimer -= dt;
        if (e.despawnTimer <= 0) {
          this.scene.remove(e.rig.root);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      e.heading = Math.atan2(dx, dz);

      let moveSpd = 0;
      if (dist > 22 && dist < 85) {
        moveSpd = 4.6;
        e.pos.x += (dx / dist) * moveSpd * dt;
        e.pos.z += (dz / dist) * moveSpd * dt;
      } else if (dist <= 22) {
        // Tactical strafe
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafeTimer = this.rng.range(1.4, 2.8);
          e.strafeDir *= -1;
        }
        moveSpd = 2.6;
        e.pos.x += (-dz / dist) * e.strafeDir * moveSpd * dt;
        e.pos.z += (dx / dist) * e.strafeDir * moveSpd * dt;
      }

      this.roadNetwork.resolveCircleCollision(e.pos, 0.5);
      e.pos.y = this.roadNetwork.sampleGroundHeight(e.pos.x, e.pos.z);

      e.fireCooldown -= dt;
      const canShoot = !player.dead && dist < 44 && e.fireCooldown <= 0;
      if (canShoot) {
        e.fireCooldown = e.role === 'police' ? this.rng.range(0.75, 1.3) : this.rng.range(0.85, 1.55);
        const orig = new THREE.Vector3(e.pos.x, e.pos.y + 1.45, e.pos.z);
        const dir = new THREE.Vector3(
          dx / dist + (this.rng.next() - 0.5) * 0.14,
          ((player.pos.y + 1.1) - orig.y) / dist + (this.rng.next() - 0.5) * 0.06,
          dz / dist + (this.rng.next() - 0.5) * 0.14,
        ).normalize();
        this._resolveBulletRay(orig, dir, 52, e.role === 'police' ? 9 : 8, 0xff5a6e, false, context);
        if (audio) audio.playWeaponShot('pistol', 0.35);
      }

      e.rig.root.position.copy(e.pos);
      e.rig.root.rotation.y = e.heading;
      e.rig.animate(moveSpd, elapsed + i, dist < 44, false);
    }

    // Update & collect pickups
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pk = this.pickups[i];
      pk.age += dt;
      pk.mesh.rotation.y = elapsed * 2.6 + i;
      pk.mesh.position.y = 0.8 + Math.sin(elapsed * 3.5 + i) * 0.18;

      const d = Math.hypot(player.pos.x - pk.x, player.pos.z - pk.z);
      if (d < 2.8) {
        if (pk.type === 'health') player.health = Math.min(player.maxHealth, player.health + 35);
        else if (pk.type === 'armor') player.armor = Math.min(player.maxArmor, player.armor + 35);
        else if (pk.type === 'cash') player.cash += 350;
        if (audio) audio.playPickup();
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      } else if (pk.age > 35) {
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }
}
