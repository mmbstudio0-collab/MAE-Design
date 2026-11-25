import { renderSpriteEntity, sampleFlipbookFrame } from './spriteAtlas';
import {
  A10Strike,
  Barricade,
  BloodStain,
  ChinookDrop,
  Civilian,
  Corpse,
  Crater,
  ExplosionEffect,
  FireSpot,
  Helicopter,
  ImpactSparkEffect,
  MuzzleFlashEffect,
  OcclusionZone,
  QuarantineZone,
  ShellCasingParticle,
  SirenMode,
  SpriteAnimState,
  Unit,
  VehicleEntity,
  Zombie,
} from './types';
import {
  EXPLOSION_CELL,
  EXPLOSION_FRAMES,
  getA10Sprite,
  getApcTurretSprite,
  getChinookRotorSprite,
  getChinookSprite,
  getCraterSprite,
  getExplosionFlipbook,
  getHelicopterSprite,
  getRotorSprite,
  getVehicleSprite,
} from './vehicleSprites';

export function renderStaticVehicleModel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  lenPx: number,
  widPx: number,
  angle: number,
  color: string
) {
  const sprite = getVehicleSprite('civilian_car', color);
  const drawW = Math.max(16, lenPx * 1.56);
  const drawH = Math.max(9.5, widPx * 1.92);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

export function renderBloodStain(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  b: BloodStain
) {
  const r = Math.max(2.2, b.radius * ppm);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(b.angle);
  ctx.globalAlpha = b.alpha;
  ctx.fillStyle = b.isZombie ? '#3f6212' : '#7f1d1d';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = b.isZombie ? '#65a30d' : '#991b1b';
  ctx.beginPath();
  ctx.arc(r * 0.35, r * 0.15, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderCorpse(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  c: Corpse
) {
  if (ppm < 0.42) return;
  const frame = sampleFlipbookFrame('death', 0, c.collapseProgress);
  renderSpriteEntity(ctx, px, py, ppm, {
    archetypeId: c.archetype,
    zombieOutfitId: c.kind === 'zombie' ? c.outfitId : undefined,
    facing: c.angle,
    anim: 'death',
    frameIndex: frame,
    glowColor: '#000000',
    strongGlow: false,
    dotColor: '#450a0a',
    scaleMult: c.scale,
  });
}

export function renderCrater(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  crater: Crater
) {
  const size = Math.max(22, crater.radius * 2.65 * ppm);
  const sprite = getCraterSprite(crater.variant);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(crater.seed);
  ctx.drawImage(sprite, -size / 2, -size / 2, size, size);

  if (crater.smokeTimer > 0) {
    const glowA = Math.min(0.6, crater.smokeTimer * 0.085);
    ctx.fillStyle = `rgba(234, 88, 12, ${glowA})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderVolumetricExplosion(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  exp: ExplosionEffect
) {
  const sheet = getExplosionFlipbook();
  const progress = Math.max(0, Math.min(0.999, exp.age / exp.duration));
  const frameIdx = Math.floor(progress * EXPLOSION_FRAMES);
  const sx = frameIdx * EXPLOSION_CELL;
  const drawSize = Math.max(58, exp.radius * 4.1 * ppm);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(exp.rotation);
  ctx.drawImage(
    sheet,
    sx,
    0,
    EXPLOSION_CELL,
    EXPLOSION_CELL,
    -drawSize / 2,
    -drawSize / 2,
    drawSize,
    drawSize
  );
  ctx.restore();
}

export function renderFireSpot(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  fire: FireSpot,
  elapsed: number
) {
  const lifeFade = Math.min(1, fire.life / Math.max(1, fire.maxLife * 0.35));
  const baseR = Math.max(7, fire.radius * ppm * fire.intensity * lifeFade);
  if (baseR < 2) return;

  ctx.save();
  ctx.translate(px, py);

  ctx.fillStyle = `rgba(12, 10, 9, ${(0.55 * lifeFade).toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(0, 0, baseR * 1.1, 0, Math.PI * 2);
  ctx.fill();

  for (let s = 0; s < 3; s++) {
    const cycle = (elapsed * 0.55 + fire.seed * 0.37 + s * 0.33) % 1;
    const dx = Math.sin(elapsed * 1.4 + s + fire.seed) * baseR * 0.25 + cycle * baseR * 0.55;
    const dy = -cycle * baseR * 2.1;
    const sr = baseR * (0.45 + cycle * 0.85);
    const alpha = Math.sin(cycle * Math.PI) * 0.42 * lifeFade;
    const sg = ctx.createRadialGradient(dx, dy, sr * 0.1, dx, dy, sr);
    sg.addColorStop(0, `rgba(41, 37, 36, ${alpha.toFixed(2)})`);
    sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(dx, dy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let f = 0; f < 3; f++) {
    const cycle = (elapsed * 1.4 + fire.seed * 0.71 + f * 0.33) % 1;
    const fx = Math.cos(fire.seed + f * 2.1) * baseR * 0.32 + Math.sin(elapsed * 5 + f) * baseR * 0.12;
    const fy = Math.sin(fire.seed + f * 2.1) * baseR * 0.28 - cycle * baseR * 0.9;
    const fr = baseR * (0.65 - cycle * 0.35);
    if (fr < 1.5) continue;

    const fg = ctx.createRadialGradient(fx, fy, fr * 0.08, fx, fy, fr);
    fg.addColorStop(0, `rgba(254, 249, 195, ${(0.88 * (1 - cycle * 0.4) * lifeFade).toFixed(2)})`);
    fg.addColorStop(0.45, `rgba(249, 115, 22, ${(0.76 * (1 - cycle * 0.35) * lifeFade).toFixed(2)})`);
    fg.addColorStop(1, 'rgba(185, 28, 28, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Multi-pronged Barrel Muzzle Flash & Heat Shock Cone (replaces long laser tracer lines).
 */
export function renderMuzzleFlash(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  mf: MuzzleFlashEffect
) {
  const ratio = Math.max(0, mf.life / mf.maxLife);
  const scale =
    mf.weapon === 'heavy'
      ? 1.55
      : mf.weapon === 'sniper'
        ? 1.65
        : mf.weapon === 'rifle'
          ? 1.2
          : mf.weapon === 'smg'
            ? 0.95
            : 0.85;
  const lenPx = Math.max(7, 4.2 * ppm * scale) * (0.55 + ratio * 0.55);
  const widPx = lenPx * 0.42;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(mf.angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, ratio * 1.25);

  // Outer warm glow halo at barrel mouth
  const halo = ctx.createRadialGradient(2, 0, 0.5, 2, 0, lenPx * 0.85);
  halo.addColorStop(0, 'rgba(255, 255, 220, 0.92)');
  halo.addColorStop(0.4, 'rgba(251, 191, 36, 0.58)');
  halo.addColorStop(1, 'rgba(234, 88, 12, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(2, 0, lenPx * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Forward directional propellant jet flame
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.moveTo(0, -widPx * 0.4);
  ctx.lineTo(lenPx, 0);
  ctx.lineTo(0, widPx * 0.4);
  ctx.closePath();
  ctx.fill();

  // Compensator side vents (crisp star-flash)
  if (mf.weapon === 'rifle' || mf.weapon === 'heavy' || mf.weapon === 'sniper') {
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(lenPx * 0.38, -widPx * 0.95);
    ctx.lineTo(lenPx * 0.5, 0);
    ctx.lineTo(lenPx * 0.38, widPx * 0.95);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function renderShellCasing(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  sc: ShellCasingParticle
) {
  if (ppm < 0.75) return;
  const alpha = Math.min(1, (sc.life / sc.maxLife) * 1.6);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(sc.angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fbbf24';
  const l = Math.max(2.4, 0.45 * ppm);
  const w = Math.max(1.1, 0.18 * ppm);
  ctx.fillRect(-l / 2, -w / 2, l, w);
  ctx.restore();
}

export function renderImpactSpark(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  sp: ImpactSparkEffect
) {
  const alpha = Math.max(0, sp.life / sp.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = sp.color;
  ctx.beginPath();
  ctx.arc(px, py, Math.max(1.2, sp.size * ppm), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 2D-3D Engineered Jersey Concrete Barrier + Sandbag Footing + Razor Wire Coils.
 */
export function renderBarricade(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  b: Barricade
) {
  const wPx = Math.max(12, b.w * ppm);
  const hPx = Math.max(5.5, b.h * ppm);
  const hpRatio = Math.max(0, Math.min(1, b.hp / Math.max(1, b.maxHp)));

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(b.angle);

  // Ground ambient shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.56)';
  ctx.fillRect(-wPx / 2 + 2.5, -hPx / 2 + 3, wPx, hPx + 2);

  // Sandbag buttress pockets along rear edge
  const bagW = Math.max(4, wPx / Math.max(3, Math.round(wPx / 8)));
  ctx.fillStyle = '#57534e';
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 0.8;
  for (let bx = -wPx / 2 + 1; bx < wPx / 2 - 3; bx += bagW) {
    ctx.beginPath();
    ctx.roundRect(bx, hPx * 0.14, bagW - 1, hPx * 0.48, 2);
    ctx.fill();
    ctx.stroke();
  }

  // Stepped concrete Jersey wall base & bright top crown
  ctx.fillStyle = '#64748b';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.2;
  ctx.fillRect(-wPx / 2, -hPx * 0.48, wPx, hPx * 0.84);
  ctx.strokeRect(-wPx / 2, -hPx * 0.48, wPx, hPx * 0.84);

  // Upper Concrete Ridge Highlight (3D beveled crown)
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-wPx / 2 + 1, -hPx * 0.34, wPx - 2, Math.max(2, hPx * 0.32));

  // Diagonal Hazard Caution Chevron Band
  ctx.fillStyle = '#f59e0b';
  const stripeCount = Math.max(3, Math.floor(wPx / 8));
  for (let i = 0; i < stripeCount; i += 2) {
    const sx = -wPx / 2 + (i / stripeCount) * wPx + 1;
    ctx.fillRect(sx, -hPx * 0.44, Math.max(2, wPx / stripeCount - 2), Math.max(1.5, hPx * 0.24));
  }

  // Coiled Concertina Razor Wire loops on front edge
  if (ppm >= 0.45) {
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.72)';
    ctx.lineWidth = 0.9;
    const loops = Math.max(4, Math.floor(wPx / 5));
    for (let i = 0; i < loops; i++) {
      const lx = -wPx / 2 + ((i + 0.5) / loops) * wPx;
      ctx.beginPath();
      ctx.arc(lx, -hPx * 0.54, Math.max(1.6, hPx * 0.28), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Barricade integrity bar if damaged
  if (hpRatio < 0.99 && ppm >= 0.5) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-wPx * 0.35, -hPx - 5, wPx * 0.7, 2.5);
    ctx.fillStyle = hpRatio > 0.4 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(-wPx * 0.35, -hPx - 5, wPx * 0.7 * hpRatio, 2.5);
  }

  ctx.restore();
}

/**
 * Renders Quarantine Zone:
 * - Scanning Phase: Animated amber radar sweep checking buildings/water/roads before deployment
 * - Active Phase: Perimeter barriers + 2D/3D watchtowers with corrugated roofs, gunners & rotating mounts
 */
export function renderQuarantineZone(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  qz: QuarantineZone,
  elapsed: number,
  project?: (x: number, y: number) => { px: number; py: number } | null
) {
  const radPx = qz.radius * ppm;

  ctx.save();
  if (qz.status === 'scanning') {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.88)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(px, py, radPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Rotating terrain scan radar sweep
    const sweepA = elapsed * 5.2;
    const sweepGrad = ctx.createRadialGradient(px, py, 4, px, py, radPx);
    sweepGrad.addColorStop(0, 'rgba(251, 191, 36, 0.05)');
    sweepGrad.addColorStop(1, 'rgba(251, 191, 36, 0.32)');
    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, radPx, sweepA - 0.65, sweepA);
    ctx.closePath();
    ctx.fill();

    // Progress ring
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, radPx * 0.82, -Math.PI / 2, -Math.PI / 2 + qz.scanProgress * Math.PI * 2);
    ctx.stroke();

    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    const pct = Math.round(qz.scanProgress * 100);
    ctx.strokeText(`ARAZİ TARANIYOR · %${pct}`, px, py - radPx + 18);
    ctx.fillText(`ARAZİ TARANIYOR · %${pct}`, px, py - radPx + 18);
    ctx.restore();
    return;
  }

  // Active Fortified Quarantine Perimeter Ring
  ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.52)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([12, 7]);
  ctx.beginPath();
  ctx.arc(px, py, radPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fcd34d';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 3;
  ctx.strokeText(`KARANTİNA ÜSSÜ (${qz.towers.length} KULE)`, px, py - radPx + 15);
  ctx.fillText(`KARANTİNA ÜSSÜ (${qz.towers.length} KULE)`, px, py - radPx + 15);
  ctx.restore();

  if (!project) return;

  // Render perimeter roadblocks
  for (const bar of qz.barriers) {
    const bp = project(bar.x, bar.y);
    if (!bp) continue;
    renderBarricade(ctx, bp.px, bp.py, ppm, bar);
  }

  // Render 2D/3D Engineered Watchtowers (Sandbag base + Steel legs + Corrugated roof + Searchlight housing)
  for (const tw of qz.towers) {
    const tp = project(tw.x, tw.y);
    if (!tp) continue;
    const sz = Math.max(13, 4.4 * ppm);
    ctx.save();
    ctx.translate(tp.px, tp.py);

    // Tall 3D cast drop shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
    ctx.fillRect(-sz * 0.45 + sz * 0.35, -sz * 0.45 + sz * 0.42, sz * 0.95, sz * 0.95);

    // Reinforced sandbag square footing
    ctx.fillStyle = '#57534e';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-sz * 0.56, -sz * 0.56, sz * 1.12, sz * 1.12, 3);
    ctx.fill();
    ctx.stroke();

    // Diagonal steel truss cross-beams
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.48);
    ctx.lineTo(sz * 0.48, sz * 0.48);
    ctx.moveTo(sz * 0.48, -sz * 0.48);
    ctx.lineTo(-sz * 0.48, sz * 0.48);
    ctx.stroke();

    // Elevated corrugated steel roof deck
    ctx.fillStyle = '#3f6212';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-sz * 0.42, -sz * 0.42, sz * 0.84, sz * 0.84, 2);
    ctx.fill();
    ctx.stroke();

    // Corrugated roof ribs
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 0.8;
    for (let r = -sz * 0.25; r <= sz * 0.25; r += sz * 0.16) {
      ctx.beginPath();
      ctx.moveTo(-sz * 0.36, r);
      ctx.lineTo(sz * 0.36, r);
      ctx.stroke();
    }

    // Rotating roof searchlight turret mount
    ctx.rotate(tw.searchlightAngle);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, sz * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sz * 0.18, 0, sz * 0.11, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function renderBloodVomitOverlay(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  facing: number,
  animTime: number,
  infectionTimer: number,
  infectionDuration = 4.2
) {
  const pulse = 0.55 + Math.max(0, Math.sin(animTime * 13.5)) * 0.45;
  const scale = Math.max(0.75, Math.min(1.65, ppm * 0.48));
  const streamLen = (9 + pulse * 8) * scale;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(facing);

  // Sickly green-crimson contagion ring around victim before turning
  const progress = Math.max(0, Math.min(1, 1 - infectionTimer / Math.max(0.2, infectionDuration)));
  ctx.strokeStyle = `rgba(163, 230, 53, ${(0.45 + progress * 0.4).toFixed(2)})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(7, 1.5 * ppm), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();

  // Animated arterial crimson vomit jet erupting forward from mouth
  const mouthX = 3.2 * scale;
  const grad = ctx.createLinearGradient(mouthX, 0, mouthX + streamLen, 0);
  grad.addColorStop(0, 'rgba(239, 68, 68, 0.96)');
  grad.addColorStop(0.55, 'rgba(185, 28, 28, 0.88)');
  grad.addColorStop(1, 'rgba(127, 29, 29, 0.15)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(mouthX, -1.1 * scale);
  ctx.quadraticCurveTo(
    mouthX + streamLen * 0.55,
    -2.6 * scale * pulse,
    mouthX + streamLen,
    (Math.sin(animTime * 21) * 1.6 - 1.8) * scale
  );
  ctx.lineTo(mouthX + streamLen, (Math.sin(animTime * 21) * 1.6 + 1.8) * scale);
  ctx.quadraticCurveTo(
    mouthX + streamLen * 0.55,
    2.6 * scale * pulse,
    mouthX,
    1.1 * scale
  );
  ctx.closePath();
  ctx.fill();

  // Airborne blood droplets splashing out ahead
  ctx.fillStyle = '#dc2626';
  for (let d = 0; d < 4; d++) {
    const phase = (animTime * 3.6 + d * 0.25) % 1;
    const dx = mouthX + streamLen * (0.4 + phase * 0.85);
    const dy = Math.sin(d * 2.3 + animTime * 11) * (2.6 * scale * phase);
    const r = Math.max(1.1, (1.6 - phase * 0.7) * scale);
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function renderCivilianSprite(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  c: Civilian,
  strongGlow: boolean
) {
  if (c.state === 'carried') return;
  if (c.occluded && ppm >= 0.42) return;

  const archetypeId = c.armed
    ? 'civ_armed'
    : c.ageGroup === 'elderly'
      ? 'civ_elderly'
      : c.gender === 'female'
        ? 'civ_female'
        : 'civ_male';

  const stage = c.infected ? (c.infectionStage ?? 'vomiting') : null;
  let anim: SpriteAnimState = 'idle';
  let deathProgress: number | undefined;

  if (stage === 'dying' || c.state === 'fallen') {
    anim = 'death';
    if (stage === 'dying') {
      const dur = Math.max(0.15, c.infectionStageDuration ?? 1.0);
      deathProgress = Math.min(0.99, Math.max(0.06, 1 - c.infectionTimer / dur));
    }
  } else if (c.hitFlash > 0) {
    anim = 'hit';
  } else if (c.shootAnim > 0) {
    anim = 'shoot';
  } else if (c.state === 'running' || c.state === 'panicking' || c.state === 'boarding') {
    anim = 'run';
  } else if (c.isMoving) {
    anim = 'walk';
  }

  const frameIndex = sampleFlipbookFrame(
    anim,
    anim === 'shoot' ? Math.max(0, 0.24 - c.shootAnim) : c.animTime,
    deathProgress
  );

  const convulse = stage === 'vomiting' ? Math.max(0, Math.sin(c.animTime * 14.5)) * 1.85 : 0;
  const drawX = px + Math.cos(c.facing) * convulse;
  const drawY = py + Math.sin(c.facing) * convulse;

  if (stage === 'dying') {
    ctx.save();
    const poolR = Math.max(4, (deathProgress ?? 0.5) * 3.2 * ppm);
    ctx.fillStyle = 'rgba(127, 29, 29, 0.72)';
    ctx.beginPath();
    ctx.ellipse(drawX, drawY + 1.5, poolR, poolR * 0.72, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderSpriteEntity(ctx, drawX, drawY, ppm, {
    archetypeId,
    overrideShirt: stage === 'vomiting' || stage === 'dying' ? '#a3e635' : c.shirtColor,
    facing: c.facing,
    anim,
    frameIndex,
    glowColor: '#f8fafc',
    strongGlow,
    dotColor: '#f8fafc',
  });

  if (stage === 'latent') {
    // Subtle early incubation biohazard ring (no vomit jet yet)
    const pulse = 0.35 + 0.35 * Math.sin(c.animTime * 6);
    ctx.save();
    ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(drawX, drawY, Math.max(5.5, 1.3 * ppm), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (stage === 'vomiting') {
    renderBloodVomitOverlay(
      ctx,
      drawX,
      drawY,
      ppm,
      c.facing,
      c.animTime,
      c.infectionTimer,
      c.infectionStageDuration ?? c.infectionDuration ?? 3.6
    );
  }

  if (ppm >= 1.0) {
    if (c.state === 'boarding') {
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(drawX, drawY - 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.state === 'calling_help' || c.wounded || c.infected) {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = stage === 'latent' ? '#fbbf24' : c.infected ? '#ef4444' : c.wounded ? '#ef4444' : '#fbbf24';
      ctx.fillText(c.infected ? '☣' : c.wounded ? '+' : '!', drawX, drawY - 16);
    }
  }
}

export function renderZombieSprite(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  z: Zombie,
  strongGlow: boolean
) {
  if (z.occluded && ppm >= 0.42) return;

  const archetypeMap: Record<Zombie['variant'], string> = {
    walker: 'zombie_walker',
    runner: 'zombie_runner',
    heavy: 'zombie_heavy',
    fat: 'zombie_fat',
    crawler: 'zombie_crawler',
    fresh_infected: 'zombie_fresh',
  };

  let anim: SpriteAnimState = 'idle';
  if (z.animState === 'knocked_down') anim = 'death';
  else if (z.hitFlash > 0) anim = 'hit';
  else if (z.attackAnim > 0 || z.animState === 'biting') anim = 'attack';
  else if (z.variant === 'runner' && z.isMoving) anim = 'run';
  else if (z.isMoving) anim = 'walk';

  const scaleMult = z.variant === 'heavy' ? 1.2 : z.variant === 'fat' ? 1.28 : 1;
  const frameIndex = sampleFlipbookFrame(
    anim,
    anim === 'attack' ? Math.max(0, 0.34 - z.attackAnim) : z.animTime,
    z.animState === 'knocked_down' ? Math.min(0.99, Math.max(0, 1 - z.stateTimer / 1.6)) : undefined
  );

  renderSpriteEntity(ctx, px, py, ppm, {
    archetypeId: archetypeMap[z.variant],
    zombieOutfitId: z.outfitId,
    overrideShirt: z.variant === 'fresh_infected' ? z.shirtColor : undefined,
    facing: z.facing,
    anim,
    frameIndex,
    glowColor: '#ef4444',
    strongGlow,
    dotColor: '#ef4444',
    scaleMult,
  });
}

export type OccludedEntityFaction = 'zombie' | 'soldier' | 'police' | 'civilian';

/**
 * Tactical Occluded Outline Silhouette (Zombie Outbreak Simulator style):
 * Renders a crisp 1.3px hollow neon humanoid contour with zero blur/halo.
 * Masked onto building roofs, tree canopies, and 45° facade shadows via destination-in compositing.
 */
export function renderOccludedEntityOutline(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  faction: OccludedEntityFaction,
  facing: number,
  scaleMult = 1,
  isSelected = false
) {
  const s = Math.max(0.45, Math.min(1.5, ppm * 0.41)) * scaleMult;
  const color =
    faction === 'zombie'
      ? '#ff2a2a'
      : faction === 'soldier'
        ? '#22c55e'
        : faction === 'police'
          ? '#38bdf8'
          : '#f8fafc';

  ctx.save();
  ctx.translate(px, py);

  if (isSelected) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(-4.5 * s, 7.6 * s);
    ctx.lineTo(0, 10.2 * s);
    ctx.lineTo(4.5 * s, 7.6 * s);
    ctx.stroke();
  }

  ctx.rotate(facing);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.25, Math.min(2.1, 1.35 * s));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Hollow Top-Down Shoulder & Torso Contour
  ctx.beginPath();
  ctx.ellipse(-0.8 * s, 0, 4.0 * s, 6.0 * s, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Hollow Anatomical Head / Helmet Contour
  ctx.beginPath();
  ctx.arc(2.1 * s, 0, 2.95 * s, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Distinct Limb / Weapon Silhouette
  ctx.beginPath();
  if (faction === 'zombie') {
    ctx.moveTo(1.2 * s, -5.0 * s);
    ctx.lineTo(7.1 * s, -3.7 * s);
    ctx.moveTo(1.2 * s, 5.0 * s);
    ctx.lineTo(7.1 * s, 3.7 * s);
  } else if (faction === 'soldier') {
    ctx.moveTo(1.0 * s, -5.3 * s);
    ctx.lineTo(5.0 * s, -1.9 * s);
    ctx.moveTo(1.0 * s, 5.3 * s);
    ctx.lineTo(5.0 * s, 1.9 * s);
    ctx.moveTo(3.6 * s, 0.8 * s);
    ctx.lineTo(10.2 * s, 0.8 * s);
  } else if (faction === 'police') {
    ctx.moveTo(0.8 * s, -5.0 * s);
    ctx.lineTo(6.0 * s, -1.1 * s);
    ctx.moveTo(0.8 * s, 5.0 * s);
    ctx.lineTo(6.0 * s, 1.1 * s);
    ctx.moveTo(5.4 * s, 0);
    ctx.lineTo(8.4 * s, 0);
  } else {
    ctx.moveTo(0.4 * s, -5.2 * s);
    ctx.lineTo(3.5 * s, -4.2 * s);
    ctx.moveTo(0.4 * s, 5.2 * s);
    ctx.lineTo(3.5 * s, 4.2 * s);
  }
  ctx.stroke();

  ctx.restore();
}

export function renderOccludedZombieSilhouette(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  z: Zombie,
  _elapsed: number
) {
  const scaleMult = z.variant === 'heavy' ? 1.15 : z.variant === 'fat' ? 1.24 : 1;
  renderOccludedEntityOutline(ctx, px, py, ppm, 'zombie', z.facing, scaleMult, false);
}

export interface OccludedSilhouetteItem {
  px: number;
  py: number;
  faction: OccludedEntityFaction;
  facing: number;
  scaleMult: number;
  isSelected: boolean;
}

let occlusionMaskCanvas: HTMLCanvasElement | null = null;
let occlusionMaskCtx: CanvasRenderingContext2D | null = null;

function getOcclusionMaskSurface(
  w: number,
  h: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!occlusionMaskCanvas) {
    occlusionMaskCanvas = document.createElement('canvas');
    occlusionMaskCtx = occlusionMaskCanvas.getContext('2d');
  }
  if (!occlusionMaskCanvas || !occlusionMaskCtx) return null;
  if (occlusionMaskCanvas.width !== w || occlusionMaskCanvas.height !== h) {
    occlusionMaskCanvas.width = w;
    occlusionMaskCanvas.height = h;
  }
  return { canvas: occlusionMaskCanvas, ctx: occlusionMaskCtx };
}

/**
 * Stencil-masks occluded entity neon silhouettes strictly inside building roofs, tree canopies,
 * narrow shadow pockets, and 45° northward building facade shadows via offscreen destination-in compositing.
 */
export function renderOccludedSilhouettesMasked(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ppm: number,
  tiltDeg: 0 | 45,
  project: (x: number, y: number) => { px: number; py: number } | null,
  occlusionZones: OcclusionZone[],
  viewBounds: { minX: number; maxX: number; minY: number; maxY: number } | null | undefined,
  entities: OccludedSilhouetteItem[]
) {
  if (entities.length === 0) return;

  // If geometry zones are unavailable yet, draw directly without losing visibility
  if (occlusionZones.length === 0) {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      renderOccludedEntityOutline(ctx, e.px, e.py, ppm, e.faction, e.facing, e.scaleMult, e.isSelected);
    }
    return;
  }

  const surface = getOcclusionMaskSurface(width, height);
  if (!surface) return;
  const mctx = surface.ctx;

  mctx.save();
  mctx.globalCompositeOperation = 'source-over';
  mctx.clearRect(0, 0, width, height);

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    renderOccludedEntityOutline(mctx, e.px, e.py, ppm, e.faction, e.facing, e.scaleMult, e.isSelected);
  }

  // Mask strictly against projected occlusion geometry (roof overhangs + 45° northward shadows + canopies)
  mctx.globalCompositeOperation = 'destination-in';
  mctx.fillStyle = '#000000';

  const padM = 16;
  for (let i = 0; i < occlusionZones.length; i++) {
    const z = occlusionZones[i];
    if (
      viewBounds &&
      (z.maxX < viewBounds.minX - padM ||
        z.minX > viewBounds.maxX + padM ||
        z.maxY < viewBounds.minY - padM ||
        z.minY > viewBounds.maxY + padM)
    ) {
      continue;
    }

    const northShiftM =
      tiltDeg === 45
        ? z.kind === 'building_roof'
          ? Math.min(11.5, Math.max(2.6, (z.heightMeters ?? 5.5) * 0.68))
          : z.kind === 'tree_canopy'
            ? 1.6
            : z.kind === 'barrier'
              ? 1.3
              : 0
        : z.kind === 'building_roof'
          ? 0.55
          : 0;

    if (z.shape === 'circle' && z.x !== undefined && z.y !== undefined && z.radius !== undefined) {
      const p = project(z.x, z.y);
      if (!p) continue;
      const rPx = Math.max(2, (z.radius + 0.35) * ppm);
      mctx.beginPath();
      mctx.arc(p.px, p.py, rPx, 0, Math.PI * 2);
      mctx.fill();
      if (northShiftM > 0.2) {
        const pN = project(z.x, z.y - northShiftM);
        if (pN) {
          mctx.beginPath();
          mctx.arc(pN.px, pN.py, rPx, 0, Math.PI * 2);
          mctx.fill();
        }
      }
    } else if (z.shape === 'polygon' && z.points && z.points.length >= 3) {
      mctx.beginPath();
      let started = false;
      for (let pi = 0; pi < z.points.length; pi++) {
        const pt = project(z.points[pi].x, z.points[pi].y);
        if (!pt) continue;
        if (!started) {
          mctx.moveTo(pt.px, pt.py);
          started = true;
        } else {
          mctx.lineTo(pt.px, pt.py);
        }
      }
      if (started) {
        mctx.closePath();
        mctx.fill();
      }
      if (northShiftM > 0.2) {
        mctx.beginPath();
        let nStarted = false;
        for (let pi = 0; pi < z.points.length; pi++) {
          const pt = project(z.points[pi].x, z.points[pi].y - northShiftM);
          if (!pt) continue;
          if (!nStarted) {
            mctx.moveTo(pt.px, pt.py);
            nStarted = true;
          } else {
            mctx.lineTo(pt.px, pt.py);
          }
        }
        if (nStarted) {
          mctx.closePath();
          mctx.fill();
        }
      }
    } else {
      const p0 = project(z.minX - 0.3, z.minY - northShiftM);
      const p1 = project(z.maxX + 0.3, z.maxY + 0.3);
      if (!p0 || !p1) continue;
      mctx.fillRect(p0.px, p0.py, p1.px - p0.px, p1.py - p0.py);
    }
  }

  mctx.restore();
  ctx.drawImage(surface.canvas, 0, 0);
}

export function renderUnitSprite(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  u: Unit,
  strongGlow: boolean,
  elapsed: number
) {
  if (u.inVehicleId !== null) return;
  if (u.occluded && u.parachuteAlt <= 0 && ppm >= 0.42) return;

  const stage = u.infected && u.parachuteAlt <= 0 ? (u.infectionStage ?? 'vomiting') : null;
  const paraLift = u.parachuteAlt > 0 ? u.parachuteAlt * 38 : 0;
  const convulse = stage === 'vomiting' ? Math.max(0, Math.sin(u.animTime * 14.5)) * 1.85 : 0;
  const drawX = px + (u.parachuteAlt > 0 ? Math.sin(u.parachuteSway) * 8 : 0) + Math.cos(u.facing) * convulse;
  const drawY = py - paraLift + Math.sin(u.facing) * convulse;

  const archetypeId = u.kind === 'police' ? `police_${u.role}` : `soldier_${u.role}`;

  if (u.selected && u.parachuteAlt <= 0) {
    const r = Math.max(9, 2.0 * ppm);
    ctx.strokeStyle = u.kind === 'soldier' ? '#22c55e' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  let anim: SpriteAnimState = 'idle';
  let deathProgress: number | undefined;
  if (stage === 'dying') {
    anim = 'death';
    const dur = Math.max(0.15, u.infectionStageDuration ?? 1.0);
    deathProgress = Math.min(0.99, Math.max(0.06, 1 - (u.infectionTimer ?? 0) / dur));
  } else if (u.hitFlash > 0) {
    anim = 'hit';
  } else if (u.shootAnim > 0 || u.muzzleFlash > 0) {
    anim = 'shoot';
  } else if (u.isMoving) {
    anim = !u.exhausted && u.speed > 3.6 ? 'run' : 'walk';
  }

  const frameIdx = sampleFlipbookFrame(
    anim,
    anim === 'shoot' ? Math.max(0, 0.24 - u.shootAnim) : u.animTime,
    deathProgress
  );

  if (stage === 'dying') {
    ctx.save();
    const poolR = Math.max(4.5, (deathProgress ?? 0.5) * 3.5 * ppm);
    ctx.fillStyle = 'rgba(127, 29, 29, 0.72)';
    ctx.beginPath();
    ctx.ellipse(drawX, drawY + 1.5, poolR, poolR * 0.72, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderSpriteEntity(ctx, drawX, drawY, ppm, {
    archetypeId,
    facing: u.facing,
    anim,
    frameIndex: frameIdx,
    glowColor: u.kind === 'soldier' ? '#22c55e' : '#38bdf8',
    strongGlow: strongGlow || u.selected,
    dotColor: u.kind === 'soldier' ? '#22c55e' : '#38bdf8',
    scaleMult: 1.08,
  });

  if (u.infected && u.parachuteAlt <= 0) {
    if (stage === 'latent') {
      const pulse = 0.35 + 0.35 * Math.sin(u.animTime * 6);
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(drawX, drawY, Math.max(6, 1.4 * ppm), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (stage === 'vomiting') {
      renderBloodVomitOverlay(
        ctx,
        drawX,
        drawY,
        ppm,
        u.facing,
        u.animTime,
        u.infectionTimer ?? 0,
        u.infectionStageDuration ?? u.infectionDuration ?? 3.6
      );
    }
    if (ppm >= 1.0) {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = stage === 'latent' ? '#fbbf24' : '#ef4444';
      ctx.fillText('☣', drawX, drawY - 19);
    }
  }

  if (ppm >= 0.9 && u.role === 'sniper' && u.animState === 'aiming' && stage !== 'dying') {
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(drawX, drawY);
    ctx.lineTo(drawX + Math.cos(u.facing) * 48, drawY + Math.sin(u.facing) * 48);
    ctx.stroke();
    ctx.restore();
  }

  if (u.parachuteAlt > 0) {
    const swayX = Math.sin(elapsed * 4 + u.id) * 4;
    const chuteY = drawY - 18;
    const chuteR = 16;
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(drawX, drawY);
    ctx.lineTo(drawX + swayX - chuteR * 0.75, chuteY);
    ctx.moveTo(drawX, drawY);
    ctx.lineTo(drawX + swayX + chuteR * 0.75, chuteY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(22, 163, 74, 0.85)';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(drawX + swayX, chuteY, chuteR, chuteR * 0.56, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (ppm >= 1.1) {
    if (u.animState === 'reloading') {
      const bw = 18;
      const pct = Math.max(0, 1 - u.reloadTimer / Math.max(0.1, u.reloadDuration));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(drawX - bw / 2, drawY - 18, bw, 3);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(drawX - bw / 2, drawY - 18, bw * pct, 3);
    } else if (u.selected || u.hp < u.maxHp) {
      const bw = 18;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(drawX - bw / 2, drawY - 16, bw, 3);
      ctx.fillStyle = u.hp / u.maxHp > 0.4 ? '#34d399' : '#ef4444';
      ctx.fillRect(drawX - bw / 2, drawY - 16, bw * Math.max(0, u.hp / u.maxHp), 3);

      // Subtle stamina thin bar underneath HP bar when unit is selected or exhausted
      if (u.selected && (u.stamina < u.maxStamina * 0.96 || u.exhausted)) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.fillRect(drawX - bw / 2, drawY - 12.5, bw, 2);
        ctx.fillStyle = u.exhausted ? '#f97316' : '#38bdf8';
        ctx.fillRect(drawX - bw / 2, drawY - 12.5, bw * Math.max(0, u.stamina / u.maxStamina), 2);
      }
    }
  }
}

interface SirenStrobeState {
  leftPower: number;
  rightPower: number;
  sweepAngle: number;
}

function computeSirenStrobe(elapsed: number, phase: number, sirenMode: SirenMode): SirenStrobeState {
  if (sirenMode === 'yelp') {
    const w = Math.sin(elapsed * 22 + phase);
    const pulse = Math.abs(Math.sin(elapsed * 44 + phase));
    return {
      leftPower: w > 0 ? 0.65 + pulse * 0.35 : 0.1,
      rightPower: w <= 0 ? 0.65 + pulse * 0.35 : 0.1,
      sweepAngle: elapsed * 9.5 + phase,
    };
  }
  if (sirenMode === 'hi_lo') {
    const step = Math.sin(elapsed * 9.74 + phase) >= 0;
    return {
      leftPower: step ? 1.0 : 0.08,
      rightPower: step ? 0.08 : 1.0,
      sweepAngle: elapsed * 5.2 + phase,
    };
  }
  // 'wail'
  const w = Math.sin(elapsed * 11.5 + phase);
  return {
    leftPower: w > 0 ? 0.45 + w * 0.55 : 0.12,
    rightPower: w < 0 ? 0.45 + -w * 0.55 : 0.12,
    sweepAngle: elapsed * 4.4 + phase,
  };
}

function getVehicleSirenColors(kind: VehicleEntity['kind']): {
  leftRgb: string;
  rightRgb: string;
  leftHex: string;
  rightHex: string;
} {
  if (kind === 'ambulance') {
    return { leftRgb: '239, 68, 68', rightRgb: '248, 250, 252', leftHex: '#ef4444', rightHex: '#f8fafc' };
  }
  if (kind === 'fire_truck') {
    return { leftRgb: '239, 68, 68', rightRgb: '245, 158, 11', leftHex: '#ef4444', rightHex: '#f59e0b' };
  }
  return { leftRgb: '239, 68, 68', rightRgb: '59, 130, 246', leftHex: '#ef4444', rightHex: '#3b82f6' };
}

function drawSpecularFlare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  coreColor: string,
  power: number
) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, power);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = coreColor;
  ctx.lineWidth = Math.max(0.8, size * 0.22);
  ctx.beginPath();
  ctx.moveTo(x - size * 1.65, y);
  ctx.lineTo(x + size * 1.65, y);
  ctx.moveTo(x, y - size * 1.35);
  ctx.lineTo(x, y + size * 1.35);
  ctx.stroke();
  ctx.restore();
}

export function renderDynamicVehicleModel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  v: VehicleEntity,
  elapsed: number,
  sirenMode: SirenMode = 'wail'
) {
  const lenPx = Math.max(v.kind === 'motorcycle' ? 14 : 23, v.length * ppm);
  const widPx = Math.max(v.kind === 'motorcycle' ? 7 : 12, v.width * ppm);

  if (v.selected) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(lenPx, widPx) * 0.78, 0, Math.PI * 2);
    ctx.stroke();
  }

  const sprite = getVehicleSprite(v.kind, v.color);
  const drawW = lenPx * 1.56;
  const drawH = widPx * 1.92;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(v.angle);
  ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);

  // 3D Beveled Polycarbonate Roof Lightbar Rack + Dual Specular Emitter Pods
  if (v.sirenOn && v.kind !== 'motorcycle') {
    const strobe = computeSirenStrobe(elapsed, v.sirenPhase, sirenMode);
    const cols = getVehicleSirenColors(v.kind);
    const barX = v.kind === 'ambulance' || v.kind === 'fire_truck' ? lenPx * 0.2 : lenPx * 0.02;
    const barThick = Math.max(2.6, widPx * 0.19);
    const barSpan = Math.max(8.5, widPx * 0.66);

    // Roof drop shadow beneath 3D raised lightbar
    ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
    ctx.fillRect(barX - barThick * 0.68, -barSpan * 0.52, barThick * 1.36, barSpan * 1.04);

    // Anodized dark housing chassis + metallic central speaker/controller bridge
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.roundRect(barX - barThick * 0.52, -barSpan * 0.5, barThick, barSpan, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.fillRect(barX - barThick * 0.34, -barSpan * 0.11, barThick * 0.68, barSpan * 0.22);

    const podSpan = barSpan * 0.34;
    const podThick = barThick * 0.78;
    const leftY = -barSpan * 0.3;
    const rightY = barSpan * 0.3;

    // Left LED Lens Pod (beveled dome + active core)
    ctx.fillStyle = `rgba(${cols.leftRgb}, ${(0.25 + strobe.leftPower * 0.72).toFixed(2)})`;
    ctx.beginPath();
    ctx.roundRect(barX - podThick * 0.5, -barSpan * 0.47, podThick, podSpan, 1);
    ctx.fill();

    // Right LED Lens Pod
    ctx.fillStyle = `rgba(${cols.rightRgb}, ${(0.25 + strobe.rightPower * 0.72).toFixed(2)})`;
    ctx.beginPath();
    ctx.roundRect(barX - podThick * 0.5, barSpan * 0.47 - podSpan, podThick, podSpan, 1);
    ctx.fill();

    // Bright emitter flares & cross-starbursts directly on roof pods
    const podGlowR = Math.max(3.5, widPx * 0.28);
    if (strobe.leftPower > 0.35) {
      const lg = ctx.createRadialGradient(barX, leftY, 0.4, barX, leftY, podGlowR * (0.8 + strobe.leftPower * 0.6));
      lg.addColorStop(0, `rgba(${cols.leftRgb}, ${(strobe.leftPower * 0.85).toFixed(2)})`);
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(barX, leftY, podGlowR * 1.4, 0, Math.PI * 2);
      ctx.fill();
      drawSpecularFlare(ctx, barX, leftY, Math.max(1.8, widPx * 0.14), cols.leftHex, strobe.leftPower);
    }
    if (strobe.rightPower > 0.35) {
      const rg = ctx.createRadialGradient(barX, rightY, 0.4, barX, rightY, podGlowR * (0.8 + strobe.rightPower * 0.6));
      rg.addColorStop(0, `rgba(${cols.rightRgb}, ${(strobe.rightPower * 0.85).toFixed(2)})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(barX, rightY, podGlowR * 1.4, 0, Math.PI * 2);
      ctx.fill();
      drawSpecularFlare(ctx, barX, rightY, Math.max(1.8, widPx * 0.14), cols.rightHex, strobe.rightPower);
    }
  }
  ctx.restore();

  if (v.kind === 'armored_apc') {
    const turret = getApcTurretSprite();
    const tSize = Math.max(16, widPx * 2.1);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(v.turretAngle);
    ctx.drawImage(turret, -tSize / 2, -tSize / 2, tSize, tSize);
    if (v.muzzleFlash > 0) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(tSize * 0.45, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (v.occupants.length > 0 && ppm >= 0.8) {
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dd3fc';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.5;
    const tag = `${v.occupants.length}/${v.maxOccupants}`;
    ctx.strokeText(tag, px, py - Math.max(11, widPx * 0.85));
    ctx.fillText(tag, px, py - Math.max(11, widPx * 0.85));
  }
}

export function renderHelicopterModel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  h: Helicopter,
  elapsed: number
) {
  const scale = 1 + h.altitude * 0.45;
  const drawSz = Math.max(36, 13.5 * ppm) * scale;
  const fuselage = getHelicopterSprite(h.mode);
  const rotor = getRotorSprite();

  ctx.save();
  ctx.translate(px + h.altitude * 28, py + 8 + h.altitude * 28);
  ctx.rotate(h.facing);
  ctx.globalAlpha = 0.36;
  ctx.drawImage(fuselage, -drawSz * 0.45, -drawSz * 0.45, drawSz * 0.9, drawSz * 0.9);
  ctx.restore();

  const liftY = py - h.altitude * 18;
  ctx.save();
  ctx.translate(px, liftY);
  ctx.rotate(h.facing);
  ctx.drawImage(fuselage, -drawSz / 2, -drawSz / 2, drawSz, drawSz);

  const strobeOn = Math.sin(elapsed * 10) > 0.2;
  ctx.fillStyle = strobeOn ? '#ef4444' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(-drawSz * 0.35, 0, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(h.rotorAngle);
  ctx.drawImage(rotor, -drawSz / 2, -drawSz / 2, drawSz, drawSz);
  ctx.restore();

  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ecfdf5';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 3;
  const label =
    h.state === 'inbound'
      ? 'GELİYOR'
      : h.state === 'descending'
        ? 'İNİYOR'
        : h.state === 'ascending' || h.state === 'outbound'
          ? 'KALKIŞ'
          : h.mode === 'gunship'
            ? 'DESTEK'
            : `${h.passengers}/${h.maxCapacity}`;
  ctx.strokeText(label, px, liftY - drawSz * 0.42 - 8);
  ctx.fillText(label, px, liftY - drawSz * 0.42 - 8);
}

export function renderA10Plane(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  strike: A10Strike
) {
  const sprite = getA10Sprite();
  const drawSz = Math.max(54, Math.min(130, 24 * ppm));

  ctx.save();
  ctx.translate(px + 42, py + 48);
  ctx.rotate(strike.angle);
  ctx.globalAlpha = 0.32;
  ctx.drawImage(sprite, -drawSz * 0.46, -drawSz * 0.46, drawSz * 0.92, drawSz * 0.92);
  ctx.restore();

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(strike.angle);
  ctx.drawImage(sprite, -drawSz / 2, -drawSz / 2, drawSz, drawSz);

  if (strike.progress >= -0.05 && strike.progress <= 1.05) {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(drawSz * 0.48, 0, drawSz * 0.09, drawSz * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderChinookModel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ppm: number,
  ch: ChinookDrop,
  elapsed: number
) {
  const hull = getChinookSprite();
  const rotor = getChinookRotorSprite();
  const drawW = Math.max(66, Math.min(165, 29 * ppm));
  const drawH = drawW * 0.44;
  const rotorSz = drawW * 0.62;
  const rotorOff = drawW * 0.285;

  ctx.save();
  ctx.translate(px + 34, py + 42);
  ctx.rotate(ch.angle);
  ctx.globalAlpha = 0.34;
  ctx.drawImage(hull, -drawW * 0.46, -drawH * 0.46, drawW * 0.92, drawH * 0.92);
  ctx.restore();

  ctx.save();
  ctx.translate(px, py - 14);
  ctx.rotate(ch.angle);
  ctx.drawImage(hull, -drawW / 2, -drawH / 2, drawW, drawH);

  ctx.fillStyle = Math.sin(elapsed * 12) > 0 ? '#ef4444' : '#450a0a';
  ctx.beginPath();
  ctx.arc(-drawW * 0.42, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(rotorOff, 0);
  ctx.rotate(ch.rotorAngle);
  ctx.drawImage(rotor, -rotorSz / 2, -rotorSz / 2, rotorSz, rotorSz);
  ctx.restore();

  ctx.save();
  ctx.translate(-rotorOff, 0);
  ctx.rotate(-ch.rotorAngle * 1.03);
  ctx.drawImage(rotor, -rotorSz / 2, -rotorSz / 2, rotorSz, rotorSz);
  ctx.restore();

  ctx.restore();

  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bef264';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 3;
  const tag = `CH-47 · ${ch.droppedCount}/10 PARAŞÜT`;
  ctx.strokeText(tag, px, py - drawH * 0.72 - 16);
  ctx.fillText(tag, px, py - drawH * 0.72 - 16);
}

// Reusable Offscreen Lightmap Canvas (eliminates dark black overlap artifacts!)
let lightmapCanvas: HTMLCanvasElement | null = null;
let lightmapCtx: CanvasRenderingContext2D | null = null;

function getLightmapSurface(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!lightmapCanvas) {
    lightmapCanvas = document.createElement('canvas');
    lightmapCtx = lightmapCanvas.getContext('2d');
  }
  if (!lightmapCanvas || !lightmapCtx) return null;
  if (lightmapCanvas.width !== w || lightmapCanvas.height !== h) {
    lightmapCanvas.width = w;
    lightmapCanvas.height = h;
  }
  return { canvas: lightmapCanvas, ctx: lightmapCtx };
}

function punchConeCutout(
  lctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  angle: number,
  lengthPx: number,
  halfSpreadRad: number,
  strength = 0.94
) {
  lctx.save();
  lctx.translate(ox, oy);
  lctx.rotate(angle);
  const grad = lctx.createRadialGradient(0, 0, Math.max(2, lengthPx * 0.04), lengthPx * 0.45, 0, lengthPx);
  grad.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  grad.addColorStop(0.55, `rgba(0, 0, 0, ${(strength * 0.65).toFixed(2)})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  lctx.fillStyle = grad;
  lctx.beginPath();
  lctx.moveTo(0, 0);
  lctx.arc(0, 0, lengthPx, -halfSpreadRad, halfSpreadRad);
  lctx.closePath();
  lctx.fill();
  lctx.restore();
}

function punchRadialCutout(
  lctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusPx: number,
  strength = 0.9
) {
  const grad = lctx.createRadialGradient(x, y, 2, x, y, radiusPx);
  grad.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  grad.addColorStop(0.55, `rgba(0, 0, 0, ${(strength * 0.55).toFixed(2)})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  lctx.fillStyle = grad;
  lctx.beginPath();
  lctx.arc(x, y, radiusPx, 0, Math.PI * 2);
  lctx.fill();
}

/**
 * Offscreen `destination-out` Night Lightmap + Subtle Volumetric Rim Tint:
 * Overlapping gun-mounted flashlights, dual car headlights, watchtower floodlights,
 * helicopter spotlights, fires & explosions NEVER turn black when combined.
 */
export function renderDayNightAtmosphere(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ppm: number,
  timeOfDay: number,
  elapsed: number,
  project: (x: number, y: number) => { px: number; py: number } | null,
  units: Unit[],
  vehicles: VehicleEntity[],
  helicopters: Helicopter[],
  fires: FireSpot[],
  quarantineZones: QuarantineZone[] = [],
  explosions: ExplosionEffect[] = [],
  sirenMode: SirenMode = 'wail'
) {
  const sunHeight = Math.sin((timeOfDay - 0.25) * Math.PI * 2);
  const darkness = Math.max(0, Math.min(0.68, (-sunHeight + 0.15) * 0.62));
  const duskWarmth = Math.max(0, 1 - Math.abs(sunHeight) * 2.6);

  if (darkness <= 0.02 && duskWarmth <= 0.05) return;

  // Dusk golden atmosphere wash
  if (duskWarmth > 0.05) {
    ctx.save();
    ctx.fillStyle = `rgba(217, 119, 6, ${(duskWarmth * 0.12).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const lightStrength = Math.max(darkness, duskWarmth * 0.35);
  const surface = darkness > 0.02 ? getLightmapSurface(width, height) : null;

  if (surface && darkness > 0.02) {
    const lctx = surface.ctx;
    lctx.save();
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, width, height);
    lctx.fillStyle = `rgba(4, 9, 24, ${darkness.toFixed(3)})`;
    lctx.fillRect(0, 0, width, height);

    // Punch clean holes using destination-out so overlaps only clear toward daylight!
    lctx.globalCompositeOperation = 'destination-out';

    // 1. Gun-mounted Tactical Flashlights (emanating strictly from weapon barrel offset forward)
    if (lightStrength > 0.14) {
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.inVehicleId !== null || u.parachuteAlt > 0) continue;
        const barrelOff = u.radius + 0.55;
        const p = project(u.x + Math.cos(u.facing) * barrelOff, u.y + Math.sin(u.facing) * barrelOff);
        if (!p || p.px < -80 || p.px > width + 80 || p.py < -80 || p.py > height + 80) continue;
        const beamLen = Math.max(26, 26 * ppm);
        // Tight bright personal ring around unit + tight tactical rail flashlight cone
        punchRadialCutout(lctx, p.px, p.py, Math.max(10, 4.5 * ppm), 0.72);
        punchConeCutout(lctx, p.px, p.py, u.facing, beamLen, 0.27, 0.96);
      }

      // 2. Dual Bumper Vehicle Headlights & Rotating Emergency Siren Cones
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (v.occupants.length === 0 && !v.sirenOn) continue;
        const cos = Math.cos(v.angle);
        const sin = Math.sin(v.angle);
        const frontOff = v.length * 0.48;
        const beamLen = Math.max(46, 44 * ppm);

        if (v.occupants.length > 0) {
          if (v.kind === 'motorcycle') {
            const hp = project(v.x + cos * frontOff, v.y + sin * frontOff);
            if (hp) punchConeCutout(lctx, hp.px, hp.py, v.angle, beamLen * 0.78, 0.25, 0.95);
          } else {
            const lat = v.width * 0.34;
            const pL = project(v.x + cos * frontOff - sin * lat, v.y + sin * frontOff + cos * lat);
            const pR = project(v.x + cos * frontOff + sin * lat, v.y + sin * frontOff - cos * lat);
            if (pL) punchConeCutout(lctx, pL.px, pL.py, v.angle - 0.05, beamLen, 0.26, 0.94);
            if (pR) punchConeCutout(lctx, pR.px, pR.py, v.angle + 0.05, beamLen, 0.26, 0.94);
          }
        }

        if (v.sirenOn && v.kind !== 'motorcycle') {
          const sp = project(v.x, v.y);
          if (sp) {
            const strobe = computeSirenStrobe(elapsed, v.sirenPhase, sirenMode);
            const coneLen = Math.max(30, 32 * ppm);
            punchRadialCutout(lctx, sp.px, sp.py, Math.max(18, 12 * ppm), 0.76);
            if (strobe.leftPower > 0.3) {
              punchConeCutout(lctx, sp.px, sp.py, v.angle + strobe.sweepAngle, coneLen, 0.44, 0.78 * strobe.leftPower);
            }
            if (strobe.rightPower > 0.3) {
              punchConeCutout(lctx, sp.px, sp.py, v.angle + strobe.sweepAngle + Math.PI, coneLen, 0.44, 0.78 * strobe.rightPower);
            }
          }
        }
      }

      // 3. Quarantine Watchtower High-Intensity Sweeping Searchlights
      for (let qi = 0; qi < quarantineZones.length; qi++) {
        const qz = quarantineZones[qi];
        if (qz.status !== 'active') continue;
        for (let ti = 0; ti < qz.towers.length; ti++) {
          const tw = qz.towers[ti];
          if (!tw.active) continue;
          const tp = project(tw.x, tw.y);
          if (!tp || tp.px < -140 || tp.px > width + 140 || tp.py < -140 || tp.py > height + 140) continue;
          const searchLen = Math.max(72, 66 * ppm);
          punchRadialCutout(lctx, tp.px, tp.py, Math.max(16, 10 * ppm), 0.92);
          punchConeCutout(lctx, tp.px, tp.py, tw.searchlightAngle, searchLen, 0.31, 1.0);
        }
      }

      // 4. Helicopter Searchlights
      for (let i = 0; i < helicopters.length; i++) {
        const h = helicopters[i];
        const p = project(h.x, h.y);
        if (!p) continue;
        punchRadialCutout(lctx, p.px, p.py, Math.max(52, 46 * ppm), 0.92);
      }

      // 5. Fires & Explosions
      for (let i = 0; i < fires.length; i++) {
        const f = fires[i];
        const p = project(f.x, f.y);
        if (!p) continue;
        punchRadialCutout(lctx, p.px, p.py, Math.max(36, f.radius * 3.4 * ppm), 0.95);
      }
      for (let i = 0; i < explosions.length; i++) {
        const ex = explosions[i];
        if (ex.age > ex.duration * 0.65) continue;
        const p = project(ex.x, ex.y);
        if (!p) continue;
        punchRadialCutout(lctx, p.px, p.py, Math.max(75, ex.radius * 3.6 * ppm), 1.0);
      }
    }
    lctx.restore();

    // Composite clean lightmap once onto scene
    ctx.drawImage(surface.canvas, 0, 0);
  }

  // Subtle colored volumetric beam tints & emergency sirens (never over-brightened!)
  if (lightStrength > 0.14) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.inVehicleId !== null || u.parachuteAlt > 0) continue;
      const barrelOff = u.radius + 0.55;
      const p = project(u.x + Math.cos(u.facing) * barrelOff, u.y + Math.sin(u.facing) * barrelOff);
      if (!p || p.px < -60 || p.px > width + 60 || p.py < -60 || p.py > height + 60) continue;
      const beamLen = Math.max(24, 24 * ppm);
      ctx.save();
      ctx.translate(p.px, p.py);
      ctx.rotate(u.facing);
      const grad = ctx.createRadialGradient(0, 0, 1, beamLen * 0.45, 0, beamLen);
      grad.addColorStop(0, `rgba(224, 242, 254, ${(0.16 * lightStrength).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, beamLen, -0.25, 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const p = project(v.x, v.y);
      if (!p || p.px < -80 || p.px > width + 80 || p.py < -80 || p.py > height + 80) continue;

      if (v.occupants.length > 0 && v.kind !== 'motorcycle') {
        const cos = Math.cos(v.angle);
        const sin = Math.sin(v.angle);
        const frontOff = v.length * 0.48;
        const lat = v.width * 0.34;
        const beamLen = Math.max(40, 40 * ppm);
        for (const side of [-1, 1]) {
          const hp = project(v.x + cos * frontOff - sin * lat * side, v.y + sin * frontOff + cos * lat * side);
          if (!hp) continue;
          ctx.save();
          ctx.translate(hp.px, hp.py);
          ctx.rotate(v.angle + side * 0.04);
          const grad = ctx.createRadialGradient(0, 0, 2, beamLen * 0.5, 0, beamLen);
          grad.addColorStop(0, `rgba(254, 249, 195, ${(0.22 * lightStrength).toFixed(2)})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, beamLen, -0.24, 0.24);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      if (v.sirenOn && v.kind !== 'motorcycle') {
        const strobe = computeSirenStrobe(elapsed, v.sirenPhase, sirenMode);
        const cols = getVehicleSirenColors(v.kind);
        const cos = Math.cos(v.angle);
        const sin = Math.sin(v.angle);
        const barOffMeters = v.kind === 'ambulance' || v.kind === 'fire_truck' ? v.length * 0.2 : v.length * 0.02;
        const podLatMeters = v.width * 0.24;
        const coneLen = Math.max(28, 30 * ppm);
        const gndR = Math.max(22, 18 * ppm);

        // Perspective-foreshortened asphalt bounce glow (no circular blob!)
        ctx.save();
        ctx.translate(p.px, p.py);
        ctx.rotate(v.angle);
        ctx.scale(1.18, 0.76);
        const bounceAlphaL = (0.2 * strobe.leftPower * Math.min(1, lightStrength * 1.15)).toFixed(2);
        const bounceAlphaR = (0.2 * strobe.rightPower * Math.min(1, lightStrength * 1.15)).toFixed(2);
        const gL = ctx.createRadialGradient(0, -gndR * 0.28, 1, 0, -gndR * 0.28, gndR);
        gL.addColorStop(0, `rgba(${cols.leftRgb}, ${bounceAlphaL})`);
        gL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gL;
        ctx.beginPath();
        ctx.arc(0, -gndR * 0.28, gndR, 0, Math.PI * 2);
        ctx.fill();

        const gR = ctx.createRadialGradient(0, gndR * 0.28, 1, 0, gndR * 0.28, gndR);
        gR.addColorStop(0, `rgba(${cols.rightRgb}, ${bounceAlphaR})`);
        gR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gR;
        ctx.beginPath();
        ctx.arc(0, gndR * 0.28, gndR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Dual sweeping 3D volumetric beacon cones
        const pLeft = project(v.x + cos * barOffMeters + sin * podLatMeters, v.y + sin * barOffMeters - cos * podLatMeters);
        const pRight = project(v.x + cos * barOffMeters - sin * podLatMeters, v.y + sin * barOffMeters + cos * podLatMeters);

        if (pLeft && strobe.leftPower > 0.25) {
          ctx.save();
          ctx.translate(pLeft.px, pLeft.py);
          ctx.rotate(v.angle + strobe.sweepAngle);
          const cg = ctx.createRadialGradient(0, 0, 1, coneLen * 0.42, 0, coneLen);
          cg.addColorStop(0, `rgba(${cols.leftRgb}, ${(0.42 * strobe.leftPower).toFixed(2)})`);
          cg.addColorStop(0.55, `rgba(${cols.leftRgb}, ${(0.18 * strobe.leftPower).toFixed(2)})`);
          cg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, coneLen, -0.42, 0.42);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        if (pRight && strobe.rightPower > 0.25) {
          ctx.save();
          ctx.translate(pRight.px, pRight.py);
          ctx.rotate(v.angle + strobe.sweepAngle + Math.PI);
          const cg = ctx.createRadialGradient(0, 0, 1, coneLen * 0.42, 0, coneLen);
          cg.addColorStop(0, `rgba(${cols.rightRgb}, ${(0.42 * strobe.rightPower).toFixed(2)})`);
          cg.addColorStop(0.55, `rgba(${cols.rightRgb}, ${(0.18 * strobe.rightPower).toFixed(2)})`);
          cg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, coneLen, -0.42, 0.42);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    for (let qi = 0; qi < quarantineZones.length; qi++) {
      const qz = quarantineZones[qi];
      if (qz.status !== 'active') continue;
      for (let ti = 0; ti < qz.towers.length; ti++) {
        const tw = qz.towers[ti];
        if (!tw.active) continue;
        const tp = project(tw.x, tw.y);
        if (!tp) continue;
        const searchLen = Math.max(66, 60 * ppm);
        ctx.save();
        ctx.translate(tp.px, tp.py);
        ctx.rotate(tw.searchlightAngle);
        const tg = ctx.createRadialGradient(0, 0, 3, searchLen * 0.5, 0, searchLen);
        tg.addColorStop(0, `rgba(254, 240, 138, ${(0.26 * lightStrength).toFixed(2)})`);
        tg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, searchLen, -0.28, 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < fires.length; i++) {
      const f = fires[i];
      const p = project(f.x, f.y);
      if (!p) continue;
      const fr = Math.max(26, f.radius * 2.5 * ppm);
      const fg = ctx.createRadialGradient(p.px, p.py, 2, p.px, p.py, fr);
      fg.addColorStop(0, 'rgba(251, 146, 60, 0.25)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(p.px, p.py, fr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

let heatmapGlowStamp: HTMLCanvasElement | null = null;
let rawHeatBuffer = new Float32Array(8192);
let smoothHeatBuffer = new Float32Array(8192);

function getHeatmapGlowStamp(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (heatmapGlowStamp) return heatmapGlowStamp;

  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const gctx = c.getContext('2d');
  if (gctx) {
    const half = size / 2;
    const grad = gctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(254, 118, 118, 0.92)');
    grad.addColorStop(0.24, 'rgba(239, 68, 68, 0.72)');
    grad.addColorStop(0.55, 'rgba(220, 38, 38, 0.34)');
    grad.addColorStop(0.82, 'rgba(185, 28, 28, 0.1)');
    grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, size, size);
  }
  heatmapGlowStamp = c;
  return c;
}

export interface ZombieHeatmapGridData {
  cellM: number;
  minIx: number;
  minIy: number;
  cols: number;
  rows: number;
  smooth: Float32Array;
  maxDensity: number;
}

export function computeZombieHeatmapGrid(
  zombies: readonly Zombie[],
  ppm: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): ZombieHeatmapGridData | null {
  if (zombies.length === 0) return null;

  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 80);
  const baseCellM = ppm >= 1.2 ? 26 : ppm >= 0.45 ? 44 : ppm >= 0.16 ? 82 : 145;
  const cellM = Math.max(baseCellM, span / 62);
  const margin = cellM * 2;

  const minIx = Math.floor((bounds.minX - margin) / cellM);
  const maxIx = Math.ceil((bounds.maxX + margin) / cellM);
  const minIy = Math.floor((bounds.minY - margin) / cellM);
  const maxIy = Math.ceil((bounds.maxY + margin) / cellM);

  const cols = Math.max(1, maxIx - minIx + 1);
  const rows = Math.max(1, maxIy - minIy + 1);
  const needed = cols * rows;

  if (rawHeatBuffer.length < needed) {
    rawHeatBuffer = new Float32Array(needed);
    smoothHeatBuffer = new Float32Array(needed);
  }

  rawHeatBuffer.fill(0, 0, needed);
  smoothHeatBuffer.fill(0, 0, needed);

  const invCell = 1 / cellM;
  let anyInBounds = false;

  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    const gx = Math.floor(z.x * invCell) - minIx;
    const gy = Math.floor(z.y * invCell) - minIy;
    if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue;

    const weight =
      z.variant === 'heavy'
        ? 1.55
        : z.variant === 'fat'
          ? 1.35
          : z.variant === 'runner'
            ? 1.15
            : 1.0;
    rawHeatBuffer[gy * cols + gx] += weight;
    anyInBounds = true;
  }

  if (!anyInBounds) return null;

  let maxDensity = 0;
  for (let y = 0; y < rows; y++) {
    const rowOff = y * cols;
    for (let x = 0; x < cols; x++) {
      const val = rawHeatBuffer[rowOff + x];
      if (val <= 0) continue;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= rows) continue;
        const nyOff = ny * cols;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= cols) continue;
          const k = dx === 0 && dy === 0 ? 0.36 : dx === 0 || dy === 0 ? 0.11 : 0.05;
          const next = smoothHeatBuffer[nyOff + nx] + val * k;
          smoothHeatBuffer[nyOff + nx] = next;
          if (next > maxDensity) maxDensity = next;
        }
      }
    }
  }

  if (maxDensity <= 0.12) return null;

  return {
    cellM,
    minIx,
    minIy,
    cols,
    rows,
    smooth: smoothHeatBuffer,
    maxDensity,
  };
}

export function renderZombieHeatmap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ppm: number,
  project: (x: number, y: number) => { px: number; py: number } | null,
  zombies: readonly Zombie[],
  viewBounds: { minX: number; maxX: number; minY: number; maxY: number } | null | undefined,
  halfSize: number,
  elapsed: number
) {
  if (zombies.length === 0) return;

  const stamp = getHeatmapGlowStamp();
  if (!stamp) return;

  const bounds = viewBounds ?? {
    minX: -halfSize,
    maxX: halfSize,
    minY: -halfSize,
    maxY: halfSize,
  };

  const grid = computeZombieHeatmapGrid(zombies, ppm, bounds);
  if (!grid) return;

  const { cellM, minIx, minIy, cols, rows, smooth } = grid;
  const baseStampPx = Math.max(38, cellM * ppm * 2.55);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let y = 0; y < rows; y++) {
    const rowOff = y * cols;
    const wy = (minIy + y + 0.5) * cellM;
    for (let x = 0; x < cols; x++) {
      const density = smooth[rowOff + x];
      if (density < 0.16) continue;

      const wx = (minIx + x + 0.5) * cellM;
      const p = project(wx, wy);
      if (!p) continue;

      const norm = 1 - Math.exp(-density / 3.4);
      const drawSize = baseStampPx * (0.95 + norm * 0.45);
      const halfDraw = drawSize * 0.5;
      if (
        p.px + halfDraw < 0 ||
        p.px - halfDraw > width ||
        p.py + halfDraw < 0 ||
        p.py - halfDraw > height
      ) {
        continue;
      }

      const pulse = 1 + 0.04 * Math.sin(elapsed * 2.1 + (minIx + x) * 0.65 + (minIy + y) * 0.85);
      const alpha = Math.min(0.42, (0.065 + norm * 0.32) * pulse);
      ctx.globalAlpha = alpha;
      ctx.drawImage(stamp, p.px - halfDraw, p.py - halfDraw, drawSize, drawSize);
    }
  }

  ctx.restore();
}
