// Responsive keyboard & mouse input manager + spring-damped third-person
// Chase / On-Foot Tactical / Cinematic Orbit camera rig with trauma screenshake.

import * as THREE from 'three';

function pseudoNoise(t, seed) {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    this.pointerLocked = false;
    this.mouseNdc = new THREE.Vector2(0, 0);
    this.hasUserInteracted = false;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.hasUserInteracted = true;
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
        e.preventDefault();
      }
      if (!this.keys.has(code)) {
        this.pressed.add(code);
      }
      this.keys.add(code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    const clearAll = () => {
      this.keys.clear();
      this.pressed.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
    };
    window.addEventListener('blur', clearAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearAll();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.hasUserInteracted = true;
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.rightMouseDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightMouseDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked || this.rightMouseDown) {
        this.mouseDeltaX += e.movementX || 0;
        this.mouseDeltaY += e.movementY || 0;
      } else {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          this.mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        }
        // Gentle horizontal steering/look when moving mouse over canvas in active play
        if (Math.abs(e.movementX) < 120 && e.buttons > 0) {
          this.mouseDeltaX += e.movementX * 0.7;
          this.mouseDeltaY += e.movementY * 0.5;
        }
      }
    });

    window.addEventListener('wheel', (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  consumeMouse() {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    const wheel = this.wheelDelta;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    return { dx, dy, wheel };
  }

  endFrame() {
    this.pressed.clear();
  }

  getMoveAxes() {
    const forward = (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0)
      - (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    const right = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
      - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    return {
      forward,
      right,
      sprint: this.isDown('ShiftLeft') || this.isDown('ShiftRight'),
      handbrake: this.isDown('Space'),
    };
  }
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.24;
    this.presetIndex = 0; // 0: Chase, 1: Action Close, 2: Hood, 3: Wide Scenic
    this.baseFov = 56;
    this.currentFov = 56;
    this.fovPunch = 0;
    this.trauma = 0;
    this.shakeTime = 0;
    this.reducedMotion = false;
    this.manualLookTimer = 0;

    this.currentPos = new THREE.Vector3(96, 12, -40);
    this.currentLook = new THREE.Vector3(96, 2, -20);
    this._desiredPos = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();
  }

  cyclePreset() {
    this.presetIndex = (this.presetIndex + 1) % 4;
    return ['CHASE', 'ACTION LOW', 'BUMPER CAM', 'WIDE SCENIC'][this.presetIndex];
  }

  addTrauma(amount) {
    if (this.reducedMotion) return;
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  punchFov(deg) {
    if (this.reducedMotion) return;
    this.fovPunch = Math.min(12, this.fovPunch + deg);
  }

  setImmediate(pos, lookAt, fov = 56) {
    this.currentPos.copy(pos);
    this.currentLook.copy(lookAt);
    this.camera.position.copy(pos);
    this.camera.lookAt(lookAt);
    this.currentFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  updateTitleOrbit(elapsed, anchor = new THREE.Vector3(96, 6, -32)) {
    const angle = elapsed * 0.14 + 0.65;
    const radius = 58;
    this.camera.position.set(
      anchor.x + Math.cos(angle) * radius,
      20 + Math.sin(elapsed * 0.35) * 3,
      anchor.z + Math.sin(angle) * radius,
    );
    this.camera.lookAt(anchor.x - 10, 6, anchor.z + 18);
    if (Math.abs(this.camera.fov - 54) > 0.1) {
      this.camera.fov = 54;
      this.camera.updateProjectionMatrix();
    }
  }

  updateGameplay(dt, {
    mode,
    targetPos,
    targetHeading,
    speed = 0,
    isNitro = false,
    isAiming = false,
    lookDx = 0,
    lookDy = 0,
    roadNetwork = null,
  }) {
    if (Math.abs(lookDx) > 0.01 || Math.abs(lookDy) > 0.01) {
      this.yaw -= lookDx * 0.0042;
      this.pitch = THREE.MathUtils.clamp(this.pitch + lookDy * 0.0032, 0.05, 0.72);
      this.manualLookTimer = 1.8;
    } else if (this.manualLookTimer > 0) {
      this.manualLookTimer = Math.max(0, this.manualLookTimer - dt);
    }

    let desiredFov = 56;
    if (mode === 'vehicle') {
      // Smoothly align camera yaw behind vehicle direction unless manually orbiting
      if (this.manualLookTimer <= 0) {
        const diff = Math.atan2(Math.sin(targetHeading - this.yaw), Math.cos(targetHeading - this.yaw));
        this.yaw += diff * (1 - Math.exp(-dt * (4.4 + Math.min(speed * 0.08, 4.0))));
        this.pitch += (0.23 - this.pitch) * (1 - Math.exp(-dt * 4.5));
      }

      const presets = [
        { dist: 10.6, height: 4.1, lookAhead: 9.5, fov: 58 },
        { dist: 8.2, height: 3.0, lookAhead: 11.5, fov: 62 },
        { dist: -0.9, height: 1.75, lookAhead: 18.0, fov: 66 },
        { dist: 14.5, height: 6.2, lookAhead: 8.5, fov: 55 },
      ];
      const p = presets[this.presetIndex];
      const speedRatio = THREE.MathUtils.clamp(speed / 52, 0, 1);
      desiredFov = p.fov + speedRatio * 10 + (isNitro ? 7 : 0);

      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      const dynamicDist = p.dist + (p.dist > 0 ? speedRatio * 1.4 : 0);
      this._desiredPos.set(
        targetPos.x - sinY * dynamicDist,
        targetPos.y + p.height + Math.sin(this.pitch) * (p.dist > 0 ? 1.8 : 0),
        targetPos.z - cosY * dynamicDist,
      );
      this._desiredLook.set(
        targetPos.x + sinY * p.lookAhead,
        targetPos.y + 1.75,
        targetPos.z + cosY * p.lookAhead,
      );
    } else {
      // On-foot third-person tactical camera (over right shoulder)
      const dist = isAiming ? 3.9 : 6.4;
      const shoulder = isAiming ? 1.05 : 0.72;
      const height = isAiming ? 2.15 : 2.85;
      desiredFov = isAiming ? 44 : 54;

      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      const rightX = cosY;
      const rightZ = -sinY;

      this._desiredPos.set(
        targetPos.x - sinY * dist + rightX * shoulder,
        targetPos.y + height + Math.sin(this.pitch) * 1.6,
        targetPos.z - cosY * dist + rightZ * shoulder,
      );
      this._desiredLook.set(
        targetPos.x + sinY * 14 + rightX * (shoulder * 0.4),
        targetPos.y + 1.6 - Math.sin(this.pitch) * 2.2,
        targetPos.z + cosY * 14 + rightZ * (shoulder * 0.4),
      );
    }

    // Keep camera above ground and gently clear of tall building boxes
    this._desiredPos.y = Math.max(1.2, this._desiredPos.y);
    if (roadNetwork && roadNetwork.isInsideBuilding(this._desiredPos.x, this._desiredPos.z, 1.2)) {
      this._desiredPos.y += 4.2;
    }

    const posLerp = 1 - Math.exp(-dt * (mode === 'vehicle' ? 11.5 : 13.5));
    const lookLerp = 1 - Math.exp(-dt * 15.0);
    this.currentPos.lerp(this._desiredPos, posLerp);
    this.currentLook.lerp(this._desiredLook, lookLerp);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);

    // FOV easing + additive punch
    this.fovPunch *= Math.exp(-dt / 0.22);
    if (this.fovPunch < 0.02) this.fovPunch = 0;
    const targetFov = desiredFov + this.fovPunch;
    this.currentFov += (targetFov - this.currentFov) * (1 - Math.exp(-dt * 8.0));
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Trauma-based screenshake (additive after base transform)
    this.shakeTime += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.45);
    if (this.trauma > 0.005 && !this.reducedMotion) {
      const shake = this.trauma * this.trauma;
      const freq = this.shakeTime * 34;
      this.camera.position.x += 0.58 * shake * pseudoNoise(freq, 1);
      this.camera.position.y += 0.45 * shake * pseudoNoise(freq, 2);
      this.camera.rotation.z += 0.06 * shake * pseudoNoise(freq, 3);
    }
  }
}
