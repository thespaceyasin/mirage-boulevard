// 8-Mission Story Campaign Director, Coastal Street Race Circuit,
// 10 Golden Palm Collectibles, Character Portrait Dialogue Queue,
// and Career Progression % (delegating Crew & Garage systems).

import * as THREE from 'three';
import { CITY_CONFIG, GOLDEN_PALMS, MISSIONS } from '../engine/gameConfig.js';
import { VehicleEntity } from '../entities/vehiclePhysics.js';
import { SyndicateCrewSystem } from './crewSystem.js';
import { SolaraCustomsGarage } from './garageShop.js';

export class MissionDirector {
  constructor(scene, roadNetwork, crewSystem = null, garageShop = null) {
    this.scene = scene;
    this.roadNetwork = roadNetwork;
    this.crew = crewSystem || new SyndicateCrewSystem();
    this.garage = garageShop || new SolaraCustomsGarage();

    this.activeMissionIndex = 0;
    this.completedMissions = new Set();
    this.collectedPalms = new Set();
    this.raceWins = 0;
    this.freeRoamMode = false;

    this.missionStage = 'active'; // active | pickup | hold | race
    this.raceCheckpointIdx = 0;
    this.holdTimer = 0;
    this.heistVehicle = null;
    this.missionEnemiesRemaining = 0;

    // Custom GPS waypoint (clicked on Interactive City Map)
    this.customWaypoint = null;

    // Active character dialogue banner
    this.activeDialogue = null;
    this.dialogueTimer = 0;
  }

  get currentMission() {
    if (this.freeRoamMode || this.activeMissionIndex >= MISSIONS.length) return null;
    return MISSIONS[this.activeMissionIndex];
  }

  get isFocusActive() {
    return this.crew.isFocusActive;
  }

  get isOverdriveActive() {
    return this.crew.isOverdriveActive;
  }

  get upgrades() {
    return this.garage.upgrades;
  }

  set upgrades(val) {
    this.garage.upgrades = val;
  }

  get nearGarage() {
    return this.garage.nearGarage;
  }

  getCareerPercent() {
    const missionPct = (this.completedMissions.size / MISSIONS.length) * 60;
    const palmPct = (this.collectedPalms.size / GOLDEN_PALMS.length) * 20;
    const upgPct = this.garage.getUpgradeProgressRatio() * 15;
    const racePct = Math.min(1, this.raceWins) * 5;
    return Math.min(100, Math.round(missionPct + palmPct + upgPct + racePct));
  }

  showDialogue(speaker, role, text, duration = 6.5) {
    this.activeDialogue = { speaker, role, text };
    this.dialogueTimer = duration;
  }

  startMission(index, context, silent = false) {
    if (index < 0 || index >= MISSIONS.length) return;
    this.freeRoamMode = false;
    this.activeMissionIndex = index;
    const m = MISSIONS[index];
    this.missionStage = m.type === 'heist' ? 'pickup' : m.type;
    this.raceCheckpointIdx = 0;
    this.holdTimer = 0;
    this.missionEnemiesRemaining = 0;
    this.customWaypoint = null;

    if (context.combat) context.combat.clearMissionEnemies();

    if (m.type === 'eliminate' || m.type === 'hold') {
      const count = m.enemyCount || 5;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        const rad = 7 + (i % 2) * 5;
        const ex = m.target.x + Math.cos(angle) * rad;
        const ez = m.target.z + Math.sin(angle) * rad;
        const p = new THREE.Vector3(ex, 0, ez);
        this.roadNetwork.resolveCircleCollision(p, 1.0);
        context.combat.spawnEnemy('cartel', p.x, p.z, m.id);
      }
      this.missionEnemiesRemaining = count;
    } else if (m.type === 'heist' && m.pickup) {
      this.heistVehicle = new VehicleEntity(this.scene, 'apex_gt', m.pickup.x, m.pickup.z, 0.3, {
        role: 'mission',
        colorHex: 0xffae2b,
      });
      context.vehicles.push(this.heistVehicle);
    }

