import { VehicleKind } from './types';

const vehicleCache = new Map<string, HTMLCanvasElement>();
let a10SpriteCanvas: HTMLCanvasElement | null = null;
let apcTurretCanvas: HTMLCanvasElement | null = null;
const heliCache = new Map<string, HTMLCanvasElement>();
let rotorCanvas: HTMLCanvasElement | null = null;
let chinookSpriteCanvas: HTMLCanvasElement | null = null;
let chinookRotorCanvas: HTMLCanvasElement | null = null;
let explosionFlipbook: HTMLCanvasElement | null = null;
const craterCache: HTMLCanvasElement[] = [];

export const EXPLOSION_FRAMES = 14;
export const EXPLOSION_CELL = 200;

function drawTireWells(
  ctx: CanvasRenderingContext2D,
  len: number,
  wid: number,
  positionsX: number[],
  tireLen: number,
  tireThick: number
) {
  ctx.fillStyle = '#090d14';
  for (const xFrac of positionsX) {
    const tx = len * xFrac;
    ctx.beginPath();
    ctx.roundRect(tx - tireLen / 2, -wid / 2 - tireThick * 0.45, tireLen, tireThick, 2);
    ctx.roundRect(tx - tireLen / 2, wid / 2 - tireThick * 0.55, tireLen, tireThick, 2);
    ctx.fill();
  }
}

function drawWindshieldGlass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 3
) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#0f172a');
  g.addColorStop(0.35, '#1e293b');
  g.addColorStop(0.55, '#334155');
  g.addColorStop(1, '#090d16');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  // Subtle diagonal glass glare
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.25, y + h * 0.15);
  ctx.lineTo(x + w * 0.72, y + h * 0.65);
  ctx.stroke();
}

