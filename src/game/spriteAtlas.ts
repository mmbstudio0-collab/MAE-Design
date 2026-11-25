import { SpriteAnimState } from './types';

export type LODTier = 0 | 1 | 2 | 3;

export const ANIM_STATES: SpriteAnimState[] = ['idle', 'walk', 'run', 'attack', 'shoot', 'hit', 'death'];
export const FRAMES_PER_ANIM = 6;
export const FRAME_SIZE = 80; // 48 cols * 80 = 3840px (< 4096 GPU texture limit), 7 rows * 80 = 560px
export const ZOMBIE_OUTFIT_COUNT = 128;

export interface FlipbookClip {
  name: string;
  fps: number;
  loop: boolean;
  frames: number;
}

export const FLIPBOOK_CLIPS: Record<SpriteAnimState, FlipbookClip> = {
  idle: { name: 'FB_Idle', fps: 4, loop: true, frames: FRAMES_PER_ANIM },
  walk: { name: 'FB_Walk', fps: 10, loop: true, frames: FRAMES_PER_ANIM },
  run: { name: 'FB_Run', fps: 15, loop: true, frames: FRAMES_PER_ANIM },
  attack: { name: 'FB_Attack', fps: 16, loop: false, frames: FRAMES_PER_ANIM },
  shoot: { name: 'FB_Shoot', fps: 24, loop: false, frames: FRAMES_PER_ANIM },
  hit: { name: 'FB_Hit', fps: 18, loop: false, frames: FRAMES_PER_ANIM },
  death: { name: 'FB_Death', fps: 11, loop: false, frames: FRAMES_PER_ANIM },
};

export function sampleFlipbookFrame(
  anim: SpriteAnimState,
  clockSec: number,
  progressOverride?: number
): number {
  const clip = FLIPBOOK_CLIPS[anim];
  if (progressOverride !== undefined) {
    const p = Math.max(0, Math.min(0.9999, progressOverride));
    return Math.floor(p * clip.frames);
  }
  const rawFrame = Math.floor(Math.max(0, clockSec) * clip.fps);
  if (clip.loop) {
    return rawFrame % clip.frames;
  }
  return Math.min(clip.frames - 1, rawFrame);
}

export type LocomotionProfile = 'civilian' | 'police' | 'soldier' | 'zombie';

export interface ArchetypeVisualSpec {
  id: string;
  motionProfile: LocomotionProfile;
  torsoColor: string;
  vestColor: string;
  pantsColor: string;
  skinColor: string;
  headgearColor: string;
  visorColor?: string;
  accentColor?: string;
  shoulderWidth: number;
  torsoDepth: number;
  weapon: 'none' | 'pistol' | 'smg' | 'rifle' | 'sniper' | 'lmg' | 'shield' | 'zombie_arms';
  backpack?: 'mil' | 'medic' | 'civ_pack' | 'none';
  hairStyle?: 'short' | 'long' | 'bun' | 'bald' | 'helmet' | 'cap' | 'beret';
  isZombie?: boolean;
  isCrawler?: boolean;
  isFat?: boolean;
}

