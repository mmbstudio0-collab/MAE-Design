import {
  ObstacleGrid,
  RoadSpawnSpot,
  isPointInHardObstacle,
  isPointInWaterObstacles,
  isPointOnBridge,
} from './obstacles';
import { isPointInWater as isPointInChicagoWater } from './prebakedMap';
import { BridgeCorridor, Obstacle } from './types';

export const CELL_WALKABLE = 0;
export const CELL_BUILDING = 1;
export const CELL_WATER = 2;
export const CELL_OBSTACLE = 3;
export const CELL_BRIDGE = 4;

export const COARSE_BLOCKED = 0;
export const COARSE_MIXED = 1;
export const COARSE_OPEN = 2;

export interface NavMeshSerialized {
  halfSize: number;
  cellSize: number;
  cols: number;
  rows: number;
  coarseFactor: number;
  coarseCols: number;
  coarseRows: number;
  cells: Uint8Array;
  coarseBlocks: Uint8Array;
}

export interface NavPoint {
  x: number;
  y: number;
}

export interface NavFlowField {
  originCellX: number;
  originCellY: number;
  width: number;
  height: number;
  cellSize: number;
  minWorldX: number;
  minWorldY: number;
  /** Encoded unit direction index (-1 = none/blocked, 0..7 = 8-way direction) */
  dirs: Int8Array;
}

const DIR_DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DIR_DY = [0, 1, 1, 1, 0, -1, -1, -1];
const DIR_COST = [1, 1.4142, 1, 1.4142, 1, 1.4142, 1, 1.4142];

/**
 * Grid-based NavMesh & Pathfinding layer.
 * Analyzes buildings, rivers/sea, trees, vehicles, and barricades into a typed cell grid,
 * providing octile A* pathfinding with line-of-sight string-pulling + bounded BFS flow fields.
 */
export class NavMeshGrid {
  public readonly halfSize: number;
  public readonly cellSize: number;
  public readonly cols: number;
  public readonly rows: number;
  public readonly cells: Uint8Array;

  // Hierarchical Level-1 Sparse Spatial Partitioning (8x8 coarse blocks)
  public readonly coarseFactor = 8;
  public readonly coarseCols: number;
  public readonly coarseRows: number;
  public readonly coarseBlocks: Uint8Array;

  // Reusable scratch buffers for zero-GC A* queries
  private gScore: Float32Array;
  private fScore: Float32Array;
  private parent: Int32Array;
  private closedStamp: Uint32Array;
  private openStamp: Uint32Array;
  private currentStamp = 1;

  // Short-lived path cache keyed by packed numeric (startCell, goalCell) for large zombie hordes
  private pathCache = new Map<number, { nextWorld: NavPoint; frame: number }>();

  constructor(
    halfSizeMeters: number,
    obstacles: Obstacle[],
    obstacleGrid: ObstacleGrid,
    roadSpots: RoadSpawnSpot[],
    bridges: BridgeCorridor[] = [],
    useChicagoAnalyticWater = false
  ) {
    this.halfSize = halfSizeMeters;
    this.cellSize =
      halfSizeMeters <= 1000 ? 4 : halfSizeMeters <= 2600 ? 6 : halfSizeMeters <= 5200 ? 10 : 14;
    this.cols = Math.ceil((halfSizeMeters * 2) / this.cellSize);
    this.rows = Math.ceil((halfSizeMeters * 2) / this.cellSize);
    const total = this.cols * this.rows;

    this.coarseCols = Math.ceil(this.cols / this.coarseFactor);
    this.coarseRows = Math.ceil(this.rows / this.coarseFactor);
    this.coarseBlocks = new Uint8Array(this.coarseCols * this.coarseRows);

    this.cells = new Uint8Array(total);
    this.gScore = new Float32Array(total);
    this.fScore = new Float32Array(total);
    this.parent = new Int32Array(total);
    this.closedStamp = new Uint32Array(total);
    this.openStamp = new Uint32Array(total);

    this.bakeFromObstacles(obstacles, obstacleGrid, roadSpots, bridges, useChicagoAnalyticWater);
  }

