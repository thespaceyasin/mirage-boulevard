// MIRAGE BOULEVARD — Main Open-World Game Bootstrap, Simulation Loop,
// Gameplay Wiring, Deterministic Shot Presets, and QA Test Hooks.

import * as THREE from 'three';
import { SaveManager } from './systems/saveManager.js';
import { AudioEngine } from './audio/audioEngine.js';
import { VfxSystem } from './systems/vfxSystem.js';
import { RoadNetwork } from './world/roadNetwork.js';
import { CameraRig, InputController } from './engine/cameraInput.js';
import { MOOD_PRESETS, RendererPipeline } from './engine/rendererPipeline.js';
import { CombatSystem } from './systems/combatSystem.js';
import { PoliceDispatchSystem } from './systems/policeDispatch.js';
import { MissionDirector } from './systems/missionDirector.js';
import { TrafficSystem } from './systems/trafficSystem.js';
import { HudDashboard } from './ui/hudDashboard.js';
import { buildSolaraBayCity } from './world/cityBuilder.js';
import { buildCityProps } from './world/cityProps.js';
import { CITY_CONFIG, GARAGE_PAINTS, MISSIONS, VEHICLE_SPECS } from './engine/gameConfig.js';
import { VehicleEntity, resolveVehiclePairCollisions } from './entities/vehiclePhysics.js';
import { PlayerController } from './entities/characterRig.js';

class MirageBoulevardGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new RendererPipeline(this.canvas);
    this.input = new InputController(this.canvas);
    this.cameraRig = new CameraRig(this.renderer.camera);

    this.roadNetwork = new RoadNetwork();
    this.city = buildSolaraBayCity(this.renderer.scene, this.roadNetwork);
    this.cityProps = buildCityProps(this.renderer.scene, this.roadNetwork);

    this.vehicles = [];
    this.player = new PlayerController(this.renderer.scene);
    this.traffic = new TrafficSystem(this.renderer.scene, this.roadNetwork, this.vehicles);
    this.combat = new CombatSystem(this.renderer.scene, this.roadNetwork);
    this.police = new PoliceDispatchSystem(this.renderer.scene, this.roadNetwork, this.vehicles);
    this.missions = new MissionDirector(this.renderer.scene, this.roadNetwork);
    this.vfx = new VfxSystem(this.renderer.scene);
    this.saveManager = new SaveManager();
    this.audio = new AudioEngine();

    // Hero Starter Supercar parked right outside Mirage Boulevard beachfront!
    this.heroCar = new VehicleEntity(this.renderer.scene, 'apex_gt', 100.6, -24, 0, {
      role: 'parked',
      colorHex: 0xff4b68,
    });
    this.vehicles.push(this.heroCar);

    // Extra coastal showroom roadster parked near Garage & Plaza
    this.vehicles.push(new VehicleEntity(this.renderer.scene, 'bayside_cruiser', -126, 152, 0.5, {
      role: 'parked',
      colorHex: 0x1de9d8,
    }));

    this.mode = 'start'; // start | play | dashboard | garage | wasted
    this.pausedForShot = false;
    this.elapsed = 0;
    this.lastFrameTime = performance.now();
    this.fpsSmoothed = 60;
    this.hitstopTimer = 0;

    this.ui = new HudDashboard({
      onStartGame: (loadLatest) => this.startGame(loadLatest),
      onOpenDashboardFromStart: () => {
        this.audio.unlock();
        this.setMode('dashboard');
      },
      onToggleDashboard: (open) => this.setMode(open ? 'dashboard' : 'play'),
      onToggleGarage: (open) => this.setMode(open ? 'garage' : 'play'),
      onCycleMood: () => {
        const preset = this.renderer.cycleMood();
        this.ui.showToast(`TIME OF DAY: ${preset.label}`);
        if (this.mode === 'dashboard') this.ui.renderDashboard(this._uiState());
      },
      onToggleAudio: () => {
        this.audio.unlock();
        this.audio.toggleMute();
        if (this.mode === 'dashboard') this.ui.renderDashboard(this._uiState());
      },
      onActivateCrew: (id) => {
        this.audio.unlock();
        this.missions.activateCrewAbility(id, this._sysContext());
      },
      onSetMapWaypoint: (wx, wz) => {
        this.missions.customWaypoint = { x: wx, z: wz };
        this.audio.playUiClick(780);
        this.ui.renderDashboard(this._uiState());
        this.ui.showToast(`GPS WAYPOINT SET — ${this.roadNetwork.getDistrictName(wx, wz)}`);
      },
      onSaveSlot: (slotId) => {
        this.saveToSlot(slotId);
        this.audio.playPickup();
        this.ui.renderDashboard(this._uiState());
        this.ui.showToast(`SAVED TO ${slotId.toUpperCase()}`);
      },
      onLoadSlot: (slotId) => {
        if (this.loadFromSlot(slotId)) {
          this.audio.playMissionComplete();
          this.setMode('play');
          this.ui.showToast(`LOADED ${slotId.toUpperCase()}`);
        }
      },
      onSelectPaint: (paintId) => {
        if (this.missions.applyGaragePaint(paintId, this.player, this.audio)) {
          this.ui.renderGarage(this._uiState());
          this.ui.showToast('CUSTOM RESPRAY APPLIED');
        }
      },
      onBuyUpgrade: (upgId) => {
        if (this.missions.buyGarageUpgrade(upgId, this.player, this.audio)) {
          this.ui.renderGarage(this._uiState());
          this.ui.showToast('PERFORMANCE UPGRADE INSTALLED');
        }
      },
      onGarageRepair: () => {
        if (this.player.cash >= 300) {
          this.player.cash -= 300;
          if (this.player.vehicle) this.player.vehicle.repairFull();
          this.player.refillAmmoAndVitals();
          this.police.clearHeat();
          this.audio.playMissionComplete();
          this.ui.renderGarage(this._uiState());
          this.ui.showToast('HULL RESTORED & WANTED HEAT WIPED');
        }
      },
      onRespawn: () => this.respawnPlayer(),
    });

    this.missions.startMission(0, this._sysContext(), true);
    this.setMode('start');
    this._installTestHooks();
    this._checkUrlShotPreset();

    requestAnimationFrame((t) => this._loop(t));
  }

  _sysContext() {
    return {
      player: this.player,
      vehicles: this.vehicles,
      renderer: this.renderer,
      cameraRig: this.cameraRig,
      roadNetwork: this.roadNetwork,
      cityProps: this.cityProps,
      traffic: this.traffic,
      combat: this.combat,
      police: this.police,
      missions: this.missions,
      vfx: this.vfx,
      audio: this.audio,
      nightFactor: this.renderer.nightFactor,
      focusActive: this.missions.isFocusActive,
      showToast: (msg) => this.ui.showToast(msg),
      triggerFlash: () => this.ui.triggerScreenFlash(),
      autoSave: () => this.saveToSlot('autosave'),
      onEnemyKilled: (enemy) => this.missions.onEnemyKilled(enemy, this._sysContext()),
    };
  }

  _uiState() {
    return {
      ...this._sysContext(),
      saveManager: this.saveManager,
      interactText: this._computeInteractPrompt(),
    };
  }

  setMode(newMode) {
    this.mode = newMode;
    this.ui.setModeVisibility({
      mode: newMode,
      hasSaves: this.saveManager.hasAnySave(),
    });
    if (newMode === 'dashboard') {
      this.ui.renderDashboard(this._uiState());
    } else if (newMode === 'garage') {
      this.ui.renderGarage(this._uiState());
    }
  }

  startGame(loadLatest = false) {
    this.audio.unlock();
    if (loadLatest && this.saveManager.hasAnySave()) {
      this.loadFromSlot('autosave') || this.loadFromSlot('slot1');
    } else {
      this.player.pos.set(95, 0, -24);
      this.player.enterVehicle(this.heroCar);
      this.cameraRig.yaw = this.heroCar.heading;
      this.missions.startMission(0, this._sysContext(), false);
    }
    this.setMode('play');
  }

  respawnPlayer() {
    this.player.cash = Math.max(0, this.player.cash - 250);
    if (this.player.vehicle) this.player.exitVehicle(this.roadNetwork);
    this.player.refillAmmoAndVitals();
    this.player.pos.set(CITY_CONFIG.hospitalPos.x, 0, CITY_CONFIG.hospitalPos.z);
    this.player.syncTransform();
    this.police.clearHeat();
    this.setMode('play');
    this.ui.showToast('DISCHARGED FROM MIRAGE MEDICAL');
  }

  saveToSlot(slotId) {
    const snap = {
      cash: this.player.cash,
      health: this.player.health,
      armor: this.player.armor,
      pos: { x: this.player.pos.x, z: this.player.pos.z },
      district: this.roadNetwork.getDistrictName(this.player.pos.x, this.player.pos.z),
      mood: this.renderer.currentMood,
      heatPeak: this.police.heatPeak,
      careerPct: this.missions.getCareerPercent(),
      missions: this.missions.serialize(),
      ammo: this.player.ammo.map((a) => ({ ...a })),
    };
    return this.saveManager.saveSlot(slotId, snap);
  }

  loadFromSlot(slotId) {
    const data = this.saveManager.loadSlot(slotId);
    if (!data) return false;
    if (this.player.vehicle) this.player.exitVehicle(this.roadNetwork);
    this.player.cash = data.cash ?? 3500;
    this.player.health = data.health ?? 100;
    this.player.armor = data.armor ?? 75;
    this.player.dead = false;
    if (data.pos) {
      this.player.pos.set(data.pos.x, 0, data.pos.z);
      this.player.syncTransform();
    }
    if (Array.isArray(data.ammo)) {
      for (let i = 0; i < Math.min(data.ammo.length, this.player.ammo.length); i += 1) {
        this.player.ammo[i] = { ...data.ammo[i] };
      }
    }
    if (data.mood) this.renderer.setMood(data.mood);
    this.police.heatPeak = data.heatPeak || 0;
    this.police.clearHeat();
    this.missions.deserialize(data.missions, this._sysContext());
    return true;
  }

  _findNearestEnterableVehicle(maxDist = 5.4) {
    let best = null;
    let bestD = maxDist;
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const v = this.vehicles[i];
      if (v.wrecked || v === this.player.vehicle) continue;
      const d = Math.hypot(v.pos.x - this.player.pos.x, v.pos.z - this.player.pos.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  _computeInteractPrompt() {
    if (this.missions.nearGarage) {
      return '[G] ENTER SOLARA CUSTOMS GARAGE — UPGRADE & RESPRAY';
    }
    if (!this.player.vehicle) {
      const nearV = this._findNearestEnterableVehicle(5.6);
      if (nearV) {
        const verb = nearV.role === 'traffic' || nearV.role === 'police' ? 'HIJACK' : 'ENTER';
        return `[F] ${verb} ${nearV.spec.name}`;
      }
    } else if (Math.hypot(this.player.pos.x - CITY_CONFIG.raceStartPos.x, this.player.pos.z - CITY_CONFIG.raceStartPos.z) < 12) {
      return '[G] START COASTAL STREET RACE';
    }
    return '';
  }

  _handlePlayHotkeys(wheel) {
    // Pause / Interactive City Map Dashboard
    if (this.input.wasPressed('Escape') || this.input.wasPressed('KeyP') || this.input.wasPressed('KeyM')) {
      this.setMode('dashboard');
      return;
    }

    // Garage Shop or Street Race trigger
    if (this.input.wasPressed('KeyG')) {
      if (this.missions.nearGarage) {
        this.setMode('garage');
        return;
      }
      if (Math.hypot(this.player.pos.x - CITY_CONFIG.raceStartPos.x, this.player.pos.z - CITY_CONFIG.raceStartPos.z) < 15) {
        this.missions.startMission(2, this._sysContext(), false);
        return;
      }
    }

    // Enter / Carjack / Exit Vehicle
    if (this.input.wasPressed('KeyF') || this.input.wasPressed('KeyE')) {
      if (this.player.vehicle) {
        this.player.exitVehicle(this.roadNetwork);
        this.audio.playUiClick(460);
      } else {
        const nearV = this._findNearestEnterableVehicle(5.8);
        if (nearV) {
          const wasTraffic = nearV.role === 'traffic' || nearV.role === 'police';
          this.player.enterVehicle(nearV);
          nearV.applyGarageUpgrades(this.missions.upgrades);
          this.cameraRig.yaw = nearV.heading;
          this.audio.playUiClick(680);
          if (wasTraffic) {
            this.police.reportCrime(nearV.spec.isPolice ? 34 : 18, nearV.spec.isPolice ? 'STOLEN POLICE CRUISER' : 'GRAND THEFT AUTO');
            this.ui.showToast(`HIJACKED ${nearV.spec.name}`);
          }
        }
      }
    }

    // Weapons 1-5 & mouse wheel
    for (let i = 0; i < 5; i += 1) {
      if (this.input.wasPressed(`Digit${i + 1}`)) {
        this.player.selectWeapon(i);
        this.audio.playUiClick(580 + i * 45);
      }
    }
    if (wheel !== 0) {
      this.player.selectWeapon(this.player.weaponIndex + (wheel > 0 ? 1 : -1));
    }

    if (this.input.wasPressed('KeyR')) {
      this.combat.startReload(this.player, this.audio);
    }

    // Crew Abilities Z / X / C
    if (this.input.wasPressed('KeyZ')) this.missions.activateCrewAbility('blackout', this._sysContext());
    if (this.input.wasPressed('KeyX')) this.missions.activateCrewAbility('nitro', this._sysContext());
    if (this.input.wasPressed('KeyC')) this.missions.activateCrewAbility('focus', this._sysContext());

    // Radio Q / Tab, Camera V, Mood T
    if (this.input.wasPressed('KeyQ') || this.input.wasPressed('Tab')) {
      const st = this.audio.nextRadioStation();
      this.ui.showToast(`RADIO: ${st.name}`);
    }
    if (this.input.wasPressed('KeyV')) {
      const label = this.cameraRig.cyclePreset();
      this.ui.showToast(`CAMERA: ${label}`);
    }
    if (this.input.wasPressed('KeyT')) {
      const preset = this.renderer.cycleMood();
      this.ui.showToast(`TIME OF DAY: ${preset.label}`);
    }
  }

  _stepSimulation(rawDt) {
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.fpsSmoothed = this.fpsSmoothed * 0.92 + (1 / dt) * 0.08;

    const { dx, dy, wheel } = this.input.consumeMouse();

    try {
      if (this.mode === 'start') {
        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
          this.startGame(false);
          return;
        }
        this.elapsed += dt;
        this.roadNetwork.updateSignals(dt);
        const mood = MOOD_PRESETS[this.renderer.currentMood];
        this.traffic.update(dt, this.elapsed, this.heroCar.pos, mood.nightFactor, this.vfx);
        this.city.update(this.elapsed, mood);
        this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
        this.renderer.updateLighting(this.heroCar.pos, this.elapsed);
        this.cameraRig.updateTitleOrbit(this.elapsed, this.heroCar.pos);
        this.vfx.update(dt);
        this.audio.updateContinuous(dt, this.elapsed, { paused: true });
        return;
      }

      if (this.mode === 'dashboard') {
        if (this.input.wasPressed('Escape') || this.input.wasPressed('KeyP') || this.input.wasPressed('KeyM')) {
          this.setMode('play');
        }
        this.audio.updateContinuous(dt, this.elapsed, { paused: true });
        return;
      }

      if (this.mode === 'garage') {
        if (this.input.wasPressed('Escape') || this.input.wasPressed('KeyG')) {
          this.setMode('play');
        }
        this.audio.updateContinuous(dt, this.elapsed, { paused: true });
        return;
      }

      if (this.mode === 'wasted') {
        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
          this.respawnPlayer();
        }
        this.audio.updateContinuous(dt, this.elapsed, { paused: true });
        return;
      }

      // Active Play Mode
      this._handlePlayHotkeys(wheel);
      if (this.mode !== 'play') return;

      if (this.hitstopTimer > 0) this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      const timeScale = this.hitstopTimer > 0 ? 0.12 : this.missions.isFocusActive ? 0.48 : 1.0;
      const simDt = dt * timeScale;
      this.elapsed += simDt;

      const mood = MOOD_PRESETS[this.renderer.currentMood];
      const ctx = this._sysContext();
      this.roadNetwork.updateSignals(simDt);

      // Player movement (driving or on foot)
      if (this.player.vehicle) {
        const axes = this.input.getMoveAxes();
        const v = this.player.vehicle;
        const nitroHeld = axes.sprint || this.missions.isOverdriveActive;
        const impact = v.stepPhysics(
          simDt,
          { throttle: axes.forward, steer: axes.right, handbrake: axes.handbrake, nitro: nitroHeld },
          this.roadNetwork,
          this.missions.upgrades,
          this.vfx,
          this.elapsed,
          mood.nightFactor,
        );
        if (impact > 11) {
          this.cameraRig.addTrauma(Math.min(0.45, impact * 0.02));
          v.takeDamage(impact * 0.7, this.vfx, this.audio, (veh) => this.combat.handleExplosionSplash(veh.pos, 10, 110, ctx));
        }
        this.player.pos.copy(v.pos);
        this.player.heading = v.heading;
        if (v.wrecked) {
          this.player.exitVehicle(this.roadNetwork);
          this.player.takeDamage(45);
        }
      } else {
        this.player.updateOnFoot(simDt, this.elapsed, this.input, this.cameraRig.yaw, this.roadNetwork, this.vehicles);
      }

      // Parked / mission vehicles idle update
      for (let i = 0; i < this.vehicles.length; i += 1) {
        const v = this.vehicles[i];
        if (v.role === 'parked' || v.role === 'mission') {
          v.stepPhysics(simDt, { throttle: 0, steer: 0, handbrake: true, nitro: false }, this.roadNetwork, null, this.vfx, this.elapsed, mood.nightFactor);
        }
      }

      // Player shooting (on foot or drive-by SMG/pistol)
      if (this.input.mouseDown) {
        this.combat.tryPlayerFire(this.player, this.renderer.camera, ctx);
      }

      // Systems updates
      this.traffic.update(simDt, this.elapsed, this.player.pos, mood.nightFactor, this.vfx);
      this.police.update(simDt, this.elapsed, ctx);
      resolveVehiclePairCollisions(
        this.vehicles,
        this.vfx,
        this.audio,
        (veh) => this.combat.handleExplosionSplash(veh.pos, 10, 110, ctx),
        (other, sev) => {
          this.cameraRig.addTrauma(Math.min(0.42, sev * 0.025));
          if (other.spec.isPolice) this.police.reportCrime(16, 'RAMMING SBPD');
          else if (sev > 16) this.police.reportCrime(8, 'RECKLESS DRIVING');
        },
      );

      this.combat.update(simDt, this.elapsed, ctx);
      this.missions.update(simDt, ctx);
      this.vfx.update(simDt);
      this.city.update(this.elapsed, mood);
      this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
      this.renderer.updateLighting(this.player.pos, this.elapsed);
      this.renderer.decayTransientLights(dt);

      // Camera update (always runs on real dt)
      this.cameraRig.updateGameplay(dt, {
        mode: this.player.vehicle ? 'vehicle' : 'foot',
        targetPos: this.player.pos,
        targetHeading: this.player.heading,
        speed: this.player.vehicle ? this.player.vehicle.speed : 0,
        isNitro: Boolean(this.player.vehicle && this.player.vehicle.nitroActive),
        isAiming: this.player.aiming,
        lookDx: dx,
        lookDy: dy,
        roadNetwork: this.roadNetwork,
      });

      // Audio continuous update
      this.audio.updateContinuous(dt, this.elapsed, {
        inVehicle: Boolean(this.player.vehicle),
        speed: this.player.vehicle ? this.player.vehicle.speed : 0,
        drifting: Boolean(this.player.vehicle && this.player.vehicle.drifting),
        nitroActive: Boolean(this.player.vehicle && this.player.vehicle.nitroActive),
        wantedLevel: this.police.wantedLevel,
        paused: false,
      });

      if (this.player.dead) {
        this.setMode('wasted');
        return;
      }

      this.ui.updateHud(dt, this._uiState());
    } finally {
      this.input.endFrame();
    }
  }

  _loop(now) {
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (!this.pausedForShot) {
      this._stepSimulation(dt);
    }
    this.renderer.render();
    this._publishDiagnostics();
    requestAnimationFrame((t) => this._loop(t));
  }

  _publishDiagnostics() {
    window.__THREE_GAME_DIAGNOSTICS__ = {
      fps: Math.round(this.fpsSmoothed),
      mode: this.mode,
      wantedLevel: this.police.wantedLevel,
      vehicles: this.vehicles.length,
      pedestrians: this.traffic.pedestrians.length,
      enemies: this.combat.enemies.filter((e) => e.alive).length,
      renderer: this.renderer.getDiagnostics(),
    };
  }

  // Deterministic scenario presets for QA inspection & real-rendered showcase captures
  applyScenarioState(name) {
    this.police.clearHeat();
    this.combat.clearMissionEnemies();
    this.elapsed = 14.2;

    if (name === 'chase') {
      // 1-chase.jpg (Cover): Golden-hour 4-star coastal chase down palm-lined Mirage Boulevard!
      this.renderer.setMood('golden');
      this.player.cash = 14850;
      this.player.health = 94;
      this.player.armor = 78;
      this.player.selectWeapon(1); // Viper Micro-SMG

      // Position player's Sunset Coral Solara Apex GT drifting down Mirage Boulevard toward Marina/Sunset!
      this.heroCar.repairFull();
      this.heroCar.setPaint(0xff4b68);
      this.heroCar.pos.set(97.5, 0, -28);
      this.heroCar.heading = 0.28; // Dynamic drift angle
      this.heroCar.vel.set(10, 0, 39);
      this.heroCar.speed = 44.5;
      this.heroCar.forwardSpeed = 43.2;
      this.heroCar.lateralSpeed = 8.4;
      this.heroCar.drifting = true;
      this.heroCar.nitroActive = true;
      this.heroCar.nitro = 82;
      this.heroCar.steerAngle = -0.35;
      this.heroCar.syncTransform();
      this.player.enterVehicle(this.heroCar);

      // 4-star SBPD pursuit: 2 Interceptors + 1 Tactical SUV + Sky-Eye Helicopter overhead!
      this.police.setWantedLevel(4);
      this.police.inSight = true;
      const cop1 = this.police.spawnPoliceUnit(this.player.pos, 0, 'RAM', { x: 92.5, z: -13, heading: 0.14 });
      cop1.speed = 36; cop1.forwardSpeed = 36; cop1.sirenActive = true; cop1.syncTransform();
      const cop2 = this.police.spawnPoliceUnit(this.player.pos, 0, 'FLANK', { x: 103.5, z: -10, heading: -0.1 });
      cop2.speed = 35; cop2.forwardSpeed = 35; cop2.sirenActive = true; cop2.syncTransform();
      const swat = this.police.spawnPoliceUnit(this.player.pos, 0, 'ROADBLOCK', { x: 97.0, z: 12, heading: 1.38 });
      swat.sirenActive = true; swat.syncTransform();

      // Position SBPD Sky-Eye Police Helicopter right-side-up in dramatic banked 3/4 view!
      this.police.heliActive = true;
      this.police.heliPos.set(106.5, 16.5, 6);
      this.police.heli.root.visible = true;
      this.police.heli.root.position.copy(this.police.heliPos);
      this.police.heli.root.rotation.order = 'YXZ';
      const hYaw = Math.atan2(this.heroCar.pos.x - this.police.heliPos.x, this.heroCar.pos.z - this.police.heliPos.z);
      this.police.heli.root.rotation.set(0.16, hYaw, -0.18);
      this.police.heli.update(0.016, this.elapsed, this.heroCar.pos);

      // Clear any overlapping traffic near Mirage Boulevard foreground and place clean coastal cars
      for (const v of this.vehicles) {
        if (v.role === 'traffic' && Math.hypot(v.pos.x - 96, v.pos.z + 10) < 35) {
          v.pos.z += 95;
          v.syncTransform();
        }
      }
      const trafficNear = this.traffic.spawnTrafficVehicle(null, 'bayside_cruiser', {
        x: 91.0, z: -1, heading: Math.PI, axis: 'z', dir: -1, laneCoord: 91.0,
      });
      trafficNear.setPaint(0x1de9d8);
      for (let i = 0; i < 8; i += 1) {
        this.vfx.spawnDriftSmoke(95.4 - i * 0.55, 0.25, -30.5 - i * 0.55);
      }

      // Active story mission + character dialogue
      this.missions.completedMissions = new Set(['m1_coastal_pickup', 'm2_market_ambush', 'm3_boulevard_velocity']);
      this.missions.activeMissionIndex = 3; // Hotwire Heist
      this.missions.missionStage = 'deliver';
      this.missions.showDialogue('Rico Vega', 'WHEELMAN', 'Four-star heat on Mirage Boulevard! Air-1 is locked on — hit Nitro [X] and shake them at the Marina!', 99);

      this.setMode('play');
      const mood = MOOD_PRESETS.golden;
      this.city.update(this.elapsed, mood);
      this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
      this.renderer.updateLighting(this.heroCar.pos, this.elapsed);
      for (const v of this.vehicles) {
        v.visual.updateVisuals({
          elapsed: this.elapsed,
          nightFactor: mood.nightFactor,
          speed: v.forwardSpeed,
          steerAngle: v.steerAngle,
          braking: false,
          sirenActive: v.sirenActive,
          nitroActive: v.nitroActive,
          wrecked: v.wrecked,
        });
      }
      this.renderer.dynamicLights.strobeRed.position.set(92.5, 3.2, -13);
      this.renderer.dynamicLights.strobeRed.intensity = 34;
      this.renderer.dynamicLights.strobeBlue.position.set(103.5, 3.2, -10);
      this.renderer.dynamicLights.strobeBlue.intensity = 34;

      // Hero cinematic chase camera showing Apex GT, pursuing SBPD cruisers, roadblock, Helicopter, palms, Art-Deco hotels & golden ocean!
      this.cameraRig.setImmediate(
        new THREE.Vector3(88.2, 5.2, -39.5),
        new THREE.Vector3(101.2, 4.4, 2.0),
        60,
      );
      this.ui.updateHud(0.016, this._uiState());
      return { state: 'chase' };
    }

    if (name === 'combat') {
      // 2-combat.jpg: Neon Night on-foot shootout + burning/exploding car in Lantern Night Market!
      this.renderer.setMood('night');
      this.player.cash = 8650;
      this.player.health = 84;
      this.player.armor = 62;
      if (this.player.vehicle) this.player.exitVehicle(this.roadNetwork);
      this.player.selectWeapon(3); // Meridian Carbine
      this.player.pos.set(-5.2, 0, 74.5);
      this.player.heading = 0.14;
      this.player.aiming = true;
      this.player.rig.animate(2.5, this.elapsed, true, false);
      this.player.syncTransform();

      this.police.setWantedLevel(3);
      this.police.inSight = true;
      this.missions.completedMissions = new Set(['m1_coastal_pickup']);
      this.missions.startMission(1, this._sysContext(), true); // Night Market Ambush
      this.missions.missionEnemiesRemaining = 3;
      this.missions.showDialogue('Tessa Vance', 'TACTICIAN', 'Meridian ambush in Lantern Night Market! Pop Tactical Focus [C] and take out their gunmen!', 99);

      // Clear default circle & place tactical combat scene right under the glowing neon market arches!
      this.combat.clearMissionEnemies();
      const e1 = this.combat.spawnEnemy('cartel', -8.8, 92.5, 'm2_market_ambush');
      const e2 = this.combat.spawnEnemy('cartel', 3.4, 96.0, 'm2_market_ambush');
      const e3 = this.combat.spawnEnemy('police', -1.8, 102.5, 'm2_market_ambush');
      for (const e of [e1, e2, e3]) {
        e.heading = Math.atan2(this.player.pos.x - e.pos.x, this.player.pos.z - e.pos.z);
        e.rig.root.rotation.y = e.heading;
        e.rig.animate(1.5, this.elapsed, true, false);
      }

      // Exploding blazing SBPD cruiser & wrecked cartel coupe in the market lane!
      const burningCar = new VehicleEntity(this.renderer.scene, 'sbpd_interceptor', 2.6, 89.2, -0.58, {
        role: 'police',
        sirenActive: true,
        dispatchRole: 'RAM',
        callsign: 'UNIT-2',
      });
      this.vehicles.push(burningCar);
      this.police.policeUnits.push(burningCar);
      burningCar.wrecked = true;
      burningCar.visual.setWrecked(true);
      this.vfx.spawnExplosion(new THREE.Vector3(2.6, 0.8, 89.2), 1.45);
      this.vfx.spawnFirePlume(2.6, 1.5, 89.2, 1.5);
      this.vfx.spawnFirePlume(1.9, 1.9, 89.6, 1.3);

      const intactCop = this.police.spawnPoliceUnit(this.player.pos, 0, 'FLANK', { x: -11.4, z: 100.5, heading: -2.4 });
      intactCop.sirenActive = true;

      // Active tracer fire & bright muzzle flash
      const muzzlePos = new THREE.Vector3(-4.8, 1.48, 75.3);
      this.vfx.spawnMuzzleFlash(muzzlePos, 2.1);
      this.vfx.spawnTracer(muzzlePos, new THREE.Vector3(-8.4, 1.3, 92.2), 0xffcf5a, 1.0);
      this.vfx.spawnTracer(new THREE.Vector3(3.1, 1.45, 95.8), new THREE.Vector3(-3.5, 1.6, 78.0), 0xff4b68, 1.0);
      this.vfx.spawnSparks(-8.4, 1.3, 92.2, 18, 11);
      this.combat.hitmarkerTimer = 0.2;

      this.renderer.pulseExplosionLight(new THREE.Vector3(2.6, 2.8, 89.2), 75);
      this.renderer.pulseMuzzleLight(muzzlePos);
      this.renderer.dynamicLights.strobeRed.position.set(-11.4, 3.2, 100.5);
      this.renderer.dynamicLights.strobeRed.intensity = 30;
      this.renderer.dynamicLights.strobeBlue.position.set(-10.0, 3.2, 100.5);
      this.renderer.dynamicLights.strobeBlue.intensity = 30;

      this.setMode('play');
      const mood = MOOD_PRESETS.night;
      this.city.update(this.elapsed, mood);
      this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
      this.renderer.updateLighting(this.player.pos, this.elapsed);
      for (const v of this.vehicles) {
        v.visual.updateVisuals({
          elapsed: this.elapsed,
          nightFactor: mood.nightFactor,
          speed: 0,
          steerAngle: 0,
          braking: false,
          sirenActive: v.sirenActive,
          nitroActive: false,
          wrecked: v.wrecked,
        });
      }
      this.cameraRig.setImmediate(
        new THREE.Vector3(-7.6, 2.75, 69.2),
        new THREE.Vector3(-1.5, 2.1, 93.0),
        54,
      );
      this.ui.updateHud(0.016, this._uiState());
      return { state: 'combat' };
    }

    if (name === 'city') {
      // 3-city.jpg: Sun-soaked daytime exploration / carjacking on vibrant Mirage Boulevard!
      this.renderer.setMood('day');
      this.player.cash = 9400;
      this.player.health = 100;
      this.player.armor = 90;
      if (this.player.vehicle) this.player.exitVehicle(this.roadNetwork);
      this.player.selectWeapon(0);
      this.player.pos.set(104.2, 0, -24.5);
      this.player.heading = -1.25;
      this.player.aiming = false;
      this.player.rig.animate(0, this.elapsed, false, false);
      this.player.syncTransform();

      this.heroCar.repairFull();
      this.heroCar.setPaint(0x1de9d8);
      this.heroCar.pos.set(100.4, 0, -24.2);
      this.heroCar.heading = 0.05;
      this.heroCar.syncTransform();

      // Clear any overlapping traffic near Mirage Boulevard foreground so every parked/moving car reads cleanly
      for (const v of this.vehicles) {
        if (v.role === 'traffic' && Math.hypot(v.pos.x - 96, v.pos.z + 14) < 38) {
          v.pos.z += 90;
          v.syncTransform();
        }
      }

      // Add lively sunlit boulevard cars right in frame with clean spacing
      const c1 = new VehicleEntity(this.renderer.scene, 'bayside_cruiser', 91.6, -12, Math.PI, { role: 'parked', colorHex: 0xff5e6c });
      const c2 = new VehicleEntity(this.renderer.scene, 'mirage_coupe', 100.6, -3, 0, { role: 'parked', colorHex: 0xffb347 });
      const c3 = new VehicleEntity(this.renderer.scene, 'sbpd_interceptor', 91.6, 14, Math.PI, { role: 'parked' });
      this.vehicles.push(c1, c2, c3);

      this.missions.completedMissions = new Set(['m1_coastal_pickup', 'm2_market_ambush']);
      this.missions.activeMissionIndex = 2;
      this.missions.activeDialogue = null;

      this.setMode('play');
      const mood = MOOD_PRESETS.day;
      this.city.update(this.elapsed, mood);
      this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
      this.renderer.updateLighting(this.player.pos, this.elapsed);
      for (const v of this.vehicles) {
        v.visual.updateVisuals({ elapsed: this.elapsed, nightFactor: 0, speed: 0, steerAngle: 0, braking: false, sirenActive: false, nitroActive: false, wrecked: false });
      }
      this.cameraRig.setImmediate(
        new THREE.Vector3(111.5, 4.4, -34.2),
        new THREE.Vector3(96.0, 2.8, -11.0),
        56,
      );
      this.ui.updateHud(0.016, this._uiState());
      return { state: 'city' };
    }

    if (name === 'dashboard') {
      // 4-dashboard.jpg: Pause / Interactive City Map + Career % + Missions + Crew + Save Slots over 3D skyline!
      this.renderer.setMood('golden');
      this.player.cash = 14850;
      this.player.pos.set(96, 0, -18);
      this.missions.completedMissions = new Set(['m1_coastal_pickup', 'm2_market_ambush', 'm3_boulevard_velocity', 'm4_hotwire_heist']);
      this.missions.activeMissionIndex = 4;
      this.missions.collectedPalms = new Set(['gp1', 'gp2', 'gp3', 'gp4', 'gp5']);
      this.missions.upgrades = { engine: 2, handling: 2, armor: 1, nitro: 2 };
      this.missions.raceWins = 1;
      this.police.heatPeak = 4;
      this.saveManager.saveSlot('autosave', { cash: 14850, careerPct: 54, district: 'MIRAGE BOULEVARD' });
      this.saveManager.saveSlot('slot1', { cash: 14850, careerPct: 54, district: 'MIRAGE BOULEVARD' });
      this.saveManager.saveSlot('slot2', { cash: 6400, careerPct: 28, district: 'LANTERN NIGHT MARKET' });

      const mood = MOOD_PRESETS.golden;
      this.city.update(this.elapsed, mood);
      this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
      this.renderer.updateLighting(this.player.pos, this.elapsed);
      this.cameraRig.setImmediate(
        new THREE.Vector3(148, 42, -88),
        new THREE.Vector3(45, 8, 12),
        54,
      );
      this.setMode('dashboard');
      return { state: 'dashboard' };
    }

    throw new Error(`Unknown state: ${name}`);
  }

  _checkUrlShotPreset() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot && ['chase', 'combat', 'city', 'dashboard'].includes(shot)) {
      this.applyScenarioState(shot);
      this.pausedForShot = true;
    }
  }

  _installTestHooks() {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: () => ({ ok: true }),
      setPausedForScreenshot: (paused) => {
        this.pausedForShot = Boolean(paused);
        return { paused: this.pausedForShot };
      },
      setReducedMotion: (rm) => {
        this.cameraRig.reducedMotion = Boolean(rm);
        return { reducedMotion: this.cameraRig.reducedMotion };
      },
      setState: (stateName) => this.applyScenarioState(stateName),
      getState: () => ({
        mode: this.mode,
        wantedLevel: this.police.wantedLevel,
        cash: this.player.cash,
        careerPct: this.missions.getCareerPercent(),
        diagnostics: this.renderer.getDiagnostics(),
      }),
    };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__MIRAGE_GAME__ = new MirageBoulevardGame();
});
