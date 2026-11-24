// Procedural Canvas2D PBR textures (roads, sidewalks, 5 district facades + emissive
// night maps, glowing neon billboards, beach sand, boardwalk, and character portraits).

import * as THREE from 'three';
import { createSeededRng } from '../engine/gameConfig.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createRoadTextures() {
  const rng = createSeededRng(1001);

  // Straight multi-lane road asphalt
  const roadC = makeCanvas(512, 512);
  const ctx = roadC.getContext('2d');
  ctx.fillStyle = '#262b35';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt aggregate grain & tire tracks
  for (let i = 0; i < 4200; i += 1) {
    const x = rng.next() * 512;
    const y = rng.next() * 512;
    const shade = 28 + Math.floor(rng.next() * 26);
    ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 9})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = 'rgba(15, 18, 25, 0.25)';
  ctx.fillRect(96, 0, 44, 512);
  ctx.fillRect(166, 0, 44, 512);
  ctx.fillRect(302, 0, 44, 512);
  ctx.fillRect(372, 0, 44, 512);

  // Concrete shoulder curbs
  ctx.fillStyle = '#79818f';
  ctx.fillRect(0, 0, 14, 512);
  ctx.fillRect(498, 0, 14, 512);
  ctx.fillStyle = '#d7e0ec';
  ctx.fillRect(20, 0, 5, 512);
  ctx.fillRect(487, 0, 5, 512);

  // Double amber centerline
  ctx.fillStyle = '#f2b838';
  ctx.fillRect(248, 0, 6, 512);
  ctx.fillRect(258, 0, 6, 512);

  // Dashed lane lines
  ctx.fillStyle = 'rgba(235, 242, 252, 0.82)';
  for (let y = 16; y < 512; y += 76) {
    ctx.fillRect(134, y, 5, 40);
    ctx.fillRect(373, y, 5, 40);
  }

  // Intersection with crisp crosswalk stripes
  const interC = makeCanvas(512, 512);
  const ictx = interC.getContext('2d');
  ictx.fillStyle = '#252a34';
  ictx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i += 1) {
    const shade = 28 + Math.floor(rng.next() * 24);
    ictx.fillStyle = `rgb(${shade},${shade + 3},${shade + 8})`;
    ictx.fillRect(rng.next() * 512, rng.next() * 512, 2, 2);
  }
  ictx.fillStyle = 'rgba(236, 242, 250, 0.88)';
  for (let k = 42; k <= 452; k += 36) {
    ictx.fillRect(k, 14, 18, 44);
    ictx.fillRect(k, 454, 18, 44);
    ictx.fillRect(14, k, 44, 18);
    ictx.fillRect(454, k, 44, 18);
  }
  // Subtle stop bars
  ictx.fillStyle = 'rgba(242, 184, 56, 0.42)';
  ictx.fillRect(68, 66, 376, 4);
  ictx.fillRect(68, 442, 376, 4);
  ictx.fillRect(66, 68, 4, 376);
  ictx.fillRect(442, 68, 4, 376);

  // Sunlit coastal sidewalk travertine
  const sideC = makeCanvas(256, 256);
  const sctx = sideC.getContext('2d');
  sctx.fillStyle = '#c8c3b8';
  sctx.fillRect(0, 0, 256, 256);
  sctx.strokeStyle = 'rgba(85, 82, 76, 0.35)';
  sctx.lineWidth = 2;
  for (let g = 0; g <= 256; g += 64) {
    sctx.beginPath();
    sctx.moveTo(g, 0);
    sctx.lineTo(g, 256);
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(0, g);
    sctx.lineTo(256, g);
    sctx.stroke();
  }
  for (let i = 0; i < 900; i += 1) {
    const v = 180 + Math.floor(rng.next() * 35);
    sctx.fillStyle = `rgba(${v},${v - 5},${v - 14},0.35)`;
    sctx.fillRect(rng.next() * 256, rng.next() * 256, 3, 3);
  }

  // Boardwalk wood planks
  const woodC = makeCanvas(256, 256);
  const wctx = woodC.getContext('2d');
  wctx.fillStyle = '#a47449';
  wctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    const tone = 148 + Math.floor(rng.next() * 26);
    wctx.fillStyle = `rgb(${tone},${Math.floor(tone * 0.72)},${Math.floor(tone * 0.48)})`;
    wctx.fillRect(0, y + 1, 256, 14);
    wctx.fillStyle = 'rgba(42, 24, 10, 0.45)';
    wctx.fillRect(0, y, 256, 2);
  }

  // Golden coastal sand
  const sandC = makeCanvas(256, 256);
  const nctx = sandC.getContext('2d');
  nctx.fillStyle = '#ebd09a';
  nctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    nctx.fillStyle = 'rgba(255, 242, 206, 0.25)';
    nctx.fillRect(0, y, 256, 3);
  }
  for (let i = 0; i < 1600; i += 1) {
    const v = 212 + Math.floor(rng.next() * 36);
    nctx.fillStyle = `rgba(${v},${v - 24},${v - 66},0.45)`;
    nctx.fillRect(rng.next() * 256, rng.next() * 256, 2, 2);
  }

  return {
    road: finalizeTexture(roadC),
    intersection: finalizeTexture(interC),
    sidewalk: finalizeTexture(sideC, { repeatX: 28, repeatY: 28 }),
    boardwalk: finalizeTexture(woodC, { repeatX: 4, repeatY: 42 }),
    sand: finalizeTexture(sandC, { repeatX: 6, repeatY: 36 }),
  };
}

