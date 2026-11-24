// Multi-layered pooled 3D particle & debris VFX system:
// clustered orange-gold fireball plumes, billowing charcoal smoke columns,
// streaking ember sparks, tumbling charred debris chunks, dual-tire drift smoke,
// muzzle flashes, glowing tracers, and fiery ground shockwave rings.

import * as THREE from 'three';
import { createSeededRng } from '../engine/gameConfig.js';

function createSoftRadialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  for (const [offset, col] of stops) g.addColorStop(offset, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBillowTexture(innerCol, midCol, edgeCol) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  // Soft overlapping feathered puffs with smooth alpha falloff so plumes blend organically
  const lobes = [
    [64, 64, 58],
    [48, 56, 40],
    [80, 58, 38],
    [62, 44, 36],
    [64, 78, 36],
  ];
  for (const [lx, ly, lr] of lobes) {
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, lr);
    g.addColorStop(0.0, innerCol);
    g.addColorStop(0.38, midCol);
    g.addColorStop(0.76, edgeCol.replace('0.0)', '0.16)'));
    g.addColorStop(1.0, edgeCol);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class VfxSystem {
  constructor(scene) {
    this.scene = scene;
    this.rng = createSeededRng(55109);
    this.particles = [];
    this.debris = [];
    this.tracers = [];
    this.rings = [];

    this._fireCoreTex = createSoftRadialTexture([
      [0.0, 'rgba(255, 250, 200, 1.0)'],
      [0.35, 'rgba(255, 175, 52, 0.92)'],
      [0.72, 'rgba(255, 76, 18, 0.45)'],
      [1.0, 'rgba(180, 20, 8, 0.0)'],
    ]);
    // Multi-lobe non-additive fireball puff so overlapping clusters stay rich orange/gold/crimson
    this._fireCloudTex = createBillowTexture(
      'rgba(255, 218, 86, 0.92)',
      'rgba(255, 92, 20, 0.82)',
      'rgba(120, 22, 8, 0.0)',
    );
    this._smokeTex = createBillowTexture(
      'rgba(32, 34, 42, 0.88)',
      'rgba(24, 26, 34, 0.62)',
      'rgba(18, 20, 26, 0.0)',
    );
    this._driftTex = createBillowTexture(
      'rgba(244, 246, 252, 0.68)',
      'rgba(220, 228, 240, 0.34)',
      'rgba(200, 210, 225, 0.0)',
    );
    this._sparkTex = createSoftRadialTexture([
      [0.0, 'rgba(255, 255, 220, 1.0)'],
      [0.4, 'rgba(255, 185, 56, 0.95)'],
      [1.0, 'rgba(255, 84, 16, 0.0)'],
    ]);

    this._ringGeo = new THREE.RingGeometry(0.72, 1.0, 28);
    this._ringGeo.rotateX(-Math.PI / 2);
    this._debrisGeo = new THREE.BoxGeometry(0.32, 0.16, 0.42);
    this._debrisMat = new THREE.MeshStandardMaterial({
      color: 0x1c1816,
      emissive: new THREE.Color(0xff5a18),
      emissiveIntensity: 0.95,
      roughness: 0.78,
    });

    // Pre-allocate pooled Sprite particles
    this._pool = [];
    for (let i = 0; i < 280; i += 1) {
      const mat = new THREE.SpriteMaterial({
        map: this._fireCoreTex,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this._pool.push(sprite);
    }
  }

  _acquireSprite(tex, additive, baseOpacity) {
    for (let i = 0; i < this._pool.length; i += 1) {
      if (!this._pool[i].visible) {
        const sp = this._pool[i];
        sp.material.map = tex;
        sp.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
        sp.material.opacity = baseOpacity;
        sp.visible = true;
        return sp;
      }
    }
    return null;
  }

  _pushSprite({ x, y, z, vx, vy, vz, scale0, scale1, life, gravity = 0, tex, additive = false, opacity = 0.92 }) {
    const sprite = this._acquireSprite(tex, additive, opacity);
    if (!sprite) return;
    sprite.position.set(x, y, z);
    sprite.scale.set(scale0, scale0, 1);
    this.particles.push({
      sprite,
      vx,
      vy,
      vz,
      scale0,
      scale1,
      life,
      maxLife: life,
      gravity,
      baseOpacity: opacity,
    });
  }

  spawnExplosion(pos, strength = 1.0) {
    // 1. Compact incandescent ignition core
    this._pushSprite({
      x: pos.x,
      y: pos.y + 1.0,
      z: pos.z,
      vx: 0,
      vy: 1.0,
      vz: 0,
      scale0: 2.2 * strength,
      scale1: 4.4 * strength,
      life: 0.32,
      tex: this._fireCoreTex,
      additive: true,
      opacity: 0.95,
    });

    // 2. Clustered billowing orange-gold-crimson fireball tongues
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const rad = this.rng.range(0.35, 1.65) * strength;
      const spd = this.rng.range(1.0, 4.2) * strength;
      this._pushSprite({
        x: pos.x + Math.cos(a) * rad,
        y: pos.y + this.rng.range(0.55, 2.2) * strength,
        z: pos.z + Math.sin(a) * rad,
        vx: Math.cos(a) * spd,
        vy: this.rng.range(2.0, 5.4) * strength,
        vz: Math.sin(a) * spd,
        scale0: this.rng.range(1.9, 3.0) * strength,
        scale1: this.rng.range(3.2, 4.6) * strength,
        life: this.rng.range(0.48, 0.9),
        gravity: -1.6,
        tex: this._fireCloudTex,
        additive: i % 3 === 0,
        opacity: i % 3 === 0 ? 0.52 : 0.78,
      });
    }

    // 3. Dense billowing charcoal smoke column rising above & around the fire cluster
    for (let i = 0; i < 14; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const rad = this.rng.range(0.8, 2.6) * strength;
      const spd = this.rng.range(0.7, 3.2) * strength;
      this._pushSprite({
        x: pos.x + Math.cos(a) * rad,
        y: pos.y + this.rng.range(2.4, 5.2) * strength,
        z: pos.z + Math.sin(a) * rad,
        vx: Math.cos(a) * spd,
        vy: this.rng.range(3.2, 7.2) * strength,
        vz: Math.sin(a) * spd,
        scale0: this.rng.range(2.0, 3.0) * strength,
        scale1: this.rng.range(4.4, 6.4) * strength,
        life: this.rng.range(1.1, 1.85),
        gravity: 1.1,
        tex: this._smokeTex,
        additive: false,
        opacity: 0.84,
      });
    }

    // 4. High-velocity bright sparks + tumbling charred 3D debris fragments
    this.spawnSparks(pos.x, pos.y + 1.4, pos.z, 28, 16 * strength);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const spd = this.rng.range(5, 13) * strength;
      const chunk = new THREE.Mesh(this._debrisGeo, this._debrisMat);
      chunk.position.set(pos.x + Math.cos(a) * 0.8, pos.y + 1.1, pos.z + Math.sin(a) * 0.8);
      chunk.scale.setScalar(this.rng.range(0.7, 1.35));
      this.scene.add(chunk);
      this.debris.push({
        mesh: chunk,
        vx: Math.cos(a) * spd,
        vy: this.rng.range(5.5, 11.5) * strength,
        vz: Math.sin(a) * spd,
        rx: this.rng.range(-9, 9),
        ry: this.rng.range(-9, 9),
        life: this.rng.range(0.9, 1.5),
      });
    }

    // 5. Fiery ground shockwave ring
    const ring = new THREE.Mesh(
      this._ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff8c32,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.set(pos.x, pos.y + 0.16, pos.z);
    ring.scale.setScalar(1.0);
    this.scene.add(ring);
    this.rings.push({ mesh: ring, life: 0.5, maxLife: 0.5, maxScale: 12 * strength });
  }

  spawnFirePlume(x, y, z, scale = 1.0) {
    this._pushSprite({
      x: x + this.rng.range(-0.85, 0.85),
      y: y + this.rng.range(0.0, 0.8),
      z: z + this.rng.range(-0.85, 0.85),
      vx: this.rng.range(-0.7, 0.7),
      vy: this.rng.range(2.6, 5.2),
      vz: this.rng.range(-0.7, 0.7),
      scale0: 1.7 * scale,
      scale1: 3.1 * scale,
      life: 0.55,
      tex: this._fireCloudTex,
      additive: false,
      opacity: 0.92,
    });
    this._pushSprite({
      x: x + this.rng.range(-0.9, 0.9),
      y: y + 2.2,
      z: z + this.rng.range(-0.9, 0.9),
      vx: this.rng.range(-1.1, 1.1),
      vy: this.rng.range(3.4, 6.2),
      vz: this.rng.range(-1.1, 1.1),
      scale0: 1.9 * scale,
      scale1: 4.5 * scale,
      life: 1.15,
      tex: this._smokeTex,
      additive: false,
      opacity: 0.78,
    });
  }

  spawnSmoke(x, y, z, scale = 1.0) {
    this._pushSprite({
      x: x + this.rng.range(-0.3, 0.3),
      y,
      z: z + this.rng.range(-0.3, 0.3),
      vx: this.rng.range(-0.6, 0.6),
      vy: this.rng.range(2.0, 3.6),
      vz: this.rng.range(-0.6, 0.6),
      scale0: 1.4 * scale,
      scale1: 3.6 * scale,
      life: 0.85,
      tex: this._smokeTex,
      additive: false,
      opacity: 0.68,
    });
  }

  spawnDriftSmoke(x, y, z) {
    this._pushSprite({
      x: x + this.rng.range(-0.35, 0.35),
      y: y + 0.18,
      z: z + this.rng.range(-0.35, 0.35),
      vx: this.rng.range(-0.6, 0.6),
      vy: this.rng.range(0.45, 1.3),
      vz: this.rng.range(-0.6, 0.6),
      scale0: 0.85,
      scale1: 2.1,
      life: 0.62,
      tex: this._driftTex,
      additive: false,
      opacity: 0.44,
    });
  }

  spawnSparks(x, y, z, count = 8, speed = 10) {
    for (let i = 0; i < count; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(speed * 0.35, speed);
      this._pushSprite({
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: this.rng.range(2.8, speed * 0.85),
        vz: Math.sin(a) * s,
        scale0: 0.68,
        scale1: 0.16,
        life: this.rng.range(0.28, 0.62),
        gravity: -16,
        tex: this._sparkTex,
        additive: true,
        opacity: 1.0,
      });
    }
  }

  spawnMuzzleFlash(pos, scale = 1.6) {
    this._pushSprite({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: 0,
      vy: 0,
      vz: 0,
      scale0: scale,
      scale1: scale * 0.2,
      life: 0.08,
      tex: this._fireCoreTex,
      additive: true,
      opacity: 1.0,
    });
  }

  spawnTracer(startPos, endPos, colorHex = 0xffd27a, life = 0.09) {
    const dir = endPos.clone().sub(startPos);
    const len = Math.max(0.2, dir.length());
    const geo = new THREE.BoxGeometry(0.08, 0.08, len);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos).addScaledVector(dir, 0.5);
    mesh.lookAt(endPos);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life, maxLife: life });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y = Math.max(0.15, p.sprite.position.y + p.vy * dt);
      p.sprite.position.z += p.vz * dt;

      const t = 1 - p.life / p.maxLife;
      const sc = p.scale0 + (p.scale1 - p.scale0) * t;
      p.sprite.scale.set(sc, sc, 1);
      p.sprite.material.opacity = p.baseOpacity * (1 - t);
    }

    for (let i = this.debris.length - 1; i >= 0; i -= 1) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debris.splice(i, 1);
        continue;
      }
      d.vy -= 22 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y = Math.max(0.12, d.mesh.position.y + d.vy * dt);
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.y += d.ry * dt;
    }

    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        tr.mesh.material.opacity = tr.life / tr.maxLife;
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      } else {
        const t = 1 - r.life / r.maxLife;
        r.mesh.scale.setScalar(1 + t * r.maxScale);
        r.mesh.material.opacity = 0.85 * (1 - t);
      }
    }
  }
}