function bakeVehicleCanvas(kind: VehicleKind, color: string): HTMLCanvasElement {
  const W = 200;
  const H = 104;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.translate(W / 2, H / 2);

  if (kind === 'motorcycle') {
    const l = 84;
    const w = 32;
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(3, 4, l * 0.48, w * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front & rear tires
    ctx.fillStyle = '#090d14';
    ctx.beginPath();
    ctx.roundRect(-l * 0.45, -5, 24, 10, 4);
    ctx.roundRect(l * 0.18, -4.5, 24, 9, 4);
    ctx.fill();

    // Twin chrome exhausts
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-l * 0.36, -9, 28, 3);
    ctx.fillRect(-l * 0.36, 6, 28, 3);

    // Frame + fuel tank
    const tankGrad = ctx.createLinearGradient(-15, -10, 20, 10);
    tankGrad.addColorStop(0, '#1e3a8a');
    tankGrad.addColorStop(0.5, '#38bdf8');
    tankGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = tankGrad;
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-l * 0.24, -8.5, l * 0.48, 17, 6);
    ctx.fill();
    ctx.stroke();

    // Handlebars + front fairing
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16, -15);
    ctx.lineTo(20, 0);
    ctx.lineTo(16, 15);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(22, 0, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Seat
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(-10, 0, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return canvas;
  }

  const isHeavy = kind === 'fire_truck' || kind === 'armored_apc' || kind === 'police_van' || kind === 'ambulance';
  const len = kind === 'fire_truck' ? 168 : kind === 'armored_apc' ? 160 : isHeavy ? 148 : 132;
  const wid = kind === 'fire_truck' ? 62 : kind === 'armored_apc' ? 66 : isHeavy ? 58 : 54;

  // 1. Contact shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.beginPath();
  ctx.roundRect(-len / 2 + 4, -wid / 2 + 5, len, wid, 10);
  ctx.fill();

  // 2. Tires & Mirrors
  if (kind === 'armored_apc') {
    drawTireWells(ctx, len, wid, [-0.36, -0.12, 0.12, 0.36], 20, 10);
  } else {
    drawTireWells(ctx, len, wid, [-0.3, 0.3], 22, 8);
  }

  // Side mirrors
  if (kind !== 'armored_apc') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(len * 0.17, -wid / 2 - 4.5, 6, 5);
    ctx.fillRect(len * 0.17, wid / 2 - 0.5, 6, 5);
  }

  // 3. Base Metallic Chassis with Shading Gradient
  let baseTop = color;
  let baseBot = color;
  if (kind === 'police_car') {
    baseTop = '#f8fafc';
    baseBot = '#cbd5e1';
  } else if (kind === 'police_van') {
    baseTop = '#1e40af';
    baseBot = '#0f172a';
  } else if (kind === 'ambulance') {
    baseTop = '#ffffff';
    baseBot = '#e2e8f0';
  } else if (kind === 'fire_truck') {
    baseTop = '#ef4444';
    baseBot = '#991b1b';
  } else if (kind === 'military_jeep') {
    baseTop = '#4d7c0f';
    baseBot = '#1a2e05';
  } else if (kind === 'armored_apc') {
    baseTop = '#4d7c0f';
    baseBot = '#273b09';
  }

  const bodyGrad = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2);
  bodyGrad.addColorStop(0, baseTop);
  bodyGrad.addColorStop(0.5, baseTop);
  bodyGrad.addColorStop(1, baseBot);

  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#05080f';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, kind === 'armored_apc' ? 5 : 9);
  ctx.fill();
  ctx.stroke();

  // Front & Rear bumpers + Headlights/Taillights
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(len / 2 - 4, -wid * 0.44, 5, wid * 0.88);
  ctx.fillRect(-len / 2 - 1, -wid * 0.44, 4, wid * 0.88);

  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(len / 2 - 3, -wid * 0.4, 3, 7);
  ctx.fillRect(len / 2 - 3, wid * 0.4 - 7, 3, 7);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-len / 2, -wid * 0.4, 2.5, 7);
  ctx.fillRect(-len / 2, wid * 0.4 - 7, 2.5, 7);

  // 4. Vehicle-Specific Upper Architecture
  if (kind === 'police_car') {
    // Black & White cruiser doors/roof
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-len * 0.19, -wid / 2 + 1, len * 0.4, wid - 2);
    // Push bumper
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(len / 2 - 1, -wid * 0.25, 4, wid * 0.5);

    // Hood crease lines
    ctx.strokeStyle = 'rgba(15,23,42,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(len * 0.24, -wid * 0.26);
    ctx.lineTo(len * 0.46, -wid * 0.2);
    ctx.moveTo(len * 0.24, wid * 0.26);
    ctx.lineTo(len * 0.46, wid * 0.2);
    ctx.stroke();

    // Front & rear windshields
    drawWindshieldGlass(ctx, len * 0.1, -wid * 0.38, len * 0.16, wid * 0.76, 3);
    drawWindshieldGlass(ctx, -len * 0.34, -wid * 0.36, len * 0.13, wid * 0.72, 3);

    // Roof + Lightbar housing
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-len * 0.2, -wid * 0.36, len * 0.3, wid * 0.72, 4);
    ctx.fill();
    ctx.stroke();

    // Lightbar chrome frame
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-3, -wid * 0.32, 6, wid * 0.3);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(-3, wid * 0.02, 6, wid * 0.3);
  } else if (kind === 'civilian_car') {
    // Hood lines & trunk seam
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(len * 0.25, -wid * 0.28);
    ctx.lineTo(len * 0.45, -wid * 0.22);
    ctx.moveTo(len * 0.25, wid * 0.28);
    ctx.lineTo(len * 0.45, wid * 0.22);
    ctx.stroke();

    drawWindshieldGlass(ctx, len * 0.08, -wid * 0.39, len * 0.18, wid * 0.78, 3);
    drawWindshieldGlass(ctx, -len * 0.35, -wid * 0.37, len * 0.14, wid * 0.74, 3);

    // Roof cabin with subtle specular sheen + sunroof
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(-len * 0.21, -wid * 0.37, len * 0.29, wid * 0.74, 4);
    ctx.fill();
    drawWindshieldGlass(ctx, -len * 0.09, -wid * 0.24, len * 0.14, wid * 0.48, 2);
  } else if (kind === 'police_van') {
    // Armored SWAT van roof + hatch + AC unit
    drawWindshieldGlass(ctx, len * 0.26, -wid * 0.4, len * 0.13, wid * 0.8, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-len * 0.44, -wid * 0.42, len * 0.66, wid * 0.84);

    // Roof turret hatch
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(len * 0.05, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rear AC unit
    ctx.fillStyle = '#334155';
    ctx.fillRect(-len * 0.34, -11, 20, 22);
  } else if (kind === 'ambulance') {
    // Cab seam + windshield
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(len * 0.18, -wid / 2);
    ctx.lineTo(len * 0.18, wid / 2);
    ctx.stroke();

    drawWindshieldGlass(ctx, len * 0.26, -wid * 0.39, len * 0.14, wid * 0.78, 3);

    // Roof crimson stripe & large medical cross
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-len * 0.46, -wid * 0.42, len * 0.62, 5);
    ctx.fillRect(-len * 0.46, wid * 0.42 - 5, len * 0.62, 5);
    ctx.fillRect(-len * 0.24, -4.5, 24, 9);
    ctx.fillRect(-len * 0.24 + 7.5, -12, 9, 24);

    // Roof AC pod
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.fillRect(len * 0.02, -10, 14, 20);
    ctx.strokeRect(len * 0.02, -10, 14, 20);
  } else if (kind === 'fire_truck') {
    // Cab seam & large front windshield
    drawWindshieldGlass(ctx, len * 0.31, -wid * 0.41, len * 0.12, wid * 0.82, 3);
    // Diamond-plate side tool decks
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-len * 0.46, -wid * 0.46, len * 0.66, 7);
    ctx.fillRect(-len * 0.46, wid * 0.46 - 7, len * 0.66, 7);
    // Extendable aerial turntable ladder
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-len * 0.32, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-len * 0.38, -9, len * 0.72, 3.5);
    ctx.fillRect(-len * 0.38, 5.5, len * 0.72, 3.5);
    for (let rx = -len * 0.34; rx <= len * 0.3; rx += 9) {
      ctx.fillRect(rx, -6, 2.2, 12);
    }
  } else if (kind === 'military_jeep') {
    // Humvee armored sloped hood with louver vents
    ctx.fillStyle = '#365314';
    ctx.fillRect(len * 0.16, -wid * 0.36, len * 0.26, wid * 0.72);
    ctx.strokeStyle = '#1a2e05';
    ctx.lineWidth = 1.5;
    for (let vx = len * 0.22; vx <= len * 0.38; vx += 6) {
      ctx.beginPath();
      ctx.moveTo(vx, -wid * 0.24);
      ctx.lineTo(vx, wid * 0.24);
      ctx.stroke();
    }
    // Split armored windshield
    drawWindshieldGlass(ctx, len * 0.06, -wid * 0.36, 10, wid * 0.32, 2);
    drawWindshieldGlass(ctx, len * 0.06, wid * 0.04, 10, wid * 0.32, 2);

    // Roof gunner ring & spare tire on rear
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-len * 0.08, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#090d14';
    ctx.fillRect(-len * 0.49, -11, 8, 22);
  } else if (kind === 'armored_apc') {
    // Sloped glacis armor & reactive side skirts
    ctx.fillStyle = '#365314';
    ctx.fillRect(-len * 0.45, -wid * 0.45, len * 0.88, 6);
    ctx.fillRect(-len * 0.45, wid * 0.45 - 6, len * 0.88, 6);

    ctx.strokeStyle = '#1a2e05';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(len * 0.24, -wid * 0.44);
    ctx.lineTo(len * 0.24, wid * 0.44);
    ctx.moveTo(-len * 0.28, -wid * 0.44);
    ctx.lineTo(-len * 0.28, wid * 0.44);
    ctx.stroke();

    // Driver vision periscopes
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(len * 0.3, -14, 5, 8);
    ctx.fillRect(len * 0.3, 6, 5, 8);

    // Crew hatches
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-len * 0.38, -14, 14, 11);
    ctx.fillRect(-len * 0.38, 3, 14, 11);
  }

  ctx.restore();
  return canvas;
}