const ARCHETYPES: Record<string, ArchetypeVisualSpec> = {
  civ_male: {
    id: 'civ_male',
    motionProfile: 'civilian',
    torsoColor: '#3b82f6',
    vestColor: '#1e3a8a',
    pantsColor: '#1e293b',
    skinColor: '#f3c69f',
    headgearColor: '#271c15',
    accentColor: '#93c5fd',
    shoulderWidth: 1.0,
    torsoDepth: 0.92,
    weapon: 'none',
    backpack: 'civ_pack',
    hairStyle: 'short',
  },
  civ_female: {
    id: 'civ_female',
    motionProfile: 'civilian',
    torsoColor: '#ec4899',
    vestColor: '#9d174d',
    pantsColor: '#334155',
    skinColor: '#f6cfa9',
    headgearColor: '#451a03',
    accentColor: '#f9a8d4',
    shoulderWidth: 0.88,
    torsoDepth: 0.84,
    weapon: 'none',
    backpack: 'none',
    hairStyle: 'long',
  },
  civ_elderly: {
    id: 'civ_elderly',
    motionProfile: 'civilian',
    torsoColor: '#94a3b8',
    vestColor: '#475569',
    pantsColor: '#1e293b',
    skinColor: '#ebc09b',
    headgearColor: '#e2e8f0',
    accentColor: '#cbd5e1',
    shoulderWidth: 0.94,
    torsoDepth: 0.95,
    weapon: 'none',
    backpack: 'none',
    hairStyle: 'short',
  },
  civ_armed: {
    id: 'civ_armed',
    motionProfile: 'civilian',
    torsoColor: '#d97706',
    vestColor: '#78350f',
    pantsColor: '#1e293b',
    skinColor: '#f3c69f',
    headgearColor: '#1c1917',
    accentColor: '#fcd34d',
    shoulderWidth: 1.02,
    torsoDepth: 0.94,
    weapon: 'pistol',
    backpack: 'civ_pack',
    hairStyle: 'short',
  },
  police_normal: {
    id: 'police_normal',
    motionProfile: 'police',
    torsoColor: '#2563eb',
    vestColor: '#0f172a',
    pantsColor: '#0f172a',
    skinColor: '#f3c69f',
    headgearColor: '#1e3a8a',
    visorColor: '#f8fafc',
    accentColor: '#60a5fa',
    shoulderWidth: 1.04,
    torsoDepth: 0.94,
    weapon: 'pistol',
    hairStyle: 'cap',
  },
  police_traffic: {
    id: 'police_traffic',
    motionProfile: 'police',
    torsoColor: '#1e3a8a',
    vestColor: '#eab308',
    pantsColor: '#0f172a',
    skinColor: '#f3c69f',
    headgearColor: '#f8fafc',
    visorColor: '#0f172a',
    accentColor: '#fde047',
    shoulderWidth: 1.04,
    torsoDepth: 0.94,
    weapon: 'pistol',
    hairStyle: 'cap',
  },
  police_special_ops: {
    id: 'police_special_ops',
    motionProfile: 'police',
    torsoColor: '#0f172a',
    vestColor: '#1e293b',
    pantsColor: '#020617',
    skinColor: '#e2b48d',
    headgearColor: '#0f172a',
    visorColor: '#38bdf8',
    accentColor: '#38bdf8',
    shoulderWidth: 1.1,
    torsoDepth: 0.98,
    weapon: 'smg',
    backpack: 'mil',
    hairStyle: 'helmet',
  },
  police_swat: {
    id: 'police_swat',
    motionProfile: 'police',
    torsoColor: '#1e293b',
    vestColor: '#090d16',
    pantsColor: '#0f172a',
    skinColor: '#e2b48d',
    headgearColor: '#0f172a',
    visorColor: '#7dd3fc',
    accentColor: '#38bdf8',
    shoulderWidth: 1.14,
    torsoDepth: 1.02,
    weapon: 'smg',
    backpack: 'mil',
    hairStyle: 'helmet',
  },
  police_commissioner: {
    id: 'police_commissioner',
    motionProfile: 'police',
    torsoColor: '#1d4ed8',
    vestColor: '#172554',
    pantsColor: '#0f172a',
    skinColor: '#f3c69f',
    headgearColor: '#1e3a8a',
    visorColor: '#fbbf24',
    accentColor: '#fbbf24',
    shoulderWidth: 1.05,
    torsoDepth: 0.95,
    weapon: 'smg',
    hairStyle: 'cap',
  },
  police_riot_shield: {
    id: 'police_riot_shield',
    motionProfile: 'police',
    torsoColor: '#1e293b',
    vestColor: '#1d4ed8',
    pantsColor: '#0f172a',
    skinColor: '#e2b48d',
    headgearColor: '#0f172a',
    visorColor: '#38bdf8',
    accentColor: '#7dd3fc',
    shoulderWidth: 1.14,
    torsoDepth: 1.02,
    weapon: 'shield',
    hairStyle: 'helmet',
  },
  soldier_infantry: {
    id: 'soldier_infantry',
    motionProfile: 'soldier',
    torsoColor: '#4d7c0f',
    vestColor: '#1a2e05',
    pantsColor: '#365314',
    skinColor: '#e7b892',
    headgearColor: '#365314',
    visorColor: '#0f172a',
    accentColor: '#a3e635',
    shoulderWidth: 1.14,
    torsoDepth: 1.04,
    weapon: 'rifle',
    backpack: 'mil',
    hairStyle: 'helmet',
  },
  soldier_commando: {
    id: 'soldier_commando',
    motionProfile: 'soldier',
    torsoColor: '#15803d',
    vestColor: '#052e16',
    pantsColor: '#166534',
    skinColor: '#e7b892',
    headgearColor: '#b91c1c',
    accentColor: '#4ade80',
    shoulderWidth: 1.14,
    torsoDepth: 1.02,
    weapon: 'rifle',
    backpack: 'mil',
    hairStyle: 'beret',
  },
  soldier_sniper: {
    id: 'soldier_sniper',
    motionProfile: 'soldier',
    torsoColor: '#65a30d',
    vestColor: '#365314',
    pantsColor: '#3f6212',
    skinColor: '#e7b892',
    headgearColor: '#3f6212',
    visorColor: '#1e293b',
    accentColor: '#bef264',
    shoulderWidth: 1.08,
    torsoDepth: 0.96,
    weapon: 'sniper',
    backpack: 'mil',
    hairStyle: 'helmet',
  },
  soldier_heavy: {
    id: 'soldier_heavy',
    motionProfile: 'soldier',
    torsoColor: '#365314',
    vestColor: '#1e293b',
    pantsColor: '#1a2e05',
    skinColor: '#e7b892',
    headgearColor: '#1e293b',
    visorColor: '#fbbf24',
    accentColor: '#fbbf24',
    shoulderWidth: 1.28,
    torsoDepth: 1.15,
    weapon: 'lmg',
    backpack: 'mil',
    hairStyle: 'helmet',
  },
  soldier_medic: {
    id: 'soldier_medic',
    motionProfile: 'soldier',
    torsoColor: '#16a34a',
    vestColor: '#14532d',
    pantsColor: '#166534',
    skinColor: '#e7b892',
    headgearColor: '#f8fafc',
    visorColor: '#ef4444',
    accentColor: '#f8fafc',
    shoulderWidth: 1.08,
    torsoDepth: 0.99,
    weapon: 'pistol',
    backpack: 'medic',
    hairStyle: 'helmet',
  },
  soldier_paratrooper: {
    id: 'soldier_paratrooper',
    motionProfile: 'soldier',
    torsoColor: '#166534',
    vestColor: '#14532d',
    pantsColor: '#1e293b',
    skinColor: '#e7b892',
    headgearColor: '#15803d',
    visorColor: '#0f172a',
    accentColor: '#86efac',
    shoulderWidth: 1.14,
    torsoDepth: 1.04,
    weapon: 'rifle',
    backpack: 'mil',
    hairStyle: 'helmet',
  },
  zombie_walker: {
    id: 'zombie_walker',
    motionProfile: 'zombie',
    torsoColor: '#6b7280',
    vestColor: '#7f1d1d',
    pantsColor: '#1f2937',
    skinColor: '#8fa876',
    headgearColor: '#27272a',
    shoulderWidth: 1.02,
    torsoDepth: 0.94,
    weapon: 'zombie_arms',
    hairStyle: 'short',
    isZombie: true,
  },
  zombie_runner: {
    id: 'zombie_runner',
    motionProfile: 'zombie',
    torsoColor: '#9a3412',
    vestColor: '#7f1d1d',
    pantsColor: '#1e293b',
    skinColor: '#a3b18a',
    headgearColor: '#451a03',
    shoulderWidth: 0.96,
    torsoDepth: 0.88,
    weapon: 'zombie_arms',
    hairStyle: 'bald',
    isZombie: true,
  },
  zombie_heavy: {
    id: 'zombie_heavy',
    motionProfile: 'zombie',
    torsoColor: '#450a0a',
    vestColor: '#7f1d1d',
    pantsColor: '#0f172a',
    skinColor: '#7f9c6b',
    headgearColor: '#1c1917',
    shoulderWidth: 1.32,
    torsoDepth: 1.18,
    weapon: 'zombie_arms',
    hairStyle: 'bald',
    isZombie: true,
  },
  zombie_fat: {
    id: 'zombie_fat',
    motionProfile: 'zombie',
    torsoColor: '#52525b',
    vestColor: '#7f1d1d',
    pantsColor: '#18181b',
    skinColor: '#9ab386',
    headgearColor: '#3f3f46',
    shoulderWidth: 1.38,
    torsoDepth: 1.32,
    weapon: 'zombie_arms',
    hairStyle: 'bald',
    isZombie: true,
    isFat: true,
  },
  zombie_crawler: {
    id: 'zombie_crawler',
    motionProfile: 'zombie',
    torsoColor: '#4d7c0f',
    vestColor: '#7f1d1d',
    pantsColor: '#1e293b',
    skinColor: '#a3be8c',
    headgearColor: '#1e293b',
    shoulderWidth: 0.95,
    torsoDepth: 1.08,
    weapon: 'zombie_arms',
    hairStyle: 'bald',
    isZombie: true,
    isCrawler: true,
  },
  zombie_fresh: {
    id: 'zombie_fresh',
    motionProfile: 'zombie',
    torsoColor: '#64748b',
    vestColor: '#991b1b',
    pantsColor: '#334155',
    skinColor: '#9bb384',
    headgearColor: '#1e293b',
    shoulderWidth: 1.0,
    torsoDepth: 0.92,
    weapon: 'zombie_arms',
    hairStyle: 'short',
    isZombie: true,
  },
};

// ============================================================================
// 128 Distinct Modeled Zombie Wardrobes (Zero VRAM Bloat)
// ============================================================================
type GarmentStyle =
  | 'hoodie'
  | 'jacket_open'
  | 'business_suit'
  | 'scrubs'
  | 'lab_coat'
  | 'firefighter'
  | 'chef_apron'
  | 'hivis_vest'
  | 'leather_biker'
  | 'tracksuit'
  | 'denim'
  | 'trenchcoat'
  | 'mechanic'
  | 'varsity'
  | 'flannel'
  | 'security_guard';

type HeadgearType = 'bald' | 'messy_hair' | 'long_hair' | 'beanie' | 'cap' | 'hardhat' | 'bandaged' | 'helmet_cracked';

export interface ZombieOutfitSpec {
  id: number;
  garment: GarmentStyle;
  baseColor: string;
  secondaryColor: string;
  trimColor: string;
  skinColor: string;
  hairColor: string;
  headgear: HeadgearType;
  bloodLevel: number; // 0..3
  hasBackpack: boolean;
  tornShoulder: 'left' | 'right' | 'both' | 'none';
}