export function createFacadeSet(style, seed) {
  const rng = createSeededRng(seed);
  const w = 512;
  const h = 512;
  const diffC = makeCanvas(w, h);
  const emisC = makeCanvas(w, h);
  const dctx = diffC.getContext('2d');
  const ectx = emisC.getContext('2d');

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  if (style === 'artdeco') {
    // Sunlit pastel coastal Art-Deco hotels (cream / coral / mint / turquoise accents)
    const wallColors = ['#f6e6d8', '#ffd8d2', '#d7f4ec', '#fcecc9'];
    const trimColors = ['#ff6b7a', '#1dd6c6', '#ffaa44', '#509cff'];
    const baseWall = rng.pick(wallColors);
    const trim = rng.pick(trimColors);

    dctx.fillStyle = baseWall;
    dctx.fillRect(0, 0, w, h);

    // Subtle vertical deco fluting & horizontal pastel ribbons
    dctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = 0; x < w; x += 64) dctx.fillRect(x, 0, 8, h);
    dctx.fillStyle = trim;
    dctx.fillRect(0, 0, w, 16);
    dctx.fillRect(0, 240, w, 12);
    dctx.fillRect(0, 444, w, 16);

    // Ground storefront arcade
    dctx.fillStyle = '#253145';
    dctx.fillRect(0, 460, w, 52);
    for (let x = 18; x < w; x += 84) {
      dctx.fillStyle = '#3c859e';
      dctx.fillRect(x, 468, 62, 38);
      ectx.fillStyle = '#ffcf86';
      ectx.fillRect(x + 4, 472, 54, 30);
    }

    // Window grid with balconies & warm sunset/night interior glow
    const cols = 6;
    const rows = 7;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const wx = 20 + c * 80;
        const wy = 26 + r * 58;
        dctx.fillStyle = '#243c59';
        dctx.fillRect(wx, wy, 52, 36);
        dctx.fillStyle = 'rgba(130, 215, 245, 0.38)';
        dctx.fillRect(wx + 4, wy + 4, 22, 26);
        dctx.fillStyle = '#ffffff';
        dctx.fillRect(wx - 4, wy + 34, 60, 6); // balcony railing

        if (rng.next() < 0.62) {
          ectx.fillStyle = rng.next() < 0.72 ? '#ffcf82' : '#4df0e2';
          ectx.fillRect(wx + 3, wy + 3, 46, 28);
        }
      }
    }
    // Neon roof strip on emissive map
    ectx.fillStyle = trim;
    ectx.fillRect(0, 4, w, 9);
  } else if (style === 'downtown') {
    // Sleek reflective glass-and-steel skyscraper curtain wall
    const grad = dctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a4d78');
    grad.addColorStop(0.5, '#3b6c94');
    grad.addColorStop(1, '#1d324d');
    dctx.fillStyle = grad;
    dctx.fillRect(0, 0, w, h);

    // Steel mullions & spandrel bands
    for (let y = 0; y < h; y += 32) {
      dctx.fillStyle = '#192536';
      dctx.fillRect(0, y, w, 7);
      const floorLit = rng.next() < 0.65;
      for (let x = 0; x < w; x += 32) {
        dctx.fillStyle = '#1b283b';
        dctx.fillRect(x, y, 4, 32);
        // Diagonal glass reflection highlight
        dctx.fillStyle = 'rgba(170, 225, 255, 0.16)';
        dctx.fillRect(x + 6, y + 9, 10, 18);
        if (floorLit && rng.next() < 0.68) {
          ectx.fillStyle = rng.next() < 0.6 ? '#ffdba0' : '#7ae8ff';
          ectx.fillRect(x + 5, y + 9, 24, 18);
        }
      }
    }
    ectx.fillStyle = '#4ad8ff';
    ectx.fillRect(0, 2, w, 6);
  } else if (style === 'market') {
    // Lantern Night Market vibrant neon bazaar facades
    dctx.fillStyle = '#2b243b';
    dctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 64) {
      dctx.fillStyle = y % 128 === 0 ? '#3a2b4d' : '#2f2542';
      dctx.fillRect(0, y, w, 60);
      for (let x = 14; x < w; x += 72) {
        dctx.fillStyle = '#1a1528';
        dctx.fillRect(x, y + 10, 52, 38);
        const lit = rng.next() < 0.78;
        if (lit) {
          const glow = rng.pick(['#ff4eb8', '#1de9d8', '#ffb347', '#ff6363']);
          dctx.fillStyle = glow;
          dctx.fillRect(x + 5, y + 14, 42, 28);
          ectx.fillStyle = glow;
          ectx.fillRect(x + 4, y + 13, 44, 30);
        }
      }
    }
    // Glowing neon storefront bands
    dctx.fillStyle = '#ff3b9a';
    dctx.fillRect(0, 420, w, 14);
    ectx.fillStyle = '#ff3b9a';
    ectx.fillRect(0, 420, w, 14);
    ectx.fillStyle = '#1de9d8';
    ectx.fillRect(0, 224, w, 10);
  } else if (style === 'villa') {
    // Palm Heights warm sunlit coastal stucco & terracotta villas
    dctx.fillStyle = rng.pick(['#f5dec0', '#f7e7d2', '#f1d0b5']);
    dctx.fillRect(0, 0, w, h);
    dctx.fillStyle = '#c96b4b';
    dctx.fillRect(0, 0, w, 26);
    dctx.fillRect(0, 250, w, 14);
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        const wx = 26 + c * 122;
        const wy = 46 + r * 116;
        dctx.fillStyle = '#2d475e';
        dctx.fillRect(wx, wy, 72, 68);
        dctx.fillStyle = '#3b6a64';
        dctx.fillRect(wx - 12, wy, 10, 68);
        dctx.fillRect(wx + 74, wy, 10, 68);
        if (rng.next() < 0.65) {
          ectx.fillStyle = '#ffd58f';
          ectx.fillRect(wx + 6, wy + 6, 60, 56);
        }
      }
    }
  } else {
    // Torque Quarter industrial corrugated metal & garage bays
    dctx.fillStyle = '#535f70';
    dctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      dctx.fillStyle = x % 32 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.14)';
      dctx.fillRect(x, 0, 8, h);
    }
    // Hazard stripe band
    dctx.fillStyle = '#eab238';
    dctx.fillRect(0, 430, w, 24);
    dctx.fillStyle = '#1b1f29';
    for (let x = -20; x < w + 40; x += 40) {
      dctx.beginPath();
      dctx.moveTo(x, 430);
      dctx.lineTo(x + 20, 430);
      dctx.lineTo(x + 6, 454);
      dctx.lineTo(x - 14, 454);
      dctx.closePath();
      dctx.fill();
    }
    // High warehouse clerestory windows
    for (let x = 22; x < w; x += 96) {
      dctx.fillStyle = '#25384b';
      dctx.fillRect(x, 60, 68, 42);
      ectx.fillStyle = '#ffcf70';
      ectx.fillRect(x + 4, 64, 60, 34);
    }
  }

  return {
    map: finalizeTexture(diffC, { anisotropy: 8 }),
    emissiveMap: finalizeTexture(emisC, { anisotropy: 4 }),
  };
}

