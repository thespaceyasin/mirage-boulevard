// Multi-slot offline persistence via localStorage (3 manual slots + Auto-Save)
// storing career progression, missions, cash, Golden Palms, garage upgrades, and vitals.

const STORAGE_KEY = 'mirage_boulevard_saves_v1';
export const SAVE_SLOTS = [
  { id: 'autosave', label: 'AUTO-SAVE' },
  { id: 'slot1', label: 'SAVE SLOT 1' },
  { id: 'slot2', label: 'SAVE SLOT 2' },
  { id: 'slot3', label: 'SAVE SLOT 3' },
];

export class SaveManager {
  constructor() {
    this._memoryFallback = {};
  }

  _readAll() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return { ...this._memoryFallback };
    }
  }

  _writeAll(obj) {
    this._memoryFallback = { ...obj };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Fallback already retained in memory
    }
  }

  hasAnySave() {
    const all = this._readAll();
    return Object.keys(all).length > 0;
  }

  listSlots() {
    const all = this._readAll();
    return SAVE_SLOTS.map((s) => ({
      ...s,
      data: all[s.id] || null,
    }));
  }

  saveSlot(slotId, snapshot) {
    const all = this._readAll();
    const record = {
      ...snapshot,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    all[slotId] = record;
    this._writeAll(all);
    return record;
  }

  loadSlot(slotId) {
    const all = this._readAll();
    return all[slotId] || null;
  }

  seedDemoSlotsIfEmpty(careerSnapshot) {
    const all = this._readAll();
    if (!all.autosave) {
      all.autosave = { ...careerSnapshot, savedAt: '17:45' };
    }
    if (!all.slot1) {
      all.slot1 = {
        ...careerSnapshot,
        cash: 11850,
        careerPct: 54,
        district: 'MIRAGE BOULEVARD',
        savedAt: '17:42',
      };
    }
    if (!all.slot2) {
      all.slot2 = {
        ...careerSnapshot,
        cash: 6400,
        careerPct: 28,
        district: 'LANTERN NIGHT MARKET',
        savedAt: '16:15',
      };
    }
    this._writeAll(all);
  }
}
