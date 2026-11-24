// Solara Customs Garage Shop:
// metallic respray paints, wanted heat wipe & hull repair, 4-tier performance
// tuning (ECU, coilovers, kevlar armor, nitro), and Syndicate Respect Rank.

import { CITY_CONFIG, GARAGE_PAINTS, GARAGE_UPGRADES } from '../engine/gameConfig.js';

const RESPECT_RANKS = [
  { minScore: 0, level: 1, title: 'STREET RUNNER' },
  { minScore: 2, level: 2, title: 'BOULEVARD ENFORCER' },
  { minScore: 4, level: 3, title: 'NIGHT MARKET CAPO' },
  { minScore: 7, level: 4, title: 'SYNDICATE BOSS' },
  { minScore: 11, level: 5, title: 'SOLARA KINGPIN' },
];

export class SolaraCustomsGarage {
  constructor() {
    this.ownedPaints = new Set(['sunset_coral']);
    this.activePaintId = 'sunset_coral';
    this.upgrades = { engine: 0, handling: 0, armor: 0, nitro: 0 };
    this.nearGarage = false;
  }

  updateGarageProximity(playerPos) {
    const dist = Math.hypot(playerPos.x - CITY_CONFIG.garagePos.x, playerPos.z - CITY_CONFIG.garagePos.z);
    this.nearGarage = dist < 14;
    return this.nearGarage;
  }

  getUpgradeProgressRatio() {
    const totalTiers = this.upgrades.engine + this.upgrades.handling + this.upgrades.armor + this.upgrades.nitro;
    return Math.min(1, totalTiers / 12);
  }

  getFleetTuningSummary() {
    const u = this.upgrades;
    const paint = GARAGE_PAINTS.find((p) => p.id === this.activePaintId) || GARAGE_PAINTS[0];
    return {
      paintName: paint.name,
      paintHex: paint.hex,
      totalTiers: u.engine + u.handling + u.armor + u.nitro,
      maxTiers: 12,
      line: `ECU LV${u.engine} · SUSP LV${u.handling} · ARMOR LV${u.armor} · NOS LV${u.nitro}`,
    };
  }

  computeSyndicateRespectRank(completedCount, heatPeak = 0, raceWins = 0) {
    const tierScore = this.upgrades.engine + this.upgrades.handling + this.upgrades.armor + this.upgrades.nitro;
    const score = completedCount + Math.floor(tierScore / 3) + (heatPeak >= 4 ? 1 : 0) + Math.min(2, raceWins);
    let rank = RESPECT_RANKS[0];
    for (const r of RESPECT_RANKS) {
      if (score >= r.minScore) rank = r;
    }
    return {
      level: rank.level,
      title: rank.title,
      badgeText: `LV.${rank.level} ${rank.title}`,
    };
  }

  applyMetallicRespray(paintId, player, audio) {
    const paint = GARAGE_PAINTS.find((p) => p.id === paintId);
    if (!paint) return false;
    if (!this.ownedPaints.has(paintId)) {
      if (player.cash < paint.price) return false;
      player.cash -= paint.price;
      this.ownedPaints.add(paintId);
    }
    this.activePaintId = paintId;
    if (player.vehicle) player.vehicle.setPaint(paint.color);
    if (audio) audio.playPickup();
    return true;
  }

  purchasePerformanceUpgrade(upgradeId, player, audio) {
    const upg = GARAGE_UPGRADES.find((u) => u.id === upgradeId);
    if (!upg) return false;
    const tier = this.upgrades[upgradeId] || 0;
    if (tier >= upg.maxTier) return false;
    const cost = upg.baseCost * (tier + 1);
    if (player.cash < cost) return false;
    player.cash -= cost;
    this.upgrades[upgradeId] = tier + 1;
    if (player.vehicle) player.vehicle.applyGarageUpgrades(this.upgrades);
    if (audio) audio.playMissionComplete();
    return true;
  }

  repairHullAndClearWantedHeat(player, police, audio) {
    if (player.cash < 300) return false;
    player.cash -= 300;
    if (player.vehicle) player.vehicle.repairFull();
    player.refillAmmoAndVitals();
    if (police) police.clearHeat();
    if (audio) audio.playMissionComplete();
    return true;
  }

  renderGarageShopPanel(elements, player, { onSelectPaint, onBuyUpgrade }) {
    elements.garageCash.textContent = `$${Math.floor(player.cash).toLocaleString()}`;

    elements.garagePaints.innerHTML = GARAGE_PAINTS.map((p) => {
      const owned = this.ownedPaints.has(p.id);
      const active = this.activePaintId === p.id;
      return `
        <button class="paint-btn ${owned ? 'owned' : ''}" data-paint="${p.id}" type="button">
          <span class="paint-swatch" style="background:${p.hex}"></span>
          <span>${p.name}</span>
          <span style="margin-left:auto;color:${active ? '#1de9d8' : '#ffb347'}">${active ? 'EQUIPPED' : owned ? 'APPLY' : `$${p.price}`}</span>
        </button>
      `;
    }).join('');

    elements.garagePaints.querySelectorAll('[data-paint]').forEach((btn) => {
      btn.addEventListener('click', () => onSelectPaint(btn.dataset.paint));
    });

    elements.garageUpgrades.innerHTML = GARAGE_UPGRADES.map((u) => {
      const tier = this.upgrades[u.id] || 0;
      const maxed = tier >= u.maxTier;
      const cost = u.baseCost * (tier + 1);
      return `
        <div class="upgrade-row">
          <div class="upgrade-info">
            <strong>${u.name} (LV ${tier} / ${u.maxTier})</strong>
            <span>${u.desc}</span>
          </div>
          <button class="upgrade-buy" data-upg="${u.id}" ${maxed || player.cash < cost ? 'disabled' : ''} type="button">
            ${maxed ? 'MAXED' : `BUY $${cost}`}
          </button>
        </div>
      `;
    }).join('');

    elements.garageUpgrades.querySelectorAll('[data-upg]').forEach((btn) => {
      btn.addEventListener('click', () => onBuyUpgrade(btn.dataset.upg));
    });
  }

  serializeGarageState() {
    return {
      ownedPaints: Array.from(this.ownedPaints),
      activePaintId: this.activePaintId,
      upgrades: { ...this.upgrades },
    };
  }

  deserializeGarageState(data) {
    if (!data) return;
    this.ownedPaints = new Set(data.ownedPaints || ['sunset_coral']);
    this.activePaintId = data.activePaintId || 'sunset_coral';
    this.upgrades = { engine: 0, handling: 0, armor: 0, nitro: 0, ...(data.upgrades || {}) };
  }
}
