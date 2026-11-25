import { getSectorLatLngBounds, latLngToMeters } from './geo';
import {
  BridgeCorridor,
  GeoOrigin,
  Obstacle,
  ObstacleKind,
  ObstacleStats,
  OcclusionZone,
  TacticalSectorPreset,
} from './types';

export interface RoadSpawnSpot {
  x: number;
  y: number;
  angle: number;
}

export interface ObstacleFetchResult {
  obstacles: Obstacle[];
  occlusionZones: OcclusionZone[];
  roadSpots: RoadSpawnSpot[];
  bridges: BridgeCorridor[];
  status: 'osm' | 'osm+ai' | 'fallback';
  aiError?: string;
  stats: ObstacleStats;
}

export const TACTICAL_SECTORS: TacticalSectorPreset[] = [
  {
    id: 'round_mountain_nv',
    name: 'Round Mountain, NV · 7 Jefferson Dr',
    subtitle: '7 Jefferson Dr #376, Round Mountain NV 89045 · Konut blokları, ağaçlar ve sokaklar',
    origin: { lat: 38.778744083524266, lng: -117.17032102919983 },
    defaultHalfSize: 450,
    recommendedZoom: 18,
  },
  {
    id: 'istanbul_karakoy',
    name: 'İstanbul · Karaköy & Galata',
    subtitle: 'Tarihi dar sokaklar, iç avlulu hanlar, Galata Köprüsü ve Haliç kıyısı',
    origin: { lat: 41.0236, lng: 28.9746 },
    defaultHalfSize: 500,
    recommendedZoom: 17,
  },
  {
    id: 'istanbul_kadikoy',
    name: 'İstanbul · Kadıköy Rıhtım',
    subtitle: 'Yoğun bloklar, sahil rıhtımı, park koridorları ve dar ara geçitler',
    origin: { lat: 40.9906, lng: 29.0246 },
    defaultHalfSize: 500,
    recommendedZoom: 17,
  },
  {
    id: 'istanbul_besiktas',
    name: 'İstanbul · Beşiktaş Meydan',
    subtitle: 'Boğaz hattı, ana bulvarlar, ağaçlıklı meydan ve mahalle arası',
    origin: { lat: 41.0428, lng: 29.0068 },
    defaultHalfSize: 500,
    recommendedZoom: 17,
  },
  {
    id: 'chicago_loop',
    name: 'Chicago · Loop & Nehir Köprüleri',
    subtitle: 'Gökdelen blokları, Chicago Nehri köprüleri ve Millennium Parkı',
    origin: { lat: 41.88194, lng: -87.62778 },
    defaultHalfSize: 1000,
    recommendedZoom: 16,
  },
];

const CAR_COLORS = ['#94a3b8', '#475569', '#dc2626', '#2563eb', '#d97706', '#e2e8f0', '#334155', '#1e293b'];

function computeBBox(points: { x: number; y: number }[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    sumX += p.x;
    sumY += p.y;
  }
  const cx = sumX / points.length;
  const cy = sumY / points.length;
  let maxR = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d > maxR) maxR = d;
  }
  return { cx, cy, minX, maxX, minY, maxY, radius: maxR };
}

export function createRectObstacle(
  id: string,
  kind: ObstacleKind,
  x: number,
  y: number,
  width: number,
  height: number,
  angle = 0,
  color?: string,
  isWater = false
): Obstacle {
  const hw = width / 2;
  const hh = height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((c) => ({
    x: x + c.x * cos - c.y * sin,
    y: y + c.x * sin + c.y * cos,
  }));
  const bbox = computeBBox(corners);
  return {
    id,
    kind,
    shape: angle === 0 ? 'rect' : 'polygon',
    x,
    y,
    radius: Math.hypot(hw, hh),
    w: width,
    h: height,
    width,
    height,
    angle,
    points: corners,
    minX: bbox.minX,
    maxX: bbox.maxX,
    minY: bbox.minY,
    maxY: bbox.maxY,
    color,
    isWater,
  };
}

export function createCircleObstacle(
  id: string,
  kind: ObstacleKind,
  x: number,
  y: number,
  radius: number,
  color?: string
): Obstacle {
  return {
    id,
    kind,
    shape: 'circle',
    x,
    y,
    radius,
    minX: x - radius,
    maxX: x + radius,
    minY: y - radius,
    maxY: y + radius,
    color,
  };
}

export function createPolygonObstacle(
  id: string,
  kind: ObstacleKind,
  points: { x: number; y: number }[],
  color?: string,
  holes?: { x: number; y: number }[][],
  isWater = false
): Obstacle | null {
  if (points.length < 3) return null;
  const bbox = computeBBox(points);
  if (bbox.maxX - bbox.minX < 1.0 || bbox.maxY - bbox.minY < 1.0) return null;
  return {
    id,
    kind,
    shape: 'polygon',
    x: bbox.cx,
    y: bbox.cy,
    radius: bbox.radius,
    points,
    holes: holes && holes.length > 0 ? holes : undefined,
    isWater,
    minX: bbox.minX,
    maxX: bbox.maxX,
    minY: bbox.minY,
    maxY: bbox.maxY,
    color,
  };
}

export function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number; distSq: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) {
    return { x: ax, y: ay, distSq: (px - ax) ** 2 + (py - ay) ** 2 };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { x: cx, y: cy, distSq: (px - cx) ** 2 + (py - cy) ** 2 };
}

export function isPointOnBridge(x: number, y: number, bridges: BridgeCorridor[], margin = 0): boolean {
  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    const cp = closestPointOnSegment(x, y, b.x1, b.y1, b.x2, b.y2);
    const limit = Math.max(1.2, b.halfWidth - margin);
    if (cp.distSq <= limit * limit) {
      return true;
    }
  }
  return false;
}

function closestEdgeOnRing(
  cx: number,
  cy: number,
  ring: { x: number; y: number }[]
): { x: number; y: number; distSq: number } {
  let bestX = ring[0].x;
  let bestY = ring[0].y;
  let bestDistSq = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const cp = closestPointOnSegment(cx, cy, a.x, a.y, b.x, b.y);
    if (cp.distSq < bestDistSq) {
      bestDistSq = cp.distSq;
      bestX = cp.x;
      bestY = cp.y;
    }
  }
  return { x: bestX, y: bestY, distSq: bestDistSq };
}

export function isPointInsidePolygonObstacle(x: number, y: number, obs: Obstacle): boolean {
  if (!obs.points || obs.points.length < 3) return false;
  if (!pointInPolygon(x, y, obs.points)) return false;
  if (obs.holes && obs.holes.length > 0) {
    for (let h = 0; h < obs.holes.length; h++) {
      if (pointInPolygon(x, y, obs.holes[h])) {
        return false; // inside open courtyard hole -> walkable!
      }
    }
  }
  return true;
}

export function doesCircleOverlapObstacle(
  cx: number,
  cy: number,
  r: number,
  obs: Obstacle,
  bridges?: BridgeCorridor[]
): boolean {
  if (cx + r < obs.minX || cx - r > obs.maxX || cy + r < obs.minY || cy - r > obs.maxY) {
    return false;
  }

  if (obs.isWater && bridges && bridges.length > 0 && isPointOnBridge(cx, cy, bridges, r * 0.45)) {
    return false;
  }

  if (obs.shape === 'circle') {
    const rad = obs.radius + r;
    const dx = cx - obs.x;
    const dy = cy - obs.y;
    return dx * dx + dy * dy < rad * rad;
  }

  if (obs.shape === 'rect' && !obs.angle) {
    const hw = (obs.width ?? obs.w ?? 4) / 2;
    const hh = (obs.height ?? obs.h ?? 4) / 2;
    const clampedX = Math.max(obs.x - hw, Math.min(obs.x + hw, cx));
    const clampedY = Math.max(obs.y - hh, Math.min(obs.y + hh, cy));
    const dx = cx - clampedX;
    const dy = cy - clampedY;
    return dx * dx + dy * dy < r * r;
  }

  if (obs.points && obs.points.length >= 3) {
    if (pointInPolygon(cx, cy, obs.points)) {
      if (obs.holes && obs.holes.length > 0) {
        for (let h = 0; h < obs.holes.length; h++) {
          const hole = obs.holes[h];
          if (pointInPolygon(cx, cy, hole)) {
            const edge = closestEdgeOnRing(cx, cy, hole);
            return edge.distSq < r * r;
          }
        }
      }
      return true;
    }
    const outerEdge = closestEdgeOnRing(cx, cy, obs.points);
    return outerEdge.distSq < r * r;
  }

  return false;
}