export function getVehicleSprite(kind: VehicleKind, color: string): HTMLCanvasElement {
  const key = kind === 'civilian_car' ? `${kind}:${color}` : kind;
  let cached = vehicleCache.get(key);
  if (!cached) {
    cached = bakeVehicleCanvas(kind, color);
    vehicleCache.set(key, cached);
  }
  return cached;
}

export function getApcTurretSprite(): HTMLCanvasElement {
  if (apcTurretCanvas) return apcTurretCanvas;
  const S = 140;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.translate(S / 2, S / 2);
    // Autocannon barrel + muzzle brake
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(8, -3.5, 52, 7);
    ctx.fillStyle = '#334155';
    ctx.fillRect(54, -5, 8, 10);

    // Armored turret hull
    ctx.fillStyle = '#3f6212';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -16);
    ctx.lineTo(14, -14);
    ctx.lineTo(22, 0);
    ctx.lineTo(14, 14);
    ctx.lineTo(-20, 16);
    ctx.lineTo(-26, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Optics + Commander hatch
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(10, -11, 6, 5);
    ctx.fillStyle = '#1a2e05';
    ctx.beginPath();
    ctx.arc(-6, 4, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  apcTurretCanvas = c;
  return c;
}

export function getHelicopterSprite(mode: 'evac' | 'gunship'): HTMLCanvasElement {
  let cached = heliCache.get(mode);
  if (cached) return cached;

  const S = 260;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.translate(S / 2, S / 2);
    const isGun = mode === 'gunship';
    const hullMain = isGun ? '#1e3a1e' : '#0f172a';
    const hullTrim = isGun ? '#4ade80' : '#f59e0b';

    // Skids
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-36, -34);
    ctx.lineTo(42, -34);
    ctx.moveTo(-36, 34);
    ctx.lineTo(42, 34);
    ctx.moveTo(-18, -34);
    ctx.lineTo(-14, -18);
    ctx.moveTo(20, -34);
    ctx.lineTo(16, -18);
    ctx.moveTo(-18, 34);
    ctx.lineTo(-14, 18);
    ctx.moveTo(20, 34);
    ctx.lineTo(16, 18);
    ctx.stroke();

    // Gunship stub wings & rocket pods
    if (isGun) {
      ctx.fillStyle = '#14532d';
      ctx.strokeStyle = '#05080f';
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -52, 22, 104);
      ctx.strokeRect(-10, -52, 22, 104);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-6, -54, 24, 10);
      ctx.fillRect(-6, 44, 24, 10);
    }

    // Tail boom + horizontal stabilizers + vertical fin
    ctx.fillStyle = hullMain;
    ctx.strokeStyle = '#05080f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-28, -9);
    ctx.lineTo(-112, -4);
    ctx.lineTo(-112, 4);
    ctx.lineTo(-28, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tail stabilizers
    ctx.fillStyle = hullTrim;
    ctx.fillRect(-98, -22, 10, 44);
    ctx.fillRect(-118, -6, 16, 12);

    // Sculpted fuselage teardrop
    const fGrad = ctx.createLinearGradient(0, -26, 0, 26);
    fGrad.addColorStop(0, isGun ? '#365314' : '#334155');
    fGrad.addColorStop(0.5, hullMain);
    fGrad.addColorStop(1, '#020617');
    ctx.fillStyle = fGrad;
    ctx.strokeStyle = hullTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(6, 0, 56, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dual turbine housings & exhausts
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-24, -15, 36, 11, 4);
    ctx.roundRect(-24, 4, 36, 11, 4);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(-28, -13, 6, 7);
    ctx.fillRect(-28, 6, 6, 7);

    // Armored tinted cockpit glass
    drawWindshieldGlass(ctx, 26, -15, 28, 30, 10);
  }

  heliCache.set(mode, c);
  return c;
}