  private checkWaterAt(
    wx: number,
    wy: number,
    pad: number,
    obstacles: Obstacle[],
    bridges: BridgeCorridor[],
    useChicagoAnalyticWater: boolean
  ): boolean {
    if (useChicagoAnalyticWater) {
      return isPointInChicagoWater(wx, wy, pad);
    }
    return isPointInWaterObstacles(wx, wy, obstacles, bridges, pad);
  }

  private cellIntersectsWater(
    wx: number,
    wy: number,
    pad: number,
    obstacles: Obstacle[],
    bridges: BridgeCorridor[],
    useChicagoAnalyticWater: boolean
  ): boolean {
    const q = this.cellSize * 0.32;
    return (
      this.checkWaterAt(wx, wy, pad, obstacles, bridges, useChicagoAnalyticWater) ||
      this.checkWaterAt(wx - q, wy - q, pad, obstacles, bridges, useChicagoAnalyticWater) ||
      this.checkWaterAt(wx + q, wy - q, pad, obstacles, bridges, useChicagoAnalyticWater) ||
      this.checkWaterAt(wx - q, wy + q, pad, obstacles, bridges, useChicagoAnalyticWater) ||
      this.checkWaterAt(wx + q, wy + q, pad, obstacles, bridges, useChicagoAnalyticWater)
    );
  }

  private cellIntersectsHardObstacle(wx: number, wy: number, pad: number, obstacleGrid: ObstacleGrid): boolean {
    const q = this.cellSize * 0.32;
    return (
      isPointInHardObstacle(wx, wy, pad, obstacleGrid) ||
      isPointInHardObstacle(wx - q, wy - q, pad, obstacleGrid) ||
      isPointInHardObstacle(wx + q, wy - q, pad, obstacleGrid) ||
      isPointInHardObstacle(wx - q, wy + q, pad, obstacleGrid) ||
      isPointInHardObstacle(wx + q, wy + q, pad, obstacleGrid)
    );
  }