export function resolveCircleObstacle(
  cx: number,
  cy: number,
  r: number,
  obs: Obstacle,
  bridges?: BridgeCorridor[]
): { x: number; y: number; hit: boolean } {
  if (cx + r < obs.minX || cx - r > obs.maxX || cy + r < obs.minY || cy - r > obs.maxY) {
    return { x: cx, y: cy, hit: false };
  }

  if (obs.isWater && bridges && bridges.length > 0 && isPointOnBridge(cx, cy, bridges, r * 0.4)) {
    return { x: cx, y: cy, hit: false };
  }

  if (obs.shape === 'circle') {
    const dx = cx - obs.x;
    const dy = cy - obs.y;
    const distSq = dx * dx + dy * dy;
    const minDist = obs.radius + r;
    if (distSq >= minDist * minDist) return { x: cx, y: cy, hit: false };
    const dist = Math.sqrt(distSq);
    if (dist < 1e-4) {
      return { x: obs.x + minDist, y: obs.y, hit: true };
    }
    return {
      x: obs.x + (dx / dist) * minDist,
      y: obs.y + (dy / dist) * minDist,
      hit: true,
    };
  }

  if (obs.shape === 'rect' && !obs.angle) {
    const hw = (obs.width ?? obs.w ?? 4) / 2;
    const hh = (obs.height ?? obs.h ?? 4) / 2;
    const minX = obs.x - hw;
    const maxX = obs.x + hw;
    const minY = obs.y - hh;
    const maxY = obs.y + hh;
    const clampedX = Math.max(minX, Math.min(maxX, cx));
    const clampedY = Math.max(minY, Math.min(maxY, cy));
    const dx = cx - clampedX;
    const dy = cy - clampedY;
    const distSq = dx * dx + dy * dy;

    if (distSq === 0) {
      const dl = Math.abs(cx - minX);
      const dr = Math.abs(maxX - cx);
      const dt = Math.abs(cy - minY);
      const db = Math.abs(maxY - cy);
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) return { x: minX - r, y: cy, hit: true };
      if (m === dr) return { x: maxX + r, y: cy, hit: true };
      if (m === dt) return { x: cx, y: minY - r, hit: true };
      return { x: cx, y: maxY + r, hit: true };
    }

    if (distSq >= r * r) return { x: cx, y: cy, hit: false };
    const dist = Math.sqrt(distSq);
    return {
      x: clampedX + (dx / dist) * r,
      y: clampedY + (dy / dist) * r,
      hit: true,
    };
  }

  if (obs.points && obs.points.length >= 3) {
    const insideOuter = pointInPolygon(cx, cy, obs.points);

    if (insideOuter && obs.holes && obs.holes.length > 0) {
      for (let h = 0; h < obs.holes.length; h++) {
        const hole = obs.holes[h];
        if (pointInPolygon(cx, cy, hole)) {
          const edge = closestEdgeOnRing(cx, cy, hole);
          if (edge.distSq >= r * r) {
            return { x: cx, y: cy, hit: false };
          }
          const dist = Math.sqrt(edge.distSq);
          if (dist < 1e-4) {
            return { x: cx, y: cy, hit: true };
          }
          return {
            x: edge.x + ((cx - edge.x) / dist) * r,
            y: edge.y + ((cy - edge.y) / dist) * r,
            hit: true,
          };
        }
      }
    }

    const edge = closestEdgeOnRing(cx, cy, obs.points);
    if (!insideOuter && edge.distSq >= r * r) {
      return { x: cx, y: cy, hit: false };
    }

    const dist = Math.sqrt(edge.distSq);
    if (insideOuter) {
      if (dist < 1e-4) {
        const dx = cx - obs.x;
        const dy = cy - obs.y;
        const d = Math.hypot(dx, dy) || 1;
        return { x: cx + (dx / d) * r, y: cy + (dy / d) * r, hit: true };
      }
      return {
        x: edge.x + ((edge.x - cx) / dist) * r,
        y: edge.y + ((edge.y - cy) / dist) * r,
        hit: true,
      };
    }

    if (dist < 1e-4) {
      return { x: cx, y: cy, hit: true };
    }
    return {
      x: edge.x + ((cx - edge.x) / dist) * r,
      y: edge.y + ((cy - edge.y) / dist) * r,
      hit: true,
    };
  }

  return { x: cx, y: cy, hit: false };
}

export function isCircleClearOfObstacles(
  cx: number,
  cy: number,
  r: number,
  obstacles: Obstacle[],
  excludeId?: string,
  ignoreKinds?: ObstacleKind[],
  bridges?: BridgeCorridor[]
): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (excludeId && obs.id === excludeId) continue;
    if (ignoreKinds && ignoreKinds.includes(obs.kind)) continue;
    if (doesCircleOverlapObstacle(cx, cy, r, obs, bridges)) {
      return false;
    }
  }
  return true;
}

export function isPointInWaterObstacles(
  x: number,
  y: number,
  obstacles: Obstacle[],
  bridges: BridgeCorridor[],
  margin = 0
): boolean {
  if (isPointOnBridge(x, y, bridges, margin)) {
    return false;
  }
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (!obs.isWater) continue;
    if (doesCircleOverlapObstacle(x, y, Math.max(0.2, margin), obs)) {
      return true;
    }
  }
  return false;
}

export function resolveAllObstacles(
  x: number,
  y: number,
  r: number,
  obstacles: Obstacle[],
  ignoreKinds?: ObstacleKind[],
  bridges?: BridgeCorridor[]
): { x: number; y: number; hit: boolean } {
  let nx = x;
  let ny = y;
  let anyHit = false;
  for (let pass = 0; pass < 2; pass++) {
    let passHit = false;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (ignoreKinds && ignoreKinds.includes(obs.kind)) continue;
      const res = resolveCircleObstacle(nx, ny, r, obs, bridges);
      if (res.hit) {
        nx = res.x;
        ny = res.y;
        anyHit = true;
        passHit = true;
      }
    }
    if (!passHit) break;
  }
  return { x: nx, y: ny, hit: anyHit };
}

export function findNearestSafeSpot(
  x: number,
  y: number,
  r: number,
  obstacles: Obstacle[],
  maxDistance: number,
  bridges?: BridgeCorridor[]
): { x: number; y: number } {
  if (isCircleClearOfObstacles(x, y, r, obstacles, undefined, undefined, bridges)) {
    return { x, y };
  }
  for (let dist = 2.0; dist <= maxDistance; dist += 2.5) {
    const steps = Math.max(8, Math.round(dist * 1.4));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const tx = x + Math.cos(a) * dist;
      const ty = y + Math.sin(a) * dist;
      if (isCircleClearOfObstacles(tx, ty, r, obstacles, undefined, undefined, bridges)) {
        return { x: tx, y: ty };
      }
    }
  }
  const pushed = resolveAllObstacles(x, y, r, obstacles, undefined, bridges);
  return { x: pushed.x, y: pushed.y };
}

export class ObstacleGrid {
  public readonly cellSize: number;
  public readonly buckets = new Map<number, Obstacle[]>();
  public readonly all: Obstacle[] = [];
  public readonly bridges: BridgeCorridor[] = [];
  private readonly invCell: number;
  private readonly scratchList: Obstacle[] = [];
  private readonly seenStamp = new Map<string, number>();
  private stampTick = 1;