export function getRotorSprite(): HTMLCanvasElement {
  if (rotorCanvas) return rotorCanvas;
  const S = 260;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, 118, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.fillRect(6, -3.5, 112, 7);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(108, -3.5, 10, 7);
      ctx.restore();
    }
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  rotorCanvas = c;
  return c;
}

/**
 * 3D-Shaded Top-Down Boeing CH-47 Chinook Heavy Tandem-Rotor Transport Helicopter (360x160)
 */
export function getChinookSprite(): HTMLCanvasElement {
  if (chinookSpriteCanvas) return chinookSpriteCanvas;

  const W = 360;
  const H = 160;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.translate(W / 2, H / 2);

  // Side fuel sponsons (distinctive Chinook wide lower pods)
  const sponsonGrad = ctx.createLinearGradient(0, -44, 0, 44);
  sponsonGrad.addColorStop(0, '#4d5d32');
  sponsonGrad.addColorStop(0.5, '#3b4a26');
  sponsonGrad.addColorStop(1, '#263018');
  ctx.fillStyle = sponsonGrad;
  ctx.strokeStyle = '#090d14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-84, -40, 168, 80, 14);
  ctx.fill();
  ctx.stroke();

  // Rear landing gear struts & wheels
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-76, -46, 16, 7);
  ctx.fillRect(-76, 39, 16, 7);
  ctx.fillRect(58, -44, 16, 6);
  ctx.fillRect(58, 38, 16, 6);

  // Main long banana-profile olive-drab fuselage
  const bodyGrad = ctx.createLinearGradient(0, -28, 0, 28);
  bodyGrad.addColorStop(0, '#62733f');
  bodyGrad.addColorStop(0.38, '#4a5930');
  bodyGrad.addColorStop(0.75, '#374422');
  bodyGrad.addColorStop(1, '#1e2612');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#070a0f';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(148, 0);
  ctx.quadraticCurveTo(142, -23, 98, -25);
  ctx.lineTo(-108, -23);
  ctx.lineTo(-138, -16);
  ctx.lineTo(-144, 0);
  ctx.lineTo(-138, 16);
  ctx.lineTo(-108, 23);
  ctx.lineTo(98, 25);
  ctx.quadraticCurveTo(142, 23, 148, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Open rear troop drop ramp + yellow warning floor stripes
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-146, -12, 24, 24);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-145, -12, 22, 2.2);
  ctx.fillRect(-145, 9.8, 22, 2.2);

  // Twin aft T55 turboshaft engine nacelles flanking aft pylon
  for (const ey of [-22, 12]) {
    ctx.fillStyle = '#2a331a';
    ctx.strokeStyle = '#090d14';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-108, ey, 46, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#090d14';
    ctx.fillRect(-112, ey + 2, 5, 6);
  }

  // Dorsal spine tunnel & panel ribbing
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(-94, -10, 178, 20, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1.2;
  for (let rx = -70; rx <= 70; rx += 28) {
    ctx.beginPath();
    ctx.moveTo(rx, -22);
    ctx.lineTo(rx, 22);
    ctx.stroke();
  }

  // Forward & Aft Rotor Pylon Hubs
  for (const hx of [102, -102]) {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#090d14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(hx, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Armored tinted dual cockpit windscreens + overhead brow windows
  drawWindshieldGlass(ctx, 112, -17, 26, 34, 8);
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(86, -15, 8, 5);
  ctx.fillRect(86, 10, 8, 5);

  chinookSpriteCanvas = c;
  return c;
}

export function getChinookRotorSprite(): HTMLCanvasElement {
  if (chinookRotorCanvas) return chinookRotorCanvas;
  const S = 220;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, 102, 0, Math.PI * 2);
    ctx.fill();

    // 3-Blade Chinook Rotor Assembly
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 3);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(6, -4, 96, 8);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(92, -4, 10, 8);
      ctx.restore();
    }
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  chinookRotorCanvas = c;
  return c;
}

