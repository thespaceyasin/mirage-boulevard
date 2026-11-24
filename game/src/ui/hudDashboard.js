// Live Gameplay HUD, Crisp Vector Minimap, SBPD Tactical Dispatch Board,
// Character Dialogue Portraits, Solara Customs Garage Shop, and
// Pause / Interactive City Map / Career Progression & Save Slots Dashboard.

import {
  CITY_CONFIG,
  CREW_ABILITIES,
  DISTRICTS,
  GARAGE_PAINTS,
  GARAGE_UPGRADES,
  GOLDEN_PALMS,
  MISSIONS,
} from '../engine/gameConfig.js';
import { MOOD_PRESETS } from '../engine/rendererPipeline.js';
import { drawCharacterPortrait } from '../world/proceduralTextures.js';

export class HudDashboard {
  constructor(callbacks) {
    this.cb = callbacks;
    this.toastTimer = 0;
    this.lastDialogueSpeaker = '';

    this.el = {
      hudRoot: document.getElementById('hud-root'),
      startOverlay: document.getElementById('start-overlay'),
      dashboardOverlay: document.getElementById('dashboard-overlay'),
      garageOverlay: document.getElementById('garage-overlay'),
      wastedOverlay: document.getElementById('wasted-overlay'),
      fxFlash: document.getElementById('fx-flash'),
      focusVignette: document.getElementById('focus-vignette'),

      missionTag: document.getElementById('mission-tag'),
      missionDist: document.getElementById('mission-dist'),
      missionTitle: document.getElementById('mission-title'),
      missionObj: document.getElementById('mission-obj'),
      missionProgWrap: document.getElementById('mission-progress-wrap'),
      missionProgBar: document.getElementById('mission-progress-bar'),

      dispatchCard: document.getElementById('dispatch-card'),
      dispatchState: document.getElementById('dispatch-state'),
      dispatchUnits: document.getElementById('dispatch-units'),
      evasionWrap: document.getElementById('evasion-bar-wrap'),
      evasionFill: document.getElementById('evasion-bar-fill'),

      toastBanner: document.getElementById('toast-banner'),
      districtName: document.getElementById('district-name'),
      clockDisplay: document.getElementById('clock-display'),
      moodBadge: document.getElementById('mood-badge'),
      wantedStars: Array.from(document.querySelectorAll('.wanted-star')),
      cashRow: document.getElementById('cash-row'),

      weaponIcon: document.getElementById('weapon-icon'),
      weaponName: document.getElementById('weapon-name'),
      weaponAmmo: document.getElementById('weapon-ammo'),
      weaponSlots: Array.from(document.querySelectorAll('.w-slot')),

      crosshair: document.getElementById('crosshair'),
      hitmarker: document.getElementById('hitmarker'),
      interactPrompt: document.getElementById('interact-prompt'),
      dialogueBanner: document.getElementById('dialogue-banner'),
      dialoguePortrait: document.getElementById('dialogue-portrait'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueText: document.getElementById('dialogue-text'),

      minimapCanvas: document.getElementById('minimap-canvas'),
      hpFill: document.getElementById('hp-fill'),
      hpVal: document.getElementById('hp-val'),
      armorFill: document.getElementById('armor-fill'),
      armorVal: document.getElementById('armor-val'),

      speedoPanel: document.getElementById('speedo-panel'),
      speedValue: document.getElementById('speed-value'),
      gearValue: document.getElementById('gear-value'),
      vehicleLabel: document.getElementById('vehicle-label'),
      nitroFill: document.getElementById('nitro-fill'),
      vehHpFill: document.getElementById('veh-hp-fill'),
      driftBadge: document.getElementById('drift-badge'),
      radioStation: document.getElementById('radio-station'),

      crewSlots: {
        blackout: document.getElementById('crew-z'),
        nitro: document.getElementById('crew-x'),
        focus: document.getElementById('crew-c'),
      },

      // Dashboard elements
      dashCareerPct: document.getElementById('dash-career-pct'),
      dashCareerFill: document.getElementById('dash-career-fill'),
      dashCash: document.getElementById('dash-cash'),
      dashMissionsCount: document.getElementById('dash-missions-count'),
      dashPalmsCount: document.getElementById('dash-palms-count'),
      dashHeatPeak: document.getElementById('dash-heat-peak'),
      dashMissionList: document.getElementById('dash-mission-list'),
      dashCrewList: document.getElementById('dash-crew-list'),
      dashSaveSlots: document.getElementById('dash-save-slots'),
      cityMapCanvas: document.getElementById('city-map-canvas'),
      btnMoodCycle: document.getElementById('btn-mood-cycle'),
      btnAudioToggle: document.getElementById('btn-audio-toggle'),

      // Garage elements
      garageCash: document.getElementById('garage-cash'),
      garagePaints: document.getElementById('garage-paints'),
      garageUpgrades: document.getElementById('garage-upgrades'),

      // Start buttons
      btnPlay: document.getElementById('btn-play'),
      btnContinue: document.getElementById('btn-continue'),
      btnStartMap: document.getElementById('btn-start-map'),
    };

    this._bindButtons();
  }

  _bindButtons() {
    this.el.btnPlay.addEventListener('click', () => this.cb.onStartGame(false));
    this.el.btnContinue.addEventListener('click', () => this.cb.onStartGame(true));
    this.el.btnStartMap.addEventListener('click', () => this.cb.onOpenDashboardFromStart());
    document.getElementById('btn-resume').addEventListener('click', () => this.cb.onToggleDashboard(false));
    document.getElementById('btn-garage-close').addEventListener('click', () => this.cb.onToggleGarage(false));
    document.getElementById('btn-garage-repair').addEventListener('click', () => this.cb.onGarageRepair());
    document.getElementById('btn-respawn').addEventListener('click', () => this.cb.onRespawn());

    this.el.btnMoodCycle.addEventListener('click', () => this.cb.onCycleMood());
    this.el.btnAudioToggle.addEventListener('click', () => this.cb.onToggleAudio());

    for (const [id, btn] of Object.entries(this.el.crewSlots)) {
      btn.addEventListener('click', () => this.cb.onActivateCrew(id));
    }

    // Click on Interactive City Map sets GPS waypoint
    this.el.cityMapCanvas.addEventListener('click', (e) => {
      const rect = this.el.cityMapCanvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const wx = -240 + nx * 460;
      const wz = -240 + ny * 480;
      this.cb.onSetMapWaypoint(wx, wz);
    });
  }

  setModeVisibility({ mode, hasSaves }) {
    this.el.startOverlay.classList.toggle('hidden', mode !== 'start');
    this.el.hudRoot.classList.toggle('hidden', mode !== 'play');
    this.el.dashboardOverlay.classList.toggle('hidden', mode !== 'dashboard');
    this.el.garageOverlay.classList.toggle('hidden', mode !== 'garage');
    this.el.wastedOverlay.classList.toggle('hidden', mode !== 'wasted');
    this.el.btnContinue.classList.toggle('hidden', !hasSaves);
  }

  showToast(text, duration = 3.2) {
    this.el.toastBanner.textContent = text;
    this.el.toastBanner.classList.remove('hidden');
    this.toastTimer = duration;
  }

  triggerScreenFlash() {
    if (this.el.fxFlash.animate) {
      this.el.fxFlash.animate([{ opacity: 0.72 }, { opacity: 0 }], { duration: 130, easing: 'ease-out' });
    }
  }

  updateHud(dt, state) {
    const {
      player,
      roadNetwork,
      police,
      missions,
      combat,
      audio,
      renderer,
      interactText,
      vehicles,
    } = state;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toastBanner.classList.add('hidden');
    }

    this.el.focusVignette.classList.toggle('active', missions.isFocusActive);

    // Top-right district / time / wanted / cash / weapon
    const mood = MOOD_PRESETS[renderer.currentMood] || MOOD_PRESETS.golden;
    this.el.districtName.textContent = roadNetwork.getDistrictName(player.pos.x, player.pos.z);
    this.el.clockDisplay.textContent = mood.clock;
    this.el.moodBadge.textContent = mood.label;
    this.el.cashRow.textContent = `$${Math.floor(player.cash).toLocaleString()}`;

    for (let i = 0; i < 5; i += 1) {
      const star = this.el.wantedStars[i];
      const active = i < police.wantedLevel;
      star.classList.toggle('active', active);
      star.classList.toggle('flashing', active && police.inSight);
    }

    const w = player.currentWeapon;
    const ammo = player.currentAmmo;
    this.el.weaponIcon.textContent = w.glyph;
    this.el.weaponName.textContent = player.reloadTimer > 0 ? 'RELOADING...' : w.name;
    this.el.weaponAmmo.innerHTML = `${ammo.mag} <span>/ ${w.id === 'pistol' ? '&infin;' : ammo.reserve}</span>`;
    for (let i = 0; i < this.el.weaponSlots.length; i += 1) {
      this.el.weaponSlots[i].classList.toggle('active', i === player.weaponIndex);
    }

    // Top-left Mission card
    const m = missions.currentMission;
    const target = missions.getActiveTargetPos();
    const dist = Math.round(Math.hypot(player.pos.x - target.x, player.pos.z - target.z));
    this.el.missionTag.textContent = m ? `MISSION ${m.num} / ${MISSIONS.length}` : 'SOLARA BAY FREE ROAM';
    this.el.missionTitle.textContent = m ? m.title : 'CITY DOMINATED';
    this.el.missionObj.textContent = missions.getObjectiveText();
    this.el.missionDist.textContent = `${dist}m`;

    const prog = missions.getMissionProgressRatio();
    if (prog !== null) {
      this.el.missionProgWrap.classList.remove('hidden');
      this.el.missionProgBar.style.width = `${Math.round(prog * 100)}%`;
    } else {
      this.el.missionProgWrap.classList.add('hidden');
    }

    // Police Dispatch Tactical Board
    if (police.wantedLevel > 0) {
      this.el.dispatchCard.classList.remove('hidden');
      this.el.dispatchState.textContent = police.inSight ? 'PURSUIT' : 'EVADING';
      this.el.dispatchState.classList.toggle('evading', !police.inSight);
      const summary = police.getActiveDispatchSummary();
      this.el.dispatchUnits.innerHTML = summary
        .map((u) => `<div class="dispatch-line"><span>${u.callsign}</span><span class="dispatch-role ${u.kind}">${u.role}</span></div>`)
        .join('');
      this.el.evasionWrap.classList.toggle('hidden', police.inSight || police.evasionProgress <= 0.01);
      this.el.evasionFill.style.width = `${Math.round(police.evasionProgress * 100)}%`;
    } else {
      this.el.dispatchCard.classList.add('hidden');
    }

    // Crosshair & Hitmarker (on foot or aiming)
    const showCrosshair = !player.vehicle || player.aiming;
    this.el.crosshair.classList.toggle('hidden', !showCrosshair);
    this.el.hitmarker.classList.toggle('hidden', combat.hitmarkerTimer <= 0);

    // Contextual Interaction Prompt
    if (interactText) {
      this.el.interactPrompt.textContent = interactText;
      this.el.interactPrompt.classList.remove('hidden');
    } else {
      this.el.interactPrompt.classList.add('hidden');
    }

    // Dialogue Banner with Procedural Portrait
    if (missions.activeDialogue) {
      this.el.dialogueBanner.classList.remove('hidden');
      this.el.dialogueSpeaker.innerHTML = `${missions.activeDialogue.speaker.toUpperCase()} <span>// ${missions.activeDialogue.role}</span>`;
      this.el.dialogueText.textContent = missions.activeDialogue.text;
      if (this.lastDialogueSpeaker !== missions.activeDialogue.speaker) {
        this.lastDialogueSpeaker = missions.activeDialogue.speaker;
        drawCharacterPortrait(this.el.dialoguePortrait, missions.activeDialogue.speaker);
      }
    } else {
      this.el.dialogueBanner.classList.add('hidden');
    }

    // Bottom-Left Vitals
    this.el.hpFill.style.width = `${Math.round((player.health / player.maxHealth) * 100)}%`;
    this.el.hpVal.textContent = Math.ceil(player.health);
    this.el.armorFill.style.width = `${Math.round((player.armor / player.maxArmor) * 100)}%`;
    this.el.armorVal.textContent = Math.ceil(player.armor);

    // Bottom-Right Speedometer
    if (player.vehicle) {
      const v = player.vehicle;
      this.el.speedoPanel.classList.remove('hidden');
      const mph = Math.round(v.speed * 2.45);
      this.el.speedValue.textContent = mph;
      this.el.gearValue.textContent = v.forwardSpeed < -1 ? 'R' : Math.min(6, Math.max(1, Math.ceil(mph / 22)));
      this.el.vehicleLabel.textContent = v.spec.name;
      this.el.nitroFill.style.width = `${Math.round(v.nitro)}%`;
      this.el.vehHpFill.style.width = `${Math.round((v.health / v.maxHealth) * 100)}%`;
      this.el.driftBadge.classList.toggle('hidden', !v.drifting);
    } else {
      this.el.speedoPanel.classList.add('hidden');
    }

    // Crew Abilities cooldown bars
    for (const ab of CREW_ABILITIES) {
      const slot = this.el.crewSlots[ab.id];
      const st = missions.crewState[ab.id];
      slot.classList.toggle('active', st.activeTimer > 0);
      slot.classList.toggle('cooldown', st.cooldownTimer > 0 && st.activeTimer <= 0);
      const fillRatio = st.activeTimer > 0
        ? st.activeTimer / ab.duration
        : st.cooldownTimer > 0
          ? 1 - st.cooldownTimer / ab.cooldown
          : 1;
      slot.querySelector('.crew-cd-bar > div').style.width = `${Math.round(fillRatio * 100)}%`;
    }

    // Radio
    this.el.radioStation.textContent = audio.currentStation.name;

    // Crisp Vector Minimap
    this._renderMinimap(player, roadNetwork, police, missions, vehicles);
  }