  private bakeFromObstacles(
    obstacles: Obstacle[],
    obstacleGrid: ObstacleGrid,
    roadSpots: RoadSpawnSpot[],
    bridges: BridgeCorridor[],
    useChicagoAnalyticWater: boolean
  ) {
    const half = this.halfSize;
    const cs = this.cellSize;
    const samplePad = Math.min(1.4, cs * 0.22);

    // 1. Rasterize water polygons / sea coastline (excluding walkable bridges)
    const hasWaterObs = useChicagoAnalyticWater || obstacles.some((o) => o.isWater);
    if (hasWaterObs) {
      for (let cy = 0; cy < this.rows; cy++) {
        const wy = -half + (cy + 0.5) * cs;
        const rowOff = cy * this.cols;
        for (let cx = 0; cx < this.cols; cx++) {
          const wx = -half + (cx + 0.5) * cs;
          if (this.cellIntersectsWater(wx, wy, samplePad, obstacles, bridges, useChicagoAnalyticWater)) {
            this.cells[rowOff + cx] = CELL_WATER;
          }
        }
      }
    }

    // 2. Rasterize all buildings (respecting inner courtyards!), barriers, and large static obstacles
    for (let i = 0; i < obstacles.length; i++) {
      const ob = obstacles[i];
      if (ob.isWater) continue; // Already handled with bridge cutouts above
      if (ob.kind === 'tree' && (ob.radius ?? 0) < cs * 0.45) continue;
      if (ob.kind === 'vehicle') continue;

      const x0 = Math.max(0, Math.floor((ob.minX - samplePad + half) / cs));
      const x1 = Math.min(this.cols - 1, Math.floor((ob.maxX + samplePad + half) / cs));
      const y0 = Math.max(0, Math.floor((ob.minY - samplePad + half) / cs));
      const y1 = Math.min(this.rows - 1, Math.floor((ob.maxY + samplePad + half) / cs));

      const cellType = ob.kind === 'building' ? CELL_BUILDING : CELL_OBSTACLE;

      for (let cy = y0; cy <= y1; cy++) {
        const wy = -half + (cy + 0.5) * cs;
        const rowOff = cy * this.cols;
        for (let cx = x0; cx <= x1; cx++) {
          if (this.cells[rowOff + cx] === CELL_WATER) continue;
          const wx = -half + (cx + 0.5) * cs;
          if (this.cellIntersectsHardObstacle(wx, wy, samplePad, obstacleGrid)) {
            this.cells[rowOff + cx] = cellType;
          }
        }
      }
    }

    // 3. Guarantee walkable bridge decks & verified clear street corridors
    for (let i = 0; i < roadSpots.length; i++) {
      const rs = roadSpots[i];
      const onBridge = isPointOnBridge(rs.x, rs.y, bridges, 0.3);
      if (!onBridge && this.checkWaterAt(rs.x, rs.y, 1.4, obstacles, bridges, useChicagoAnalyticWater)) continue;
      if (isPointInHardObstacle(rs.x, rs.y, 1.1, obstacleGrid)) continue;
      const cx = this.worldToCellX(rs.x);
      const cy = this.worldToCellY(rs.y);
      const idx = cy * this.cols + cx;
      const cur = this.cells[idx];
      if (cur === CELL_BUILDING || (cur === CELL_WATER && !onBridge)) continue;
      const wx = -half + (cx + 0.5) * cs;
      const wy = -half + (cy + 0.5) * cs;
      if (this.cellIntersectsHardObstacle(wx, wy, 0.85, obstacleGrid)) continue;
      this.cells[idx] = onBridge ? CELL_BRIDGE : CELL_WALKABLE;
    }

    // Also stamp bridge segments explicitly so even wide bridges without sparse roadSpots are cleanly walkable
    for (let i = 0; i < bridges.length; i++) {
      const b = bridges[i];
      const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      const steps = Math.max(1, Math.ceil(len / (cs * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const bx = b.x1 + (b.x2 - b.x1) * t;
        const by = b.y1 + (b.y2 - b.y1) * t;
        const cx = this.worldToCellX(bx);
        const cy = this.worldToCellY(by);
        const idx = cy * this.cols + cx;
        if (this.cells[idx] !== CELL_BUILDING) {
          this.cells[idx] = CELL_BRIDGE;
        }
      }
    }

    // 4. Build Hierarchical Level-1 Coarse Spatial Partitioning Blocks
    this.rebuildCoarseBlocks(0, this.coarseCols - 1, 0, this.coarseRows - 1);
  }

  private rebuildCoarseBlocks(bx0: number, bx1: number, by0: number, by1: number) {
    const cf = this.coarseFactor;
    for (let by = by0; by <= by1; by++) {
      const cyStart = by * cf;
      const cyEnd = Math.min(this.rows - 1, cyStart + cf - 1);
      for (let bx = bx0; bx <= bx1; bx++) {
        const cxStart = bx * cf;
        const cxEnd = Math.min(this.cols - 1, cxStart + cf - 1);
        let anyOpen = false;
        let anyBlocked = false;
        for (let cy = cyStart; cy <= cyEnd; cy++) {
          const rowOff = cy * this.cols;
          for (let cx = cxStart; cx <= cxEnd; cx++) {
            const v = this.cells[rowOff + cx];
            if (v === CELL_WALKABLE || v === CELL_BRIDGE) anyOpen = true;
            else anyBlocked = true;
            if (anyOpen && anyBlocked) break;
          }
          if (anyOpen && anyBlocked) break;
        }
        this.coarseBlocks[by * this.coarseCols + bx] = !anyOpen
          ? COARSE_BLOCKED
          : !anyBlocked
            ? COARSE_OPEN
            : COARSE_MIXED;
      }
    }
  }

  public exportGridData(): NavMeshSerialized {
    return {
      halfSize: this.halfSize,
      cellSize: this.cellSize,
      cols: this.cols,
      rows: this.rows,
      coarseFactor: this.coarseFactor,
      coarseCols: this.coarseCols,
      coarseRows: this.coarseRows,
      cells: new Uint8Array(this.cells),
      coarseBlocks: new Uint8Array(this.coarseBlocks),
    };
  }

  public markDynamicBarricade(ob: Obstacle) {
    const cs = this.cellSize;
    const half = this.halfSize;
    const x0 = Math.max(0, Math.floor((ob.minX - 0.8 + half) / cs));
    const x1 = Math.min(this.cols - 1, Math.floor((ob.maxX + 0.8 + half) / cs));
    const y0 = Math.max(0, Math.floor((ob.minY - 0.8 + half) / cs));
    const y1 = Math.min(this.rows - 1, Math.floor((ob.maxY + 0.8 + half) / cs));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const idx = cy * this.cols + cx;
        if (this.cells[idx] === CELL_WALKABLE || this.cells[idx] === CELL_BRIDGE) {
          this.cells[idx] = CELL_OBSTACLE;
        }
      }
    }
    this.rebuildCoarseBlocks(
      Math.floor(x0 / this.coarseFactor),
      Math.floor(x1 / this.coarseFactor),
      Math.floor(y0 / this.coarseFactor),
      Math.floor(y1 / this.coarseFactor)
    );
    this.pathCache.clear();
  }