/**
 * High-detail Pre-Rendered Top-Down A-10 Thunderbolt II ("Warthog") Sprite (320x320)
 */
export function getA10Sprite(): HTMLCanvasElement {
  if (a10SpriteCanvas) return a10SpriteCanvas;

  const S = 320;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.translate(S / 2, S / 2);

  // Underwing Ordnance Pylons (AGM-65 Mavericks & JDAMs)
  const pylonsY = [-86, -64, -42, 42, 64, 86];
  ctx.fillStyle = '#334155';
  for (const py of pylonsY) {
    ctx.fillRect(-10, py - 2.5, 26, 5);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(12, py - 1.5, 5, 3);
    ctx.fillStyle = '#334155';
  }

  // Broad Straight A-10 Main Wings with Tapered Leading/Trailing Edges & Wingtips
  const wingGrad = ctx.createLinearGradient(0, -148, 0, 148);
  wingGrad.addColorStop(0, '#475569');
  wingGrad.addColorStop(0.5, '#64748b');
  wingGrad.addColorStop(1, '#475569');
  ctx.fillStyle = wingGrad;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, -16);
  ctx.lineTo(14, -144);
  ctx.lineTo(-18, -144);
  ctx.lineTo(-26, -16);
  ctx.lineTo(-26, 16);
  ctx.lineTo(-18, 144);
  ctx.lineTo(14, 144);
  ctx.lineTo(22, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Wing flap & aileron panel seams + landing gear pods
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-14, -140);
  ctx.lineTo(-14, 140);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(4, -40, 18, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(4, 40, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Air Force Star roundels
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.beginPath();
  ctx.arc(0, -104, 7, 0, Math.PI * 2);
  ctx.arc(0, 104, 7, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal Tail & Twin Vertical Stabilizers ("H-Tail")
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-124, -56, 26, 112, 4);
  ctx.fill();
  ctx.stroke();

  // Twin vertical tail fins at tips of horizontal stabilizer
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-128, -58, 32, 7);
  ctx.fillRect(-128, 51, 32, 7);

  // Sculpted Long Fuselage + Tapered Nose
  const fuseGrad = ctx.createLinearGradient(0, -18, 0, 18);
  fuseGrad.addColorStop(0, '#475569');
  fuseGrad.addColorStop(0.5, '#94a3b8');
  fuseGrad.addColorStop(1, '#334155');
  ctx.fillStyle = fuseGrad;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(132, 0);
  ctx.quadraticCurveTo(124, -13, 86, -14);
  ctx.lineTo(-118, -10);
  ctx.lineTo(-124, 0);
  ctx.lineTo(-118, 10);
  ctx.lineTo(86, 14);
  ctx.quadraticCurveTo(124, 13, 132, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // GAU-8 Avenger 30mm Rotary Cannon Barrel protruding from nose!
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(126, -3, 18, 6);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(140, -2, 5, 4);

  // Twin High-Mounted TF34 Turbofan Engine Nacelles behind wing root
  for (const ey of [-22, 22]) {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#05080f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-78, ey - 10, 56, 20, 7);
    ctx.fill();
    ctx.stroke();
    // Intake metallic ring & exhaust cone
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-25, ey - 8, 4, 16);
    ctx.fillStyle = '#090d14';
    ctx.fillRect(-82, ey - 7, 5, 14);
  }

  // Gold-tinted Bubble Canopy
  drawWindshieldGlass(ctx, 46, -8, 42, 16, 7);

  // Subtle shark-mouth nose accent stripe
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(102, -9, 14, 3);
  ctx.fillRect(102, 6, 14, 3);

  a10SpriteCanvas = c;
  return c;
}

