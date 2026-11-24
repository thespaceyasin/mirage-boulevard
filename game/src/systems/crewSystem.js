// Syndicate Crew Ability System:
// [Z] Nadia Vale (Signal Blackout), [X] Rico Vega (Nitro Overdrive),
// and [C] Tessa Vance (Tactical Focus bullet-time).

import { CREW_ABILITIES } from '../engine/gameConfig.js';

export class SyndicateCrewSystem {
  constructor() {
    this.crewState = {};
    this.resetCrewCooldowns();
  }

  get isFocusActive() {
    return this.crewState.focus.activeTimer > 0;
  }

  get isOverdriveActive() {
    return this.crewState.nitro.activeTimer > 0;
  }

  resetCrewCooldowns() {
    for (const ab of CREW_ABILITIES) {
      this.crewState[ab.id] = { activeTimer: 0, cooldownTimer: 0 };
    }
  }

  getSimulationTimeScale(hitstopTimer = 0) {
    if (hitstopTimer > 0) return 0.12;
    return this.isFocusActive ? 0.48 : 1.0;
  }

  updateCrewCooldowns(dt) {
    for (const ab of CREW_ABILITIES) {
      const st = this.crewState[ab.id];
      if (st.activeTimer > 0) st.activeTimer = Math.max(0, st.activeTimer - dt);
      if (st.cooldownTimer > 0) st.cooldownTimer = Math.max(0, st.cooldownTimer - dt);
    }
  }

  activateCrewAbility(abilityId, context) {
    const spec = CREW_ABILITIES.find((a) => a.id === abilityId);
    const st = this.crewState[abilityId];
    if (!spec || !st || st.cooldownTimer > 0) return false;

    st.activeTimer = spec.duration;
    st.cooldownTimer = spec.cooldown;

    if (abilityId === 'blackout') {
      this.triggerSignalBlackout(spec, context);
    } else if (abilityId === 'nitro') {
      this.triggerNitroOverdrive(spec, context);
    } else if (abilityId === 'focus') {
      this.triggerTacticalFocus(spec, context);
    }

    if (context.audio) context.audio.playAbility(abilityId);
    return true;
  }

  triggerSignalBlackout(spec, context) {
    const jammed = context.police.triggerBlackout(context.player.pos, spec.duration);
    if (context.missions) {
      context.missions.showDialogue(
        'Nadia Vale',
        'NETRUNNER',
        `Signal Blackout live! ${jammed} SBPD cruisers stalled and dispatch jammed.`,
        4.5,
      );
    }
    if (context.showToast) context.showToast('NADIA: SIGNAL BLACKOUT ACTIVE');
  }

  triggerNitroOverdrive(spec, context) {
    if (context.player.vehicle) {
      context.player.vehicle.nitro = 100;
      context.player.vehicle.health = Math.min(
        context.player.vehicle.maxHealth,
        context.player.vehicle.health + 55,
      );
      if (context.cameraRig) context.cameraRig.punchFov(8);
    } else {
      context.player.armor = Math.min(context.player.maxArmor, context.player.armor + 35);
    }
    if (context.missions) {
      context.missions.showDialogue(
        'Rico Vega',
        'WHEELMAN',
        'Overdrive engaged — full nitro surge and quick chassis patch!',
        4.2,
      );
    }
    if (context.showToast) context.showToast('RICO: NITRO OVERDRIVE ENGAGED');
  }

  triggerTacticalFocus(spec, context) {
    if (context.missions) {
      context.missions.showDialogue(
        'Tessa Vance',
        'TACTICIAN',
        'Tactical Focus online — breathing steady, +50% weapon impact.',
        4.2,
      );
    }
    if (context.showToast) context.showToast('TESSA: TACTICAL FOCUS (SLOW-MO)');
  }

  getCrewAbilityHudStates() {
    return CREW_ABILITIES.map((ab) => {
      const st = this.crewState[ab.id];
      const active = st.activeTimer > 0;
      const onCooldown = st.cooldownTimer > 0 && !active;
      const fillRatio = active
        ? st.activeTimer / ab.duration
        : st.cooldownTimer > 0
          ? 1 - st.cooldownTimer / ab.cooldown
          : 1;
      return {
        id: ab.id,
        key: ab.key,
        member: ab.member,
        title: ab.title,
        active,
        onCooldown,
        fillRatio: Math.max(0, Math.min(1, fillRatio)),
      };
    });
  }
}