export function createBillboardTexture(title, subtitle, accentHex, bgHex = '#10172b') {
  const c = makeCanvas(512, 192);
  const ctx = c.getContext('2d');

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 192);

  // Subtle diagonal sunset/neon glow stripe
  const grad = ctx.createLinearGradient(0, 0, 512, 192);
  grad.addColorStop(0, `${accentHex}55`);
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `${accentHex}44`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 192);

  // Crisp glowing frame border
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 172);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 50px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 82);

  ctx.fillStyle = accentHex;
  ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(subtitle, 256, 136);

  return finalizeTexture(c, { anisotropy: 4 });
}

export function createPoliceDoorTexture() {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f6fc';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#182b4d';
  ctx.fillRect(0, 0, 256, 22);
  ctx.fillRect(0, 102, 256, 26);
  ctx.fillStyle = '#ffaa2b';
  ctx.fillRect(0, 95, 256, 7);
  ctx.fillStyle = '#142340';
  ctx.font = '900 44px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SBPD', 128, 66);
  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#2d6cdf';
  ctx.fillText('SOLARA BAY INTERCEPTOR', 128, 88);
  return finalizeTexture(c, { anisotropy: 4 });
}

export function drawCharacterPortrait(canvas, speakerName) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const profiles = {
    'Nadia Vale': { bg: '#162847', accent: '#1de9d8', skin: '#e4b393', hair: '#1d1633', jacket: '#233b66', shades: true },
    'Rico Vega': { bg: '#3b1e25', accent: '#ffb347', skin: '#c88d65', hair: '#181412', jacket: '#b83c48', shades: false },
    'Tessa Vance': { bg: '#2c1c3d', accent: '#ff5e6c', skin: '#f0c5a8', hair: '#d9663c', jacket: '#282d3d', shades: false },
    'Mateo Cruz': { bg: '#192c3b', accent: '#ffaa44', skin: '#d49a73', hair: '#1c1816', jacket: '#ff5e6c', shades: true },
    'Victor Solis': { bg: '#261422', accent: '#ff2e55', skin: '#cfa082', hair: '#d6dce6', jacket: '#141722', shades: true },
  };
  const p = profiles[speakerName] || profiles['Mateo Cruz'];

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, p.bg);
  grad.addColorStop(1, '#0b101d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle neon ring behind head
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.44, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Shoulders / jacket
  ctx.fillStyle = p.jacket;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.95, 25, 18, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Collar accent
  ctx.fillStyle = p.accent;
  ctx.fillRect(w * 0.42, h * 0.72, w * 0.16, 14);

  // Neck & head
  ctx.fillStyle = p.skin;
  ctx.fillRect(w * 0.43, h * 0.58, w * 0.14, 12);
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.43, 13, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.37, 14, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.28, h * 0.33, 4, 14);
  ctx.fillRect(w * 0.66, h * 0.33, 4, 12);

  // Eyes or coastal shades
  if (p.shades) {
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(w * 0.33, h * 0.40, 10, 5);
    ctx.fillRect(w * 0.53, h * 0.40, 10, 5);
    ctx.fillStyle = p.accent;
    ctx.fillRect(w * 0.35, h * 0.41, 6, 2);
    ctx.fillRect(w * 0.55, h * 0.41, 6, 2);
  } else {
    ctx.fillStyle = '#181c28';
    ctx.fillRect(w * 0.38, h * 0.41, 3, 3);
    ctx.fillRect(w * 0.57, h * 0.41, 3, 3);
  }
}
