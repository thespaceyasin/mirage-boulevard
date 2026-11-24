// Pooled soft-gradient sprite & 3D particle VFX system:
// cinematic fireballs, billowing dark smoke plumes, burning vehicle flames,
// drift tire smoke, metallic sparks, muzzle flashes, glowing tracers, and shockwave rings.

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

export class VfxSystem {
  constructor(scene) {
    this.scene = scene;
    this.rng = createSeededRng(55109);
    this.particles = [];
    this.tracers = [];
    this.rings = [];

    this._fireTex = createSoftRadialTexture([
      [0.0, 'rgba(255, 252, 224, 1.0)'],
      [0.28, 'rgba(255, 196, 72, 0.95)'],
      [0.6, 'rgba(255, 86, 24, 0.68)'],
      [1.0, 'rgba(180, 20, 8, 0.0)'],
    ]);
    this._smokeTex = createSoftRadialTexture([
      [0.0, 'rgba(42, 46, 56, 0.85)'],
      [0.52, 'rgba(34, 38, 46, 0.56)'],
      [1.0, 'rgba(24, 28, 36, 0.0)'],
    ]);
    this._driftTex = createSoftRadialTexture([
      [0.0, 'rgba(240, 244, 252, 0.62)'],
      [0.55, 'rgba(218, 226, 238, 0.32)'],
      [1.0, 'rgba(200, 210, 225, 0.0)'],
    ]);
    this._sparkTex = createSoftRadialTexture([
      [0.0, 'rgba(255, 255, 230, 1.0)'],
      [0.4, 'rgba(255, 195, 70, 0.9)'],
      [1.0, 'rgba(255, 100, 20, 0.0)'],
    ]);

    this._ringGeo = new THREE.RingGeometry(0.72, 1.0, 28);
    this._ringGeo.rotateX(-Math.PI / 2);

    // Pre-allocate pooled Sprite particles (zero runtime geometry/material churn!)
    this._pool = [];
    for (let i = 0; i < 240; i += 1) {
      const mat = new THREE.SpriteMaterial({
        map: this._fireTex,
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
    // Blazing incandescent inner core flash
    this._pushSprite({
      x: pos.x,
      y: pos.y + 1.5,
      z: pos.z,
      vx: 0,
      vy: 1.5,
      vz: 0,
      scale0: 3.4 * strength,
      scale1: 9.2 * strength,
      life: 0.42,
      tex: this._fireTex,
      additive: true,
      opacity: 1.0,
    });

    // Rolling fiery blast cloud
    for (let i = 0; i < 18; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const spd = this.rng.range(1.6, 8.2) * strength;
      this._pushSprite({
        x: pos.x + Math.cos(a) * 1.1,
        y: pos.y + this.rng.range(0.6, 2.4),
        z: pos.z + Math.sin(a) * 1.1,
        vx: Math.cos(a) * spd,
        vy: this.rng.range(2.4, 8.6) * strength,
        vz: Math.sin(a) * spd,
        scale0: this.rng.range(2.2, 3.8) * strength,
        scale1: this.rng.range(5.2, 8.0) * strength,
        life: this.rng.range(0.45, 0.92),
        gravity: -2.4,
        tex: this._fireTex,
        additive: true,
        opacity: 0.92,
      });
    }

    // Thick billowing charcoal smoke column rising ABOVE the fireball so fire stays blazing bright!
    for (let i = 0; i < 14; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const spd = this.rng.range(0.8, 4.0) * strength;
      this._pushSprite({
        x: pos.x + Math.cos(a) * 1.4,
        y: pos.y + this.rng.range(3.4, 5.6),
        z: pos.z + Math.sin(a) * 1.4,
        vx: Math.cos(a) * spd,
        vy: this.rng.range(3.6, 8.2) * strength,
        vz: Math.sin(a) * spd,
        scale0: 2.5 * strength,
        scale1: 6.8 * strength,
        life: this.rng.range(1.1, 1.9),
        gravity: 1.2,
        tex: this._smokeTex,
        additive: false,
        opacity: 0.72,
      });
    }

    this.spawnSparks(pos.x, pos.y + 1.5, pos.z, 26, 17 * strength);

    // Expanding fiery ground shockwave ring
    const ring = new THREE.Mesh(
      this._ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff9b42,
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
    this.rings.push({ mesh: ring, life: 0.5, maxLife: 0.5, maxScale: 13 * strength });
  }

  spawnFirePlume(x, y, z, scale = 1.0) {
    this._pushSprite({
      x: x + this.rng.range(-0.7, 0.7),
      y: y + this.rng.range(-0.1, 0.5),
      z: z + this.rng.range(-0.7, 0.7),
      vx: this.rng.range(-0.6, 0.6),
      vy: this.rng.range(2.8, 5.8),
      vz: this.rng.range(-0.6, 0.6),
      scale0: 2.4 * scale,
      scale1: 4.5 * scale,
      life: 0.52,
      tex: this._fireTex,
      additive: true,
      opacity: 0.94,
    });
    this._pushSprite({
      x: x + this.rng.range(-0.8, 0.8),
      y: y + 2.8,
      z: z + this.rng.range(-0.8, 0.8),
      vx: this.rng.range(-1.0, 1.0),
      vy: this.rng.range(3.6, 6.4),
      vz: this.rng.range(-1.0, 1.0),
      scale0: 2.3 * scale,
      scale1: 5.8 * scale,
      life: 1.1,
      tex: this._smokeTex,
      additive: false,
      opacity: 0.68,
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
      scale0: 1.5 * scale,
      scale1: 3.8 * scale,
      life: 0.85,
      tex: this._smokeTex,
      additive: false,
      opacity: 0.62,
    });
  }

  spawnDriftSmoke(x, y, z) {
    this._pushSprite({
      x: x + this.rng.range(-0.6, 0.6),
      y: y + 0.3,
      z: z + this.rng.range(-0.6, 0.6),
      vx: this.rng.range(-0.8, 0.8),
      vy: this.rng.range(0.5, 1.6),
      vz: this.rng.range(-0.8, 0.8),
      scale0: 1.4,
      scale1: 3.9,
      life: 0.68,
      tex: this._driftTex,
      additive: false,
      opacity: 0.56,
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
        vy: this.rng.range(2.6, speed * 0.8),
        vz: Math.sin(a) * s,
        scale0: 0.72,
        scale1: 0.16,
        life: this.rng.range(0.24, 0.54),
        gravity: -18,
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
      tex: this._fireTex,
      additive: true,
      opacity: 1.0,
    });
  }

  spawnTracer(startPos, endPos, colorHex = 0xffd27a, life = 0.09) {
    const dir = endPos.clone().sub(startPos);
    const len = Math.max(0.2, dir.length());
    const geo = new THREE.BoxGeometry(0.075, 0.075, len);
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
