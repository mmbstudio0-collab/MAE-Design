import { NavMeshSerialized } from './navmesh';

export interface WorkerAdvice {
  steerX: number;
  steerY: number;
  flockX: number;
  flockY: number;
  tick: number;
}

/**
 * Worker Thread Pool managing 2–4 off-main-thread Web Workers for heavy
 * hierarchical NavMesh pathfinding and 15,000-entity flocking calculations.
 */
export class SimWorkerPool {
  private workers: Worker[] = [];
  private busyFlags: boolean[] = [];
  private jobSeq = 1;
  private adviceMap = new Map<number, WorkerAdvice>();
  private inFlight = false;
  private pendingChunks = 0;

  constructor() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
      const poolSize = Math.max(2, Math.min(4, hw - 1));
      for (let i = 0; i < poolSize; i++) {
        try {
          const w = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
          w.onmessage = (e: MessageEvent) => this.handleMessage(i, e.data);
          this.workers.push(w);
          this.busyFlags.push(false);
        } catch {
          // Graceful fallback if Worker construction is restricted in a test environment
          break;
        }
      }
    }
  }

  public getWorkerCount(): number {
    return this.workers.length;
  }

  public isActive(): boolean {
    return this.workers.length > 0;
  }

  public syncNavMesh(navData: NavMeshSerialized) {
    this.adviceMap.clear();
    if (this.workers.length === 0) return;
    for (let i = 0; i < this.workers.length; i++) {
      this.workers[i].postMessage({
        type: 'init_nav',
        nav: {
          ...navData,
          cells: new Uint8Array(navData.cells),
          coarseBlocks: new Uint8Array(navData.coarseBlocks),
        },
      });
    }
  }

  public clearAdvice() {
    this.adviceMap.clear();
  }

  public getAdvice(entityId: number, currentTick: number): WorkerAdvice | null {
    const ad = this.adviceMap.get(entityId);
    if (!ad || currentTick - ad.tick > 36) return null;
    return ad;
  }

  public dispatchBatch(
    tick: number,
    zPos: Float32Array,
    zTargets: Float32Array,
    targetItemCount: number
  ) {
    if (this.workers.length === 0 || this.inFlight || targetItemCount <= 0) return;
    const count = Math.min(this.workers.length, Math.max(1, Math.ceil(targetItemCount / 180)));
    const chunkSize = Math.ceil(targetItemCount / count);
    this.inFlight = true;
    this.pendingChunks = count;
    const batchTick = tick;

    for (let wIdx = 0; wIdx < count; wIdx++) {
      const startIdx = wIdx * chunkSize;
      const endIdx = Math.min(targetItemCount, startIdx + chunkSize);
      this.busyFlags[wIdx] = true;
      this.workers[wIdx].postMessage({
        type: 'compute_flock_nav_batch',
        jobId: (this.jobSeq++ << 8) | (batchTick & 0xff),
        tick: batchTick,
        zPos,
        zTargets,
        startIdx,
        endIdx,
      });
    }
  }

  private lastBatchTick = 0;

  public setDispatchTick(tick: number) {
    this.lastBatchTick = tick;
  }

  private handleMessage(workerIdx: number, msg: { type: string; buffer?: ArrayBuffer }) {
    this.busyFlags[workerIdx] = false;
    if (msg.type === 'flock_nav_result' && msg.buffer) {
      const arr = new Float32Array(msg.buffer);
      const len = Math.floor(arr.length / 5);
      const tickStamp = this.lastBatchTick;
      for (let i = 0; i < len; i++) {
        const b = i * 5;
        const id = arr[b];
        this.adviceMap.set(id, {
          steerX: arr[b + 1],
          steerY: arr[b + 2],
          flockX: arr[b + 3],
          flockY: arr[b + 4],
          tick: tickStamp,
        });
      }
      if (this.adviceMap.size > 16000) {
        this.adviceMap.clear();
      }
    }
    this.pendingChunks = Math.max(0, this.pendingChunks - 1);
    if (this.pendingChunks === 0) {
      this.inFlight = false;
    }
  }

  public dispose() {
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
    this.busyFlags = [];
    this.adviceMap.clear();
  }
}