    if (!silent) {
      this.showDialogue(m.speaker, m.speakerRole, m.brief, 7.5);
      if (context.showToast) context.showToast(`MISSION ${m.num}: ${m.title}`);
    }
  }

  enterFreeRoam(context) {
    this.freeRoamMode = true;
    this.customWaypoint = null;
    if (context.combat) context.combat.clearMissionEnemies();
    this.showDialogue(
      'Mateo Cruz',
      'PROTAGONIST',
      'Free Roam Solara Bay — hijack any ride, hit Stunt Ramps, hunt Golden Palms, or visit Solara Customs [G]!',
      6.5,
    );
  }

  getActiveTargetPos() {
    if (this.customWaypoint) return this.customWaypoint;
    const m = this.currentMission;
    if (!m) return CITY_CONFIG.raceStartPos;
    if (m.type === 'race' && m.checkpoints) {
      return m.checkpoints[this.raceCheckpointIdx] || m.target;
    }
    if (m.type === 'heist' && this.missionStage === 'pickup' && m.pickup) {
      return m.pickup;
    }
    return m.target;
  }

  getObjectiveText() {
    const m = this.currentMission;
    if (!m) return 'Free Roam Solara Bay — Explore, Drift, Race or Hunt Golden Palms';
    if (m.type === 'race') {
      return `Coastal Street Race: Checkpoint ${this.raceCheckpointIdx + 1} / ${m.checkpoints.length}`;
    }
    if (m.type === 'eliminate') {
      return `${m.objective} (${this.missionEnemiesRemaining} left)`;
    }
    if (m.type === 'hold') {
      const rem = Math.max(0, Math.ceil((m.holdSeconds || 22) - this.holdTimer));
      return `${m.objective} (${rem}s remaining)`;
    }
    if (m.type === 'heist') {
      return this.missionStage === 'pickup'
        ? 'Steal the gold Solara Apex GT in Palm Heights'
        : 'Deliver the stolen Apex GT to Solara Customs Garage';
    }
    return m.objective;
  }

  getMissionProgressRatio() {
    const m = this.currentMission;
    if (!m) return null;
    if (m.type === 'race') return this.raceCheckpointIdx / m.checkpoints.length;
    if (m.type === 'hold') return Math.min(1, this.holdTimer / (m.holdSeconds || 22));
    if (m.type === 'eliminate' && m.enemyCount) {
      return (m.enemyCount - this.missionEnemiesRemaining) / m.enemyCount;
    }
    return null;
  }

  onEnemyKilled(enemy, context) {
    const m = this.currentMission;
    if (!m || !enemy.missionTag || enemy.missionTag !== m.id) return;
    this.missionEnemiesRemaining = Math.max(0, this.missionEnemiesRemaining - 1);
    if (m.type === 'eliminate' && this.missionEnemiesRemaining <= 0) {
      this._completeCurrentMission(context);
    }
  }

  _completeCurrentMission(context) {
    const m = this.currentMission;
    if (!m) return;
    this.completedMissions.add(m.id);
    if (m.type === 'race') this.raceWins += 1;
    context.player.cash += m.reward;
    if (context.audio) context.audio.playMissionComplete();
    if (context.showToast) context.showToast(`MISSION PASSED: ${m.title} (+$${m.reward.toLocaleString()})`);

    if (context.autoSave) context.autoSave();

    const nextIdx = this.activeMissionIndex + 1;
    if (nextIdx < MISSIONS.length) {
      this.startMission(nextIdx, context, false);
    } else {
      this.activeMissionIndex = MISSIONS.length;
      this.showDialogue('Mateo Cruz', 'PROTAGONIST', 'Solara Bay belongs to our syndicate now. Mirage Boulevard is ours!', 7.5);
    }
  }

  update(dt, context) {
    const { player, cityProps, police, audio } = context;

    this.crew.updateCrewCooldowns(dt);

    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.activeDialogue = null;
    }

    // Collect Golden Palms
    for (let i = 0; i < GOLDEN_PALMS.length; i += 1) {
      const gp = GOLDEN_PALMS[i];
      if (this.collectedPalms.has(gp.id)) continue;
      if (Math.hypot(player.pos.x - gp.x, player.pos.z - gp.z) < 4.0) {
        this.collectedPalms.add(gp.id);
        player.cash += 500;
        if (audio) audio.playPickup();
        if (context.showToast) context.showToast(`GOLDEN PALM COLLECTED (${this.collectedPalms.size}/10) +$500`);
      }
    }

    // Garage proximity check
    this.garage.updateGarageProximity(player.pos);

    // Active Mission objectives
    const m = this.currentMission;
    const target = this.getActiveTargetPos();
    if (cityProps) {
      const colorHex = this.customWaypoint ? 0x1de9d8 : m?.type === 'race' ? 0xff5e6c : 0xffb347;
      cityProps.setBeacon(target.x, target.z, colorHex, true);
    }

    if (this.customWaypoint && Math.hypot(player.pos.x - this.customWaypoint.x, player.pos.z - this.customWaypoint.z) < 10) {
      this.customWaypoint = null;
    }

    if (!m) return;

    const distToTarget = Math.hypot(player.pos.x - target.x, player.pos.z - target.z);

    if (m.type === 'deliver' && distToTarget < 10) {
      this._completeCurrentMission(context);
    } else if (m.type === 'race') {
      if (distToTarget < 11) {
        this.raceCheckpointIdx += 1;
        if (audio) audio.playPickup();
        if (this.raceCheckpointIdx >= m.checkpoints.length) {
          this._completeCurrentMission(context);
        } else if (context.showToast) {
          context.showToast(`CHECKPOINT ${this.raceCheckpointIdx} / ${m.checkpoints.length}`);
        }
      }
    } else if (m.type === 'heist') {
      if (this.missionStage === 'pickup' && player.vehicle && (player.vehicle === this.heistVehicle || player.vehicle.specId === 'apex_gt')) {
        this.missionStage = 'deliver';
        police.setWantedLevel(Math.max(police.wantedLevel, m.wantedBoost || 3));
        this.showDialogue('Rico Vega', 'WHEELMAN', 'SBPD spotted the prototype! Floor it to Solara Customs Garage in Torque Quarter!', 6);
      } else if (this.missionStage === 'deliver' && distToTarget < 13) {
        police.clearHeat();
        this._completeCurrentMission(context);
      }
    } else if (m.type === 'hold') {
      if (distToTarget < 16) {
        this.holdTimer += dt;
        if (this.holdTimer >= (m.holdSeconds || 22)) {
          this._completeCurrentMission(context);
        }
      }
    }
  }

  serialize() {
    return {
      activeMissionIndex: this.activeMissionIndex,
      completedMissions: Array.from(this.completedMissions),
      collectedPalms: Array.from(this.collectedPalms),
      raceWins: this.raceWins,
      freeRoamMode: this.freeRoamMode,
      ...this.garage.serializeGarageState(),
    };
  }

  deserialize(data, context) {
    if (!data) return;
    this.completedMissions = new Set(data.completedMissions || []);
    this.collectedPalms = new Set(data.collectedPalms || []);
    this.raceWins = data.raceWins || 0;
    this.freeRoamMode = Boolean(data.freeRoamMode);
    this.garage.deserializeGarageState(data);
    const idx = Math.min(MISSIONS.length, data.activeMissionIndex ?? 0);
    if (!this.freeRoamMode && idx < MISSIONS.length) {
      this.startMission(idx, context, true);
    } else {
      this.activeMissionIndex = idx;
    }
  }
}