const GARMENT_STYLES: GarmentStyle[] = [
  'hoodie',
  'jacket_open',
  'business_suit',
  'scrubs',
  'lab_coat',
  'firefighter',
  'chef_apron',
  'hivis_vest',
  'leather_biker',
  'tracksuit',
  'denim',
  'trenchcoat',
  'mechanic',
  'varsity',
  'flannel',
  'security_guard',
];

const GARMENT_PALETTES: Record<GarmentStyle, { base: string[]; sec: string[]; trim: string[] }> = {
  hoodie: {
    base: ['#475569', '#7f1d1d', '#1e3a8a', '#3f6212', '#581c87', '#7c2d12', '#0f766e', '#334155'],
    sec: ['#1e293b', '#450a0a', '#172554', '#1a2e05', '#3b0764', '#431407', '#134e4a', '#0f172a'],
    trim: ['#cbd5e1', '#fca5a5', '#93c5fd', '#bef264', '#d8b4fe', '#fdba74', '#5eead4', '#94a3b8'],
  },
  jacket_open: {
    base: ['#78350f', '#1e293b', '#3f3f46', '#365314', '#881337', '#1e3a8a'],
    sec: ['#e2e8f0', '#94a3b8', '#f1f5f9', '#d6d3d1', '#cbd5e1', '#bae6fd'],
    trim: ['#451a03', '#0f172a', '#27272a', '#1a2e05', '#4c0519', '#172554'],
  },
  business_suit: {
    base: ['#1e293b', '#0f172a', '#334155', '#27272a', '#1c1917', '#172554'],
    sec: ['#f8fafc', '#e2e8f0', '#dbeafe', '#f1f5f9'],
    trim: ['#dc2626', '#1d4ed8', '#78350f', '#475569', '#b45309'],
  },
  scrubs: {
    base: ['#0d9488', '#0284c7', '#2563eb', '#059669', '#4f46e5'],
    sec: ['#115e59', '#075985', '#1e40af', '#065f46', '#3730a3'],
    trim: ['#99f6e4', '#bae6fd', '#cbd5e1', '#a7f3d0', '#c7d2fe'],
  },
  lab_coat: {
    base: ['#e2e8f0', '#f1f5f9', '#cbd5e1', '#f8fafc'],
    sec: ['#1e3a8a', '#0f766e', '#334155', '#475569'],
    trim: ['#94a3b8', '#64748b', '#0ea5e9', '#dc2626'],
  },
  firefighter: {
    base: ['#b45309', '#1c1917', '#7c2d12', '#991b1b'],
    sec: ['#facc15', '#bef264', '#fde047'],
    trim: ['#e2e8f0', '#cbd5e1'],
  },
  chef_apron: {
    base: ['#f8fafc', '#e2e8f0', '#1e293b'],
    sec: ['#cbd5e1', '#94a3b8', '#ffffff'],
    trim: ['#dc2626', '#334155', '#b91c1c'],
  },
  hivis_vest: {
    base: ['#eab308', '#f97316', '#84cc16', '#facc15'],
    sec: ['#1e293b', '#334155', '#1d4ed8', '#3f3f46'],
    trim: ['#f8fafc', '#e2e8f0'],
  },
  leather_biker: {
    base: ['#090d16', '#18181b', '#27272a', '#3f1d0b'],
    sec: ['#7f1d1d', '#334155', '#f1f5f9'],
    trim: ['#cbd5e1', '#94a3b8', '#facc15'],
  },
  tracksuit: {
    base: ['#dc2626', '#2563eb', '#059669', '#0f172a', '#7c3aed', '#ea580c'],
    sec: ['#f8fafc', '#facc15', '#38bdf8', '#e2e8f0'],
    trim: ['#ffffff', '#fde047'],
  },
  denim: {
    base: ['#1d4ed8', '#1e40af', '#2563eb', '#3b82f6'],
    sec: ['#cbd5e1', '#f8fafc', '#475569', '#991b1b'],
    trim: ['#ca8a04', '#d97706'],
  },
  trenchcoat: {
    base: ['#a16207', '#78350f', '#57534e', '#44403c', '#1e293b'],
    sec: ['#451a03', '#292524', '#0f172a'],
    trim: ['#d6d3d1', '#b45309'],
  },
  mechanic: {
    base: ['#1e3a8a', '#365314', '#334155', '#7c2d12'],
    sec: ['#0f172a', '#1c1917', '#475569'],
    trim: ['#94a3b8', '#f59e0b'],
  },
  varsity: {
    base: ['#991b1b', '#1e3a8a', '#14532d', '#4c1d95', '#b45309'],
    sec: ['#f8fafc', '#facc15', '#e2e8f0'],
    trim: ['#fca5a5', '#93c5fd', '#86efac', '#fde047'],
  },
  flannel: {
    base: ['#b91c1c', '#15803d', '#1d4ed8', '#a16207', '#4c0519'],
    sec: ['#0f172a', '#1c1917', '#27272a'],
    trim: ['#e2e8f0', '#f8fafc'],
  },
  security_guard: {
    base: ['#38bdf8', '#1e3a8a', '#475569', '#0f172a'],
    sec: ['#0f172a', '#172554', '#1e293b'],
    trim: ['#facc15', '#cbd5e1'],
  },
};

const ZOMBIE_SKINS = ['#8fa876', '#a3b18a', '#7f9c6b', '#9ab386', '#849b72', '#a8b594', '#728c69', '#96a883'];
const HAIR_COLORS = ['#18181b', '#271c15', '#451a03', '#78350f', '#9ca3af', '#52525b', '#7c2d12'];
const HEADGEARS: HeadgearType[] = ['bald', 'messy_hair', 'long_hair', 'beanie', 'cap', 'hardhat', 'bandaged', 'helmet_cracked'];

function buildZombieOutfitCatalog(): ZombieOutfitSpec[] {
  const list: ZombieOutfitSpec[] = [];
  for (let i = 0; i < ZOMBIE_OUTFIT_COUNT; i++) {
    const garment = GARMENT_STYLES[i % GARMENT_STYLES.length];
    const variant = Math.floor(i / GARMENT_STYLES.length); // 0..7
    const pal = GARMENT_PALETTES[garment];
    const baseColor = pal.base[(i * 3 + variant) % pal.base.length];
    const secondaryColor = pal.sec[(i * 5 + variant) % pal.sec.length];
    const trimColor = pal.trim[(i * 7 + variant) % pal.trim.length];
    const skinColor = ZOMBIE_SKINS[(i * 3 + 1) % ZOMBIE_SKINS.length];
    const hairColor = HAIR_COLORS[(i * 5 + 2) % HAIR_COLORS.length];

    let headgear = HEADGEARS[(i * 11 + variant) % HEADGEARS.length];
    if (garment === 'hivis_vest' || garment === 'mechanic') headgear = i % 2 === 0 ? 'hardhat' : 'cap';
    if (garment === 'firefighter') headgear = 'helmet_cracked';
    if (garment === 'chef_apron') headgear = 'beanie';

    const tornCycle: ('left' | 'right' | 'both' | 'none')[] = ['none', 'left', 'right', 'both'];
    list.push({
      id: i,
      garment,
      baseColor,
      secondaryColor,
      trimColor,
      skinColor,
      hairColor,
      headgear,
      bloodLevel: (i * 3 + variant) % 4,
      hasBackpack: i % 5 === 0 && garment !== 'lab_coat' && garment !== 'firefighter',
      tornShoulder: tornCycle[(i + variant) % 4],
    });
  }
  return list;
}