  constructor(obstacles: Obstacle[] = [], cellSize = 36, bridges: BridgeCorridor[] = []) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
    this.bridges = bridges;
    for (let i = 0; i < obstacles.length; i++) {
      this.insert(obstacles[i]);
    }
  }

  private cellKey(cx: number, cy: number): number {
    return (cx + 16384) * 32768 + (cy + 16384);
  }

  public insert(ob: Obstacle) {
    this.all.push(ob);
    const x0 = Math.floor(ob.minX * this.invCell);
    const x1 = Math.floor(ob.maxX * this.invCell);
    const y0 = Math.floor(ob.minY * this.invCell);
    const y1 = Math.floor(ob.maxY * this.invCell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.cellKey(cx, cy);
        let list = this.buckets.get(k);
        if (!list) {
          list = [];
          this.buckets.set(k, list);
        }
        list.push(ob);
      }
    }
  }

  public queryBoxScratch(minX: number, minY: number, maxX: number, maxY: number): Obstacle[] {
    this.scratchList.length = 0;
    this.stampTick++;
    const x0 = Math.floor(minX * this.invCell);
    const x1 = Math.floor(maxX * this.invCell);
    const y0 = Math.floor(minY * this.invCell);
    const y1 = Math.floor(maxY * this.invCell);

    if (x0 === x1 && y0 === y1) {
      const list = this.buckets.get(this.cellKey(x0, y0));
      if (!list) return this.scratchList;
      for (let i = 0; i < list.length; i++) {
        const ob = list[i];
        if (ob.maxX >= minX && ob.minX <= maxX && ob.maxY >= minY && ob.minY <= maxY) {
          this.scratchList.push(ob);
        }
      }
      return this.scratchList;
    }

    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.buckets.get(this.cellKey(cx, cy));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const ob = list[i];
          if (this.seenStamp.get(ob.id) === this.stampTick) continue;
          this.seenStamp.set(ob.id, this.stampTick);
          if (ob.maxX >= minX && ob.minX <= maxX && ob.maxY >= minY && ob.minY <= maxY) {
            this.scratchList.push(ob);
          }
        }
      }
    }
    return this.scratchList;
  }
}

export function buildObstacleGrid(
  obstacles: Obstacle[],
  cellSize = 36,
  bridges: BridgeCorridor[] = []
): ObstacleGrid {
  return new ObstacleGrid(obstacles, cellSize, bridges);
}

export function queryObstacleGrid(x: number, y: number, r: number, grid: ObstacleGrid): Obstacle[] {
  return grid.queryBoxScratch(x - r, y - r, x + r, y + r);
}

function unwrapObsList(obs: Obstacle[] | ObstacleGrid): { list: Obstacle[]; bridges: BridgeCorridor[] } {
  if (obs instanceof ObstacleGrid) {
    return { list: obs.all, bridges: obs.bridges };
  }
  return { list: obs, bridges: [] };
}

export function resolveCircleObstacles(
  cx: number,
  cy: number,
  radius: number,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid
): { x: number; y: number; collided: boolean } {
  let x = cx;
  let y = cy;
  let collided = false;
  let bridges: BridgeCorridor[] = [];
  let candidates: Obstacle[];

  if (obstaclesOrGrid instanceof ObstacleGrid) {
    candidates = obstaclesOrGrid.queryBoxScratch(cx - radius - 4, cy - radius - 4, cx + radius + 4, cy + radius + 4);
    bridges = obstaclesOrGrid.bridges;
  } else {
    candidates = obstaclesOrGrid;
  }

  for (let pass = 0; pass < 2; pass++) {
    let passHit = false;
    for (let i = 0; i < candidates.length; i++) {
      const res = resolveCircleObstacle(x, y, radius, candidates[i], bridges);
      if (res.hit) {
        x = res.x;
        y = res.y;
        collided = true;
        passHit = true;
      }
    }
    if (!passHit) break;
  }
  return { x, y, collided };
}

export function isPointBlocked(
  x: number,
  y: number,
  margin: number,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid
): boolean {
  let candidates: Obstacle[];
  let bridges: BridgeCorridor[] = [];
  if (obstaclesOrGrid instanceof ObstacleGrid) {
    candidates = obstaclesOrGrid.queryBoxScratch(x - margin - 2, y - margin - 2, x + margin + 2, y + margin + 2);
    bridges = obstaclesOrGrid.bridges;
  } else {
    candidates = obstaclesOrGrid;
  }

  for (let i = 0; i < candidates.length; i++) {
    if (doesCircleOverlapObstacle(x, y, margin, candidates[i], bridges)) {
      return true;
    }
  }
  return false;
}

export function isPointInHardObstacle(
  x: number,
  y: number,
  margin: number,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid,
  ignoreVehicles = true
): boolean {
  let candidates: Obstacle[];
  let bridges: BridgeCorridor[] = [];
  if (obstaclesOrGrid instanceof ObstacleGrid) {
    candidates = obstaclesOrGrid.queryBoxScratch(x - margin - 2, y - margin - 2, x + margin + 2, y + margin + 2);
    bridges = obstaclesOrGrid.bridges;
  } else {
    candidates = obstaclesOrGrid;
  }

  for (let i = 0; i < candidates.length; i++) {
    const ob = candidates[i];
    if (ignoreVehicles && ob.kind === 'vehicle') continue;
    if (ob.kind === 'tree' && (ob.radius ?? 0) < 1.2) continue;
    if (doesCircleOverlapObstacle(x, y, margin, ob, bridges)) {
      return true;
    }
  }
  return false;
}

export function isVehicleFootprintBlocked(
  cx: number,
  cy: number,
  len: number,
  wid: number,
  angle: number,
  margin: number,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid
): boolean {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hx = len * 0.36;
  const hy = wid * 0.36;
  const probeR = Math.max(0.75, wid * 0.34 + margin * 0.5);
  const probes = [
    { x: cx, y: cy },
    { x: cx + cos * hx, y: cy + sin * hx },
    { x: cx - cos * hx, y: cy - sin * hx },
    { x: cx - sin * hy, y: cy + cos * hy },
    { x: cx + sin * hy, y: cy - cos * hy },
  ];

  const reach = Math.hypot(len * 0.5, wid * 0.5) + margin + 3;
  let candidates: Obstacle[];
  let bridges: BridgeCorridor[] = [];
  if (obstaclesOrGrid instanceof ObstacleGrid) {
    candidates = obstaclesOrGrid.queryBoxScratch(cx - reach, cy - reach, cx + reach, cy + reach);
    bridges = obstaclesOrGrid.bridges;
  } else {
    candidates = obstaclesOrGrid;
  }

  for (let p = 0; p < probes.length; p++) {
    const pt = probes[p];
    for (let i = 0; i < candidates.length; i++) {
      const ob = candidates[i];
      if (doesCircleOverlapObstacle(pt.x, pt.y, probeR, ob, bridges)) {
        return true;
      }
    }
  }
  return false;
}

export function hasBuildingLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid
): boolean {
  const minX = Math.min(x1, x2) - 2;
  const maxX = Math.max(x1, x2) + 2;
  const minY = Math.min(y1, y2) - 2;
  const maxY = Math.max(y1, y2) + 2;

  let candidates: Obstacle[];
  if (obstaclesOrGrid instanceof ObstacleGrid) {
    candidates = obstaclesOrGrid.queryBoxScratch(minX, minY, maxX, maxY);
  } else {
    candidates = obstaclesOrGrid;
  }

  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.min(22, Math.ceil(dist / 6)));
  for (let i = 0; i < candidates.length; i++) {
    const ob = candidates[i];
    if (ob.kind !== 'building' && ob.kind !== 'barricade') continue;
    if (ob.maxX < minX || ob.minX > maxX || ob.maxY < minY || ob.minY > maxY) continue;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      if (doesCircleOverlapObstacle(sx, sy, 0.35, ob)) {
        return false;
      }
    }
  }
  return true;
}