/**
 * After-Effects-Style 14-Frame Volumetric 3D Fireball & Smoke Plume Flipbook
 */
export function getExplosionFlipbook(): HTMLCanvasElement {
  if (explosionFlipbook) return explosionFlipbook;

  const canvas = document.createElement('canvas');
  canvas.width = EXPLOSION_FRAMES * EXPLOSION_CELL;
  canvas.height = EXPLOSION_CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  for (let f = 0; f < EXPLOSION_FRAMES; f++) {
    const t = f / (EXPLOSION_FRAMES - 1); // 0 -> 1
    const cx = f * EXPLOSION_CELL + EXPLOSION_CELL / 2;
    const cy = EXPLOSION_CELL / 2;

    ctx.save();
    ctx.translate(cx, cy);

    // 1. Primary Supersonic Mach Ring + Ground Dust Wave (frames 0..7)
    if (t < 0.56) {
      const ringT = t / 0.56;
      const rr = 18 + ringT * 82;
      ctx.strokeStyle = `rgba(255, 247, 205, ${(1 - ringT) * 0.72})`;
      ctx.lineWidth = Math.max(1, (1 - ringT) * 7.5);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();

      const dustR = 14 + ringT * 68;
      ctx.strokeStyle = `rgba(168, 162, 158, ${(1 - ringT) * 0.42})`;
      ctx.lineWidth = Math.max(1.5, (1 - ringT) * 10);
      ctx.beginPath();
      ctx.arc(0, 0, dustR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Incandescent Hot Fragmentation & Shrapnel Streaks (frames 0..8)
    if (t < 0.65) {
      const spT = t / 0.65;
      const spFade = 1 - spT;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.19;
        const rStart = 12 + spT * (38 + (i % 4) * 11);
        const rLen = (16 - spT * 11) * (0.65 + (i % 3) * 0.25);
        ctx.strokeStyle = i % 2 === 0
          ? `rgba(254, 240, 138, ${spFade * 0.9})`
          : `rgba(251, 146, 60, ${spFade * 0.85})`;
        ctx.lineWidth = i % 3 === 0 ? 2.4 : 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rStart, Math.sin(a) * rStart);
        ctx.lineTo(Math.cos(a) * (rStart + rLen), Math.sin(a) * (rStart + rLen));
        ctx.stroke();
      }
    }

    // 3. Outer Billowing Volumetric Charcoal Smoke Plumes (frames 1..13)
    if (t > 0.08) {
      const smokeT = (t - 0.08) / 0.92;
      const puffCount = 16;
      const smokeAlpha = Math.sin(Math.min(1, smokeT * 1.1) * Math.PI) * 0.92;
      for (let i = 0; i < puffCount; i++) {
        const a = (i / puffCount) * Math.PI * 2 + i * 0.62;
        const dist = (8 + smokeT * 56) * (0.62 + ((i * 41) % 10) / 16);
        const px = Math.cos(a) * dist;
        const py = Math.sin(a) * dist - smokeT * 22;
        const pr = 17 + smokeT * 33 + (i % 3) * 5;

        const sg = ctx.createRadialGradient(px - pr * 0.28, py - pr * 0.28, pr * 0.1, px, py, pr);
        const innerEmber = Math.max(0, 1 - smokeT * 1.65);
        sg.addColorStop(
          0,
          innerEmber > 0.25
            ? `rgba(180, 83, 9, ${smokeAlpha * 0.9})`
            : `rgba(87, 83, 78, ${smokeAlpha})`
        );
        sg.addColorStop(0.5, `rgba(41, 37, 36, ${smokeAlpha * 0.95})`);
        sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Turbulent Thermobaric Fireball Lobes & Embers (frames 0..9)
    if (t < 0.78) {
      const fireT = t / 0.78;
      const fireFade = 1 - Math.pow(fireT, 1.65);
      const lobeCount = 12;
      for (let i = 0; i < lobeCount; i++) {
        const a = (i / lobeCount) * Math.PI * 2 + t * 0.75;
        const dist = (4 + fireT * 42) * (0.52 + (i % 4) * 0.19);
        const fx = Math.cos(a) * dist;
        const fy = Math.sin(a) * dist - fireT * 12;
        const fr = (20 + fireT * 28) * fireFade;
        if (fr < 2) continue;

        const fg = ctx.createRadialGradient(fx - fr * 0.22, fy - fr * 0.22, fr * 0.08, fx, fy, fr);
        fg.addColorStop(0, `rgba(255, 253, 240, ${fireFade})`);
        fg.addColorStop(0.28, `rgba(253, 224, 71, ${fireFade * 0.96})`);
        fg.addColorStop(0.62, `rgba(234, 88, 12, ${fireFade * 0.88})`);
        fg.addColorStop(1, 'rgba(127, 29, 29, 0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Blinding White-Hot Detonation Core Flash
      if (t < 0.3) {
        const coreR = (1 - t / 0.3) * 52 + 16;
        const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, coreR);
        cg.addColorStop(0, 'rgba(255, 255, 255, 1)');
        cg.addColorStop(0.4, 'rgba(254, 240, 138, 0.94)');
        cg.addColorStop(0.75, 'rgba(249, 115, 22, 0.45)');
        cg.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  explosionFlipbook = canvas;
  return canvas;
}

/**
 * Pre-renders 4 distinct 3D-shaded blast crater decals with blast scorch, upturned soil, and fractures.
 */
export function getCraterSprite(variant: number): HTMLCanvasElement {
  const idx = ((variant % 4) + 4) % 4;
  if (craterCache[idx]) return craterCache[idx];

  const S = 160;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.translate(S / 2, S / 2);

    // Outer soot scorch rays
    const soot = ctx.createRadialGradient(0, 0, 16, 0, 0, 74);
    soot.addColorStop(0, 'rgba(12, 10, 9, 0.96)');
    soot.addColorStop(0.42, 'rgba(28, 25, 23, 0.88)');
    soot.addColorStop(0.75, 'rgba(68, 64, 60, 0.45)');
    soot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = soot;
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    ctx.fill();

    // Radial blast fracture cracks
    ctx.strokeStyle = 'rgba(12, 10, 9, 0.78)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + idx * 0.4;
      const r1 = 22;
      const r2 = 44 + ((i * 19 + idx * 7) % 24);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a + 0.08) * (r1 + r2) * 0.5, Math.sin(a + 0.08) * (r1 + r2) * 0.5);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }

    // Upturned crater rim bevel (lit top-left, shaded bottom-right for 3D depth)
    const rimGrad = ctx.createLinearGradient(-34, -34, 34, 34);
    rimGrad.addColorStop(0, 'rgba(120, 113, 108, 0.72)');
    rimGrad.addColorStop(0.5, 'rgba(41, 37, 36, 0.9)');
    rimGrad.addColorStop(1, 'rgba(12, 10, 9, 0.95)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rad = 32 + Math.sin(i * 3.1 + idx * 1.9) * 5;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();

    // Deep concave shaded pit center
    const pitGrad = ctx.createRadialGradient(4, 4, 3, 0, 0, 26);
    pitGrad.addColorStop(0, '#070606');
    pitGrad.addColorStop(0.65, '#1c1917');
    pitGrad.addColorStop(1, 'rgba(28, 25, 23, 0)');
    ctx.fillStyle = pitGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  craterCache[idx] = c;
  return c;
}
