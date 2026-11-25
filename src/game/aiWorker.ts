// Off-main-thread Web Worker for Hierarchical NavMesh Pathfinding & Zombie Swarm Flocking

const CELL_WALKABLE = 0;
const CELL_BRIDGE = 4;
const COARSE_BLOCKED = 0;
const COARSE_OPEN = 2;

const DIR_DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DIR_DY = [0, 1, 1, 1, 0, -1, -1, -1];
const DIR_COST = [1, 1.4142, 1, 1.4142, 1, 1.4142, 1, 1.4142];

interface WorkerNavState {
  halfSize: number;
  cellSize: number;
  cols: number;
  rows: number;
  coarseFactor: number;
  coarseCols: number;
  coarseRows: number;
  cells: Uint8Array;
  coarseBlocks: Uint8Array;
  gScore: Float32Array;
  fScore: Float32Array;
  parent: Int32Array;
  closedStamp: Uint32Array;
  openStamp: Uint32Array;
  stamp: number;
}

let nav: WorkerNavState | null = null;
const pathCache = new Map<number, { wx: number; wy: number; tick: number }>();

function isCellWalkable(cx: number, cy: number): boolean {
  if (!nav || cx < 0 || cx >= nav.cols || cy < 0 || cy >= nav.rows) return false;
  const v = nav.cells[cy * nav.cols + cx];
  return v === CELL_WALKABLE || v === CELL_BRIDGE;
}

function hasNavLoS(x1: number, y1: number, x2: number, y2: number): boolean {
  if (!nav) return true;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const step = Math.max(2, nav.cellSize * 0.48);
  const steps = Math.ceil(dist / step);
  if (steps <= 1) return true;
  const dx = (x2 - x1) / steps;
  const dy = (y2 - y1) / steps;
  const invCs = 1 / nav.cellSize;
  const half = nav.halfSize;
  const cf = nav.coarseFactor;
  for (let i = 1; i < steps; i++) {
    const sx = x1 + dx * i;
    const sy = y1 + dy * i;
    const cx = Math.floor((sx + half) * invCs);
    const cy = Math.floor((sy + half) * invCs);
    if (cx < 0 || cx >= nav.cols || cy < 0 || cy >= nav.rows) return false;
    const bx = (cx / cf) | 0;
    const by = (cy / cf) | 0;
    const coarse = nav.coarseBlocks[by * nav.coarseCols + bx];
    if (coarse === COARSE_BLOCKED) return false;
    if (coarse === COARSE_OPEN) continue;
    const v = nav.cells[cy * nav.cols + cx];
    if (v !== CELL_WALKABLE && v !== CELL_BRIDGE) return false;
  }
  return true;
}