  public worldToCellX(wx: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((wx + this.halfSize) / this.cellSize)));
  }

  public worldToCellY(wy: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((wy + this.halfSize) / this.cellSize)));
  }

  public cellToWorld(cx: number, cy: number): NavPoint {
    return {
      x: -this.halfSize + (cx + 0.5) * this.cellSize,
      y: -this.halfSize + (cy + 0.5) * this.cellSize,
    };
  }

  public isCellWalkable(cx: number, cy: number): boolean {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return false;
    const v = this.cells[cy * this.cols + cx];
    return v === CELL_WALKABLE || v === CELL_BRIDGE;
  }

  public isWorldWalkable(wx: number, wy: number): boolean {
    return this.isCellWalkable(this.worldToCellX(wx), this.worldToCellY(wy));
  }

  public findNearestWalkableCell(cx: number, cy: number, maxRadiusCells = 12): { cx: number; cy: number } | null {
    if (this.isCellWalkable(cx, cy)) return { cx, cy };
    for (let r = 1; r <= maxRadiusCells; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (this.isCellWalkable(nx, ny)) return { cx: nx, cy: ny };
        }
      }
    }
    return null;
  }

  public ensureWalkableWorldPoint(wx: number, wy: number, maxRadiusCells = 16): NavPoint | null {
    const cx = this.worldToCellX(wx);
    const cy = this.worldToCellY(wy);
    if (this.isCellWalkable(cx, cy)) return { x: wx, y: wy };
    const found = this.findNearestWalkableCell(cx, cy, maxRadiusCells);
    return found ? this.cellToWorld(found.cx, found.cy) : null;
  }

  /**
   * Hierarchical sparse-block accelerated grid raycast checking if straight line is clear on the NavMesh.
   */
  public hasNavLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const step = Math.max(2, this.cellSize * 0.48);
    const steps = Math.ceil(dist / step);
    if (steps <= 1) return true;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;
    const invCs = 1 / this.cellSize;
    const half = this.halfSize;
    const cf = this.coarseFactor;
    for (let i = 1; i < steps; i++) {
      const sx = x1 + dx * i;
      const sy = y1 + dy * i;
      const cx = Math.floor((sx + half) * invCs);
      const cy = Math.floor((sy + half) * invCs);
      if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return false;
      const bx = (cx / cf) | 0;
      const by = (cy / cf) | 0;
      const coarse = this.coarseBlocks[by * this.coarseCols + bx];
      if (coarse === COARSE_BLOCKED) return false;
      if (coarse === COARSE_OPEN) continue;
      const v = this.cells[cy * this.cols + cx];
      if (v !== CELL_WALKABLE && v !== CELL_BRIDGE) return false;
    }
    return true;
  }

  /**
   * Octile A* pathfinder with anti-corner-cutting & line-of-sight path smoothing.
   */
  public findPath(sx: number, sy: number, tx: number, ty: number, maxExpansions = 1600): NavPoint[] {
    const startRawX = this.worldToCellX(sx);
    const startRawY = this.worldToCellY(sy);
    const goalRawX = this.worldToCellX(tx);
    const goalRawY = this.worldToCellY(ty);

    const startCell = this.findNearestWalkableCell(startRawX, startRawY, 10);
    const goalCell = this.findNearestWalkableCell(goalRawX, goalRawY, 14);
    if (!startCell || !goalCell) {
      return goalCell ? [this.cellToWorld(goalCell.cx, goalCell.cy)] : [{ x: sx, y: sy }];
    }

    const goalWorld = this.isWorldWalkable(tx, ty)
      ? { x: tx, y: ty }
      : this.cellToWorld(goalCell.cx, goalCell.cy);

    if (startCell.cx === goalCell.cx && startCell.cy === goalCell.cy) {
      return [goalWorld];
    }

    if (this.hasNavLineOfSight(sx, sy, goalWorld.x, goalWorld.y)) {
      return [goalWorld];
    }

    this.currentStamp++;
    if (this.currentStamp >= 0xfffffffe) {
      this.closedStamp.fill(0);
      this.openStamp.fill(0);
      this.currentStamp = 1;
    }
    const stamp = this.currentStamp;

    const startIdx = startCell.cy * this.cols + startCell.cx;
    const goalIdx = goalCell.cy * this.cols + goalCell.cx;

    // Lightweight binary min-heap stored in local arrays
    const heapIdx: number[] = [startIdx];
    const heapF: number[] = [];

    const octile = (cx: number, cy: number) => {
      const dx = Math.abs(cx - goalCell.cx);
      const dy = Math.abs(cy - goalCell.cy);
      return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
    };

    this.gScore[startIdx] = 0;
    this.fScore[startIdx] = octile(startCell.cx, startCell.cy);
    this.parent[startIdx] = -1;
    this.openStamp[startIdx] = stamp;
    heapF.push(this.fScore[startIdx]);

    const pushHeap = (idx: number, f: number) => {
      let i = heapIdx.length;
      heapIdx.push(idx);
      heapF.push(f);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= f) break;
        heapIdx[i] = heapIdx[p];
        heapF[i] = heapF[p];
        i = p;
      }
      heapIdx[i] = idx;
      heapF[i] = f;
    };

    const popHeap = (): number => {
      const top = heapIdx[0];
      const lastIdx = heapIdx.pop()!;
      const lastF = heapF.pop()!;
      if (heapIdx.length > 0) {
        let i = 0;
        const n = heapIdx.length;
        while (true) {
          const l = (i << 1) + 1;
          const r = l + 1;
          let smallest = i;
          if (l < n && heapF[l] < lastF) smallest = l;
          if (r < n && heapF[r] < (smallest === i ? lastF : heapF[l])) smallest = r;
          if (smallest === i) break;
          heapIdx[i] = heapIdx[smallest];
          heapF[i] = heapF[smallest];
          i = smallest;
        }
        heapIdx[i] = lastIdx;
        heapF[i] = lastF;
      }
      return top;
    };

    let bestNode = startIdx;
    let bestH = Infinity;
    let expansions = 0;

    while (heapIdx.length > 0 && expansions < maxExpansions) {
      const cur = popHeap();
      if (this.closedStamp[cur] === stamp) continue;
      this.closedStamp[cur] = stamp;
      expansions++;

      if (cur === goalIdx) {
        bestNode = cur;
        break;
      }

      const cx = cur % this.cols;
      const cy = Math.floor(cur / this.cols);
      const hCur = octile(cx, cy);
      if (hCur < bestH) {
        bestH = hCur;
        bestNode = cur;
      }

      const baseG = this.gScore[cur];

      for (let d = 0; d < 8; d++) {
        const nx = cx + DIR_DX[d];
        const ny = cy + DIR_DY[d];
        if (!this.isCellWalkable(nx, ny)) continue;

        // Prevent diagonal corner cutting across building/water corners
        if (d % 2 === 1) {
          if (!this.isCellWalkable(cx + DIR_DX[d], cy) || !this.isCellWalkable(cx, cy + DIR_DY[d])) {
            continue;
          }
        }

        const nIdx = ny * this.cols + nx;
        if (this.closedStamp[nIdx] === stamp) continue;

        const tentativeG = baseG + DIR_COST[d];
        if (this.openStamp[nIdx] !== stamp || tentativeG < this.gScore[nIdx]) {
          this.parent[nIdx] = cur;
          this.gScore[nIdx] = tentativeG;
          const f = tentativeG + octile(nx, ny) * 1.08;
          this.fScore[nIdx] = f;
          this.openStamp[nIdx] = stamp;
          pushHeap(nIdx, f);
        }
      }
    }

    // Reconstruct raw path
    const raw: NavPoint[] = [];
    let trace = bestNode;
    let guard = 0;
    while (trace !== -1 && trace !== startIdx && guard++ < 600) {
      const cx = trace % this.cols;
      const cy = Math.floor(trace / this.cols);
      raw.push(this.cellToWorld(cx, cy));
      trace = this.parent[trace];
    }
    raw.reverse();

    if (bestNode === goalIdx && raw.length > 0) {
      raw[raw.length - 1] = goalWorld;
    } else if (raw.length === 0) {
      return bestNode !== startIdx
        ? [this.cellToWorld(bestNode % this.cols, Math.floor(bestNode / this.cols))]
        : [];
    }

    // String-pull / smooth redundant collinear cells via NavMesh raycast
    const smoothed: NavPoint[] = [];
    let anchorX = sx;
    let anchorY = sy;
    let i = 0;
    while (i < raw.length) {
      let furthest = i;
      for (let j = Math.min(raw.length - 1, i + 12); j > i; j--) {
        if (this.hasNavLineOfSight(anchorX, anchorY, raw[j].x, raw[j].y)) {
          furthest = j;
          break;
        }
      }
      smoothed.push(raw[furthest]);
      anchorX = raw[furthest].x;
      anchorY = raw[furthest].y;
      i = furthest + 1;
    }

    return smoothed;
  }

  /**
   * Cached next-waypoint lookup for large zombie hordes (returns smooth detour around buildings & bridges).
   */
  public getCachedNextWaypoint(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    frameTick: number,
    canSolveBudget: () => boolean
  ): NavPoint | null {
    const scx = this.worldToCellX(sx);
    const scy = this.worldToCellY(sy);
    const gcx = this.worldToCellX(tx);
    const gcy = this.worldToCellY(ty);
    const key = ((scx * 2048 + scy) * 4194304) + (gcx * 2048 + gcy);

    const cached = this.pathCache.get(key);
    if (cached && frameTick - cached.frame < 45) {
      return cached.nextWorld;
    }

    if (!canSolveBudget()) return null;

    const path = this.findPath(sx, sy, tx, ty, 380);
    if (path.length === 0) return null;
    const nextPt = path[0];
    if (this.pathCache.size > 2400) {
      this.pathCache.clear();
    }
    this.pathCache.set(key, { nextWorld: nextPt, frame: frameTick });
    return nextPt;
  }

  /**
   * Builds a local Dijkstra/BFS Flow Field centered on an evacuation LZ or objective
   * so hundreds of civilians smoothly flow around blocks & fences toward the target in O(1) lookup time.
   */
  public buildFlowField(tx: number, ty: number, radiusMeters = 145): NavFlowField {
    const rCells = Math.ceil(radiusMeters / this.cellSize) + 2;
    const centerCX = this.worldToCellX(tx);
    const centerCY = this.worldToCellY(ty);

    const minCX = Math.max(0, centerCX - rCells);
    const maxCX = Math.min(this.cols - 1, centerCX + rCells);
    const minCY = Math.max(0, centerCY - rCells);
    const maxCY = Math.min(this.rows - 1, centerCY + rCells);

    const w = maxCX - minCX + 1;
    const h = maxCY - minCY + 1;
    const dirs = new Int8Array(w * h);
    dirs.fill(-1);

    const dist = new Float32Array(w * h);
    dist.fill(Infinity);

    const goalLocalX = centerCX - minCX;
    const goalLocalY = centerCY - minCY;
    const queue: number[] = [];

    if (this.isCellWalkable(centerCX, centerCY)) {
      const gIdx = goalLocalY * w + goalLocalX;
      dist[gIdx] = 0;
      queue.push(gIdx);
    }

    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const lx = cur % w;
      const ly = Math.floor(cur / w);
      const curDist = dist[cur];

      for (let d = 0; d < 8; d++) {
        const nlx = lx + DIR_DX[d];
        const nly = ly + DIR_DY[d];
        if (nlx < 0 || nlx >= w || nly < 0 || nly >= h) continue;
        const gcx = minCX + nlx;
        const gcy = minCY + nly;
        if (!this.isCellWalkable(gcx, gcy)) continue;
        if (d % 2 === 1) {
          if (!this.isCellWalkable(minCX + lx + DIR_DX[d], minCY + ly) || !this.isCellWalkable(minCX + lx, minCY + ly + DIR_DY[d])) {
            continue;
          }
        }
        const nIdx = nly * w + nlx;
        const nd = curDist + DIR_COST[d];
        if (nd < dist[nIdx]) {
          dist[nIdx] = nd;
          // Reverse direction points from neighbor back toward current (toward goal!)
          dirs[nIdx] = (d + 4) % 8;
          queue.push(nIdx);
        }
      }
    }

    return {
      originCellX: minCX,
      originCellY: minCY,
      width: w,
      height: h,
      cellSize: this.cellSize,
      minWorldX: -this.halfSize + minCX * this.cellSize,
      minWorldY: -this.halfSize + minCY * this.cellSize,
      dirs,
    };
  }

  public sampleFlowTarget(field: NavFlowField, wx: number, wy: number, stepAhead = 12): NavPoint | null {
    const lx = Math.floor((wx - field.minWorldX) / field.cellSize);
    const ly = Math.floor((wy - field.minWorldY) / field.cellSize);
    if (lx < 0 || lx >= field.width || ly < 0 || ly >= field.height) return null;
    const dir = field.dirs[ly * field.width + lx];
    if (dir < 0) return null;
    return {
      x: wx + DIR_DX[dir] * stepAhead,
      y: wy + DIR_DY[dir] * stepAhead,
    };
  }

  /**
   * Viewport-culled NavMesh debug overlay rendered only when player enables "Navmesh & Engel" view.
   */
  public renderDebugOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    project: (x: number, y: number) => { px: number; py: number } | null,
    unproject?: { minX: number; maxX: number; minY: number; maxY: number } | null
  ) {
    const cs = this.cellSize;
    const x0 = unproject ? Math.max(0, this.worldToCellX(unproject.minX) - 1) : 0;
    const x1 = unproject ? Math.min(this.cols - 1, this.worldToCellX(unproject.maxX) + 1) : this.cols - 1;
    const y0 = unproject ? Math.max(0, this.worldToCellY(unproject.minY) - 1) : 0;
    const y1 = unproject ? Math.min(this.rows - 1, this.worldToCellY(unproject.maxY) + 1) : this.rows - 1;

    // Limit cell render stride when fully zoomed out so debug view stays 60 FPS
    const span = (x1 - x0) * (y1 - y0);
    const stride = span > 8000 ? 3 : span > 3200 ? 2 : 1;

    ctx.save();
    for (let cy = y0; cy <= y1; cy += stride) {
      const wy = -this.halfSize + cy * cs;
      const rowOff = cy * this.cols;
      for (let cx = x0; cx <= x1; cx += stride) {
        const val = this.cells[rowOff + cx];
        if (val === CELL_WALKABLE) continue;

        const wx = -this.halfSize + cx * cs;
        const p1 = project(wx, wy);
        const p2 = project(wx + cs * stride, wy + cs * stride);
        if (!p1 || !p2) continue;
        if (p2.px < 0 || p1.px > width || p2.py < 0 || p1.py > height) continue;

        ctx.fillStyle =
          val === CELL_WATER
            ? 'rgba(14, 165, 233, 0.24)'
            : val === CELL_BUILDING
              ? 'rgba(239, 68, 68, 0.22)'
              : val === CELL_BRIDGE
                ? 'rgba(16, 185, 129, 0.22)'
                : 'rgba(245, 158, 11, 0.22)';
        ctx.fillRect(p1.px, p1.py, p2.px - p1.px, p2.py - p1.py);
      }
    }
    ctx.restore();
  }
}