export function isNearCoverOrTree(
  x: number,
  y: number,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid
): boolean {
  const { list } = unwrapObsList(obstaclesOrGrid);
  const candidates =
    obstaclesOrGrid instanceof ObstacleGrid
      ? obstaclesOrGrid.queryBoxScratch(x - 4.5, y - 4.5, x + 4.5, y + 4.5)
      : list;
  for (let i = 0; i < candidates.length; i++) {
    const ob = candidates[i];
    if (ob.kind !== 'building' && ob.kind !== 'tree' && ob.kind !== 'barricade') continue;
    if (doesCircleOverlapObstacle(x, y, 2.2, ob)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds occlusion zones from physical obstacles (building roofs & tree canopies).
 */
export function buildOcclusionZonesFromObstacles(
  obstacles: Obstacle[],
  extraZones: OcclusionZone[] = []
): OcclusionZone[] {
  const zones: OcclusionZone[] = [...extraZones];
  for (let i = 0; i < obstacles.length; i++) {
    const ob = obstacles[i];
    if (ob.isWater || ob.kind === 'vehicle' || ob.kind === 'barricade') continue;
    if (ob.kind === 'tree') {
      zones.push({
        id: `occ-${ob.id}`,
        kind: 'tree_canopy',
        shape: ob.shape,
        x: ob.x,
        y: ob.y,
        radius: ob.radius,
        w: ob.w,
        h: ob.h,
        angle: ob.angle,
        points: ob.points,
        heightMeters: ob.heightMeters ?? 4.5,
        minX: ob.minX,
        maxX: ob.maxX,
        minY: ob.minY,
        maxY: ob.maxY,
      });
    } else if (ob.kind === 'building') {
      zones.push({
        id: `occ-${ob.id}`,
        kind: 'building_roof',
        shape: ob.shape,
        x: ob.x,
        y: ob.y,
        radius: ob.radius,
        w: ob.w,
        h: ob.h,
        angle: ob.angle,
        points: ob.points,
        heightMeters: ob.heightMeters ?? 5.5,
        minX: ob.minX,
        maxX: ob.maxX,
        minY: ob.minY,
        maxY: ob.maxY,
      });
    } else if (ob.kind === 'barrier') {
      zones.push({
        id: `occ-${ob.id}`,
        kind: 'barrier',
        shape: ob.shape,
        x: ob.x,
        y: ob.y,
        radius: ob.radius,
        w: ob.w,
        h: ob.h,
        angle: ob.angle,
        points: ob.points,
        heightMeters: ob.heightMeters ?? 2.2,
        minX: ob.minX,
        maxX: ob.maxX,
        minY: ob.minY,
        maxY: ob.maxY,
      });
    }
  }
  return zones;
}

function isPointInsideOcclusionZone(x: number, y: number, z: OcclusionZone): boolean {
  if (x < z.minX || x > z.maxX || y < z.minY || y > z.maxY) return false;
  if (z.shape === 'circle') {
    const dx = x - z.x;
    const dy = y - z.y;
    return dx * dx + dy * dy <= z.radius * z.radius;
  }
  if (z.points && z.points.length >= 3) {
    return pointInPolygon(x, y, z.points);
  }
  return true;
}

/**
 * Camera-angle-aware geometry occlusion test (Zombie Outbreak Simulator style):
 * - Top-down (0°): ONLY hidden directly under tree canopies, narrow dark shadow alleys, or tight roof eaves (0.55m).
 * - Angled (45°): Buildings & barriers project a realistic northward (-Y) occlusion shadow zone proportional to heightMeters!
 * Never triggers false silhouettes in open grass/streets.
 */
export function isEntityVisuallyOccludedAtCamera(
  x: number,
  y: number,
  tiltDeg: 0 | 45,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid,
  occlusionZones: OcclusionZone[] = []
): boolean {
  const { list } = unwrapObsList(obstaclesOrGrid);
  const searchPad = tiltDeg === 45 ? 14.0 : 5.0;
  const candidates =
    obstaclesOrGrid instanceof ObstacleGrid
      ? obstaclesOrGrid.queryBoxScratch(x - searchPad, y - searchPad, x + searchPad, y + searchPad)
      : list;

  // 1. Check explicit canopy / shadow pocket zones
  for (let i = 0; i < occlusionZones.length; i++) {
    const z = occlusionZones[i];
    if (z.kind === 'tree_canopy' || z.kind === 'narrow_shadow') {
      if (isPointInsideOcclusionZone(x, y, z)) return true;
      if (tiltDeg === 45 && z.kind === 'tree_canopy' && isPointInsideOcclusionZone(x, y + 1.5, z)) {
        return true;
      }
    }
  }

  // 2. Check physical building roof overhang & 45° behind-building facade shadow
  for (let i = 0; i < candidates.length; i++) {
    const ob = candidates[i];
    if (ob.isWater || ob.kind === 'barricade' || ob.kind === 'vehicle') continue;

    if (ob.kind === 'tree') {
      // Exact visual tree canopy radius (+0.3m foliage fringe)
      if (doesCircleOverlapObstacle(x, y, 0.35, ob)) return true;
      if (tiltDeg === 45 && doesCircleOverlapObstacle(x, y + 1.5, 0.25, ob)) return true;
    } else if (ob.kind === 'building') {
      // Tight roof eaves shadow (0.55m north/west overhang) — never triggers in open grass!
      if (
        doesCircleOverlapObstacle(x, y, 0.45, ob) ||
        doesCircleOverlapObstacle(x, y + 0.55, 0.25, ob)
      ) {
        return true;
      }
      if (tiltDeg === 45) {
        // From South-looking 45° camera, points directly North (-Y) behind a building of height H are occluded
        const bHeight = ob.heightMeters ?? 5.5;
        const projNorth = Math.min(11.5, Math.max(2.6, bHeight * 0.68));
        if (x >= ob.minX - 0.3 && x <= ob.maxX + 0.3 && y <= ob.maxY && y >= ob.minY - projNorth) {
          if (
            doesCircleOverlapObstacle(x, y + projNorth * 0.45, 0.25, ob) ||
            doesCircleOverlapObstacle(x, y + projNorth * 0.9, 0.25, ob)
          ) {
            return true;
          }
        }
      }
    } else if (ob.kind === 'barrier') {
      if (tiltDeg === 45 && doesCircleOverlapObstacle(x, y + 1.2, 0.2, ob)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Legacy wrapper defaulting to 0° top-down occlusion test.
 */
export function isEntityVisuallyOccluded(
  x: number,
  y: number,
  obstaclesOrGrid: Obstacle[] | ObstacleGrid
): boolean {
  return isEntityVisuallyOccludedAtCamera(x, y, 0, obstaclesOrGrid, []);
}

/**
 * Validates whether a barricade or barrier segment overlaps ANY building, tree, water, or static vehicle.
 */
export function isSegmentBlockedByObstacles(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  clearance: number,
  grid: ObstacleGrid,
  ignoreKinds: ObstacleKind[] = ['barricade']
): boolean {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const minX = Math.min(x1, x2) - clearance - 2;
  const maxX = Math.max(x1, x2) + clearance + 2;
  const minY = Math.min(y1, y2) - clearance - 2;
  const maxY = Math.max(y1, y2) + clearance + 2;
  const candidates = grid.queryBoxScratch(minX, minY, maxX, maxY);
  const steps = Math.max(3, Math.ceil(len / 2.2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (let i = 0; i < candidates.length; i++) {
      const ob = candidates[i];
      if (ignoreKinds.includes(ob.kind)) continue;
      if (doesCircleOverlapObstacle(px, py, clearance, ob, grid.bridges)) {
        return true;
      }
    }
  }
  return false;
}

interface OsmNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OsmRelationMember {
  type: 'way' | 'node' | 'relation';
  ref: number;
  role: string;
}

interface OsmRelation {
  type: 'relation';
  id: number;
  members: OsmRelationMember[];
  tags?: Record<string, string>;
}

/**
 * Stitches unordered OSM way chains into closed or continuous polyline rings.
 */
function stitchWayChains(waysNodeLists: number[][]): number[][] {
  const remaining = waysNodeLists.map((n) => [...n]).filter((n) => n.length >= 2);
  const chains: number[][] = [];

  while (remaining.length > 0) {
    const current = remaining.shift()!;
    let changed = true;
    while (changed && current[0] !== current[current.length - 1]) {
      changed = false;
      const head = current[0];
      const tail = current[current.length - 1];
      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        const cHead = cand[0];
        const cTail = cand[cand.length - 1];
        if (tail === cHead) {
          current.push(...cand.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        if (tail === cTail) {
          current.push(...cand.slice(0, -1).reverse());
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        if (head === cTail) {
          current.unshift(...cand.slice(0, -1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        if (head === cHead) {
          current.unshift(...cand.slice(1).reverse());
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    chains.push(current);
  }
  return chains;
}

/**
 * Computes signed area of polygon in screen coordinates (+x East, +y South).
 * Positive signed area = clockwise in screen space.
 */
function signedPolygonArea(pts: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
  }
  return area * 0.5;
}

/**
 * Converts an open OSM natural=coastline polyline into a closed sea-water polygon.
 * Per OSM spec, LAND is to the LEFT of the coastline direction and WATER is to the RIGHT.
 */
function closeCoastlineWaterPolygon(
  line: { x: number; y: number }[],
  extent: number
): { x: number; y: number }[] | null {
  if (line.length < 2) return null;
  // Build thick coastal sea apron extending 140m to the RIGHT side of each directed coastline segment,
  // plus sector border closure when endpoints exit sector bounds.
  const first = line[0];
  const last = line[line.length - 1];
  const isClosed = Math.hypot(first.x - last.x, first.y - last.y) < 4.0;
  if (isClosed && line.length >= 4) {
    // Check winding: if island (land inside), water is outside; if sea basin, keep water
    const area = signedPolygonArea(line);
    if (area > 0) {
      return line;
    }
  }

  // Offset right-hand normal by seaDepth toward water side (+y South: right-hand normal of (dx,dy) is (-dy, dx))
  const seaDepth = Math.min(420, extent * 0.65);
  const rightSide: { x: number; y: number }[] = [];
  for (let i = 0; i < line.length; i++) {
    const pPrev = line[Math.max(0, i - 1)];
    const pNext = line[Math.min(line.length - 1, i + 1)];
    const dx = pNext.x - pPrev.x;
    const dy = pNext.y - pPrev.y;
    const len = Math.hypot(dx, dy) || 1;
    // Screen coordinates (+x East, +y South): travel direction (dx, dy) -> right side vector is (-dy, dx)
    const rx = -dy / len;
    const ry = dx / len;
    rightSide.push({
      x: line[i].x + rx * seaDepth,
      y: line[i].y + ry * seaDepth,
    });
  }
  return [...line, ...rightSide.reverse()];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function queryOverpassWithFallback(query: string): Promise<any> {
  let lastErr: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 14000);
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!resp.ok) {
        lastErr = new Error(`Overpass HTTP ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      if (data && Array.isArray(data.elements)) {
        return data;
      }
    } catch (e) {
      lastErr = e;
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error('Overpass API unavailable');
}

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generates an emergency procedural fallback city obstacle grid when Overpass is unreachable,
 * never colliding with road centerlines.
 */
export function generateProceduralFallbackSector(halfSizeMeters: number): ObstacleFetchResult {
  const obstacles: Obstacle[] = [];
  const roadSpots: RoadSpawnSpot[] = [];
  const bridges: BridgeCorridor[] = [];
  let buildings = 0;
  let trees = 0;
  let vehicles = 0;
  let barriers = 0;
  let roads = 0;
  let idCounter = 1;

  const blockStep = 115;
  const limit = Math.min(halfSizeMeters - 40, 1400);
  const minCell = -Math.floor(limit / blockStep);
  const maxCell = Math.floor(limit / blockStep);

  for (let gx = minCell; gx <= maxCell; gx++) {
    const roadX = gx * blockStep;
    roads++;
    for (let y = -limit; y <= limit; y += 45) {
      roadSpots.push({ x: roadX, y, angle: Math.PI / 2 });
    }
  }
  for (let gy = minCell; gy <= maxCell; gy++) {
    const roadY = gy * blockStep;
    roads++;
    for (let x = -limit; x <= limit; x += 45) {
      roadSpots.push({ x, y: roadY, angle: 0 });
    }
  }

  for (let gx = minCell; gx < maxCell; gx++) {
    const x0 = gx * blockStep;
    const bx = x0 + blockStep / 2;
    for (let gy = minCell; gy < maxCell; gy++) {
      const y0 = gy * blockStep;
      const by = y0 + blockStep / 2;
      const h = seededNoise(gx * 31.7 + gy * 67.3);

      if (h < 0.78) {
        // Build block with open center courtyard on every 3rd block!
        if (h < 0.28) {
          const outer = [
            { x: bx - 41, y: by - 41 },
            { x: bx + 41, y: by - 41 },
            { x: bx + 41, y: by + 41 },
            { x: bx - 41, y: by + 41 },
          ];
          const inner = [
            { x: bx - 18, y: by - 18 },
            { x: bx + 18, y: by - 18 },
            { x: bx + 18, y: by + 18 },
            { x: bx - 18, y: by + 18 },
          ];
          const obs = createPolygonObstacle(`fb-bld-${idCounter++}`, 'building', outer, undefined, [inner]);
          if (obs) {
            obstacles.push(obs);
            buildings++;
          }
        } else {
          obstacles.push(createRectObstacle(`fb-bld-${idCounter++}`, 'building', bx, by - 22, 80, 34, 0));
          obstacles.push(createRectObstacle(`fb-bld-${idCounter++}`, 'building', bx, by + 22, 80, 34, 0));
          buildings += 2;
        }
        if (h > 0.35) {
          obstacles.push(createCircleObstacle(`fb-t-${idCounter++}`, 'tree', x0 + 6.5, by, 2.3));
          trees++;
        }
        if (h > 0.42 && h < 0.74) {
          obstacles.push(
            createRectObstacle(
              `fb-car-${idCounter++}`,
              'vehicle',
              bx - 16,
              y0 + 6.5,
              5.2,
              2.4,
              0,
              CAR_COLORS[Math.floor(h * 73) % CAR_COLORS.length]
            )
          );
          vehicles++;
        }
      } else {
        obstacles.push(createCircleObstacle(`fb-pt-${idCounter++}`, 'tree', bx - 18, by - 16, 3.2));
        obstacles.push(createCircleObstacle(`fb-pt-${idCounter++}`, 'tree', bx + 18, by + 16, 3.2));
        obstacles.push(createRectObstacle(`fb-wall-${idCounter++}`, 'barrier', bx, by, 14, 2.8, 0));
        trees += 2;
        barriers++;
      }
    }
  }

  return {
    obstacles,
    occlusionZones: buildOcclusionZonesFromObstacles(obstacles),
    roadSpots,
    bridges,
    status: 'fallback',
    stats: {
      total: obstacles.length,
      buildings,
      courtyards: 0,
      trees,
      vehicles,
      barriers,
      bridges: 0,
      roads,
      aiDetected: 0,
      shadowZones: 0,
    },
  };
}

/**
 * Fetches and deeply analyzes real-world OpenStreetMap features around any Google Maps sector:
 * - Building footprints + inner courtyards (`holes`)
 * - Water bodies (`natural=water`, `waterway`, `natural=bay`, `reservoir`) & `natural=coastline` sea walls
 * - Highway / pedestrian bridges (`bridge=*`) carving walkable crossings over water
 * - Linear walls, fences, hedges, retaining barriers
 * - Trees & tree rows
 * - Streets & parked curb-side cars outside buildings & water
 */
export async function fetchRealOsmObstacles(
  origin: GeoOrigin,
  halfSizeMeters: number
): Promise<ObstacleFetchResult> {
  const fetchRadius = Math.min(halfSizeMeters, 1500);
  const bounds = getSectorLatLngBounds(origin, fetchRadius);
  const bbox = `${bounds.south.toFixed(6)},${bounds.west.toFixed(6)},${bounds.north.toFixed(6)},${bounds.east.toFixed(6)}`;

  const query = `
    [out:json][timeout:14];
    (
      way["building"](${bbox});
      way["building:part"](${bbox});
      relation["building"](${bbox});
      way["man_made"~"silo|storage_tank|works|greenhouse"](${bbox});
      way["natural"="water"](${bbox});
      relation["natural"="water"](${bbox});
      way["natural"="bay"](${bbox});
      relation["natural"="bay"](${bbox});
      way["natural"="coastline"](${bbox});
      way["waterway"~"riverbank|canal|dock"](${bbox});
      relation["waterway"="riverbank"](${bbox});
      way["landuse"~"reservoir|basin|forest|orchard"](${bbox});
      way["natural"~"wood|scrub|tree_row"](${bbox});
      way["highway"]["bridge"]["bridge"!="no"](${bbox});
      way["man_made"="bridge"](${bbox});
      node["natural"="tree"](${bbox});
      way["barrier"~"wall|fence|hedge|retaining_wall|city_wall|jersey_barrier"](${bbox});
      way["highway"~"primary|secondary|tertiary|residential|living_street|unclassified|service|pedestrian"](${bbox});
    );
    (._;>;);
    out body;
  `;

  try {
    const data = await queryOverpassWithFallback(query);
    const elements = (data?.elements ?? []) as (
      | (OsmNode & { type: 'node' })
      | OsmWay
      | OsmRelation
    )[];

    const nodeMap = new Map<number, OsmNode>();
    const wayMap = new Map<number, OsmWay>();
    const relations: OsmRelation[] = [];

    for (const el of elements) {
      if (el.type === 'node') {
        nodeMap.set(el.id, el);
      } else if (el.type === 'way') {
        wayMap.set(el.id, el);
      } else if (el.type === 'relation') {
        relations.push(el);
      }
    }

    const nodeIdsToMeters = (nodeIds: number[]): { x: number; y: number }[] => {
      const pts: { x: number; y: number }[] = [];
      for (const nid of nodeIds) {
        const n = nodeMap.get(nid);
        if (!n) continue;
        pts.push(latLngToMeters(n.lat, n.lon, origin));
      }
      return pts;
    };

    const obstacles: Obstacle[] = [];
    const roadSpots: RoadSpawnSpot[] = [];
    const bridges: BridgeCorridor[] = [];

    let buildings = 0;
    let courtyards = 0;
    let trees = 0;
    let vehicles = 0;
    let barriers = 0;
    let roads = 0;

    const relationMemberWayIds = new Set<number>();
    for (const rel of relations) {
      for (const m of rel.members ?? []) {
        if (m.type === 'way') relationMemberWayIds.add(m.ref);
      }
    }

    // 1. Parse multi-polygon relations (Buildings with inner courtyards, plus large Water polygons!)
    for (const rel of relations) {
      const tags = rel.tags ?? {};
      const isBld = Boolean(tags.building);
      const isWater =
        tags.natural === 'water' ||
        tags.natural === 'bay' ||
        tags.waterway === 'riverbank' ||
        tags.landuse === 'reservoir' ||
        tags.landuse === 'basin';
      if (!isBld && !isWater) continue;

      const outerWays: number[][] = [];
      const innerWays: number[][] = [];
      for (const mem of rel.members ?? []) {
        if (mem.type !== 'way') continue;
        const w = wayMap.get(mem.ref);
        if (!w || w.nodes.length < 2) continue;
        if (mem.role === 'inner') {
          innerWays.push(w.nodes);
        } else {
          outerWays.push(w.nodes);
        }
      }

      const outerChains = stitchWayChains(outerWays);
      const innerChains = stitchWayChains(innerWays);
      const innerPolys: { x: number; y: number }[][] = [];
      for (const ic of innerChains) {
        const pts = nodeIdsToMeters(ic);
        if (pts.length >= 4) {
          innerPolys.push(pts.slice(0, -1));
        }
      }

      for (let ci = 0; ci < outerChains.length; ci++) {
        const pts = nodeIdsToMeters(outerChains[ci]);
        if (pts.length < 4) continue;
        const cleanPts = pts.slice(0, -1);
        const obs = createPolygonObstacle(
          `rel-${rel.id}-${ci}`,
          isWater ? 'barrier' : 'building',
          cleanPts,
          isWater ? '#0ea5e9' : undefined,
          innerPolys,
          isWater
        );
        if (obs) {
          obstacles.push(obs);
          if (isWater) {
            barriers++;
          } else {
            buildings++;
            courtyards += innerPolys.length;
          }
        }
      }
    }

    // 2. Standalone OSM Ways (Buildings, Water, Coastlines, Bridges, Walls/Fences, Tree Rows, Roads)
    const coastlinePolylines: { x: number; y: number }[][] = [];

    for (const way of wayMap.values()) {
      const tags = way.tags ?? {};

      // Bridges (walkable crossings over rivers/canals/harbors)
      if (
        (tags.highway && tags.bridge && tags.bridge !== 'no') ||
        tags.man_made === 'bridge'
      ) {
        const pts = nodeIdsToMeters(way.nodes);
        const hwTag = tags.highway ?? '';
        const halfW =
          hwTag === 'primary' || hwTag === 'trunk'
            ? 8.5
            : hwTag === 'secondary' || hwTag === 'tertiary'
              ? 6.8
              : hwTag === 'pedestrian'
                ? 5.0
                : 5.5;
        for (let i = 0; i < pts.length - 1; i++) {
          bridges.push({
            x1: pts[i].x,
            y1: pts[i].y,
            x2: pts[i + 1].x,
            y2: pts[i + 1].y,
            halfWidth: halfW,
          });
        }
      }

      // Coastline (stitch later so multi-way sea boundary closes accurately)
      if (tags.natural === 'coastline') {
        const pts = nodeIdsToMeters(way.nodes);
        if (pts.length >= 2) {
          coastlinePolylines.push(pts);
        }
        continue;
      }

      if (relationMemberWayIds.has(way.id)) {
        // Already merged inside relation polygon above (still keep road sampling below if tagged highway)
        if (!tags.highway) continue;
      }

      // Building / man-made roofed structure way
      if (
        tags.building ||
        tags['building:part'] ||
        (tags.man_made && ['silo', 'storage_tank', 'works', 'greenhouse'].includes(tags.man_made))
      ) {
        const pts = nodeIdsToMeters(way.nodes);
        if (pts.length >= 4) {
          const obs = createPolygonObstacle(`bld-${way.id}`, 'building', pts.slice(0, -1));
          if (obs) {
            obstacles.push(obs);
            buildings++;
          }
        }
        continue;
      }

      // Water polygon way
      if (
        tags.natural === 'water' ||
        tags.natural === 'bay' ||
        tags.waterway === 'riverbank' ||
        tags.waterway === 'canal' ||
        tags.waterway === 'dock' ||
        tags.landuse === 'reservoir' ||
        tags.landuse === 'basin'
      ) {
        const pts = nodeIdsToMeters(way.nodes);
        if (pts.length >= 4) {
          const obs = createPolygonObstacle(
            `wtr-${way.id}`,
            'barrier',
            pts.slice(0, -1),
            '#0ea5e9',
            undefined,
            true
          );
          if (obs) {
            obstacles.push(obs);
            barriers++;
          }
        }
        continue;
      }

      // Walls / Fences / Hedges
      if (tags.barrier) {
        const pts = nodeIdsToMeters(way.nodes);
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (segLen < 1.2 || segLen > 120) continue;
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          obstacles.push(
            createRectObstacle(
              `wall-${way.id}-${i}`,
              'barrier',
              (p1.x + p2.x) / 2,
              (p1.y + p2.y) / 2,
              segLen,
              1.6,
              angle,
              tags.barrier === 'hedge' ? '#166534' : '#64748b'
            )
          );
          barriers++;
        }
        continue;
      }

      // Tree row
      if (tags.natural === 'tree_row') {
        const pts = nodeIdsToMeters(way.nodes);
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const steps = Math.max(1, Math.floor(segLen / 10));
          for (let s = 0; s <= steps; s++) {
            const t = s / Math.max(1, steps);
            obstacles.push(
              createCircleObstacle(
                `trow-${way.id}-${i}-${s}`,
                'tree',
                p1.x + (p2.x - p1.x) * t,
                p1.y + (p2.y - p1.y) * t,
                2.5
              )
            );
            trees++;
          }
        }
        continue;
      }

      // Roads (for vehicle & pedestrian spawn spots + realistic parked curb-side cars)
      if (tags.highway) {
        roads++;
        const pts = nodeIdsToMeters(way.nodes);
        const isBridge = Boolean(tags.bridge && tags.bridge !== 'no');
        const isPedestrian = tags.highway === 'pedestrian' || tags.highway === 'living_street';
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (segLen < 6) continue;
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const step = 18;
          const count = Math.max(1, Math.floor(segLen / step));
          for (let s = 0; s < count; s++) {
            const t = (s + 0.5) / count;
            const rx = p1.x + (p2.x - p1.x) * t;
            const ry = p1.y + (p2.y - p1.y) * t;
            if (Math.abs(rx) > halfSizeMeters - 16 || Math.abs(ry) > halfSizeMeters - 16) continue;
            roadSpots.push({ x: rx, y: ry, angle });

            // Place realistic parked cars along vehicle streets (never on bridges or pedestrian zones)
            if (!isBridge && !isPedestrian && vehicles < 90 && (way.id + i + s) % 9 === 0) {
              const sideOffset = (s % 2 === 0 ? 1 : -1) * 3.8;
              const px = rx - Math.sin(angle) * sideOffset;
              const py = ry + Math.cos(angle) * sideOffset;
              if (isCircleClearOfObstacles(px, py, 2.9, obstacles, undefined, undefined, bridges)) {
                const col = CAR_COLORS[(way.id + s) % CAR_COLORS.length];
                obstacles.push(
                  createRectObstacle(`pcar-${way.id}-${i}-${s}`, 'vehicle', px, py, 4.9, 2.2, angle, col)
                );
                vehicles++;
              }
            }
          }
        }
      }
    }

    // 3. Stitch Coastline Segments & Seal Sea Water Side
    if (coastlinePolylines.length > 0) {
      // Stitch adjacent coastline ways by proximity
      const stitchedCoast: { x: number; y: number }[][] = [];
      const rem = [...coastlinePolylines];
      while (rem.length > 0) {
        const chain = rem.shift()!;
        let merged = true;
        while (merged) {
          merged = false;
          const tail = chain[chain.length - 1];
          const head = chain[0];
          for (let i = 0; i < rem.length; i++) {
            const cand = rem[i];
            if (Math.hypot(tail.x - cand[0].x, tail.y - cand[0].y) < 3.0) {
              chain.push(...cand.slice(1));
              rem.splice(i, 1);
              merged = true;
              break;
            }
            if (Math.hypot(head.x - cand[cand.length - 1].x, head.y - cand[cand.length - 1].y) < 3.0) {
              chain.unshift(...cand.slice(0, -1));
              rem.splice(i, 1);
              merged = true;
              break;
            }
          }
        }
        stitchedCoast.push(chain);
      }

      for (let ci = 0; ci < stitchedCoast.length; ci++) {
        const seaPoly = closeCoastlineWaterPolygon(stitchedCoast[ci], fetchRadius);
        if (!seaPoly) continue;
        const obs = createPolygonObstacle(`sea-${ci}`, 'barrier', seaPoly, '#0ea5e9', undefined, true);
        if (obs) {
          obstacles.push(obs);
          barriers++;
        }
      }
    }

    // 4. Individual Tree Nodes
    for (const node of nodeMap.values()) {
      if (node.tags?.natural === 'tree') {
        const pos = latLngToMeters(node.lat, node.lon, origin);
        if (Math.abs(pos.x) <= halfSizeMeters && Math.abs(pos.y) <= halfSizeMeters) {
          obstacles.push(createCircleObstacle(`tree-${node.id}`, 'tree', pos.x, pos.y, 2.4));
          trees++;
        }
      }
    }

    // Woods / Forest canopies -> visual tree_canopy occlusion zones (units can walk inside with neon silhouettes)
    const extraZones: OcclusionZone[] = [];
    for (const way of wayMap.values()) {
      const tags = way.tags ?? {};
      if (tags.natural === 'wood' || tags.natural === 'scrub' || tags.landuse === 'forest' || tags.landuse === 'orchard') {
        const pts = nodeIdsToMeters(way.nodes);
        if (pts.length >= 4) {
          const clean = pts.slice(0, -1);
          const bb = computeBBox(clean);
          extraZones.push({
            id: `wood-${way.id}`,
            kind: 'tree_canopy',
            shape: 'polygon',
            x: bb.cx,
            y: bb.cy,
            radius: bb.radius,
            points: clean,
            heightMeters: 5.0,
            minX: bb.minX,
            maxX: bb.maxX,
            minY: bb.minY,
            maxY: bb.maxY,
          });
        }
      }
    }

    // Filter out any roadSpots that happen to lie inside water or buildings
    const cleanRoadSpots = roadSpots.filter(
      (spot) =>
        isPointOnBridge(spot.x, spot.y, bridges, 0.5) ||
        isCircleClearOfObstacles(spot.x, spot.y, 1.8, obstacles, undefined, ['vehicle'], bridges)
    );

    const occlusionZones = buildOcclusionZonesFromObstacles(obstacles, extraZones);

    return {
      obstacles,
      occlusionZones,
      roadSpots: cleanRoadSpots.length > 0 ? cleanRoadSpots : roadSpots,
      bridges,
      status: 'osm',
      stats: {
        total: obstacles.length,
        buildings,
        courtyards,
        trees,
        vehicles,
        barriers,
        bridges: bridges.length,
        roads,
        aiDetected: 0,
        shadowZones: extraZones.length,
      },
    };
  } catch (err) {
    console.warn('OSM Overpass fetch failed, using fallback obstacle sector:', err);
    return generateProceduralFallbackSector(halfSizeMeters);
  }
}

interface ServerAnalyzedBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  heightMeters?: number;
  kind?: string;
}

interface ServerMeterBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  heightMeters?: number;
  kind?: string;
}

interface ServerAnalyzeSectorPayload {
  ok: boolean;
  error?: string;
  zoom?: number;
  spanMeters?: number;
  buildings?: ServerAnalyzedBox[];
  trees?: ServerAnalyzedBox[];
  narrowShadows?: ServerAnalyzedBox[];
  barriers?: ServerAnalyzedBox[];
  meterBoxes?: {
    buildings?: ServerMeterBox[];
    trees?: ServerMeterBox[];
    narrowShadows?: ServerMeterBox[];
    barriers?: ServerMeterBox[];
  };
}

function boxesOverlapSignificantly(
  ax0: number,
  ay0: number,
  ax1: number,
  ay1: number,
  ob: Obstacle
): boolean {
  const ix0 = Math.max(ax0, ob.minX);
  const iy0 = Math.max(ay0, ob.minY);
  const ix1 = Math.min(ax1, ob.maxX);
  const iy1 = Math.min(ay1, ob.maxY);
  if (ix1 <= ix0 || iy1 <= iy0) return false;
  const inter = (ix1 - ix0) * (iy1 - iy0);
  const areaA = Math.max(1, (ax1 - ax0) * (ay1 - ay0));
  const areaB = Math.max(1, (ob.maxX - ob.minX) * (ob.maxY - ob.minY));
  return inter / Math.min(areaA, areaB) > 0.36;
}

/**
 * Queries the server-side Gemini Vision + Satellite Imagery Analyzer (/api/analyze-sector)
 * and merges unmapped buildings, mobile homes/trailers, sheds, dense tree canopies, and narrow shadow pockets.
 */
export async function enhanceSectorWithAiVision(
  origin: GeoOrigin,
  halfSizeMeters: number,
  base: ObstacleFetchResult
): Promise<ObstacleFetchResult> {
  try {
    const resp = await fetch('/api/analyze-sector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: origin.lat,
        lng: origin.lng,
        halfSizeMeters,
      }),
    });

    const data = (await resp.json().catch(() => null)) as ServerAnalyzeSectorPayload | null;
    if (!resp.ok || !data || !data.ok || (!data.spanMeters && !data.meterBoxes)) {
      return {
        ...base,
        aiError: data?.error || `AI analiz sunucusu yanıt vermedi (HTTP ${resp.status})`,
      };
    }

    const span = data.spanMeters ?? halfSizeMeters * 2;
    const normToRect = (b: ServerAnalyzedBox) => {
      const minX = (b.xmin / 1000 - 0.5) * span;
      const maxX = (b.xmax / 1000 - 0.5) * span;
      const minY = (b.ymin / 1000 - 0.5) * span;
      const maxY = (b.ymax / 1000 - 0.5) * span;
      return {
        minX,
        maxX,
        minY,
        maxY,
        cx: (minX + maxX) * 0.5,
        cy: (minY + maxY) * 0.5,
        w: Math.max(2.0, maxX - minX),
        h: Math.max(2.0, maxY - minY),
        heightMeters: b.heightMeters,
        kind: b.kind,
      };
    };

    const meterToRect = (b: ServerMeterBox) => ({
      minX: b.minX,
      maxX: b.maxX,
      minY: b.minY,
      maxY: b.maxY,
      cx: (b.minX + b.maxX) * 0.5,
      cy: (b.minY + b.maxY) * 0.5,
      w: Math.max(2.0, b.maxX - b.minX),
      h: Math.max(2.0, b.maxY - b.minY),
      heightMeters: b.heightMeters,
      kind: b.kind,
    });

    const aiBuildings = data.meterBoxes?.buildings
      ? data.meterBoxes.buildings.map(meterToRect)
      : (data.buildings ?? []).map(normToRect);
    const aiTrees = data.meterBoxes?.trees
      ? data.meterBoxes.trees.map(meterToRect)
      : (data.trees ?? []).map(normToRect);
    const aiBarriers = data.meterBoxes?.barriers
      ? data.meterBoxes.barriers.map(meterToRect)
      : (data.barriers ?? []).map(normToRect);
    const aiShadows = data.meterBoxes?.narrowShadows
      ? data.meterBoxes.narrowShadows.map(meterToRect)
      : (data.narrowShadows ?? []).map(normToRect);

    const obstacles = [...base.obstacles];
    const extraZones: OcclusionZone[] = base.occlusionZones.filter(
      (z) => z.kind === 'narrow_shadow' || z.id.startsWith('wood-')
    );
    let aiBuildingsAdded = 0;
    let aiTreesAdded = 0;
    let aiBarriersAdded = 0;
    let shadowZonesAdded = 0;

    // 1. Merge AI-detected buildings, mobile homes & sheds (skip duplicates overlapping OSM buildings or bridges)
    for (let i = 0; i < aiBuildings.length; i++) {
      const r = aiBuildings[i];
      if (r.w > 110 || r.h > 110 || r.w < 2.2 || r.h < 2.2) continue;
      if (isPointOnBridge(r.cx, r.cy, base.bridges, 0.2)) continue;
      const dup = obstacles.some(
        (ob) => ob.kind === 'building' && boxesOverlapSignificantly(r.minX, r.minY, r.maxX, r.maxY, ob)
      );
      if (dup) continue;

      const ob = createRectObstacle(`ai-bld-${i}`, 'building', r.cx, r.cy, r.w, r.h, 0);
      ob.heightMeters = r.heightMeters ?? (r.kind === 'shed' ? 3.2 : 4.8);
      ob.source = 'ai_vision';
      obstacles.push(ob);
      aiBuildingsAdded++;
    }

    // 2. Merge AI-detected dense tree canopies
    for (let i = 0; i < aiTrees.length; i++) {
      const r = aiTrees[i];
      const rad = Math.max(1.8, Math.min(12, Math.max(r.w, r.h) * 0.45));
      if (isPointOnBridge(r.cx, r.cy, base.bridges, 0.2)) continue;
      const dup = obstacles.some(
        (ob) =>
          (ob.kind === 'tree' && Math.hypot(ob.x - r.cx, ob.y - r.cy) < rad * 0.75) ||
          (ob.kind === 'building' && doesCircleOverlapObstacle(r.cx, r.cy, 0.4, ob))
      );
      if (dup) continue;

      const treeOb = createCircleObstacle(`ai-tree-${i}`, 'tree', r.cx, r.cy, rad);
      treeOb.heightMeters = 4.8;
      treeOb.source = 'ai_vision';
      obstacles.push(treeOb);
      aiTreesAdded++;
    }

    // 3. Merge AI-detected solid compound fences/barriers
    for (let i = 0; i < aiBarriers.length; i++) {
      const r = aiBarriers[i];
      if (r.w > 90 && r.h > 90) continue;
      if (isPointOnBridge(r.cx, r.cy, base.bridges, 0.2)) continue;
      const dup = obstacles.some((ob) => boxesOverlapSignificantly(r.minX, r.minY, r.maxX, r.maxY, ob));
      if (dup) continue;
      const thinW = r.w > r.h * 2.2 ? r.w : Math.min(r.w, 2.2);
      const thinH = r.h > r.w * 2.2 ? r.h : Math.min(r.h, 2.2);
      const barOb = createRectObstacle(`ai-bar-${i}`, 'barrier', r.cx, r.cy, thinW, thinH, 0, '#64748b');
      barOb.heightMeters = 2.4;
      barOb.source = 'ai_vision';
      obstacles.push(barOb);
      aiBarriersAdded++;
    }

    // 4. Add AI-detected dark narrow shadow & alley occlusion pockets (strictly visual occlusion, not walk-blocking!)
    for (let i = 0; i < aiShadows.length; i++) {
      const r = aiShadows[i];
      if (r.w > 60 || r.h > 60 || r.w < 1.8 || r.h < 1.8) continue;
      extraZones.push({
        id: `ai-shd-${i}`,
        kind: 'narrow_shadow',
        shape: 'rect',
        x: r.cx,
        y: r.cy,
        radius: Math.hypot(r.w * 0.5, r.h * 0.5),
        w: r.w,
        h: r.h,
        angle: 0,
        heightMeters: 4.5,
        minX: r.minX,
        maxX: r.maxX,
        minY: r.minY,
        maxY: r.maxY,
      });
      shadowZonesAdded++;
    }

    const occlusionZones = buildOcclusionZonesFromObstacles(obstacles, extraZones);
    const cleanRoadSpots = base.roadSpots.filter(
      (spot) =>
        isPointOnBridge(spot.x, spot.y, base.bridges, 0.5) ||
        isCircleClearOfObstacles(spot.x, spot.y, 1.8, obstacles, undefined, ['vehicle'], base.bridges)
    );

    const aiDetected = aiBuildingsAdded + aiTreesAdded + aiBarriersAdded;

    return {
      obstacles,
      occlusionZones,
      roadSpots: cleanRoadSpots.length > 0 ? cleanRoadSpots : base.roadSpots,
      bridges: base.bridges,
      status: aiDetected > 0 || shadowZonesAdded > 0 ? 'osm+ai' : base.status,
      stats: {
        total: obstacles.length,
        buildings: base.stats.buildings + aiBuildingsAdded,
        courtyards: base.stats.courtyards ?? 0,
        trees: base.stats.trees + aiTreesAdded,
        vehicles: base.stats.vehicles,
        barriers: base.stats.barriers + aiBarriersAdded,
        bridges: base.stats.bridges ?? 0,
        roads: base.stats.roads,
        aiDetected,
        shadowZones: (base.stats.shadowZones ?? 0) + shadowZonesAdded,
      },
    };
  } catch (err) {
    return {
      ...base,
      aiError: err instanceof Error ? err.message : 'AI uydu analizine bağlanılamadı.',
    };
  }
}
