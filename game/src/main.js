// MIRAGE BOULEVARD — Main Open-World Game Bootstrap, Simulation Loop,
// Gameplay Wiring, Deterministic Shot Presets, and QA Test Hooks.

import * as THREE from 'three';
import { TitleMenuController } from './ui/titleMenu.js';
import { HudDashboard } from './ui/hudDashboard.js';
import { SolaraCustomsGarage } from './systems/garageShop.js';
import { SyndicateCrewSystem } from './systems/crewSystem.js';
import { MissionDirector } from './systems/missionDirector.js';
import { PoliceDispatchSystem } from './systems/policeDispatch.js';
import { CombatSystem } from './systems/combatSystem.js';
import { TrafficSystem } from './systems/trafficSystem.js';
import { VfxSystem } from './systems/vfxSystem.js';
import { SaveManager } from './systems/saveManager.js';
import { AudioEngine } from './audio/audioEngine.js';
import { VehicleEntity, resolveVehiclePairCollisions } from './entities/vehiclePhysics.js';
import { PlayerController } from './entities/characterRig.js';
import { RoadNetwork } from './world/roadNetwork.js';
import { buildSolaraBayCity } from './world/cityBuilder.js';
import { buildCityProps } from './world/cityProps.js';
import { CameraRig, InputController } from './engine/cameraInput.js';
import { MOOD_PRESETS, RendererPipeline } from './engine/rendererPipeline.js';
import { CITY_CONFIG } from './engine/gameConfig.js';

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
    this.crewSystem = new SyndicateCrewSystem();
    this.garageShop = new SolaraCustomsGarage();
    this.missions = new MissionDirector(this.renderer.scene, this.roadNetwork, this.crewSystem, this.garageShop);
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

    this._seedDefaultCampaignSaves();

    this.mode = 'start'; // start | play | dashboard | garage | wasted
    this.pausedForShot = false;
    this.elapsed = 0;
    this.lastFrameTime = performance.now();
    this.fpsSmoothed = 60;
    this.hitstopTimer = 0;

    this.titleMenu = new TitleMenuController({
      onContinueCampaign: () => this.startGame(true, false),
      onNewGame: () => this.startGame(false, false),
      onOpenSaveSlots: () => {
        this.audio.unlock();
        this.setMode('dashboard');
      },
      onEnterFreeRoam: () => this.startGame(false, true),
      onCycleMood: () => {
        const preset = this.renderer.cycleMood();
        this._syncTitleMenu();
        this.ui.showToast(`TIME OF DAY: ${preset.label}`);
      },
      onToggleAudio: () => {
        this.audio.unlock();
        this.audio.toggleMute();
        this._syncTitleMenu();
      },
      onCycleCamera: () => {
        const label = this.cameraRig.cyclePreset();
        this._syncTitleMenu();
        this.ui.showToast(`CAMERA: ${label}`);
      },
    });

    this.ui = new HudDashboard({
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
        this.crewSystem.activateCrewAbility(id, this._sysContext());
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
        if (this.garageShop.applyMetallicRespray(paintId, this.player, this.audio)) {
          this.ui.renderGarage(this._uiState());
          this.ui.showToast('CUSTOM RESPRAY APPLIED');
        }
      },
      onBuyUpgrade: (upgId) => {
        if (this.garageShop.purchasePerformanceUpgrade(upgId, this.player, this.audio)) {
          this.ui.renderGarage(this._uiState());
          this.ui.showToast('PERFORMANCE UPGRADE INSTALLED');
        }
      },
      onGarageRepair: () => {
        if (this.garageShop.repairHullAndClearWantedHeat(this.player, this.police, this.audio)) {
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

  _seedDefaultCampaignSaves() {
    this.saveManager.seedDemoSlotsIfEmpty({
      cash: 14850,
      health: 100,
      armor: 85,
      pos: { x: 96, z: -24 },
      district: 'MIRAGE BOULEVARD',
      mood: 'golden',
      heatPeak: 4,
      careerPct: 54,
      missions: {
        activeMissionIndex: 4,
        completedMissions: ['m1_coastal_pickup', 'm2_market_ambush', 'm3_boulevard_velocity', 'm4_hotwire_heist'],
        collectedPalms: ['gp1', 'gp2', 'gp3', 'gp4', 'gp5'],
        raceWins: 1,
        ownedPaints: ['sunset_coral', 'cyber_cyan'],
        activePaintId: 'sunset_coral',
        upgrades: { engine: 2, handling: 2, armor: 1, nitro: 2 },
      },
    });
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
      crewSystem: this.crewSystem,
      garageShop: this.garageShop,
      vfx: this.vfx,
      audio: this.audio,
      nightFactor: this.renderer.nightFactor,
      focusActive: this.crewSystem.isFocusActive,
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

  _syncTitleMenu() {
    const mood = MOOD_PRESETS[this.renderer.currentMood] || MOOD_PRESETS.golden;
    const camNames = ['CHASE', 'ACTION LOW', 'BUMPER CAM', 'WIDE SCENIC'];
    this.titleMenu.renderTitleMenuState({
      visible: this.mode === 'start',
      hasSaves: this.saveManager.hasAnySave(),
      bestCareerPct: this.saveManager.getBestCareerPercent(),
      currentMoodLabel: mood.label,
      muted: this.audio.muted,
      cameraLabel: camNames[this.cameraRig.presetIndex] || 'CHASE',
    });
  }

  setMode(newMode) {
    this.mode = newMode;
    this.ui.setModeVisibility({ mode: newMode });
    this._syncTitleMenu();
    if (newMode === 'dashboard') {
      this.ui.renderDashboard(this._uiState());
    } else if (newMode === 'garage') {
      this.ui.renderGarage(this._uiState());
    }
  }

  startGame(loadLatest = false, freeRoam = false) {
    this.audio.unlock();
    if (loadLatest && this.saveManager.hasAnySave()) {
      this.loadFromSlot('autosave') || this.loadFromSlot('slot1');
      if (!this.player.vehicle) {
        this.heroCar.pos.set(this.player.pos.x, 0, this.player.pos.z);
        this.heroCar.syncTransform();
        this.player.enterVehicle(this.heroCar);
        this.cameraRig.yaw = this.heroCar.heading;
      }
    } else if (freeRoam) {
      this.player.cash = Math.max(this.player.cash, 12500);
      this.player.refillAmmoAndVitals();
      this.heroCar.repairFull();
      this.heroCar.pos.set(100.6, 0, -24);
      this.heroCar.heading = 0;
      this.heroCar.syncTransform();
      this.player.enterVehicle(this.heroCar);
      this.cameraRig.yaw = this.heroCar.heading;
      this.missions.enterFreeRoam(this._sysContext());
    } else {
      this.player.cash = 3500;
      this.player.refillAmmoAndVitals();
      this.heroCar.repairFull();
      this.heroCar.pos.set(100.6, 0, -24);
      this.heroCar.heading = 0;
      this.heroCar.syncTransform();
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
    if (this.garageShop.nearGarage) {
      return '[G] ENTER SOLARA CUSTOMS GARAGE — UPGRADE & RESPRAY';
    }
    if (!this.player.vehicle) {
      const nearV = this._findNearestEnterableVehicle(5.8);
      if (nearV) {
        return `[F] STEAL ${nearV.spec.name}`;
      }
    } else if (Math.hypot(this.player.pos.x - CITY_CONFIG.raceStartPos.x, this.player.pos.z - CITY_CONFIG.raceStartPos.z) < 12) {
      return '[G] START COASTAL STREET RACE';
    }
    return '';
  }

  _handlePlayHotkeys(wheel) {
    if (this.input.wasPressed('Escape') || this.input.wasPressed('KeyP') || this.input.wasPressed('KeyM')) {
      this.setMode('dashboard');
      return;
    }

    if (this.input.wasPressed('KeyG')) {
      if (this.garageShop.nearGarage) {
        this.setMode('garage');
        return;
      }
      if (Math.hypot(this.player.pos.x - CITY_CONFIG.raceStartPos.x, this.player.pos.z - CITY_CONFIG.raceStartPos.z) < 15) {
        this.missions.startMission(2, this._sysContext(), false);
        return;
      }
    }

    if (this.input.wasPressed('KeyF') || this.input.wasPressed('KeyE')) {
      if (this.player.vehicle) {
        this.player.exitVehicle(this.roadNetwork);
        this.audio.playUiClick(460);
      } else {
        const nearV = this._findNearestEnterableVehicle(5.8);
        if (nearV) {
          const wasTraffic = nearV.role === 'traffic' || nearV.role === 'police';
          this.player.enterVehicle(nearV);
          nearV.applyGarageUpgrades(this.garageShop.upgrades);
          this.cameraRig.yaw = nearV.heading;
          this.audio.playUiClick(680);
          if (wasTraffic) {
            this.police.reportCrime(nearV.spec.isPolice ? 34 : 18, nearV.spec.isPolice ? 'STOLEN POLICE CRUISER' : 'GRAND THEFT AUTO');
            this.ui.showToast(`STOLE ${nearV.spec.name}`);
          }
        }
      }
    }

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

    // Syndicate Crew Abilities Z / X / C
    if (this.input.wasPressed('KeyZ')) this.crewSystem.activateCrewAbility('blackout', this._sysContext());
    if (this.input.wasPressed('KeyX')) this.crewSystem.activateCrewAbility('nitro', this._sysContext());
    if (this.input.wasPressed('KeyC')) this.crewSystem.activateCrewAbility('focus', this._sysContext());

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
          this.startGame(true, false);
          return;
        }
        this.elapsed += dt;
        this.roadNetwork.updateSignals(dt);
        const mood = MOOD_PRESETS[this.renderer.currentMood];
        this.traffic.update(dt, this.elapsed, this.heroCar.pos, mood.nightFactor, this.vfx);
        this.city.update(this.elapsed, mood);
        this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
        this.renderer.updateLighting(this.heroCar.pos, this.elapsed);
        this.titleMenu.updateTitlePanoramaCamera(this.cameraRig, this.elapsed, this.heroCar.pos);
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

      this._handlePlayHotkeys(wheel);
      if (this.mode !== 'play') return;

      if (this.hitstopTimer > 0) this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      const timeScale = this.crewSystem.getSimulationTimeScale(this.hitstopTimer);
      const simDt = dt * timeScale;
      this.elapsed += simDt;

      const mood = MOOD_PRESETS[this.renderer.currentMood];
      const ctx = this._sysContext();
      this.roadNetwork.updateSignals(simDt);

      if (this.player.vehicle) {
        const axes = this.input.getMoveAxes();
        const v = this.player.vehicle;
        const nitroHeld = axes.sprint || this.crewSystem.isOverdriveActive;
        const impact = v.stepPhysics(
          simDt,
          { throttle: axes.forward, steer: axes.right, handbrake: axes.handbrake, nitro: nitroHeld },
          this.roadNetwork,
          this.garageShop.upgrades,
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

      for (let i = 0; i < this.vehicles.length; i += 1) {
        const v = this.vehicles[i];
        if (v.role === 'parked' || v.role === 'mission') {
          v.stepPhysics(simDt, { throttle: 0, steer: 0, handbrake: true, nitro: false }, this.roadNetwork, null, this.vfx, this.elapsed, mood.nightFactor);
        }
      }

      if (this.input.mouseDown) {
        this.combat.tryPlayerFire(this.player, this.renderer.camera, ctx);
      }

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
      // 1-chase.jpg (Cover): Dramatic close golden-hour drift pursuit down Mirage Boulevard!
      this.renderer.setMood('golden');
      this.player.cash = 14850;
      this.player.health = 94;
      this.player.armor = 78;
      this.player.selectWeapon(1);

      this.heroCar.repairFull();
      this.heroCar.setPaint(0xff4b68);
      this.heroCar.pos.set(98.4, 0, -28.0);
      this.heroCar.heading = 0.32;
      this.heroCar.vel.set(11, 0, 41);
      this.heroCar.speed = 46.5;
      this.heroCar.forwardSpeed = 44.8;
      this.heroCar.lateralSpeed = 8.6;
      this.heroCar.drifting = true;
      this.heroCar.nitroActive = true;
      this.heroCar.nitro = 84;
      this.heroCar.steerAngle = -0.42;
      this.heroCar.syncTransform();
      this.player.enterVehicle(this.heroCar);

      // Close pursuing SBPD Interceptors + Tactical SUV roadblock + Sky-Eye Helicopter
      this.police.setWantedLevel(4);
      this.police.inSight = true;
      const cop1 = this.police.spawnPoliceUnit(this.player.pos, 0, 'RAM', { x: 93.2, z: -15.5, heading: 0.16 });
      cop1.speed = 38; cop1.forwardSpeed = 38; cop1.sirenActive = true; cop1.syncTransform();
      const cop2 = this.police.spawnPoliceUnit(this.player.pos, 0, 'FLANK', { x: 103.8, z: -10.5, heading: -0.14 });
      cop2.speed = 37; cop2.forwardSpeed = 37; cop2.sirenActive = true; cop2.syncTransform();
      const swat = this.police.spawnPoliceUnit(this.player.pos, 0, 'ROADBLOCK', { x: 97.2, z: 13.5, heading: 1.4 });
      swat.sirenActive = true; swat.syncTransform();

      this.police.heliActive = true;
      this.police.heliPos.set(105.5, 16.0, 5.5);
      this.police.heli.root.visible = true;
      this.police.heli.root.position.copy(this.police.heliPos);
      this.police.heli.root.rotation.order = 'YXZ';
      const hYaw = Math.atan2(this.heroCar.pos.x - this.police.heliPos.x, this.heroCar.pos.z - this.police.heliPos.z);
      this.police.heli.root.rotation.set(0.16, hYaw, -0.18);
      this.police.heli.update(0.016, this.elapsed, this.heroCar.pos);

      // Clear foreground overlap & place coastal civilian traffic + boardwalk pedestrians in frame
      for (const v of this.vehicles) {
        if (v.role === 'traffic' && Math.hypot(v.pos.x - 96, v.pos.z + 10) < 35) {
          v.pos.z += 95;
          v.syncTransform();
        }
      }
      const trafficA = this.traffic.spawnTrafficVehicle(null, 'bayside_cruiser', {
        x: 91.2, z: 1.5, heading: Math.PI, axis: 'z', dir: -1, laneCoord: 91.2,
      });
      trafficA.setPaint(0x1de9d8);
      const trafficB = this.traffic.spawnTrafficVehicle(null, 'mirage_coupe', {
        x: 101.2, z: 26.0, heading: 0, axis: 'z', dir: 1, laneCoord: 101.2,
      });
      trafficB.setPaint(0xffb347);

      // Position 4 pedestrians visibly on the foreground boardwalk & hotel sidewalk
      const pedSpots = [
        { x: 110.8, z: -18.5, h: 0.4 },
        { x: 112.4, z: -13.0, h: -0.2 },
        { x: 84.5, z: -17.0, h: 0.1 },
        { x: 84.8, z: -6.5, h: 3.0 },
      ];
      for (let i = 0; i < Math.min(pedSpots.length, this.traffic.pedestrians.length); i += 1) {
        const p = this.traffic.pedestrians[i];
        p.pos.set(pedSpots[i].x, 0, pedSpots[i].z);
        p.heading = pedSpots[i].h;
        p.rig.root.position.copy(p.pos);
        p.rig.root.rotation.y = p.heading;
        p.rig.animate(2.2, this.elapsed + i, false, false);
      }

      // Rich dual-wheel tire drift smoke trailing behind rear tires without obscuring taillights
      for (let i = 0; i < 6; i += 1) {
        this.vfx.spawnDriftSmoke(96.6 - i * 0.48, 0.22, -30.1 - i * 0.55);
        this.vfx.spawnDriftSmoke(98.4 - i * 0.48, 0.22, -30.8 - i * 0.55);
      }

      this.missions.completedMissions = new Set(['m1_coastal_pickup', 'm2_market_ambush', 'm3_boulevard_velocity']);
      this.missions.activeMissionIndex = 3;
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
          nitroActive: v.nitroActive || (v.drifting && v.speed > 22),
          wrecked: v.wrecked,
        });
      }
      this.renderer.dynamicLights.strobeRed.position.set(93.2, 3.2, -15.5);
      this.renderer.dynamicLights.strobeRed.intensity = 36;
      this.renderer.dynamicLights.strobeBlue.position.set(103.8, 3.2, -10.5);
      this.renderer.dynamicLights.strobeBlue.intensity = 36;

      // Closer, lower hero chase framing: Apex GT clear above dialogue banner, cruisers, heli, beach & pedestrians all visible!
      this.cameraRig.setImmediate(
        new THREE.Vector3(94.6, 3.35, -36.2),
        new THREE.Vector3(100.4, 2.35, 6.0),
        58,
      );
      this.ui.updateHud(0.016, this._uiState());
      return { state: 'chase' };
    }

    if (name === 'combat') {
      // 2-combat.jpg: Neon Night shootout + multi-layered car explosion + [F] STEAL prompt in Lantern Night Market!
      this.renderer.setMood('night');
      this.player.cash = 8650;
      this.player.health = 84;
      this.player.armor = 62;
      if (this.player.vehicle) this.player.exitVehicle(this.roadNetwork);
      this.player.selectWeapon(3); // Meridian Carbine
      this.player.pos.set(-5.0, 0, 74.8);
      this.player.heading = -0.22;
      this.player.aiming = true;
      this.player.rig.animate(2.5, this.elapsed, true, false);
      this.player.syncTransform();

      // Park a sleek Lagoon Cyan Mirage GT Coupe right within steal range (~4.1m) so [F] STEAL prompt shows clearly!
      const stealCar = new VehicleEntity(this.renderer.scene, 'mirage_coupe', -8.3, 77.6, 0.34, {
        role: 'parked',
        colorHex: 0x1de9d8,
      });
      this.vehicles.push(stealCar);

      this.police.setWantedLevel(3);
      this.police.inSight = true;
      this.missions.completedMissions = new Set(['m1_coastal_pickup']);
      this.missions.startMission(1, this._sysContext(), true);
      this.missions.missionEnemiesRemaining = 3;
      this.missions.showDialogue('Tessa Vance', 'TACTICIAN', 'Meridian ambush in Lantern Night Market! Steal [F] the coupe or pop Focus [C] and clear them!', 99);

      this.combat.clearMissionEnemies();
      const e1 = this.combat.spawnEnemy('cartel', -8.4, 93.0, 'm2_market_ambush');
      const e2 = this.combat.spawnEnemy('cartel', 3.4, 96.0, 'm2_market_ambush');
      const e3 = this.combat.spawnEnemy('police', -1.8, 102.5, 'm2_market_ambush');
      for (const e of [e1, e2, e3]) {
        e.heading = Math.atan2(this.player.pos.x - e.pos.x, this.player.pos.z - e.pos.z);
        e.rig.root.rotation.y = e.heading;
        e.rig.animate(1.5, this.elapsed, true, false);
      }

      // Burning/exploding SBPD Interceptor with multi-layer fireball cluster + smoke column + sparks!
      const burningCar = new VehicleEntity(this.renderer.scene, 'sbpd_interceptor', 2.8, 89.2, -0.58, {
        role: 'police',
        sirenActive: false,
        dispatchRole: 'RAM',
        callsign: 'UNIT-2',
      });
      this.vehicles.push(burningCar);
      this.police.policeUnits.push(burningCar);
      burningCar.wrecked = true;
      burningCar.visual.setWrecked(true);
      this.vfx.spawnExplosion(new THREE.Vector3(2.8, 0.85, 89.2), 1.3);
      this.vfx.spawnFirePlume(2.6, 1.35, 89.2, 1.25);

      const intactCop = this.police.spawnPoliceUnit(this.player.pos, 0, 'FLANK', { x: -11.4, z: 100.5, heading: -2.4 });
      intactCop.sirenActive = true;

      // Active tracer fire & crisp muzzle flash right from Mateo's Meridian Carbine barrel
      const muzzlePos = new THREE.Vector3(-4.9, 1.44, 75.85);
      this.vfx.spawnMuzzleFlash(muzzlePos, 1.35);
      this.vfx.spawnTracer(muzzlePos, new THREE.Vector3(-8.2, 1.3, 92.8), 0xffcf5a, 1.0);
      this.vfx.spawnTracer(new THREE.Vector3(3.1, 1.45, 95.8), new THREE.Vector3(-3.2, 1.55, 78.2), 0xff4b68, 1.0);
      this.vfx.spawnSparks(-8.2, 1.3, 92.8, 18, 11);
      this.combat.hitmarkerTimer = 0.2;

      this.renderer.pulseExplosionLight(new THREE.Vector3(2.8, 2.8, 89.2), 72);
      this.renderer.pulseMuzzleLight(muzzlePos);
      this.renderer.dynamicLights.strobeRed.position.set(-11.4, 3.2, 100.5);
      this.renderer.dynamicLights.strobeRed.intensity = 32;
      this.renderer.dynamicLights.strobeBlue.position.set(-10.0, 3.2, 100.5);
      this.renderer.dynamicLights.strobeBlue.intensity = 32;

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
        new THREE.Vector3(-3.15, 2.45, 70.1),
        new THREE.Vector3(-3.4, 1.9, 92.0),
        56,
      );
      this.ui.updateHud(0.016, this._uiState());
      return { state: 'combat' };
    }

    if (name === 'dashboard') {
      // 3-dashboard.jpg: Pause / Interactive City Map + 8 Story Missions + Crew + Solara Customs + Respect + Save Slots
      this.renderer.setMood('golden');
      this.player.cash = 14850;
      this.player.pos.set(96, 0, -18);
      this.missions.completedMissions = new Set(['m1_coastal_pickup', 'm2_market_ambush', 'm3_boulevard_velocity', 'm4_hotwire_heist']);
      this.missions.activeMissionIndex = 4;
      this.missions.collectedPalms = new Set(['gp1', 'gp2', 'gp3', 'gp4', 'gp5']);
      this.garageShop.upgrades = { engine: 2, handling: 2, armor: 1, nitro: 2 };
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

    if (name === 'title') {
      // 4-title.jpg: Cinematic Main Menu over vibrant Golden-Hour coastal panorama of Solara Bay!
      this.renderer.setMood('golden');
      this.heroCar.repairFull();
      this.heroCar.setPaint(0xff4b68);
      this.heroCar.pos.set(100.6, 0, -24);
      this.heroCar.heading = 0.25;
      this.heroCar.syncTransform();

      const mood = MOOD_PRESETS.golden;
      this.city.update(this.elapsed, mood);
      this.cityProps.update(this.elapsed, mood, this.missions.collectedPalms);
      this.renderer.updateLighting(this.heroCar.pos, this.elapsed);
      for (const v of this.vehicles) {
        v.visual.updateVisuals({
          elapsed: this.elapsed,
          nightFactor: mood.nightFactor,
          speed: 0,
          steerAngle: 0,
          braking: false,
          sirenActive: false,
          nitroActive: false,
          wrecked: false,
        });
      }
      this.setMode('start');
      this.cameraRig.setImmediate(
        new THREE.Vector3(88.5, 13.5, -48.0),
        new THREE.Vector3(114.0, 4.2, 26.0),
        56,
      );
      return { state: 'title' };
    }

    throw new Error(`Unknown state: ${name}`);
  }

  _checkUrlShotPreset() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot && ['chase', 'combat', 'dashboard', 'title'].includes(shot)) {
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