  _renderMinimap(player, roadNetwork, police, missions, vehicles) {
    const canvas = this.el.minimapCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const scale = 0.72; // pixels per world meter

    ctx.fillStyle = '#0c182c';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.56;
    const toMap = (wx, wz) => ({
      x: cx + (wx - player.pos.x) * scale,
      y: cy + (wz - player.pos.z) * scale,
    });

    // Golden beach & turquoise coastal ocean on right side
    const beachStart = toMap(CITY_CONFIG.beachStartX, 0).x;
    const waterStart = toMap(CITY_CONFIG.waterStartX, 0).x;
    ctx.fillStyle = '#3a372a';
    ctx.fillRect(beachStart, 0, Math.max(0, waterStart - beachStart), h);
    ctx.fillStyle = '#0e5b78';
    ctx.fillRect(waterStart, 0, w - waterStart, h);
    ctx.fillStyle = '#1de9d8';
    ctx.fillRect(waterStart - 2, 0, 2, h);

    // City blocks
    ctx.fillStyle = '#18243a';
    for (let i = 0; i < roadNetwork.buildings.length; i += 1) {
      const b = roadNetwork.buildings[i];
      const p0 = toMap(b.minX, b.minZ);
      const p1 = toMap(b.maxX, b.maxZ);
      if (p1.x < 0 || p0.x > w || p1.y < 0 || p0.y > h) continue;
      ctx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    }

    // Roads
    ctx.strokeStyle = '#3a4b68';
    ctx.lineWidth = CITY_CONFIG.roadWidth * scale;
    for (const ax of CITY_CONFIG.avenuesX) {
      const a0 = toMap(ax, -210);
      const a1 = toMap(ax, 210);
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.stroke();
    }
    for (const sz of CITY_CONFIG.streetsZ) {
      const s0 = toMap(-210, sz);
      const s1 = toMap(112, sz);
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }

    // GPS Route Line to active mission / waypoint
    const target = missions.getActiveTargetPos();
    const route = roadNetwork.getGpsPolyline(player.pos.x, player.pos.z, target.x, target.z);
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 3;
    ctx.beginPath();
    route.forEach((pt, idx) => {
      const m = toMap(pt.x, pt.z);
      if (idx === 0) ctx.moveTo(m.x, m.y);
      else ctx.lineTo(m.x, m.y);
    });
    ctx.stroke();

    // Garage pin (green square)
    const gp = toMap(CITY_CONFIG.garagePos.x, CITY_CONFIG.garagePos.z);
    ctx.fillStyle = '#2ee59d';
    ctx.fillRect(gp.x - 4, gp.y - 4, 8, 8);

    // Objective pin (glowing gold circle)
    const tp = toMap(target.x, target.z);
    const clampedX = Math.max(8, Math.min(w - 8, tp.x));
    const clampedY = Math.max(8, Math.min(h - 8, tp.y));
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(clampedX, clampedY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Police units & Helicopter
    for (let i = 0; i < police.policeUnits.length; i += 1) {
      const u = police.policeUnits[i];
      if (u.wrecked) continue;
      const mp = toMap(u.pos.x, u.pos.z);
      ctx.fillStyle = i % 2 === 0 ? '#ff2a55' : '#3291ff';
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (police.heliActive) {
      const hp = toMap(police.heliPos.x, police.heliPos.z);
      ctx.strokeStyle = '#ffd25a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player heading arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-player.heading + Math.PI);
    ctx.fillStyle = '#1de9d8';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Subtle police wanted border pulse
    if (police.wantedLevel > 0) {
      ctx.strokeStyle = Math.floor(performance.now() / 280) % 2 === 0 ? '#ff2a55' : '#3291ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    }
  }

  renderDashboard(state) {
    const { player, missions, police, saveManager, roadNetwork, renderer, audio } = state;
    const pct = missions.getCareerPercent();
    this.el.dashCareerPct.textContent = `${pct}%`;
    this.el.dashCareerFill.style.width = `${pct}%`;
    this.el.dashCash.textContent = `$${Math.floor(player.cash).toLocaleString()}`;
    this.el.dashMissionsCount.textContent = `${missions.completedMissions.size} / ${MISSIONS.length}`;
    this.el.dashPalmsCount.textContent = `${missions.collectedPalms.size} / ${GOLDEN_PALMS.length}`;
    this.el.dashHeatPeak.textContent = `${police.heatPeak}★`;

    const mood = MOOD_PRESETS[renderer.currentMood] || MOOD_PRESETS.golden;
    this.el.btnMoodCycle.textContent = `TIME: ${mood.label}`;
    this.el.btnAudioToggle.textContent = `AUDIO: ${audio.muted ? 'OFF' : 'ON'}`;

    // 8 Story Missions Grid
    this.el.dashMissionList.innerHTML = MISSIONS.map((m, idx) => {
      const done = missions.completedMissions.has(m.id);
      const active = idx === missions.activeMissionIndex;
      const cls = done ? 'done' : active ? 'active' : '';
      const badge = done ? 'DONE' : active ? 'ACTIVE' : 'LOCKED';
      return `<div class="m-row ${cls}"><span>${m.num}. ${m.title}</span><span class="m-badge">${badge}</span></div>`;
    }).join('');

    // Crew Roster
    this.el.dashCrewList.innerHTML = CREW_ABILITIES.map((c) => (
      `<div class="crew-card"><strong>[${c.key}] ${c.member}</strong><span>${c.title}</span></div>`
    )).join('');

    // Save Slots
    const slots = saveManager.listSlots();
    this.el.dashSaveSlots.innerHTML = slots.map((s) => {
      const info = s.data
        ? `${s.data.careerPct ?? 0}% · $${Math.floor(s.data.cash ?? 0).toLocaleString()} · ${s.data.savedAt || ''}`
        : 'Empty Slot';
      return `
        <div class="save-row">
          <div class="save-meta"><strong>${s.label}</strong><span>${info}</span></div>
          <div class="save-btns">
            <button type="button" data-save="${s.id}">SAVE</button>
            <button type="button" class="load-btn" data-load="${s.id}" ${s.data ? '' : 'disabled'}>LOAD</button>
          </div>
        </div>
      `;
    }).join('');

    this.el.dashSaveSlots.querySelectorAll('[data-save]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onSaveSlot(btn.dataset.save));
    });
    this.el.dashSaveSlots.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onLoadSlot(btn.dataset.load));
    });

    // Large Interactive Vector City Map (660x460)
    this._renderFullCityMap(player, roadNetwork, missions, police);
  }

