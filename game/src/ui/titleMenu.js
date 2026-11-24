// Cinematic Main Menu / Start Screen Controller:
// Continue Campaign (%), New Game, Load Save, Free Roam, Controls & Settings drawer,
// and live 3D Golden-Hour coastal panorama orbit camera.

export class TitleMenuController {
  constructor(callbacks) {
    this.cb = callbacks;
    this.settingsOpen = false;

    this.el = {
      overlay: document.getElementById('start-overlay'),
      btnContinue: document.getElementById('btn-continue'),
      btnNewGame: document.getElementById('btn-play'),
      btnLoadSave: document.getElementById('btn-start-map'),
      btnFreeRoam: document.getElementById('btn-free-roam'),
      btnSettings: document.getElementById('btn-title-settings'),
      settingsPanel: document.getElementById('title-settings-panel'),
      btnTitleMood: document.getElementById('btn-title-mood'),
      btnTitleAudio: document.getElementById('btn-title-audio'),
      btnTitleCamera: document.getElementById('btn-title-camera'),
      btnSettingsClose: document.getElementById('btn-title-settings-close'),
    };

    this.bindTitleMenuActions();
  }

  bindTitleMenuActions() {
    this.el.btnContinue.addEventListener('click', () => this.cb.onContinueCampaign());
    this.el.btnNewGame.addEventListener('click', () => this.cb.onNewGame());
    this.el.btnLoadSave.addEventListener('click', () => this.cb.onOpenSaveSlots());
    this.el.btnFreeRoam.addEventListener('click', () => this.cb.onEnterFreeRoam());
    this.el.btnSettings.addEventListener('click', () => this.toggleControlsSettingsDrawer());

    if (this.el.btnTitleMood) {
      this.el.btnTitleMood.addEventListener('click', () => this.cb.onCycleMood());
    }
    if (this.el.btnTitleAudio) {
      this.el.btnTitleAudio.addEventListener('click', () => this.cb.onToggleAudio());
    }
    if (this.el.btnTitleCamera) {
      this.el.btnTitleCamera.addEventListener('click', () => this.cb.onCycleCamera());
    }
    if (this.el.btnSettingsClose) {
      this.el.btnSettingsClose.addEventListener('click', () => this.toggleControlsSettingsDrawer(false));
    }
  }

  renderTitleMenuState({ visible, hasSaves, bestCareerPct, currentMoodLabel, muted, cameraLabel }) {
    this.el.overlay.classList.toggle('hidden', !visible);
    if (!visible) {
      this.toggleControlsSettingsDrawer(false);
      return;
    }
    this.updateContinueCampaignButton(hasSaves, bestCareerPct);
    this.syncSettingsControls({ currentMoodLabel, muted, cameraLabel });
  }

  updateContinueCampaignButton(hasSaves, bestCareerPct = 0) {
    this.el.btnContinue.classList.toggle('hidden', !hasSaves);
    if (hasSaves) {
      this.el.btnContinue.textContent = `CONTINUE CAMPAIGN (${bestCareerPct}%)`;
    }
  }

  toggleControlsSettingsDrawer(forceState = null) {
    this.settingsOpen = forceState === null ? !this.settingsOpen : Boolean(forceState);
    if (this.el.settingsPanel) {
      this.el.settingsPanel.classList.toggle('hidden', !this.settingsOpen);
    }
    this.el.btnSettings.classList.toggle('active-btn', this.settingsOpen);
  }

  syncSettingsControls({ currentMoodLabel, muted, cameraLabel }) {
    if (this.el.btnTitleMood && currentMoodLabel) {
      this.el.btnTitleMood.textContent = `TIME OF DAY: ${currentMoodLabel}`;
    }
    if (this.el.btnTitleAudio && typeof muted === 'boolean') {
      this.el.btnTitleAudio.textContent = `AUDIO & RADIO: ${muted ? 'OFF' : 'ON'}`;
    }
    if (this.el.btnTitleCamera && cameraLabel) {
      this.el.btnTitleCamera.textContent = `CAMERA PRESET: ${cameraLabel}`;
    }
  }

  updateTitlePanoramaCamera(cameraRig, elapsed, anchorPos) {
    const sway = Math.sin(elapsed * 0.22) * 3.5;
    cameraRig.camera.position.set(
      anchorPos.x - 12.0 + sway,
      13.2 + Math.sin(elapsed * 0.35) * 0.9,
      anchorPos.z - 24.0 + Math.cos(elapsed * 0.18) * 3.0,
    );
    cameraRig.camera.lookAt(anchorPos.x + 14, 4.2, anchorPos.z + 48);
    if (Math.abs(cameraRig.camera.fov - 56) > 0.1) {
      cameraRig.camera.fov = 56;
      cameraRig.camera.updateProjectionMatrix();
    }
  }
}