export const ZOMBIE_OUTFIT_CATALOG: ZombieOutfitSpec[] = buildZombieOutfitCatalog();

interface CachedSpriteSheet {
  canvas: HTMLCanvasElement;
  lod2Canvas: HTMLCanvasElement;
}

const atlasCache = new Map<string, CachedSpriteSheet>();
const zombieOutfitStampCache = new Map<number, HTMLCanvasElement>();
const glowSpriteCache = new Map<string, HTMLCanvasElement>();

function getGlowSprite(color: string): HTMLCanvasElement {
  const cached = glowSpriteCache.get(color);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(24, 24, 3, 24, 24, 23);
    g.addColorStop(0, color + 'b8');
    g.addColorStop(0.5, color + '3d');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(24, 24, 23, 0, Math.PI * 2);
    ctx.fill();
  }
  glowSpriteCache.set(color, c);
  return c;
}

/**
 * Draws an anatomically proportioned top-down human head:
 * - Visible neck connecting collar to skull
 * - Contoured oval cranium (forward jaw/nose bridge + subtle cheekbones + ears)
 * - Styled hair / officer cap / tactical helmet / beret / NVG visor
 */
function drawAnatomicalHead(
  ctx: CanvasRenderingContext2D,
  spec: ArchetypeVisualSpec,
  skinColor: string,
  headgearColor: string,
  hairStyle?: ArchetypeVisualSpec['hairStyle'],
  visorColor?: string,
  isZombie?: boolean
) {
  // Neck connecting torso trapezius to skull base
  ctx.fillStyle = skinColor;
  ctx.strokeStyle = '#04070d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0.4, 0, 3.6, 3.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ears
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(1.9, -5.6, 1.3, 1.7, 0.2, 0, Math.PI * 2);
  ctx.ellipse(1.9, 5.6, 1.3, 1.7, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Cranium + sculpted jaw/nose contour (longer along facing +X, slightly tapered jaw)
  ctx.fillStyle = skinColor;
  ctx.strokeStyle = '#04070d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8.3, 0); // subtle nose/jaw forward contour
  ctx.bezierCurveTo(8.0, 3.5, 5.4, 5.5, 2.2, 5.5);
  ctx.bezierCurveTo(-1.8, 5.5, -4.0, 3.4, -4.0, 0);
  ctx.bezierCurveTo(-4.0, -3.4, -1.8, -5.5, 2.2, -5.5);
  ctx.bezierCurveTo(5.4, -5.5, 8.0, -3.5, 8.3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Facial shadow / eye brow ridge detail
  if (isZombie) {
    ctx.fillStyle = 'rgba(20, 30, 12, 0.55)';
    ctx.beginPath();
    ctx.arc(5.4, -2.0, 1.25, 0, Math.PI * 2);
    ctx.arc(5.4, 2.0, 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(153, 27, 27, 0.72)';
    ctx.beginPath();
    ctx.ellipse(6.5, 0.8, 1.3, 1.9, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(5.6, -2.6);
    ctx.quadraticCurveTo(6.3, 0, 5.6, 2.6);
    ctx.stroke();
  }

  // Headgear / Hair
  if (hairStyle === 'helmet') {
    ctx.fillStyle = headgearColor;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(1.5, 0, 6.6, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Helmet tactical rails & crown specular rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(1.2, 0, 4.7, -Math.PI * 0.82, -Math.PI * 0.16);
    ctx.stroke();

    // NVG mount bracket / tactical goggles
    if (visorColor) {
      ctx.fillStyle = visorColor;
      ctx.beginPath();
      ctx.arc(4.8, 0, 4.3, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.fill();
    }
    if (spec.id === 'soldier_medic') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0.2, -2.6, 2.2, 5.2);
      ctx.fillRect(-1.3, -1.1, 5.2, 2.2);
    }
  } else if (hairStyle === 'cap') {
    ctx.fillStyle = headgearColor;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(1.4, 0, 6.0, 5.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Structured visor brim
    ctx.fillStyle = visorColor || '#0f172a';
    ctx.beginPath();
    ctx.ellipse(6.8, 0, 3.2, 4.1, 0, -Math.PI * 0.48, Math.PI * 0.48);
    ctx.fill();

    // Officer crest insignia
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(4.9, 0, 1.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (hairStyle === 'beret') {
    ctx.fillStyle = headgearColor;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0.8, -1.3, 6.7, 5.5, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (hairStyle !== 'bald') {
    ctx.fillStyle = headgearColor;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.ellipse(0.4, 0, hairStyle === 'long' ? 6.5 : 5.4, 5.5, 0, Math.PI * 0.34, Math.PI * 1.66);
    ctx.fill();
    ctx.stroke();
    if (hairStyle === 'long') {
      // Flowing back hair strand
      ctx.beginPath();
      ctx.ellipse(-3.6, 0, 3.5, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draws an anatomically tapered top-down torso (trapezius shoulders tapering to waist/hips)
 * instead of a plain rectangle or ellipse.
 */
function traceAnatomicalTorsoPath(ctx: CanvasRenderingContext2D, sw: number, td: number) {
  const wShoulder = 13.0 * sw;
  const wWaist = 9.2 * sw;
  const frontX = 7.6 * td;
  const backX = -7.8 * td;

  ctx.beginPath();
  ctx.moveTo(frontX * 0.85, -wWaist * 0.52);
  // Front chest contour across shoulders
  ctx.bezierCurveTo(frontX, -wShoulder * 0.85, frontX * 0.45, -wShoulder, 0, -wShoulder);
  // Left shoulder blade tapering down to waist/hip
  ctx.bezierCurveTo(backX * 0.55, -wShoulder * 0.96, backX, -wWaist * 0.95, backX * 0.95, 0);
  // Right hip back up to right shoulder
  ctx.bezierCurveTo(backX, wWaist * 0.95, backX * 0.55, wShoulder * 0.96, 0, wShoulder);
  ctx.bezierCurveTo(frontX * 0.45, wShoulder, frontX, wShoulder * 0.85, frontX * 0.85, wWaist * 0.52);
  ctx.closePath();
}

/**
 * Renders an individual pre-baked 64x64 top-down stamp for one of the 128 modeled zombie outfits.
 * Layered dynamically over the animated zombie limbs/legs at render time.
 */
function getOrBakeZombieOutfitStamp(outfitId: number): HTMLCanvasElement {
  const safeId = ((outfitId % ZOMBIE_OUTFIT_COUNT) + ZOMBIE_OUTFIT_COUNT) % ZOMBIE_OUTFIT_COUNT;
  const cached = zombieOutfitStampCache.get(safeId);
  if (cached) return cached;

  const spec = ZOMBIE_OUTFIT_CATALOG[safeId];
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.translate(32, 32);

    // Optional ragged backpack / satchel
    if (spec.hasBackpack) {
      ctx.fillStyle = spec.secondaryColor;
      ctx.strokeStyle = '#04070d';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-12.5, -5.8, 6.2, 11.6, 2.2);
      ctx.fill();
      ctx.stroke();
    }

    // Anatomical shoulder/torso coat silhouette
    ctx.fillStyle = spec.baseColor;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.8;
    traceAnatomicalTorsoPath(ctx, 1.0, 0.95);
    ctx.fill();
    ctx.stroke();

    // Garment-specific anatomical modeling!
    if (spec.garment === 'jacket_open' || spec.garment === 'trenchcoat' || spec.garment === 'lab_coat') {
      // Open front lapels showing undershirt
      ctx.fillStyle = spec.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(3.6, 0, 4.2, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Jacket collar lapels
      ctx.strokeStyle = spec.trimColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(6.0, -3.5);
      ctx.lineTo(1.5, -1.8);
      ctx.moveTo(6.0, 3.5);
      ctx.lineTo(1.5, 1.8);
      ctx.stroke();
    } else if (spec.garment === 'business_suit') {
      // Crisp white shirt V + neck tie
      ctx.fillStyle = spec.secondaryColor;
      ctx.beginPath();
      ctx.moveTo(6.8, -3.2);
      ctx.lineTo(1.2, 0);
      ctx.lineTo(6.8, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = spec.trimColor;
      ctx.fillRect(3.2, -0.9, 4.4, 1.8);
    } else if (spec.garment === 'hivis_vest' || spec.garment === 'firefighter') {
      // Reflective high-visibility shoulder & chest stripes
      ctx.fillStyle = spec.secondaryColor;
      ctx.fillRect(-5.0, -9.5, 4.5, 3.2);
      ctx.fillRect(-5.0, 6.3, 4.5, 3.2);
      ctx.fillStyle = spec.trimColor;
      ctx.fillRect(-2.0, -10.0, 2.2, 20.0);
    } else if (spec.garment === 'chef_apron') {
      // Apron bib & neck strap
      ctx.fillStyle = spec.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(2.5, 0, 5.2, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.garment === 'tracksuit' || spec.garment === 'varsity') {
      // Racing stripes down shoulders + contrasting sleeves
      ctx.fillStyle = spec.secondaryColor;
      ctx.fillRect(-2.5, -12.0, 5.0, 2.2);
      ctx.fillRect(-2.5, 9.8, 5.0, 2.2);
    } else if (spec.garment === 'flannel') {
      // Subtle plaid cross-hatch lines
      ctx.strokeStyle = spec.secondaryColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-5, -8);
      ctx.lineTo(6, -8);
      ctx.moveTo(-5, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(-5, 8);
      ctx.lineTo(6, 8);
      ctx.moveTo(0, -11);
      ctx.lineTo(0, 11);
      ctx.stroke();
    } else if (spec.garment === 'hoodie') {
      // Draped hood behind neck
      ctx.fillStyle = spec.secondaryColor;
      ctx.strokeStyle = '#04070d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(-4.6, 0, 4.5, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (spec.garment === 'security_guard' || spec.garment === 'leather_biker') {
      // Diagonal bandolier / shoulder badge / zipper line
      ctx.strokeStyle = spec.trimColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, -9);
      ctx.lineTo(5, 8);
      ctx.stroke();
    }

    // Exposed necrotic shoulder tears revealing skin underneath
    if (spec.tornShoulder === 'left' || spec.tornShoulder === 'both') {
      ctx.fillStyle = spec.skinColor;
      ctx.beginPath();
      ctx.ellipse(0.5, -10.2, 3.2, 2.4, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (spec.tornShoulder === 'right' || spec.tornShoulder === 'both') {
      ctx.fillStyle = spec.skinColor;
      ctx.beginPath();
      ctx.ellipse(0.5, 10.2, 3.2, 2.4, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dried blood / trauma splashes based on bloodLevel
    if (spec.bloodLevel >= 1) {
      ctx.fillStyle = 'rgba(153, 27, 27, 0.82)';
      ctx.beginPath();
      ctx.ellipse(3.6, 3.0, 3.4, 2.4, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (spec.bloodLevel >= 2) {
      ctx.fillStyle = 'rgba(127, 29, 29, 0.78)';
      ctx.beginPath();
      ctx.ellipse(1.2, -4.5, 3.8, 2.6, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (spec.bloodLevel >= 3) {
      ctx.fillStyle = 'rgba(185, 28, 28, 0.75)';
      ctx.beginPath();
      ctx.ellipse(-2.8, 1.5, 3.0, 3.8, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Anatomical head + specific zombie headgear
    const hairStyle: ArchetypeVisualSpec['hairStyle'] =
      spec.headgear === 'bald'
        ? 'bald'
        : spec.headgear === 'long_hair'
          ? 'long'
          : spec.headgear === 'cap'
            ? 'cap'
            : spec.headgear === 'hardhat' || spec.headgear === 'helmet_cracked'
              ? 'helmet'
              : 'short';

    const headColor =
      spec.headgear === 'hardhat'
        ? '#facc15'
        : spec.headgear === 'helmet_cracked'
          ? '#991b1b'
          : spec.headgear === 'beanie'
            ? spec.trimColor
            : spec.headgear === 'bandaged'
              ? '#e2e8f0'
              : spec.hairColor;

    drawAnatomicalHead(
      ctx,
      ARCHETYPES.zombie_walker,
      spec.skinColor,
      headColor,
      hairStyle,
      spec.headgear === 'cap' ? spec.secondaryColor : undefined,
      true
    );

    if (spec.headgear === 'beanie') {
      ctx.fillStyle = spec.trimColor;
      ctx.strokeStyle = '#04070d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0.6, 0, 5.4, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (spec.headgear === 'bandaged') {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-2, -4.5);
      ctx.lineTo(5, 4.5);
      ctx.moveTo(0, 4.8);
      ctx.lineTo(4.5, -4.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(185, 28, 28, 0.85)';
      ctx.beginPath();
      ctx.arc(3.5, -1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  zombieOutfitStampCache.set(safeId, c);
  return c;
}

/**
 * Computes distinct locomotion kinematics for Police vs Soldiers vs Civilians vs Zombies.
 * - Police: upright agile sprint, brisk arm pump, higher cadence twist, weapon high-ready
 * - Soldier: braced lower tactical combat stride, heavy pack bounce, tight two-handed rifle cradle
 */
function computeMotionKinematics(
  profile: LocomotionProfile,
  anim: SpriteAnimState,
  frame: number
) {
  const tNorm = frame / FRAMES_PER_ANIM;
  const phase = tNorm * Math.PI * 2;
  let stride = 0;
  let armSwing = 0;
  let lunge = 0;
  let torsoTwist = 0;
  let recoil = 0;
  let breathScale = 1;
  let leanTilt = 0;

  if (anim === 'idle') {
    breathScale = 1 + Math.sin(phase) * (profile === 'soldier' ? 0.025 : 0.035);
    torsoTwist = Math.sin(phase) * 0.04;
  } else if (anim === 'walk') {
    stride = Math.sin(phase) * (profile === 'police' ? 9.0 : profile === 'soldier' ? 7.6 : 8.2);
    armSwing = Math.sin(phase) * (profile === 'police' ? 5.2 : 3.2);
    torsoTwist = Math.sin(phase) * (profile === 'police' ? 0.12 : 0.07);
  } else if (anim === 'run') {
    if (profile === 'police') {
      // Agile upright police pursuit sprint: long stride, crisp elbow pump, dynamic shoulder sway
      stride = Math.sin(phase) * 14.0;
      armSwing = Math.sin(phase) * 9.2;
      torsoTwist = Math.sin(phase) * 0.22;
      lunge = 2.0 + Math.abs(Math.cos(phase)) * 1.6;
      leanTilt = 0.06;
    } else if (profile === 'soldier') {
      // Heavy tactical infantry run: planted boots, minimal chest twist due to plate carrier & rifle cradle
      stride = Math.sin(phase) * 10.6;
      armSwing = Math.sin(phase) * 2.2;
      torsoTwist = Math.sin(phase) * 0.075;
      lunge = 1.0 + Math.abs(Math.sin(phase)) * 1.1;
      leanTilt = -0.02;
    } else {
      stride = Math.sin(phase) * 12.6;
      armSwing = Math.sin(phase) * 7.8;
      torsoTwist = Math.sin(phase) * 0.17;
      lunge = 1.6 + Math.abs(Math.cos(phase)) * 1.4;
      leanTilt = 0.04;
    }
  } else if (anim === 'attack') {
    const lungeCurve = [-2.5, 1.5, 7.8, 9.2, 5.0, 0.5][frame] ?? 0;
    const twistCurve = [-0.22, -0.06, 0.28, 0.32, 0.12, -0.05][frame] ?? 0;
    lunge = lungeCurve;
    armSwing = 6 + lungeCurve * 0.65;
    torsoTwist = twistCurve;
  } else if (anim === 'shoot') {
    const recoilCurve = [0, -4.6, -3.2, -1.5, -0.5, 0][frame] ?? 0;
    recoil = recoilCurve;
    torsoTwist = frame === 1 ? -0.1 : frame === 2 ? -0.06 : 0;
  } else if (anim === 'hit') {
    const stagger = [-5.0, -4.2, -2.6, -1.5, -0.6, 0][frame] ?? 0;
    recoil = stagger;
    lunge = stagger * 0.6;
    torsoTwist = stagger * 0.06;
  }

  return { phase, stride, armSwing, lunge, torsoTwist, recoil, breathScale, leanTilt };
}

function drawUe2DCharacterFrame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spec: ArchetypeVisualSpec,
  anim: SpriteAnimState,
  frame: number,
  dirIdx: number,
  overrideShirt?: string
) {
  const dirAngle = (dirIdx / 8) * Math.PI * 2;
  const sw = spec.shoulderWidth;
  const td = spec.torsoDepth;
  const kin = computeMotionKinematics(spec.motionProfile, anim, frame);
  const collapse = anim === 'death' ? (frame + 1) / FRAMES_PER_ANIM : 0;

  ctx.save();
  ctx.translate(cx, cy);

  // Soft Ambient Occlusion contact shadow
  const shadowGrad = ctx.createRadialGradient(2.5, 4, 3, 2.5, 4, 19 * sw);
  shadowGrad.addColorStop(0, `rgba(2, 6, 15, ${(0.5 - collapse * 0.14).toFixed(2)})`);
  shadowGrad.addColorStop(0.65, 'rgba(2, 6, 15, 0.22)');
  shadowGrad.addColorStop(1, 'rgba(2, 6, 15, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(2.5, 4, 17 * sw * (1 + collapse * 0.35), 13 * td, dirAngle, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(dirAngle);

  if (anim === 'death') {
    const fallAngle = [0.22, 0.52, 0.85, 1.12, 1.24, 1.28][frame] ?? 1.2;
    ctx.rotate(fallAngle);
    ctx.scale(1 + collapse * 0.36, 1 - collapse * 0.18);
    ctx.globalAlpha = 1 - collapse * 0.1;

    if (frame >= 3) {
      const poolR = 7 + (frame - 3) * 3.8;
      ctx.fillStyle = spec.isZombie ? 'rgba(63, 98, 18, 0.62)' : 'rgba(127, 29, 29, 0.66)';
      ctx.beginPath();
      ctx.ellipse(-2, 2, poolR * 1.25, poolR * 0.85, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.translate(kin.lunge, 0);
  ctx.rotate(kin.torsoTwist + kin.leanTilt);
  ctx.scale(kin.breathScale, kin.breathScale);

  const torsoCol = anim === 'hit' && frame < 2 ? '#fca5a5' : overrideShirt || spec.torsoColor;

  // Crawler zombie pose
  if (spec.isCrawler) {
    const drag = Math.sin(kin.phase) * 5.8;
    ctx.fillStyle = spec.pantsColor;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(-10.5, 0, 9.2, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 6.2;
    ctx.beginPath();
    ctx.moveTo(2, -7.8);
    ctx.lineTo(16.5 + drag, -5.2);
    ctx.moveTo(2, 7.8);
    ctx.lineTo(16.5 - drag, 5.2);
    ctx.stroke();

    ctx.strokeStyle = spec.skinColor;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(2, -7.8);
    ctx.lineTo(16.5 + drag, -5.2);
    ctx.moveTo(2, 7.8);
    ctx.lineTo(16.5 - drag, 5.2);
    ctx.stroke();

    ctx.fillStyle = torsoCol;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.6;
    traceAnatomicalTorsoPath(ctx, 0.92, 1.0);
    ctx.fill();
    ctx.stroke();

    ctx.translate(4.5, 0);
    drawAnatomicalHead(ctx, spec, spec.skinColor, spec.headgearColor, 'bald', undefined, true);
    ctx.restore();
    return;
  }

  // 1. Articulated Thighs, Calves, Kneepads & Angled Boots
  const drawLeg = (footX: number, footY: number) => {
    const kneeX = footX * 0.56;
    const kneeY = footY * 0.94;

    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 6.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1.0, footY * 0.78);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX * 0.8, footY);
    ctx.stroke();

    ctx.strokeStyle = spec.pantsColor;
    ctx.lineWidth = 4.3;
    ctx.beginPath();
    ctx.moveTo(-1.0, footY * 0.78);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX * 0.8, footY);
    ctx.stroke();

    // Angled boot toe
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(footX + 0.8, footY, 5.6, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!spec.isZombie && (spec.hairStyle === 'helmet' || spec.hairStyle === 'beret')) {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(kneeX, kneeY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawLeg(kin.stride, -5.8 * sw);
  drawLeg(-kin.stride, 5.8 * sw);

  // Drop-leg tactical holster for police & soldiers
  if (spec.motionProfile === 'police' || spec.motionProfile === 'soldier') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-3.0, 5.6 * sw, 4.4, 3.0);
  }

  // 2. Tactical Backpack / Medical Rig
  if (spec.backpack === 'mil') {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-13.8 * td, -7.2 * sw, 7.2, 14.4 * sw, 2.4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-11.6 * td, -5.5 * sw);
    ctx.lineTo(-11.6 * td, 5.5 * sw);
    ctx.stroke();
  } else if (spec.backpack === 'medic') {
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-13.6, -6.8, 7.2, 13.6, 2.4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-11.5, -3.8, 2.8, 7.6);
    ctx.fillRect(-12.9, -1.4, 5.6, 2.8);
  } else if (spec.backpack === 'civ_pack') {
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-11.5, -5.8, 5.6, 11.6, 2.2);
    ctx.fill();
    ctx.stroke();
  }

  // 3. Articulated Shoulder -> Elbow -> Forearm & Weapons
  if (spec.weapon === 'zombie_arms') {
    const reachL = 16.0 + Math.sin(kin.phase) * 3.5 + (anim === 'attack' ? kin.armSwing * 0.42 : 0);
    const reachR = 16.0 - Math.sin(kin.phase) * 3.5 + (anim === 'attack' ? kin.armSwing * 0.42 : 0);
    const elbowL = { x: reachL * 0.48, y: -10.2 * sw };
    const elbowR = { x: reachR * 0.48, y: 10.2 * sw };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 6.8;
    ctx.beginPath();
    ctx.moveTo(0, -10.4 * sw);
    ctx.lineTo(elbowL.x, elbowL.y);
    ctx.lineTo(reachL, -5.2 * sw);
    ctx.moveTo(0, 10.4 * sw);
    ctx.lineTo(elbowR.x, elbowR.y);
    ctx.lineTo(reachR, 5.2 * sw);
    ctx.stroke();

    ctx.strokeStyle = spec.skinColor;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(0, -10.4 * sw);
    ctx.lineTo(elbowL.x, elbowL.y);
    ctx.lineTo(reachL, -5.2 * sw);
    ctx.moveTo(0, 10.4 * sw);
    ctx.lineTo(elbowR.x, elbowR.y);
    ctx.lineTo(reachR, 5.2 * sw);
    ctx.stroke();

    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(reachL, -5.2 * sw, 2.2, 0, Math.PI * 2);
    ctx.arc(reachR, 5.2 * sw, 2.2, 0, Math.PI * 2);
    ctx.fill();

    if (anim === 'attack' && (frame === 2 || frame === 3)) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(13, 0, 12, -0.75, 0.75);
      ctx.stroke();
    }
  } else if (spec.weapon === 'none') {
    const swingL = kin.armSwing * 0.68;
    const swingR = -kin.armSwing * 0.68;

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 6.2;
    ctx.beginPath();
    ctx.moveTo(0, -10.4 * sw);
    ctx.lineTo(swingL + 4.8, -10.8 * sw);
    ctx.moveTo(0, 10.4 * sw);
    ctx.lineTo(swingR + 4.8, 10.8 * sw);
    ctx.stroke();

    ctx.strokeStyle = torsoCol;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(0, -10.4 * sw);
    ctx.lineTo(swingL + 4.2, -10.8 * sw);
    ctx.moveTo(0, 10.4 * sw);
    ctx.lineTo(swingR + 4.2, 10.8 * sw);
    ctx.stroke();

    ctx.fillStyle = spec.skinColor;
    ctx.beginPath();
    ctx.arc(swingL + 5.5, -10.8 * sw, 2.3, 0, Math.PI * 2);
    ctx.arc(swingR + 5.5, 10.8 * sw, 2.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Police agile high-ready vs Soldier braced two-handed grip
    const isOneHandPistol = spec.weapon === 'pistol' && spec.motionProfile === 'police' && anim === 'run';
    const armPump = isOneHandPistol ? kin.armSwing * 0.45 : 0;

    const lElbowX = 5.4 + kin.recoil * 0.4 - armPump;
    const lElbowY = -10.4 * sw;
    const rElbowX = 6.4 + kin.recoil * 0.4 + armPump * 0.4;
    const rElbowY = 10.0 * sw;

    const lHandX = isOneHandPistol ? 8.5 - armPump : 11.0 + kin.recoil;
    const lHandY = isOneHandPistol ? -9.5 * sw : -2.1;
    const rHandX = 13.2 + kin.recoil;
    const rHandY = 1.4;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(0.5, -10.2 * sw);
    ctx.lineTo(lElbowX, lElbowY);
    ctx.lineTo(lHandX, lHandY);
    ctx.moveTo(0.5, 10.2 * sw);
    ctx.lineTo(rElbowX, rElbowY);
    ctx.lineTo(rHandX, rHandY);
    ctx.stroke();

    ctx.strokeStyle = torsoCol;
    ctx.lineWidth = 4.3;
    ctx.beginPath();
    ctx.moveTo(0.5, -10.2 * sw);
    ctx.lineTo(lElbowX, lElbowY);
    ctx.lineTo(lHandX, lHandY);
    ctx.moveTo(0.5, 10.2 * sw);
    ctx.lineTo(rElbowX, rElbowY);
    ctx.lineTo(rHandX, rHandY);
    ctx.stroke();

    ctx.fillStyle = spec.skinColor;
    ctx.beginPath();
    ctx.arc(lHandX, lHandY, 2.2, 0, Math.PI * 2);
    ctx.arc(rHandX, rHandY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Realistic top-down firearms (no static long tracer lines; crisp weapon silhouettes)
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.2;
    const rOff = kin.recoil;
    if (spec.weapon === 'pistol') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(11.0 + rOff, -1.6, 10.2, 3.2);
      ctx.strokeRect(11.0 + rOff, -1.6, 10.2, 3.2);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(15.5 + rOff, -0.7, 5.2, 1.4);
    } else if (spec.weapon === 'smg') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(7.5 + rOff, -2.0, 15.5, 3.9);
      ctx.strokeRect(7.5 + rOff, -2.0, 15.5, 3.9);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(17.5 + rOff, -1.0, 5.5, 2.0);
    } else if (spec.weapon === 'rifle') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(6.5 + rOff, -1.9, 21.5, 3.8);
      ctx.strokeRect(6.5 + rOff, -1.9, 21.5, 3.8);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(20.5 + rOff, -1.0, 7.4, 2.0);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(12.5 + rOff, -0.7, 3.0, 1.4);
    } else if (spec.weapon === 'sniper') {
      ctx.fillStyle = '#1a2e05';
      ctx.fillRect(5.5 + rOff, -1.8, 27.5, 3.6);
      ctx.strokeRect(5.5 + rOff, -1.8, 27.5, 3.6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(12.5 + rOff, -2.8, 8.2, 5.6);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(18.5 + rOff, -1.4, 1.8, 2.8);
    } else if (spec.weapon === 'lmg') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6.5 + rOff, -2.7, 23.5, 5.4);
      ctx.strokeRect(6.5 + rOff, -2.7, 23.5, 5.4);
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(10.5 + rOff, 2.7, 5.2, 3.5);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(22.5 + rOff, -1.1, 7.5, 2.2);
    } else if (spec.weapon === 'shield') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.48)';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(8.5, 0, 14.0, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(8.5, 0, 11.2, -Math.PI * 0.35, 0);
      ctx.stroke();
    }
  }

  // 4. Sculpted Anatomical Torso (skipped for zombies when overlaid with 128-outfit stamp!)
  if (!spec.isZombie) {
    const torsoGrad = ctx.createLinearGradient(-8 * td, -12 * sw, 8 * td, 12 * sw);
    torsoGrad.addColorStop(0, torsoCol);
    torsoGrad.addColorStop(1, '#090d16');

    ctx.fillStyle = torsoCol;
    ctx.strokeStyle = '#04070d';
    ctx.lineWidth = 1.9;
    traceAnatomicalTorsoPath(ctx, sw, td);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = torsoGrad;
    traceAnatomicalTorsoPath(ctx, sw, td);
    ctx.fill();
    ctx.restore();

    // Tactical Belt / Plate Carrier / Collar
    ctx.fillStyle = spec.vestColor;
    ctx.beginPath();
    ctx.roundRect(-4.6 * td, -7.8 * sw, 9.6 * td, 15.6 * sw, 3.4);
    ctx.fill();

    // Shoulder straps & collar badge highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(-1.0, -7.2 * sw, 5.2, 2.6);
    ctx.fillRect(-1.0, 4.6 * sw, 5.2, 2.6);

    if (spec.accentColor) {
      ctx.fillStyle = spec.accentColor;
      ctx.fillRect(-1.5, -10.2 * sw, 3.0, 2.2);
      ctx.fillRect(-1.5, 8.0 * sw, 3.0, 2.2);
    }

    // 5. Anatomical Head
    ctx.translate(1.2, 0);
    drawAnatomicalHead(
      ctx,
      spec,
      spec.skinColor,
      spec.headgearColor,
      spec.hairStyle,
      spec.visorColor,
      false
    );
  }

  ctx.restore();
}

function getOrBakeArchetype(archetypeId: string, overrideShirt?: string): CachedSpriteSheet {
  const key = overrideShirt ? `${archetypeId}:${overrideShirt}` : archetypeId;
  const existing = atlasCache.get(key);
  if (existing) return existing;

  const spec = ARCHETYPES[archetypeId] || ARCHETYPES.civ_male;
  const cols = FRAMES_PER_ANIM * 8;
  const rows = ANIM_STATES.length;
  const canvas = document.createElement('canvas');
  canvas.width = cols * FRAME_SIZE;
  canvas.height = rows * FRAME_SIZE;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    for (let r = 0; r < rows; r++) {
      const anim = ANIM_STATES[r];
      for (let d = 0; d < 8; d++) {
        for (let f = 0; f < FRAMES_PER_ANIM; f++) {
          const col = d * FRAMES_PER_ANIM + f;
          const cx = col * FRAME_SIZE + FRAME_SIZE / 2;
          const cy = r * FRAME_SIZE + FRAME_SIZE / 2;
          drawUe2DCharacterFrame(ctx, cx, cy, spec, anim, f, d, overrideShirt);
        }
      }
    }
  }

  const lod2Canvas = document.createElement('canvas');
  lod2Canvas.width = 8 * 28;
  lod2Canvas.height = 28;
  const lctx = lod2Canvas.getContext('2d');
  if (lctx) {
    for (let d = 0; d < 8; d++) {
      const ang = (d / 8) * Math.PI * 2;
      lctx.save();
      lctx.translate(d * 28 + 14, 14);
      lctx.rotate(ang);
      if (spec.isZombie) {
        lctx.strokeStyle = spec.skinColor;
        lctx.lineWidth = 2.4;
        lctx.beginPath();
        lctx.moveTo(0, -4);
        lctx.lineTo(8, -3);
        lctx.moveTo(0, 4);
        lctx.lineTo(8, 3);
        lctx.stroke();
      }
      lctx.fillStyle = overrideShirt || spec.torsoColor;
      lctx.strokeStyle = '#04070d';
      lctx.lineWidth = 1.4;
      lctx.beginPath();
      lctx.ellipse(0, 0, 5.0, 7.4 * spec.shoulderWidth, 0, 0, Math.PI * 2);
      lctx.fill();
      lctx.stroke();
      lctx.fillStyle = spec.headgearColor;
      lctx.beginPath();
      lctx.ellipse(2.6, 0, 3.8, 3.4, 0, 0, Math.PI * 2);
      lctx.fill();
      lctx.restore();
    }
  }

  const baked = { canvas, lod2Canvas };
  atlasCache.set(key, baked);
  return baked;
}

export function angleTo8Dir(radians: number): number {
  const norm = ((radians % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(norm / (Math.PI / 4)) % 8;
}

export function computeLODTier(pixelsPerMeter: number): { tier: LODTier; label: string } {
  if (pixelsPerMeter >= 2.3) return { tier: 0, label: 'LOD-0 Anatomik 2D Flipbook (8-Yön)' };
  if (pixelsPerMeter >= 1.0) return { tier: 1, label: 'LOD-1 Orta Sprite (8-Yön)' };
  if (pixelsPerMeter >= 0.42) return { tier: 2, label: 'LOD-2 Uzak Sprite' };
  return { tier: 3, label: 'LOD-3 Taktik Nokta' };
}

export function renderSpriteEntity(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  options: {
    archetypeId: string;
    overrideShirt?: string;
    zombieOutfitId?: number;
    facing: number;
    anim: SpriteAnimState;
    frameIndex: number;
    glowColor: string;
    strongGlow: boolean;
    dotColor: string;
    scaleMult?: number;
  }
) {
  const { tier } = computeLODTier(ppm);

  if (tier === 3) {
    ctx.fillStyle = options.dotColor;
    ctx.fillRect(px - 2, py - 2, 4, 4);
    return;
  }

  if (options.strongGlow) {
    const glowSize = Math.max(18, 4.8 * ppm * (options.scaleMult ?? 1));
    const glowImg = getGlowSprite(options.glowColor);
    ctx.drawImage(glowImg, px - glowSize / 2, py - glowSize / 2, glowSize, glowSize);
  }

  const sheet = getOrBakeArchetype(options.archetypeId, options.overrideShirt);
  const dir = angleTo8Dir(options.facing);

  if (tier === 2) {
    const drawSz = Math.max(11, 2.5 * ppm * (options.scaleMult ?? 1));
    if (options.zombieOutfitId !== undefined) {
      const outfitSpec = ZOMBIE_OUTFIT_CATALOG[options.zombieOutfitId % ZOMBIE_OUTFIT_COUNT];
      ctx.fillStyle = outfitSpec.baseColor;
      ctx.beginPath();
      ctx.ellipse(px, py, drawSz * 0.34, drawSz * 0.46, options.facing, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.drawImage(sheet.lod2Canvas, dir * 28, 0, 28, 28, px - drawSz / 2, py - drawSz / 2, drawSz, drawSz);
    }
    return;
  }

  const animRow = Math.max(0, ANIM_STATES.indexOf(options.anim));
  const frame = ((options.frameIndex % FRAMES_PER_ANIM) + FRAMES_PER_ANIM) % FRAMES_PER_ANIM;
  const sx = (dir * FRAMES_PER_ANIM + frame) * FRAME_SIZE;
  const sy = animRow * FRAME_SIZE;

  const baseMetersSize = tier === 0 ? 4.8 : 4.2;
  const drawSize = Math.max(tier === 0 ? 24 : 15, Math.min(58, baseMetersSize * ppm * (options.scaleMult ?? 1)));

  // Draw base animated skeleton & limbs
  ctx.drawImage(
    sheet.canvas,
    sx,
    sy,
    FRAME_SIZE,
    FRAME_SIZE,
    px - drawSize / 2,
    py - drawSize / 2,
    drawSize,
    drawSize
  );

  // Layer one of 128 distinct modeled zombie outfits directly aligned to torso motion & death collapse
  if (options.zombieOutfitId !== undefined) {
    const stamp = getOrBakeZombieOutfitStamp(options.zombieOutfitId);
    const dirAngle = (dir / 8) * Math.PI * 2;
    const kin = computeMotionKinematics('zombie', options.anim, frame);
    const collapse = options.anim === 'death' ? (frame + 1) / FRAMES_PER_ANIM : 0;
    const pxScale = drawSize / FRAME_SIZE;
    const stampDraw = 64 * pxScale;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(dirAngle);
    if (options.anim === 'death') {
      const fallAngle = [0.22, 0.52, 0.85, 1.12, 1.24, 1.28][frame] ?? 1.2;
      ctx.rotate(fallAngle);
      ctx.scale(1 + collapse * 0.36, 1 - collapse * 0.18);
      ctx.globalAlpha = 1 - collapse * 0.12;
    }
    ctx.translate(kin.lunge * pxScale, 0);
    ctx.rotate(kin.torsoTwist + kin.leanTilt);
    ctx.scale(kin.breathScale, kin.breathScale);
    ctx.drawImage(stamp, -stampDraw / 2, -stampDraw / 2, stampDraw, stampDraw);
    ctx.restore();
  }
}