  _renderFullCityMap(player, roadNetwork, missions, police) {
    const canvas = this.el.cityMapCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const toPx = (wx, wz) => ({
      x: ((wx + 240) / 460) * w,
      y: ((wz + 240) / 480) * h,
    });

    // Deep coastal ocean + land base
    ctx.fillStyle = '#0c233a';
    ctx.fillRect(0, 0, w, h);

    const beachX = toPx(CITY_CONFIG.beachStartX, 0).x;
    const waterX = toPx(CITY_CONFIG.waterStartX, 0).x;
    ctx.fillStyle = '#111a2c';
    ctx.fillRect(0, 0, beachX, h);
    ctx.fillStyle = '#4c4430';
    ctx.fillRect(beachX, 0, waterX - beachX, h);

    // Ocean gradient & Marina piers
    const oceanGrad = ctx.createLinearGradient(waterX, 0, w, 0);
    oceanGrad.addColorStop(0, '#14889e');
    oceanGrad.addColorStop(1, '#092d52');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(waterX, 0, w - waterX, h);

    ctx.fillStyle = '#8b6844';
    for (const pz of [92, 134, 174]) {
      const p0 = toPx(120, pz - 4);
      const p1 = toPx(176, pz + 4);
      ctx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    }

    // District subtle tint fills
    for (const d of DISTRICTS) {
      const a = toPx(d.bounds.x0, d.bounds.z0);
      const b = toPx(d.bounds.x1, d.bounds.z1);
      ctx.fillStyle = `${d.accent}12`;
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeStyle = `${d.accent}44`;
      ctx.lineWidth = 1;
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    // Buildings footprints
    ctx.fillStyle = '#20304d';
    for (const b of roadNetwork.buildings) {
      const p0 = toPx(b.minX, b.minZ);
      const p1 = toPx(b.maxX, b.maxZ);
      ctx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    }

    // Roads
    ctx.strokeStyle = '#4a6085';
    ctx.lineWidth = 9;
    for (const ax of CITY_CONFIG.avenuesX) {
      const a0 = toPx(ax, -210);
      const a1 = toPx(ax, 210);
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.stroke();
    }
    for (const sz of CITY_CONFIG.streetsZ) {
      const s0 = toPx(-210, sz);
      const s1 = toPx(112, sz);
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }

    // GPS Path
    const target = missions.getActiveTargetPos();
    const route = roadNetwork.getGpsPolyline(player.pos.x, player.pos.z, target.x, target.z);
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    route.forEach((pt, idx) => {
      const m = toPx(pt.x, pt.z);
      if (idx === 0) ctx.moveTo(m.x, m.y);
      else ctx.lineTo(m.x, m.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // District Labels
    ctx.font = '800 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const mid = toPx((d.bounds.x0 + d.bounds.x1) * 0.5, (d.bounds.z0 + d.bounds.z1) * 0.5);
      ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
      ctx.fillRect(mid.x - 68, mid.y - 9, 136, 17);
      ctx.fillStyle = d.accent;
      ctx.fillText(d.name, mid.x, mid.y + 4);
    }

    // Golden Palms
    ctx.fillStyle = '#ffe766';
    for (const gp of GOLDEN_PALMS) {
      if (missions.collectedPalms.has(gp.id)) continue;
      const p = toPx(gp.x, gp.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Garage & Street Race icons
    const drawPin = (wx, wz, color, label) => {
      const p = toPx(wx, wz);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#09111f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#09111f';
      ctx.font = '900 9px "Segoe UI", sans-serif';
      ctx.fillText(label, p.x, p.y + 3);
    };
    drawPin(CITY_CONFIG.garagePos.x, CITY_CONFIG.garagePos.z, '#2ee59d', 'G');
    drawPin(CITY_CONFIG.raceStartPos.x, CITY_CONFIG.raceStartPos.z, '#ff5e6c', 'R');
    drawPin(target.x, target.z, '#ffb347', 'M');

    // Police units
    for (const u of police.policeUnits) {
      if (u.wrecked) continue;
      const p = toPx(u.pos.x, u.pos.z);
      ctx.fillStyle = '#ff2a55';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Marker
    const pp = toPx(player.pos.x, player.pos.z);
    ctx.fillStyle = '#1de9d8';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  renderGarage(state) {
    const { player, missions } = state;
    this.el.garageCash.textContent = `$${Math.floor(player.cash).toLocaleString()}`;

    this.el.garagePaints.innerHTML = GARAGE_PAINTS.map((p) => {
      const owned = missions.ownedPaints.has(p.id);
      const active = missions.activePaintId === p.id;
      return `
        <button class="paint-btn ${owned ? 'owned' : ''}" data-paint="${p.id}" type="button">
          <span class="paint-swatch" style="background:${p.hex}"></span>
          <span>${p.name}</span>
          <span style="margin-left:auto;color:${active ? '#1de9d8' : '#ffb347'}">${active ? 'EQUIPPED' : owned ? 'APPLY' : '$' + p.price}</span>
        </button>
      `;
    }).join('');

    this.el.garagePaints.querySelectorAll('[data-paint]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onSelectPaint(btn.dataset.paint));
    });

    this.el.garageUpgrades.innerHTML = GARAGE_UPGRADES.map((u) => {
      const tier = missions.upgrades[u.id] || 0;
      const maxed = tier >= u.maxTier;
      const cost = u.baseCost * (tier + 1);
      return `
        <div class="upgrade-row">
          <div class="upgrade-info">
            <strong>${u.name} (LV ${tier} / ${u.maxTier})</strong>
            <span>${u.desc}</span>
          </div>
          <button class="upgrade-buy" data-upg="${u.id}" ${maxed || player.cash < cost ? 'disabled' : ''} type="button">
            ${maxed ? 'MAXED' : 'BUY $' + cost}
          </button>
        </div>
      `;
    }).join('');

    this.el.garageUpgrades.querySelectorAll('[data-upg]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onBuyUpgrade(btn.dataset.upg));
    });
  }
}