function findNextWaypoint(sx: number, sy: number, tx: number, ty: number, tick: number): { wx: number; wy: number } | null {
  if (!nav) return null;
  const invCs = 1 / nav.cellSize;
  const scx = Math.max(0, Math.min(nav.cols - 1, Math.floor((sx + nav.halfSize) * invCs)));
  const scy = Math.max(0, Math.min(nav.rows - 1, Math.floor((sy + nav.halfSize) * invCs)));
  const gcx = Math.max(0, Math.min(nav.cols - 1, Math.floor((tx + nav.halfSize) * invCs)));
  const gcy = Math.max(0, Math.min(nav.rows - 1, Math.floor((ty + nav.halfSize) * invCs)));

  if (scx === gcx && scy === gcy) return { wx: tx, wy: ty };
  if (hasNavLoS(sx, sy, tx, ty)) return { wx: tx, wy: ty };

  const key = (scx * 2048 + scy) * 4194304 + (gcx * 2048 + gcy);
  const hit = pathCache.get(key);
  if (hit && tick - hit.tick < 60) {
    return { wx: hit.wx, wy: hit.wy };
  }

  nav.stamp++;
  if (nav.stamp >= 0xfffffffe) {
    nav.closedStamp.fill(0);
    nav.openStamp.fill(0);
    nav.stamp = 1;
  }
  const stamp = nav.stamp;
  const cols = nav.cols;

  const startIdx = scy * cols + scx;
  const goalIdx = gcy * cols + gcx;
  if (!isCellWalkable(scx, scy) || !isCellWalkable(gcx, gcy)) return null;

  const heapIdx = [startIdx];
  const octile = (cx: number, cy: number) => {
    const dx = Math.abs(cx - gcx);
    const dy = Math.abs(cy - gcy);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  };
  const heapF = [octile(scx, scy)];

  nav.gScore[startIdx] = 0;
  nav.fScore[startIdx] = heapF[0];
  nav.parent[startIdx] = -1;
  nav.openStamp[startIdx] = stamp;

  const push = (idx: number, f: number) => {
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

  const pop = (): number => {
    const top = heapIdx[0];
    const lastIdx = heapIdx.pop()!;
    const lastF = heapF.pop()!;
    if (heapIdx.length > 0) {
      let i = 0;
      const n = heapIdx.length;
      while (true) {
        const l = (i << 1) + 1;
        const r = l + 1;
        let sm = i;
        if (l < n && heapF[l] < lastF) sm = l;
        if (r < n && heapF[r] < (sm === i ? lastF : heapF[l])) sm = r;
        if (sm === i) break;
        heapIdx[i] = heapIdx[sm];
        heapF[i] = heapF[sm];
        i = sm;
      }
      heapIdx[i] = lastIdx;
      heapF[i] = lastF;
    }
    return top;
  };

  let best = startIdx;
  let bestH = Infinity;
  let expansions = 0;
  while (heapIdx.length > 0 && expansions < 420) {
    const cur = pop();
    if (nav.closedStamp[cur] === stamp) continue;
    nav.closedStamp[cur] = stamp;
    expansions++;
    if (cur === goalIdx) {
      best = cur;
      break;
    }
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
    const hc = octile(cx, cy);
    if (hc < bestH) {
      bestH = hc;
      best = cur;
    }
    const baseG = nav.gScore[cur];
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIR_DX[d];
      const ny = cy + DIR_DY[d];
      if (!isCellWalkable(nx, ny)) continue;
      if (d % 2 === 1 && (!isCellWalkable(cx + DIR_DX[d], cy) || !isCellWalkable(cx, cy + DIR_DY[d]))) {
        continue;
      }
      const nIdx = ny * cols + nx;
      if (nav.closedStamp[nIdx] === stamp) continue;
      const tg = baseG + DIR_COST[d];
      if (nav.openStamp[nIdx] !== stamp || tg < nav.gScore[nIdx]) {
        nav.parent[nIdx] = cur;
        nav.gScore[nIdx] = tg;
        const f = tg + octile(nx, ny) * 1.08;
        nav.fScore[nIdx] = f;
        nav.openStamp[nIdx] = stamp;
        push(nIdx, f);
      }
    }
  }

  let trace = best;
  let prev = best;
  let guard = 0;
  while (trace !== -1 && trace !== startIdx && guard++ < 500) {
    prev = trace;
    trace = nav.parent[trace];
  }
  if (prev === startIdx) return null;

  const wcx = prev % cols;
  const wcy = Math.floor(prev / cols);
  const wx = -nav.halfSize + (wcx + 0.5) * nav.cellSize;
  const wy = -nav.halfSize + (wcy + 0.5) * nav.cellSize;

  if (pathCache.size > 3000) pathCache.clear();
  pathCache.set(key, { wx, wy, tick });
  return { wx, wy };
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init_nav') {
    const { halfSize, cellSize, cols, rows, coarseFactor, coarseCols, coarseRows, cells, coarseBlocks } = msg.nav;
    const total = cols * rows;
    nav = {
      halfSize,
      cellSize,
      cols,
      rows,
      coarseFactor,
      coarseCols,
      coarseRows,
      cells: new Uint8Array(cells),
      coarseBlocks: new Uint8Array(coarseBlocks),
      gScore: new Float32Array(total),
      fScore: new Float32Array(total),
      parent: new Int32Array(total),
      closedStamp: new Uint32Array(total),
      openStamp: new Uint32Array(total),
      stamp: 1,
    };
    pathCache.clear();
    return;
  }

  if (msg.type === 'compute_flock_nav_batch') {
    // Packed input aligned with engine.ts dispatchZombieWorkerBatch:
    // zPos: Float32Array [id, x, y, facing, ...] (stride 4)
    // zTargets: Float32Array [tx, ty, hasTarget, ...] (stride 3)
    const { jobId, tick, zPos, zTargets, startIdx, endIdx } = msg;
    const zPosArr = new Float32Array(zPos);
    const zTargetArr = new Float32Array(zTargets);
    const itemCount = Math.max(0, endIdx - startIdx);

    // Build fast spatial hash on zPosArr (cell 28m) for O(1) Boids neighborhood
    const invCell = 1 / 28;
    const buckets = new Map<number, number[]>();
    const totalZ = Math.floor(zPosArr.length / 4);
    for (let i = 0; i < totalZ; i++) {
      const zx = zPosArr[i * 4 + 1];
      const zy = zPosArr[i * 4 + 2];
      const cx = Math.floor(zx * invCell);
      const cy = Math.floor(zy * invCell);
      const k = (cx + 4096) * 8192 + (cy + 4096);
      let b = buckets.get(k);
      if (!b) {
        b = [];
        buckets.set(k, b);
      }
      b.push(i);
    }

    // Output per slice item: [id, steerX, steerY, flockDirX, flockDirY]
    const out = new Float32Array(itemCount * 5);

    for (let k = 0; k < itemCount; k++) {
      const idx = startIdx + k;
      const pBase = idx * 4;
      const tBase = idx * 3;
      const id = zPosArr[pBase];
      const x = zPosArr[pBase + 1];
      const y = zPosArr[pBase + 2];
      const tx = zTargetArr[tBase];
      const ty = zTargetArr[tBase + 1];
      const hasTarget = zTargetArr[tBase + 2] > 0.5;

      let steerX = tx;
      let steerY = ty;
      if (hasTarget && nav && !Number.isNaN(tx) && Math.hypot(tx - x, ty - y) > 14) {
        const wp = findNextWaypoint(x, y, tx, ty, tick);
        if (wp) {
          steerX = wp.wx;
          steerY = wp.wy;
        }
      }

      // Compute 3-Rule Boids Flocking (Separation + Alignment + Cohesion) within 26m
      const cx0 = Math.floor(x * invCell);
      const cy0 = Math.floor(y * invCell);
      let sepX = 0;
      let sepY = 0;
      let sumX = 0;
      let sumY = 0;
      let sumCos = 0;
      let sumSin = 0;
      let flockCount = 0;

      for (let dcx = -1; dcx <= 1 && flockCount < 14; dcx++) {
        for (let dcy = -1; dcy <= 1 && flockCount < 14; dcy++) {
          const b = buckets.get((cx0 + dcx + 4096) * 8192 + (cy0 + dcy + 4096));
          if (!b) continue;
          for (let bi = 0; bi < b.length && flockCount < 14; bi++) {
            const zi = b[bi];
            if (zi === idx) continue;
            const ox = zPosArr[zi * 4 + 1];
            const oy = zPosArr[zi * 4 + 2];
            const dx = ox - x;
            const dy = oy - y;
            const dSq = dx * dx + dy * dy;
            if (dSq <= 0.001 || dSq >= 676) continue;
            const d = Math.sqrt(dSq);
            if (d < 3.6) {
              const weight = (3.6 - d) / 3.6;
              sepX -= (dx / d) * weight;
              sepY -= (dy / d) * weight;
            }
            sumX += ox;
            sumY += oy;
            const f = zPosArr[zi * 4 + 3];
            sumCos += Math.cos(f);
            sumSin += Math.sin(f);
            flockCount++;
          }
        }
      }

      let flockX = 0;
      let flockY = 0;
      if (flockCount >= 1) {
        const cohX = sumX / flockCount - x;
        const cohY = sumY / flockCount - y;
        const cohLen = Math.hypot(cohX, cohY) || 1;
        const aliLen = Math.hypot(sumCos, sumSin) || 1;
        const sepLen = Math.hypot(sepX, sepY) || 1;
        flockX =
          (cohX / cohLen) * 0.48 +
          (sumCos / aliLen) * 0.28 +
          (sepX !== 0 || sepY !== 0 ? (sepX / sepLen) * 0.24 : 0);
        flockY =
          (cohY / cohLen) * 0.48 +
          (sumSin / aliLen) * 0.28 +
          (sepX !== 0 || sepY !== 0 ? (sepY / sepLen) * 0.24 : 0);
        const fLen = Math.hypot(flockX, flockY) || 1;
        flockX /= fLen;
        flockY /= fLen;
      }

      const oBase = k * 5;
      out[oBase] = id;
      out[oBase + 1] = steerX;
      out[oBase + 2] = steerY;
      out[oBase + 3] = flockX;
      out[oBase + 4] = flockY;
    }

    (self as unknown as Worker).postMessage(
      { type: 'flock_nav_result', jobId, buffer: out.buffer },
      [out.buffer]
    );
  }
};
