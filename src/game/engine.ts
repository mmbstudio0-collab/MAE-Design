import { soundEngine } from '../audio/soundEngine';
import {
  ObstacleGrid,
  RoadSpawnSpot,
  TACTICAL_SECTORS,
  buildOcclusionZonesFromObstacles,
  createRectObstacle,
  hasBuildingLineOfSight,
  isCircleClearOfObstacles,
  isEntityVisuallyOccludedAtCamera,
  isNearCoverOrTree,
  isPointBlocked,
  isPointInHardObstacle,
  isPointInWaterObstacles,
  isSegmentBlockedByObstacles,
  isVehicleFootprintBlocked,
  resolveCircleObstacles,
} from './obstacles';
import { NavFlowField, NavMeshGrid } from './navmesh';
import { CameraTiltDeg } from './perspective';
import { getLakeShorelineX, isPointInWater } from './prebakedMap';
import {
  OccludedSilhouetteItem,
  renderA10Plane,
  renderBarricade,
  renderBloodStain,
  renderChinookModel,
  renderCivilianSprite,
  renderCorpse,
  renderCrater,
  renderDayNightAtmosphere,
  renderDynamicVehicleModel,
  renderFireSpot,
  renderHelicopterModel,
  renderImpactSpark,
  renderMuzzleFlash,
  renderOccludedSilhouettesMasked,
  renderQuarantineZone,
  renderShellCasing,
  renderStaticVehicleModel,
  renderUnitSprite,
  renderVolumetricExplosion,
  renderZombieHeatmap,
  renderZombieSprite,
} from './renderModels';
import { SimWorkerPool } from './simWorkerPool';
import { computeLODTier } from './spriteAtlas';
import {
  A10Strike,
  Barricade,
  BloodStain,
  BridgeCorridor,
  ChinookDrop,
  Civilian,
  CivilianGear,
  CivilianHairStyle,
  Corpse,
  Crater,
  DayPhase,
  ExplosionEffect,
  FireSpot,
  GeoOrigin,
  Helicopter,
  HudSnapshot,
  ImpactSparkEffect,
  MissionConfig,
  MuzzleFlashEffect,
  Obstacle,
  OcclusionZone,
  PlacementValidation,
  PoliceRole,
  QuarantineBarrier,
  QuarantineTower,
  QuarantineZone,
  ShellCasingParticle,
  SirenMode,
  SoldierRole,
  TacticalLogEntry,
  TacticalLogSeverity,
  Unit,
  UnitKind,
  UnitRole,
  VehicleEntity,
  VehicleKind,
  WeaponClass,
  Zombie,
  ZombieVariant,
} from './types';

interface Tracer {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
  width?: number;
}

interface OrderMarker {
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onMissionEnd: (snapshot: HudSnapshot) => void;
}

export interface AffineMapProjection {
  px0: number;
  py0: number;
  scaleX: number;
  scaleY: number;
  quadY: number;
}

export interface MapProjector {
  project: (xMeters: number, yMeters: number) => { px: number; py: number } | null;
  pixelsPerMeter: number;
  affine?: AffineMapProjection;
}

const CIVILIAN_COLORS = ['#60a5fa', '#e2e8f0', '#fbbf24', '#f472b6', '#34d399'];
const HAIR_COLORS = ['#0f172a', '#451a03', '#78350f', '#92400e', '#ca8a04'];
const CAR_COLORS = ['#94a3b8', '#475569', '#dc2626', '#2563eb', '#d97706', '#e2e8f0', '#334155'];

const VEHICLE_SPECS: Record<VehicleKind, { len: number; wid: number; speed: number; hp: number; cap: number }> = {
  police_car: { len: 6.8, wid: 3.05, speed: 14.0, hp: 340, cap: 4 },
  police_van: { len: 8.2, wid: 3.45, speed: 11.5, hp: 480, cap: 6 },
  ambulance: { len: 8.4, wid: 3.45, speed: 12.5, hp: 400, cap: 3 },
  fire_truck: { len: 10.4, wid: 3.7, speed: 10.4, hp: 580, cap: 4 },
  civilian_car: { len: 6.4, wid: 2.85, speed: 12.0, hp: 240, cap: 4 },
  motorcycle: { len: 3.5, wid: 1.65, speed: 17.0, hp: 130, cap: 2 },
  military_jeep: { len: 7.0, wid: 3.15, speed: 13.2, hp: 440, cap: 4 },
  armored_apc: { len: 9.4, wid: 4.0, speed: 9.5, hp: 920, cap: 6 },
};

function randomInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

class SpatialHash<T extends { x: number; y: number }> {
  private invCell: number;
  private cellSize: number;
  private buckets = new Map<number, T[]>();
  private activeKeys: number[] = [];

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
  }

  private key(cx: number, cy: number): number {
    return (cx + 16384) * 32768 + (cy + 16384);
  }

  public rebuild(items: T[]) {
    for (let i = 0; i < this.activeKeys.length; i++) {
      const b = this.buckets.get(this.activeKeys[i]);
      if (b) b.length = 0;
    }
    this.activeKeys.length = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cx = Math.floor(it.x * this.invCell);
      const cy = Math.floor(it.y * this.invCell);
      const k = this.key(cx, cy);
      let list = this.buckets.get(k);
      if (!list) {
        list = [];
        this.buckets.set(k, list);
      }
      if (list.length === 0) {
        this.activeKeys.push(k);
      }
      list.push(it);
    }
  }

  public queryRadiusScratch(x: number, y: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const x0 = Math.floor((x - radius) * this.invCell);
    const x1 = Math.floor((x + radius) * this.invCell);
    const y0 = Math.floor((y - radius) * this.invCell);
    const y1 = Math.floor((y + radius) * this.invCell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const b = this.buckets.get((cx + 16384) * 32768 + (cy + 16384));
        if (b && b.length > 0) {
          for (let i = 0; i < b.length; i++) out.push(b[i]);
        }
      }
    }
    return out;
  }

  public queryRadius(x: number, y: number, radius: number): T[] {
    return this.queryRadiusScratch(x, y, radius, []);
  }

  /**
   * Expanding-ring spatial hash nearest search with early-exit once a closer cell ring cannot improve bestDist.
   */
  public findNearest(x: number, y: number, maxRadius: number, filter?: (item: T) => boolean): { item: T; dist: number } | null {
    const centerCx = Math.floor(x * this.invCell);
    const centerCy = Math.floor(y * this.invCell);
    const maxRing = Math.ceil(maxRadius * this.invCell);
    let best: T | null = null;
    let bestDistSq = maxRadius * maxRadius;

    for (let ring = 0; ring <= maxRing; ring++) {
      // If we already found a target strictly closer than the minimum possible distance to this ring, stop early!
      if (best && ring > 1) {
        const minPossible = (ring - 1) * this.cellSize;
        if (bestDistSq <= minPossible * minPossible) break;
      }

      for (let dx = -ring; dx <= ring; dx++) {
        const cx = centerCx + dx;
        for (let dy = -ring; dy <= ring; dy++) {
          if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const b = this.buckets.get((cx + 16384) * 32768 + (centerCy + dy + 16384));
          if (!b || b.length === 0) continue;
          for (let i = 0; i < b.length; i++) {
            const it = b[i];
            if (filter && !filter(it)) continue;
            const ddx = it.x - x;
            const ddy = it.y - y;
            const dSq = ddx * ddx + ddy * ddy;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              best = it;
            }
          }
        }
      }
    }
    return best ? { item: best, dist: Math.sqrt(bestDistSq) } : null;
  }
}

export class TacticalZombieEngine {
  private callbacks: EngineCallbacks;
  private config: MissionConfig;
  private origin: GeoOrigin = { ...TACTICAL_SECTORS[0].origin };
  private obstacles: Obstacle[] = [];
  private occlusionZones: OcclusionZone[] = [];
  private bridges: BridgeCorridor[] = [];
  private usingPrebakedChicago = false;
  private cameraTiltDeg: CameraTiltDeg = 0;
  private obstacleGrid: ObstacleGrid = new ObstacleGrid([]);
  private roadSpots: RoadSpawnSpot[] = [];
  private navMesh: NavMeshGrid | null = null;
  private workerPool = new SimWorkerPool();
  private heliFlowFields = new Map<number, NavFlowField>();

  private zombieHash = new SpatialHash<Zombie>(48);
  private civilianHash = new SpatialHash<Civilian>(48);
  private unitHash = new SpatialHash<Unit>(48);
  private unitNeighborsScratch: Unit[] = [];
  private civNeighborsScratch: Civilian[] = [];
  private zombieNeighborsScratch: Zombie[] = [];
  private steerObsScratch: Obstacle[] = [];
  private frameTick = 0;

  private running = false;
  private paused = false;
  private frozen = false;
  private outcome: 'ongoing' | 'victory' | 'defeat' = 'ongoing';

  private units: Unit[] = [];
  private civilians: Civilian[] = [];
  private zombies: Zombie[] = [];
  private helicopters: Helicopter[] = [];
  private chinooks: ChinookDrop[] = [];
  private vehicles: VehicleEntity[] = [];
  private airstrikes: A10Strike[] = [];
  private craters: Crater[] = [];
  private fires: FireSpot[] = [];
  private explosions: ExplosionEffect[] = [];
  private bloodStains: BloodStain[] = [];
  private corpses: Corpse[] = [];
  private barricades: Barricade[] = [];
  private quarantineZones: QuarantineZone[] = [];

  private tracers: Tracer[] = [];
  private muzzleFlashes: MuzzleFlashEffect[] = [];
  private shellCasings: ShellCasingParticle[] = [];
  private impactSparks: ImpactSparkEffect[] = [];
  private orderMarkers: OrderMarker[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];

  private readonly barricadesMax = 8;
  private readonly quarantineMax = 3;
  private barricadesBuiltCount = 0;

  private nextId = 1;
  private halfSize = 600;

  private zombiesInitial = 0;
  private zombiesSpawnedTotal = 0;
  private zombiesKilled = 0;
  private civiliansInitial = 0;
  private civiliansEvacuated = 0;
  private civiliansLost = 0;
  private policeInitial = 0;
  private soldiersInitial = 0;
  private policeLosses = 0;
  private soldierLosses = 0;
  private policeCap = 12;
  private soldiersCap = 8;
  private helicoptersTotal = 3;
  private helicoptersRemaining = 3;
  private reinforceCooldown = 0;
  private outbreakCenter = { x: 220, y: -160 };
  private stagingCenter = { x: 0, y: 0 };
  private missionTimeSec = 0;
  private timeOfDay = 0.48; // Realistic 60-min cycle: 30m Day + 30m Night
  private sirenMode: SirenMode = 'wail';
  private currentLodLabel = 'LOD-0 ZOS Detaylı Sprite';
  private hudSyncTimer = 0;
  private elapsedVisual = 0;

  // Tactical Event Log & Strategic Alert Throttles
  private eventLog: TacticalLogEntry[] = [];
  private nextLogId = 1;
  private contactAlertCooldown = 0;
  private evacLogCooldown = 0;
  private siegeAlertCooldown = 0;
  private evacBatchCounter = 0;

  constructor(callbacks: EngineCallbacks, initialConfig: MissionConfig) {
    this.callbacks = callbacks;
    this.config = initialConfig;
    this.halfSize = initialConfig.sectorSizeMeters / 2;
  }

  public setOrigin(origin: GeoOrigin) {
    this.origin = origin;
  }

  public getOrigin(): GeoOrigin {
    return this.origin;
  }

  public getHalfSize(): number {
    return this.halfSize;
  }

  public getObstacleGrid(): ObstacleGrid {
    return this.obstacleGrid;
  }

  private getMaxLandX(y: number, margin = 20): number {
    return this.usingPrebakedChicago
      ? Math.min(this.halfSize - margin, getLakeShorelineX(y) - margin)
      : this.halfSize - margin;
  }

  private isWaterAt(x: number, y: number, margin: number): boolean {
    if (this.usingPrebakedChicago && isPointInWater(x, y, margin)) return true;
    return isPointInWaterObstacles(x, y, this.obstacles, this.bridges, margin);
  }

  private rebuildNavMesh() {
    this.navMesh = new NavMeshGrid(
      this.halfSize,
      this.obstacles,
      this.obstacleGrid,
      this.roadSpots,
      this.bridges,
      this.usingPrebakedChicago
    );
    this.heliFlowFields.clear();
    if (this.navMesh && this.workerPool.isActive()) {
      this.workerPool.syncNavMesh(this.navMesh.exportGridData());
    }
  }

  public setCameraTilt(tiltDeg: CameraTiltDeg) {
    this.cameraTiltDeg = tiltDeg;
  }

  public setObstacles(
    obstacles: Obstacle[],
    roadSpots: RoadSpawnSpot[] = [],
    bridges: BridgeCorridor[] = [],
    isPrebakedChicago = false,
    occlusionZones?: OcclusionZone[]
  ) {
    this.obstacles = obstacles;
    this.bridges = bridges;
    this.usingPrebakedChicago = isPrebakedChicago;
    this.occlusionZones = occlusionZones ?? buildOcclusionZonesFromObstacles(obstacles);
    this.obstacleGrid = new ObstacleGrid(obstacles, 36, bridges);
    this.roadSpots = roadSpots.filter(
      (r) => !this.isWaterAt(r.x, r.y, 3.5) && !isPointBlocked(r.x, r.y, 1.5, this.obstacleGrid)
    );
    this.rebuildNavMesh();
  }

  public getObstacles(): Obstacle[] {
    return this.obstacles;
  }

  public logEvent(severity: TacticalLogSeverity, message: string) {
    const sec = Math.floor(this.missionTimeSec);
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    this.eventLog.push({
      id: this.nextLogId++,
      timestampText: `${hh}:${mm}:${ss}`,
      missionSec: sec,
      severity,
      message,
    });
    if (this.eventLog.length > 70) {
      this.eventLog.shift();
    }
  }

  public startMission(config: MissionConfig) {
    this.config = config;
    this.halfSize = config.sectorSizeMeters / 2;
    this.running = true;
    this.paused = false;
    this.frozen = false;
    this.outcome = 'ongoing';

    soundEngine.stopHelicopterLoop();
    soundEngine.stopSirenLoop();
    soundEngine.setSirenMode(this.sirenMode);

    this.units = [];
    this.civilians = [];
    this.zombies = [];
    this.helicopters = [];
    this.chinooks = [];
    this.vehicles = [];
    this.airstrikes = [];
    this.craters = [];
    this.fires = [];
    this.explosions = [];
    this.bloodStains = [];
    this.corpses = [];
    this.barricades = [];
    this.quarantineZones = [];
    this.tracers = [];
    this.muzzleFlashes = [];
    this.shellCasings = [];
    this.impactSparks = [];
    this.orderMarkers = [];
    this.particles = [];
    this.shockwaves = [];
    this.eventLog = [];
    this.barricadesBuiltCount = 0;
    this.contactAlertCooldown = 0;
    this.evacLogCooldown = 0;
    this.siegeAlertCooldown = 8;
    this.evacBatchCounter = 0;

    this.obstacles = this.obstacles.filter((o) => o.kind !== 'barricade');
    this.obstacleGrid = new ObstacleGrid(this.obstacles, 36, this.bridges);
    this.rebuildNavMesh();

    this.zombiesKilled = 0;
    this.civiliansEvacuated = 0;
    this.civiliansLost = 0;
    this.policeLosses = 0;
    this.soldierLosses = 0;
    this.missionTimeSec = 0;
    this.timeOfDay = 0.48;
    this.reinforceCooldown = 0;

    // 1. Open staging center
    this.stagingCenter = this.findNearestOpenSpot(0, 0, 2.5, 180);

    // 2. Determine Zombie Spawn Zone according to user preference (always on dry open land, never in water!)
    const edgeDist = Math.min(this.halfSize - 55, Math.max(320, this.halfSize * 0.48));
    let obx = 180;
    let oby = -160;
    if (config.zombieSpawnMode === 'north') {
      oby = -edgeDist;
      const maxLandX = this.getMaxLandX(oby, 75);
      obx = clamp((Math.random() - 0.5) * 200, -this.halfSize + 60, maxLandX);
    } else if (config.zombieSpawnMode === 'south') {
      oby = edgeDist;
      const maxLandX = this.getMaxLandX(oby, 75);
      obx = clamp((Math.random() - 0.5) * 200, -this.halfSize + 60, maxLandX);
    } else if (config.zombieSpawnMode === 'west') {
      obx = -edgeDist;
      oby = (Math.random() - 0.5) * 140;
    } else if (config.zombieSpawnMode === 'east') {
      oby = (Math.random() - 0.5) * 240;
      const maxLandX = this.getMaxLandX(oby, 65);
      obx = clamp(Math.min(edgeDist, maxLandX), -this.halfSize + 80, maxLandX);
    } else {
      for (let attempt = 0; attempt < 60; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 190 + Math.random() * Math.max(80, edgeDist - 190);
        const cy = clamp(Math.sin(angle) * dist, -this.halfSize + 45, this.halfSize - 45);
        const maxLandX = this.getMaxLandX(cy, 45);
        const cx = clamp(Math.cos(angle) * dist, -this.halfSize + 45, maxLandX);
        if (!this.isLocationBlocked(cx, cy, 2.5)) {
          obx = cx;
          oby = cy;
          break;
        }
      }
    }
    const safeOutbreak = this.findNearestOpenSpot(obx, oby, 2.2, 160);
    obx = safeOutbreak.x;
    oby = safeOutbreak.y;
    this.outbreakCenter = { x: obx, y: oby };

    // 3. Roll Min-Max counts (scales smoothly up to 5,000 zombies & 10,000 civilians)
    const zCount = randomInt(config.zombies.min, config.zombies.max);
    const cCount = randomInt(config.civilians.min, config.civilians.max);
    const pCount = randomInt(config.police.min, config.police.max);
    const sCount = randomInt(config.soldiers.min, config.soldiers.max);
    const hCount = randomInt(config.helicopters.min, config.helicopters.max);

    this.zombiesInitial = zCount;
    this.zombiesSpawnedTotal = zCount;
    this.civiliansInitial = cCount;
    this.policeInitial = pCount;
    this.soldiersInitial = sCount;
    this.policeCap = Math.max(config.police.max, pCount);
    this.soldiersCap = Math.max(config.soldiers.max, sCount);
    this.helicoptersTotal = hCount;
    this.helicoptersRemaining = hCount;

    // 4. Spawn Zombies (strictly on open streets/plazas/parks, never inside buildings or water)
    const variants: ZombieVariant[] = ['walker', 'walker', 'runner', 'heavy', 'fat', 'crawler', 'fresh_infected'];
    const isDirectional = config.zombieSpawnMode !== 'random';
    const clusterSpread = zCount > 1000 ? Math.min(this.halfSize * 0.55, 650) : 165;
    const roadLen = this.roadSpots.length;
    for (let i = 0; i < zCount; i++) {
      let rawX = obx;
      let rawY = oby;
      if (isDirectional) {
        const lineSpan = (Math.random() - 0.5) * Math.min(this.halfSize * 0.9, zCount > 1000 ? 1100 : 500);
        const depth = (Math.random() - 0.5) * (zCount > 1000 ? 220 : 95);
        if (config.zombieSpawnMode === 'north' || config.zombieSpawnMode === 'south') {
          rawY = clamp(oby + depth, -this.halfSize + 15, this.halfSize - 15);
          rawX = clamp(obx + lineSpan, -this.halfSize + 15, this.getMaxLandX(rawY, 22));
        } else {
          rawY = clamp(oby + lineSpan, -this.halfSize + 15, this.halfSize - 15);
          rawX = clamp(obx + depth, -this.halfSize + 15, this.getMaxLandX(rawY, 22));
        }
      } else if (roadLen > 0 && (zCount > 800 || i % 3 === 0)) {
        const rs = this.roadSpots[(i * 7 + Math.floor(Math.random() * 17)) % roadLen];
        rawX = clamp(rs.x + (Math.random() - 0.5) * 8, -this.halfSize + 15, this.getMaxLandX(rs.y, 18));
        rawY = clamp(rs.y + (Math.random() - 0.5) * 8, -this.halfSize + 15, this.halfSize - 15);
      } else {
        const spread = 12 + Math.random() * clusterSpread;
        const a = Math.random() * Math.PI * 2;
        rawY = clamp(oby + Math.sin(a) * spread, -this.halfSize + 15, this.halfSize - 15);
        rawX = clamp(obx + Math.cos(a) * spread, -this.halfSize + 15, this.getMaxLandX(rawY, 22));
      }
      const spot = this.findNearestOpenSpot(rawX, rawY, 1.35, 64);
      const variant = variants[i % variants.length];
      this.spawnZombie(spot.x, spot.y, variant, undefined, isDirectional ? { x: 0, y: 0 } : undefined);
    }

    // 5. Spawn Civilians across verified dry streets/plazas (fast road-weighted placement for up to 10,000)
    const spawnSpread = Math.min(this.halfSize - 25, Math.max(480, this.halfSize * 0.55));
    for (let i = 0; i < cCount; i++) {
      let cx = this.stagingCenter.x;
      let cy = this.stagingCenter.y;
      if (roadLen > 0 && i % 5 !== 0) {
        const rs = this.roadSpots[i % roadLen];
        cx = clamp(rs.x + (Math.random() - 0.5) * 8, -this.halfSize + 15, this.halfSize - 15);
        cy = clamp(rs.y + (Math.random() - 0.5) * 8, -this.halfSize + 15, this.halfSize - 15);
      } else {
        for (let t = 0; t < 16; t++) {
          const ty = (Math.random() * 2 - 1) * spawnSpread;
          const maxLandX = Math.min(spawnSpread, this.getMaxLandX(ty, 20));
          const tx = -spawnSpread + Math.random() * Math.max(100, maxLandX + spawnSpread);
          if (!this.isLocationBlocked(tx, ty, 1.3)) {
            cx = tx;
            cy = ty;
            break;
          }
        }
      }
      const safe = this.findNearestOpenSpot(cx, cy, 1.25, 64);
      this.spawnCivilianInternal(safe.x, safe.y, 'random');
    }

    // 6. Spawn Police & Military squads
    this.spawnUnitSquad('police', pCount, this.stagingCenter.x - 8, this.stagingCenter.y + 4);
    this.spawnUnitSquad('soldier', sCount, this.stagingCenter.x + 8, this.stagingCenter.y - 4);

    // 7. Spawn parked empty city vehicles (strictly parked until Police/Soldiers board!)
    this.spawnInitialCityVehicles();

    this.logEvent(
      'info',
      `Operasyon başladı · ${zCount} zombi, ${cCount} sivil, ${pCount + sCount} güvenlik personeli konuşlandı.`
    );

    this.emitHud();
  }

  private spawnInitialCityVehicles() {
    const vehiclePool: VehicleKind[] = [
      'police_car',
      'police_van',
      'ambulance',
      'fire_truck',
      'civilian_car',
      'motorcycle',
      'military_jeep',
      'armored_apc',
      'police_car',
      'military_jeep',
    ];

    for (let i = 0; i < vehiclePool.length; i++) {
      const kind = vehiclePool[i];
      let vx = 0;
      let vy = 0;
      let angle = Math.random() * Math.PI * 2;
      if (this.roadSpots.length > 0 && i > 2) {
        const spot = this.roadSpots[Math.floor(Math.random() * this.roadSpots.length)];
        vx = spot.x;
        vy = spot.y;
        angle = spot.angle;
      } else {
        // Ensure a few tactical vehicles spawn near staging center so player can easily board them!
        const a = (i / 3) * Math.PI * 2;
        vx = this.stagingCenter.x + Math.cos(a) * 18;
        vy = this.stagingCenter.y + Math.sin(a) * 18;
      }
      const safeSpot = this.findSafeVehicleSpot(vx, vy, kind, angle);
      this.spawnVehicleInternal(safeSpot.x, safeSpot.y, kind, safeSpot.angle);
    }
  }

  private spawnUnitSquad(kind: UnitKind, count: number, baseX: number, baseY: number) {
    const policeRoles: PoliceRole[] = ['normal', 'traffic', 'special_ops', 'swat', 'commissioner', 'riot_shield'];
    const soldierRoles: SoldierRole[] = ['infantry', 'commando', 'sniper', 'heavy', 'medic', 'infantry'];
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ox = (col - (cols - 1) / 2) * 4.2;
      const oy = row * 4.2;
      const spot = this.findNearestOpenSpot(baseX + ox, baseY + oy, 1.35, 70);
      const role =
        kind === 'police'
          ? policeRoles[i % policeRoles.length]
          : soldierRoles[i % soldierRoles.length];
      this.units.push(this.createUnit(kind, role, spot.x, spot.y));
    }
  }

  private createUnit(kind: UnitKind, role: UnitRole, x: number, y: number, parachuteDrop = false): Unit {
    const specs: Record<
      UnitRole,
      {
        hp: number;
        radius: number;
        speed: number;
        range: number;
        fireInterval: number;
        damage: number;
        ammo: number;
        reload: number;
        weaponClass: WeaponClass;
      }
    > = {
      normal: { hp: 105, radius: 0.95, speed: 4.55, range: 54, fireInterval: 0.56, damage: 22, ammo: 15, reload: 1.5, weaponClass: 'pistol' },
      traffic: { hp: 95, radius: 0.92, speed: 4.9, range: 48, fireInterval: 0.58, damage: 19, ammo: 15, reload: 1.4, weaponClass: 'pistol' },
      special_ops: { hp: 150, radius: 1.0, speed: 4.65, range: 72, fireInterval: 0.14, damage: 18, ammo: 32, reload: 1.7, weaponClass: 'smg' },
      swat: { hp: 190, radius: 1.08, speed: 3.95, range: 72, fireInterval: 0.34, damage: 30, ammo: 30, reload: 1.8, weaponClass: 'rifle' },
      commissioner: { hp: 140, radius: 1.0, speed: 4.35, range: 58, fireInterval: 0.48, damage: 25, ammo: 15, reload: 1.5, weaponClass: 'pistol' },
      riot_shield: { hp: 290, radius: 1.15, speed: 3.4, range: 38, fireInterval: 0.58, damage: 20, ammo: 12, reload: 1.6, weaponClass: 'pistol' },
      infantry: { hp: 170, radius: 1.05, speed: 3.75, range: 82, fireInterval: 0.36, damage: 29, ammo: 30, reload: 1.8, weaponClass: 'rifle' },
      commando: { hp: 195, radius: 1.05, speed: 4.35, range: 78, fireInterval: 0.14, damage: 20, ammo: 32, reload: 1.5, weaponClass: 'smg' },
      sniper: { hp: 130, radius: 0.98, speed: 3.45, range: 195, fireInterval: 1.55, damage: 115, ammo: 8, reload: 2.2, weaponClass: 'sniper' },
      heavy: { hp: 235, radius: 1.18, speed: 3.05, range: 90, fireInterval: 0.22, damage: 26, ammo: 60, reload: 2.6, weaponClass: 'heavy' },
      medic: { hp: 145, radius: 1.0, speed: 4.1, range: 48, fireInterval: 0.56, damage: 19, ammo: 18, reload: 1.6, weaponClass: 'pistol' },
      paratrooper: { hp: 185, radius: 1.05, speed: 4.05, range: 80, fireInterval: 0.32, damage: 30, ammo: 30, reload: 1.7, weaponClass: 'rifle' },
    };

    const st = specs[role];
    return {
      id: this.nextId++,
      kind,
      role,
      weaponClass: st.weaponClass,
      x,
      y,
      hp: st.hp,
      maxHp: st.hp,
      stamina: 100,
      maxStamina: 100,
      exhausted: false,
      radius: st.radius,
      speed: st.speed,
      range: st.range,
      fireInterval: st.fireInterval,
      fireTimer: Math.random() * 0.2,
      damage: st.damage,
      ammo: st.ammo,
      maxAmmo: st.ammo,
      reloadTimer: 0,
      reloadDuration: st.reload,
      facing: 0,
      targetPos: null,
      targetVehicleId: null,
      focusZombieId: null,
      selected: true,
      hitFlash: 0,
      muzzleFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      isMoving: false,
      animState: parachuteDrop ? 'parachuting' : 'idle',
      inCover: false,
      carryingCivilianId: null,
      parachuteAlt: parachuteDrop ? 1 : 0,
      parachuteSway: Math.random() * Math.PI * 2,
      inVehicleId: null,
      animTime: Math.random() * 2,
      shootAnim: 0,
      steerBias: Math.random() < 0.5 ? 1 : -1,
      steerLockTimer: 0,
      gender: Math.random() < 0.22 ? 'female' : 'male',
    };
  }

  private spawnCivilianInternal(x: number, y: number, preset: 'random' | 'armed' | 'wounded') {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const ageGroup = Math.random() < 0.22 ? 'elderly' : 'adult';
    const hairPool: CivilianHairStyle[] =
      gender === 'female' ? ['long', 'bun', 'short'] : ['short', 'bald', 'short'];
    const gearPool: CivilianGear[] = ['none', 'none', 'backpack', 'handbag', 'briefcase'];
    const armedRatio = clamp(this.config.armedCivilianPct ?? 12, 0, 100) / 100;
    const armed = preset === 'armed' ? true : preset === 'random' ? Math.random() < armedRatio : false;
    const wounded = preset === 'wounded' ? true : preset === 'random' ? Math.random() < 0.1 : false;

    const baseSpeed = ageGroup === 'elderly' ? 3.2 : 4.45;
    const hp = ageGroup === 'elderly' ? 32 : 42;

    this.civilians.push({
      id: this.nextId++,
      x,
      y,
      hp: wounded ? hp * 0.5 : hp,
      maxHp: hp,
      stamina: 100,
      maxStamina: 100,
      exhausted: false,
      radius: 0.9,
      speed: baseSpeed,
      facing: Math.random() * Math.PI * 2,
      wanderTarget: null,
      wanderTimer: Math.random() * 2.5,
      state: wounded ? 'calling_help' : 'wandering',
      targetHeliId: null,
      hitFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      isMoving: false,
      shirtColor: CIVILIAN_COLORS[Math.floor(Math.random() * CIVILIAN_COLORS.length)],
      gender,
      ageGroup,
      hairStyle: hairPool[Math.floor(Math.random() * hairPool.length)],
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      gear: gearPool[Math.floor(Math.random() * gearPool.length)],
      armed,
      fireTimer: 0,
      wounded,
      infected: false,
      infectionTimer: 0,
      helpWavePhase: Math.random() * Math.PI * 2,
      animTime: Math.random() * 2,
      shootAnim: 0,
      steerBias: Math.random() < 0.5 ? 1 : -1,
      steerLockTimer: 0,
    });
  }

  private spawnZombie(
    x: number,
    y: number,
    variant: ZombieVariant,
    shirtColor?: string,
    initialMarchTarget?: { x: number; y: number }
  ) {
    const specs: Record<ZombieVariant, { hp: number; radius: number; speed: number; damage: number }> = {
      walker: { hp: 68, radius: 0.95, speed: 2.75, damage: 15 },
      runner: { hp: 46, radius: 0.9, speed: 5.45, damage: 12 },
      heavy: { hp: 185, radius: 1.25, speed: 2.15, damage: 24 },
      fat: { hp: 220, radius: 1.35, speed: 1.75, damage: 20 },
      crawler: { hp: 42, radius: 0.8, speed: 1.65, damage: 13 },
      fresh_infected: { hp: 58, radius: 0.92, speed: 3.35, damage: 14 },
    };

    const sp = specs[variant];
    this.zombies.push({
      id: this.nextId++,
      variant,
      outfitId: Math.floor(Math.random() * 128),
      x,
      y,
      hp: sp.hp,
      maxHp: sp.hp,
      radius: sp.radius,
      speed: sp.speed,
      damage: sp.damage,
      facing: Math.random() * Math.PI * 2,
      attackTimer: 0,
      attackAnim: 0,
      wanderTarget: initialMarchTarget ?? null,
      wanderTimer: initialMarchTarget ? 28 : Math.random() * 2,
      hitFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      isMoving: false,
      animState: variant === 'crawler' ? 'crawling' : 'wandering',
      stateTimer: 0,
      shirtColor,
      animTime: Math.random() * 2,
      steerBias: Math.random() < 0.5 ? 1 : -1,
      steerLockTimer: 0,
    });
  }

  private spawnVehicleInternal(x: number, y: number, kind: VehicleKind, angle = 0): VehicleEntity {
    const sp = VEHICLE_SPECS[kind];
    const v: VehicleEntity = {
      id: this.nextId++,
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      angle,
      length: sp.len,
      width: sp.wid,
      speed: sp.speed,
      hp: sp.hp,
      maxHp: sp.hp,
      maxOccupants: sp.cap,
      occupants: [],
      targetPos: null,
      selected: false,
      sirenOn: false,
      sirenPhase: Math.random() * Math.PI * 2,
      fireTimer: 0,
      turretAngle: angle,
      muzzleFlash: 0,
      actionTimer: 0,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    };
    this.vehicles.push(v);
    return v;
  }

  private isLocationBlocked(x: number, y: number, margin: number): boolean {
    if (Math.abs(x) > this.halfSize - margin || Math.abs(y) > this.halfSize - margin) return true;
    return this.isWaterAt(x, y, margin) || isPointBlocked(x, y, margin, this.obstacleGrid);
  }

  private isHardBlocked(x: number, y: number, margin: number): boolean {
    if (Math.abs(x) > this.halfSize - 4 || Math.abs(y) > this.halfSize - 4) return true;
    return this.isWaterAt(x, y, margin) || isPointInHardObstacle(x, y, margin, this.obstacleGrid);
  }

  private isVehiclePoseSafe(cx: number, cy: number, kind: VehicleKind, angle: number): boolean {
    const sp = VEHICLE_SPECS[kind];
    const maxHalf = Math.hypot(sp.len * 0.5, sp.wid * 0.5) + 0.85;
    if (Math.abs(cx) > this.halfSize - maxHalf || Math.abs(cy) > this.halfSize - maxHalf) return false;
    if (this.isWaterAt(cx, cy, maxHalf)) return false;
    if (isVehicleFootprintBlocked(cx, cy, sp.len, sp.wid, angle, 0.75, this.obstacleGrid)) return false;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const minSep = (v.length + sp.len) * 0.55 + 1.0;
      if (Math.hypot(v.x - cx, v.y - cy) < minSep) return false;
    }
    return true;
  }

  private findSafeVehicleSpot(
    x: number,
    y: number,
    kind: VehicleKind,
    preferredAngle = 0
  ): { x: number; y: number; angle: number } {
    const sp = VEHICLE_SPECS[kind];
    const maxHalf = Math.hypot(sp.len * 0.5, sp.wid * 0.5) + 1.5;
    const clampedY = clamp(y, -this.halfSize + maxHalf, this.halfSize - maxHalf);
    const maxLandX = this.getMaxLandX(clampedY, maxHalf + 4);
    const clampedX = clamp(x, -this.halfSize + maxHalf, Math.max(-this.halfSize + maxHalf, maxLandX));

    const angles = [preferredAngle, 0, Math.PI * 0.5];
    for (let ai = 0; ai < angles.length; ai++) {
      if (this.isVehiclePoseSafe(clampedX, clampedY, kind, angles[ai])) {
        return { x: clampedX, y: clampedY, angle: angles[ai] };
      }
    }

    for (let r = 4; r <= 220; r += 4) {
      const steps = r < 24 ? 12 : r < 72 ? 20 : 28;
      const stepA = (Math.PI * 2) / steps;
      for (let a = 0; a < Math.PI * 2; a += stepA) {
        const tx = clamp(clampedX + Math.cos(a) * r, -this.halfSize + maxHalf, this.halfSize - maxHalf);
        const ty = clamp(clampedY + Math.sin(a) * r, -this.halfSize + maxHalf, this.halfSize - maxHalf);
        for (let ai = 0; ai < angles.length; ai++) {
          if (this.isVehiclePoseSafe(tx, ty, kind, angles[ai])) {
            return { x: tx, y: ty, angle: angles[ai] };
          }
        }
      }
    }

    if (this.roadSpots.length > 0) {
      let bestSpot: RoadSpawnSpot | null = null;
      let bestDistSq = Infinity;
      for (let i = 0; i < this.roadSpots.length; i++) {
        const rs = this.roadSpots[i];
        const dSq = (rs.x - clampedX) ** 2 + (rs.y - clampedY) ** 2;
        if (dSq < bestDistSq && this.isVehiclePoseSafe(rs.x, rs.y, kind, rs.angle)) {
          bestDistSq = dSq;
          bestSpot = rs;
        }
      }
      if (bestSpot) {
        return { x: bestSpot.x, y: bestSpot.y, angle: bestSpot.angle };
      }
    }

    return { x: this.stagingCenter.x, y: this.stagingCenter.y, angle: preferredAngle };
  }

  private findNearestOpenSpot(
    x: number,
    y: number,
    margin: number,
    maxSearchRadius: number
  ): { x: number; y: number } {
    const clampedY = clamp(y, -this.halfSize + 8, this.halfSize - 8);
    const maxLandX = this.getMaxLandX(clampedY, margin + 6);
    const clampedX = clamp(x, -this.halfSize + 8, Math.max(-this.halfSize + 8, maxLandX));

    if (!this.isLocationBlocked(clampedX, clampedY, margin)) {
      return { x: clampedX, y: clampedY };
    }

    const searchMax = Math.max(maxSearchRadius, 180);
    for (let r = 3; r <= searchMax; r += 3) {
      const steps = r < 24 ? 16 : r < 72 ? 24 : 32;
      const stepA = (Math.PI * 2) / steps;
      for (let a = 0; a < Math.PI * 2; a += stepA) {
        const tx = clamp(clampedX + Math.cos(a) * r, -this.halfSize + 8, this.halfSize - 8);
        const ty = clamp(clampedY + Math.sin(a) * r, -this.halfSize + 8, this.halfSize - 8);
        if (!this.isLocationBlocked(tx, ty, margin)) {
          return { x: tx, y: ty };
        }
      }
    }

    // Exact nearest verified open-street fallback (never skip candidates, zero random post-jitter)
    if (this.roadSpots.length > 0) {
      let bestSpot: RoadSpawnSpot | null = null;
      let bestDistSq = Infinity;
      for (let i = 0; i < this.roadSpots.length; i++) {
        const rs = this.roadSpots[i];
        const dSq = (rs.x - clampedX) ** 2 + (rs.y - clampedY) ** 2;
        if (dSq < bestDistSq && !this.isLocationBlocked(rs.x, rs.y, margin)) {
          bestDistSq = dSq;
          bestSpot = rs;
        }
      }
      if (bestSpot) {
        return { x: bestSpot.x, y: bestSpot.y };
      }
    }

    return { x: this.stagingCenter.x, y: this.stagingCenter.y };
  }

  // --- Player Sandbox & Command Actions ---

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      soundEngine.stopHelicopterLoop();
      soundEngine.stopSirenLoop();
    }
  }

  public setFrozen(frozen: boolean) {
    this.frozen = frozen;
    if (frozen) {
      soundEngine.stopHelicopterLoop();
      soundEngine.stopSirenLoop();
    }
    this.emitHud();
  }

  public cycleTimeOfDay() {
    this.timeOfDay = (this.timeOfDay + 0.25) % 1;
    this.emitHud();
  }

  public stopOutbreak() {
    this.zombies = [];
    for (const c of this.civilians) {
      c.infected = false;
      c.infectionTimer = 0;
    }
    this.civiliansEvacuated += this.civilians.length;
    this.civilians = [];
    this.workerPool.clearAdvice();
    this.logEvent('info', 'Salgın durduruldu · Kalan tüm siviller güvenliğe alındı.');
    this.finishMission('victory');
  }

  public spawnZombieAt(x: number, y: number, variant: ZombieVariant) {
    if (!this.running) return;
    const spot = this.findNearestOpenSpot(x, y, 1.35, 150);
    this.spawnZombie(spot.x, spot.y, variant);
    this.zombiesSpawnedTotal += 1;
    this.spawnParticles(spot.x, spot.y, '#84cc16', 5);
    soundEngine.playInfection(spot.x, spot.y);
    this.emitHud();
  }

  public spawnCivilianAt(x: number, y: number, preset: 'random' | 'armed' | 'wounded') {
    if (!this.running) return;
    const spot = this.findNearestOpenSpot(x, y, 1.25, 150);
    this.spawnCivilianInternal(spot.x, spot.y, preset);
    this.civiliansInitial += 1;
    soundEngine.playCommand();
    this.emitHud();
  }

  public deployPoliceAt(x: number, y: number, role: PoliceRole) {
    if (!this.running) return;
    const spot = this.findNearestOpenSpot(x, y, 1.35, 150);
    this.units.push(this.createUnit('police', role, spot.x, spot.y));
    this.policeInitial += 1;
    this.policeCap = Math.max(this.policeCap, this.units.filter((u) => u.kind === 'police').length);
    soundEngine.playCommand();
    this.logEvent('info', 'Takviye polis ekibi bölgeye konuşlandırıldı.');
    this.emitHud();
  }

  public deploySoldierAt(x: number, y: number, role: SoldierRole) {
    if (!this.running) return;
    if (role === 'paratrooper') {
      this.dispatchChinookParatrooperDrop(x, y);
      return;
    }
    const spot = this.findNearestOpenSpot(x, y, 1.35, 150);
    this.units.push(this.createUnit('soldier', role, spot.x, spot.y, false));
    this.soldiersInitial += 1;
    this.soldiersCap = Math.max(this.soldiersCap, this.units.filter((u) => u.kind === 'soldier').length);
    soundEngine.playCommand();
    this.logEvent('info', 'Askerî piyade birliği bölgeye konuşlandırıldı.');
    this.emitHud();
  }

  /**
   * Dispatches a 3D-shaded CH-47 Chinook heavy transport helicopter flying across the target sector,
   * deploying 10 paratroopers in 2x5 parallel sticks.
   */
  public dispatchChinookParatrooperDrop(x: number, y: number) {
    if (!this.running) return;
    const safeDrop = this.findNearestOpenSpot(x, y, 2.0, 140);
    const tx = safeDrop.x;
    const ty = safeDrop.y;

    const flightAngle = (Math.random() - 0.5) * 0.7 - Math.PI * 0.18;
    const halfSpan = 290;
    const startX = clamp(tx - Math.cos(flightAngle) * halfSpan, -this.halfSize, this.halfSize);
    const startY = clamp(ty - Math.sin(flightAngle) * halfSpan, -this.halfSize, this.halfSize);
    const endX = clamp(tx + Math.cos(flightAngle) * halfSpan, -this.halfSize, this.halfSize);
    const endY = clamp(ty + Math.sin(flightAngle) * halfSpan, -this.halfSize, this.halfSize);

    const dropTargets: { x: number; y: number }[] = [];
    const perpX = -Math.sin(flightAngle);
    const perpY = Math.cos(flightAngle);
    const dropThresholds = [0.28, 0.39, 0.5, 0.61, 0.72];
    for (let w = 0; w < dropThresholds.length; w++) {
      const p = dropThresholds[w];
      const cx = startX + (endX - startX) * p;
      const cy = startY + (endY - startY) * p;
      const lateral = 7.5;
      dropTargets.push(this.findNearestOpenSpot(cx + perpX * lateral, cy + perpY * lateral, 1.35, 120));
      dropTargets.push(this.findNearestOpenSpot(cx - perpX * lateral, cy - perpY * lateral, 1.35, 120));
    }

    this.chinooks.push({
      id: this.nextId++,
      x: startX,
      y: startY,
      startX,
      startY,
      endX,
      endY,
      angle: Math.atan2(endY - startY, endX - startX),
      progress: -0.15,
      rotorAngle: 0,
      dropTargets,
      droppedCount: 0,
      nextDropIdx: 0,
    });

    soundEngine.playHeliDispatch();
    soundEngine.playRadioComms('lz', tx, ty);
    soundEngine.setHelicopterFlying(true);
    this.logEvent('info', 'CH-47 Chinook paraşütçü indirme kolu (10 asker) bölgeye sevk edildi.');
    this.emitHud();
  }

  public spawnVehicleAt(x: number, y: number, kind: VehicleKind) {
    if (!this.running) return;
    const spot = this.findSafeVehicleSpot(x, y, kind, 0);
    this.spawnVehicleInternal(spot.x, spot.y, kind, spot.angle);
    soundEngine.playCommand();
    this.emitHud();
  }

  /**
   * Unloads all soldiers & police currently inside selected vehicles (G key).
   */
  public unloadSelectedVehicles(): number {
    let unloaded = 0;
    for (const v of this.vehicles) {
      if (!v.selected || v.occupants.length === 0) continue;
      v.targetPos = null;
      const count = v.occupants.length;
      for (let i = 0; i < count; i++) {
        const u = v.occupants[i];
        const a = (i / Math.max(1, count)) * Math.PI * 2;
        const spot = this.findNearestOpenSpot(v.x + Math.cos(a) * 4.5, v.y + Math.sin(a) * 4.5, u.radius + 0.3, 25);
        u.inVehicleId = null;
        u.targetVehicleId = null;
        u.targetPos = null;
        u.waypoints = undefined;
        u.x = spot.x;
        u.y = spot.y;
        u.selected = true;
        unloaded++;
      }
      v.occupants = [];
    }
    if (unloaded > 0) {
      soundEngine.playCommand();
      this.emitHud();
    }
    return unloaded;
  }

  /**
   * Toggles siren lights & real audio siren on selected vehicles (H key).
   */
  public toggleSelectedSirens(): boolean {
    const selectedVehs = this.vehicles.filter((v) => v.selected);
    if (selectedVehs.length === 0) return false;
    const anyCurrentlyOn = selectedVehs.some((v) => v.sirenOn);
    const nextState = !anyCurrentlyOn;
    for (const v of selectedVehs) {
      v.sirenOn = nextState;
    }
    const anySirenGlobal = this.vehicles.some((v) => v.sirenOn);
    soundEngine.setSirenMode(this.sirenMode);
    soundEngine.setSirenActive(anySirenGlobal);
    this.emitHud();
    return true;
  }

  public setSirenMode(mode: SirenMode) {
    this.sirenMode = mode;
    soundEngine.setSirenMode(mode);
    this.emitHud();
  }

  public cycleSirenMode(): SirenMode {
    const order: SirenMode[] = ['wail', 'yelp', 'hi_lo'];
    const next = order[(order.indexOf(this.sirenMode) + 1) % order.length];
    this.setSirenMode(next);
    return next;
  }

  public hasSelectedVehicles(): boolean {
    return this.vehicles.some((v) => v.selected);
  }

  public validateBarricadeSegment(x1: number, y1: number, x2: number, y2: number): PlacementValidation {
    if (!this.running) return { valid: false, reason: 'Operasyon aktif değil' };
    if (this.barricadesBuiltCount >= this.barricadesMax) {
      return { valid: false, reason: `Barikat limiti doldu (${this.barricadesMax}/${this.barricadesMax})` };
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    const rawLen = Math.hypot(dx, dy);
    const len = rawLen < 3 ? 14 : Math.max(8, Math.min(48, rawLen));
    const angle = rawLen < 3 ? 0 : Math.atan2(dy, dx);
    const cx = rawLen < 3 ? x1 : (x1 + x2) / 2;
    const cy = rawLen < 3 ? y1 : (y1 + y2) / 2;
    const sx1 = cx - Math.cos(angle) * (len * 0.5);
    const sy1 = cy - Math.sin(angle) * (len * 0.5);
    const sx2 = cx + Math.cos(angle) * (len * 0.5);
    const sy2 = cy + Math.sin(angle) * (len * 0.5);

    if (
      Math.abs(sx1) > this.halfSize - 4 ||
      Math.abs(sy1) > this.halfSize - 4 ||
      Math.abs(sx2) > this.halfSize - 4 ||
      Math.abs(sy2) > this.halfSize - 4
    ) {
      return { valid: false, reason: 'Sektör sınırı dışına taşamaz' };
    }
    if (this.isWaterAt(cx, cy, 1.8) || this.isWaterAt(sx1, sy1, 1.5) || this.isWaterAt(sx2, sy2, 1.5)) {
      return { valid: false, reason: 'Su kütlesine temas ediyor' };
    }
    if (isSegmentBlockedByObstacles(sx1, sy1, sx2, sy2, 1.35, this.obstacleGrid)) {
      return { valid: false, reason: 'Bina veya engelle çakışıyor' };
    }
    for (const v of this.vehicles) {
      const dist = Math.hypot(v.x - cx, v.y - cy);
      if (dist < len * 0.5 + Math.max(v.length, v.width) * 0.55) {
        return { valid: false, reason: 'Araç güzergahını kapatıyor' };
      }
    }
    return { valid: true };
  }

  public validateQuarantineArea(x: number, y: number, radius = 90): PlacementValidation {
    if (!this.running) return { valid: false, reason: 'Operasyon aktif değil' };
    if (this.quarantineZones.length >= this.quarantineMax) {
      return { valid: false, reason: `Karantina limiti doldu (${this.quarantineMax}/${this.quarantineMax})` };
    }
    const r = clamp(radius, 45, 220);
    if (Math.abs(x) > this.halfSize - 18 || Math.abs(y) > this.halfSize - 18) {
      return { valid: false, reason: 'Sektör sınırı dışında kurulamaz' };
    }
    if (this.isWaterAt(x, y, 4.0) || this.isLocationBlocked(x, y, 3.0)) {
      return { valid: false, reason: 'Merkez noktası bina veya su üstünde' };
    }
    let validTowerSpots = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tx = x + Math.cos(a) * (r * 0.84);
      const ty = y + Math.sin(a) * (r * 0.84);
      if (
        Math.abs(tx) < this.halfSize - 8 &&
        Math.abs(ty) < this.halfSize - 8 &&
        !this.isWaterAt(tx, ty, 3.0) &&
        isCircleClearOfObstacles(tx, ty, 3.0, this.obstacles, undefined, undefined, this.bridges) &&
        this.vehicles.every((v) => Math.hypot(v.x - tx, v.y - ty) > 7.5)
      ) {
        validTowerSpots++;
      }
    }
    if (validTowerSpots < 2) {
      return { valid: false, reason: 'Kule ve bariyer için açık zemin yetersiz' };
    }
    return { valid: true };
  }

  public buildBarricade(x1: number, y1: number, x2: number, y2: number): PlacementValidation {
    const check = this.validateBarricadeSegment(x1, y1, x2, y2);
    if (!check.valid) {
      soundEngine.playPlacementInvalid();
      if (check.reason) this.logEvent('warn', `Barikat reddedildi: ${check.reason}.`);
      this.emitHud();
      return check;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(8, Math.min(48, Math.hypot(dx, dy) < 3 ? 14 : Math.hypot(dx, dy)));
    const angle = Math.hypot(dx, dy) < 3 ? 0 : Math.atan2(dy, dx);
    const cx = Math.hypot(dx, dy) < 3 ? x1 : (x1 + x2) / 2;
    const cy = Math.hypot(dx, dy) < 3 ? y1 : (y1 + y2) / 2;
    const id = `barricade-${this.nextId++}`;
    const bar: Barricade = {
      id,
      x: cx,
      y: cy,
      w: len,
      h: 2.2,
      angle,
      hp: 460,
      maxHp: 460,
    };
    this.barricades.push(bar);
    this.barricadesBuiltCount += 1;
    const ob = createRectObstacle(id, 'barricade', cx, cy, len, 2.2, angle);
    this.obstacles.push(ob);
    this.obstacleGrid.insert(ob);
    this.navMesh?.markDynamicBarricade(ob);
    if (this.navMesh && this.workerPool.isActive()) {
      this.workerPool.syncNavMesh(this.navMesh.exportGridData());
    }
    this.heliFlowFields.clear();
    soundEngine.playBarricadeBuild();
    this.logEvent(
      'info',
      `Sokak barikatı kuruldu (${this.barricadesMax - this.barricadesBuiltCount}/${this.barricadesMax} kaldı).`
    );
    this.emitHud();
    return { valid: true };
  }

  public createQuarantineZone(x: number, y: number, radius = 90): PlacementValidation {
    const check = this.validateQuarantineArea(x, y, radius);
    if (!check.valid) {
      soundEngine.playPlacementInvalid();
      if (check.reason) this.logEvent('warn', `Karantina reddedildi: ${check.reason}.`);
      this.emitHud();
      return check;
    }

    this.quarantineZones.push({
      id: this.nextId++,
      x,
      y,
      radius: clamp(radius, 45, 220),
      active: false,
      status: 'scanning',
      scanProgress: 0,
      towers: [],
      barriers: [],
      garrisonUnitIds: [],
    });
    soundEngine.playCommand();
    this.logEvent('info', 'Karantina bölgesi için arazi ve bina engeli taraması başlatıldı...');
    this.emitHud();
    return { valid: true };
  }

  public callA10Strike(x1: number, y1: number, x2: number, y2: number) {
    if (!this.running) return;
    let sx = x1;
    let sy = y1;
    let ex = x2;
    let ey = y2;
    const len = Math.hypot(ex - sx, ey - sy);
    if (len < 20) {
      sx = x1 - 55;
      sy = y1 - 25;
      ex = x1 + 55;
      ey = y1 + 25;
    }
    const angle = Math.atan2(ey - sy, ex - sx);
    const approachStartX = sx - Math.cos(angle) * 260;
    const approachStartY = sy - Math.sin(angle) * 260;
    this.airstrikes.push({
      id: this.nextId++,
      startX: sx,
      startY: sy,
      endX: ex,
      endY: ey,
      planeX: approachStartX,
      planeY: approachStartY,
      angle,
      progress: -0.45,
      bombedIndices: new Set<number>(),
      cannonTimer: 0,
      bombRadius: 24,
    });
    soundEngine.playA10Flyby(sx, sy);
    this.logEvent('warn', 'A-10 yakın hava desteği taarruz koridoruna giriş yapıyor.');
    this.emitHud();
  }

  public selectAt(x: number, y: number, additive: boolean) {
    if (!additive) {
      this.units.forEach((u) => {
        u.selected = false;
      });
      this.vehicles.forEach((v) => {
        v.selected = false;
      });
    }
    let bestU: Unit | null = null;
    let bestDist = 7;
    for (const u of this.units) {
      if (u.inVehicleId !== null) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestU = u;
      }
    }
    if (bestU) {
      bestU.selected = additive ? !bestU.selected : true;
      this.emitHud();
      return;
    }
    for (const v of this.vehicles) {
      if (Math.hypot(v.x - x, v.y - y) < 8.5) {
        v.selected = additive ? !v.selected : true;
        break;
      }
    }
    this.emitHud();
  }

  public selectInBox(minX: number, minY: number, maxX: number, maxY: number, additive: boolean) {
    if (!additive) {
      this.units.forEach((u) => {
        u.selected = false;
      });
      this.vehicles.forEach((v) => {
        v.selected = false;
      });
    }
    for (const u of this.units) {
      if (u.inVehicleId !== null) continue;
      if (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
        u.selected = true;
      }
    }
    for (const v of this.vehicles) {
      if (v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY) {
        v.selected = true;
      }
    }
    this.emitHud();
  }

  public selectByKind(filter: UnitKind | 'all') {
    this.vehicles.forEach((v) => {
      v.selected = false;
    });
    this.units.forEach((u) => {
      if (u.inVehicleId !== null) {
        u.selected = false;
      } else {
        u.selected = filter === 'all' ? true : u.kind === filter;
      }
    });
    this.emitHud();
  }

  public commandRightClick(x: number, y: number) {
    const selectedUnits = this.units.filter((u) => u.selected && u.inVehicleId === null);
    const selectedVehicles = this.vehicles.filter((v) => v.selected);
    if (selectedUnits.length === 0 && selectedVehicles.length === 0) return;

    // 1. Check if Police/Soldiers right-clicked a Vehicle to board it!
    if (selectedUnits.length > 0) {
      const targetVehicle = this.vehicles.find(
        (v) => Math.hypot(v.x - x, v.y - y) <= 7.5 && v.occupants.length < v.maxOccupants
      );
      if (targetVehicle) {
        for (const u of selectedUnits) {
          u.targetVehicleId = targetVehicle.id;
          const path = this.navMesh ? this.navMesh.findPath(u.x, u.y, targetVehicle.x, targetVehicle.y) : [{ x: targetVehicle.x, y: targetVehicle.y }];
          u.waypoints = path;
          u.targetPos = u.waypoints.shift() ?? { x: targetVehicle.x, y: targetVehicle.y };
          u.focusZombieId = null;
        }
        this.orderMarkers.push({
          x: targetVehicle.x,
          y: targetVehicle.y,
          color: '#38bdf8',
          life: 0.8,
          maxLife: 0.8,
        });
        soundEngine.playCommand();
        return;
      }
    }

    let clickedZombie: Zombie | null = null;
    let bestZDist = 7;
    for (const z of this.zombies) {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < bestZDist) {
        bestZDist = d;
        clickedZombie = z;
      }
    }

    const clampedX = clamp(x, -this.halfSize + 6, this.halfSize - 6);
    const clampedY = clamp(y, -this.halfSize + 6, this.halfSize - 6);

    const cols = Math.max(1, Math.ceil(Math.sqrt(selectedUnits.length)));
    selectedUnits.forEach((u, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const ox = (col - (cols - 1) / 2) * 3.8;
      const oy = (row - (Math.ceil(selectedUnits.length / cols) - 1) / 2) * 3.8;
      const spot = this.findNearestOpenSpot(clampedX + ox, clampedY + oy, u.radius + 0.35, 35);
      u.targetVehicleId = null;
      const path = this.navMesh ? this.navMesh.findPath(u.x, u.y, spot.x, spot.y) : [spot];
      u.waypoints = path;
      u.targetPos = u.waypoints.shift() ?? spot;
      u.focusZombieId = clickedZombie ? clickedZombie.id : null;
    });

    // Only vehicles with at least 1 Police or Soldier occupant can drive!
    selectedVehicles.forEach((v, idx) => {
      if (v.occupants.length === 0) return;
      const spot = this.findNearestOpenSpot(clampedX + idx * 6, clampedY, 2.8, 40);
      const path = this.navMesh ? this.navMesh.findPath(v.x, v.y, spot.x, spot.y) : [spot];
      v.waypoints = path;
      v.targetPos = v.waypoints.shift() ?? spot;
    });

    this.orderMarkers.push({
      x: clampedX,
      y: clampedY,
      color: clickedZombie ? '#ef4444' : '#34d399',
      life: 0.8,
      maxLife: 0.8,
    });
    soundEngine.playCommand();
  }

  public callHelicopterAt(
    x: number,
    y: number,
    mode: 'evac' | 'gunship' = 'evac'
  ): { ok: boolean; reason?: string } {
    if (!this.running || this.paused) return { ok: false, reason: 'Oyun aktif değil.' };
    if (mode === 'evac' && this.helicoptersRemaining <= 0) {
      return { ok: false, reason: 'Kullanılabilir tahliye helikopteri kalmadı.' };
    }
    if (Math.abs(x) > this.halfSize - 8 || Math.abs(y) > this.halfSize - 8) {
      return { ok: false, reason: 'Sektör sınırları dışında iniş yapılamaz.' };
    }
    if (mode === 'evac' && this.isLocationBlocked(x, y, 4.5)) {
      return { ok: false, reason: 'Bu noktada su, bina, ağaç veya araç var; açık bir cadde/meydan seçin.' };
    }

    if (mode === 'evac') {
      this.helicoptersRemaining -= 1;
    }

    const entryDist = Math.min(this.halfSize, 520);
    const angle = Math.atan2(y, x) + (Math.random() - 0.5) * 0.6;
    const entryX = clamp(x + Math.cos(angle) * entryDist, -this.halfSize, this.halfSize);
    const entryY = clamp(y + Math.sin(angle) * entryDist, -this.halfSize, this.halfSize);

    this.helicopters.push({
      id: this.nextId++,
      x: entryX,
      y: entryY,
      targetX: x,
      targetY: y,
      entryX,
      entryY,
      facing: Math.atan2(y - entryY, x - entryX),
      state: 'inbound',
      stateTimer: 0,
      altitude: 1,
      rotorAngle: 0,
      passengers: 0,
      maxCapacity: 30,
      evacRadius: 100,
      mode,
      fireTimer: 0,
      spotlightAngle: 0,
    });

    soundEngine.playHeliDispatch();
    soundEngine.playRadioComms('lz', x, y);
    soundEngine.setHelicopterFlying(true);
    this.logEvent(
      'info',
      mode === 'gunship'
        ? 'Silahlı destek helikopteri devriye bölgesine yönlendirildi.'
        : 'Tahliye helikopteri iniş noktasına (LZ) çağrıldı.'
    );
    this.emitHud();
    return { ok: true };
  }

  public launchHelicopter(heliId: number) {
    const h = this.helicopters.find((item) => item.id === heliId);
    if (!h || h.state !== 'landed') return;
    h.state = 'ascending';
    h.stateTimer = 2.2;
    soundEngine.playHeliDispatch();
    soundEngine.setHelicopterFlying(true);
    this.emitHud();
  }

  // --- Core Simulation Loop ---

  public update(rawDt: number) {
    this.elapsedVisual += Math.min(rawDt, 0.05);
    if (!this.running || this.paused || this.frozen) return;

    const dt = Math.min(rawDt, 0.05);
    this.missionTimeSec += dt;
    this.frameTick++;
    // Realistic 60-minute cycle: 30 minutes Day + 30 minutes Night (3600s full cycle)
    this.timeOfDay = (this.timeOfDay + dt / 3600) % 1;

    if (this.reinforceCooldown > 0) {
      this.reinforceCooldown = Math.max(0, this.reinforceCooldown - dt);
    }
    if (this.contactAlertCooldown > 0) {
      this.contactAlertCooldown = Math.max(0, this.contactAlertCooldown - dt);
    }
    if (this.evacLogCooldown > 0) {
      this.evacLogCooldown = Math.max(0, this.evacLogCooldown - dt);
    }
    if (this.siegeAlertCooldown > 0) {
      this.siegeAlertCooldown = Math.max(0, this.siegeAlertCooldown - dt);
    }

    // Rebuild O(1) spatial hash indices once per frame for up to 15,000 active agents
    this.zombieHash.rebuild(this.zombies);
    this.civilianHash.rebuild(this.civilians);
    this.unitHash.rebuild(this.units);

    // Dispatch parallel Web Worker batch for flocking & hierarchical NavMesh pathing
    if (this.workerPool.isActive() && this.zombies.length > 0 && this.frameTick % 4 === 0) {
      this.dispatchZombieWorkerBatch();
    }

    this.updateHelicopters(dt);
    this.updateChinooks(dt);
    this.updateQuarantineZones(dt);
    this.updateA10Strikes(dt);
    this.updateVehicles(dt);
    this.updateUnits(dt);
    this.updateCivilians(dt);
    this.updateZombies(dt);
    this.updateEffects(dt);

    // Periodic strategic hotspot alert when large zombie swarm gathers
    if (this.siegeAlertCooldown <= 0 && this.zombies.length >= 24) {
      this.siegeAlertCooldown = 28;
      const sample = this.zombies[Math.floor(Math.random() * this.zombies.length)];
      const cluster = this.zombieHash.queryRadiusScratch(sample.x, sample.y, 65, this.zombieNeighborsScratch);
      if (cluster.length >= 16) {
        this.outbreakCenter = { x: sample.x, y: sample.y };
        soundEngine.playRadioComms('siege', sample.x, sample.y);
        this.logEvent('warn', `Yoğun zombi akın merkezi tespit edildi (${cluster.length}+ hedef).`);
      }
    }

    const activeEvacHelis = this.helicopters.filter(
      (h) => h.mode === 'evac' && (h.state === 'inbound' || h.state === 'descending' || h.state === 'landed')
    );

    if (this.civilians.length === 0 && activeEvacHelis.length === 0 && this.civiliansInitial > 0) {
      if (this.civiliansEvacuated > 0) {
        this.finishMission('victory');
        return;
      } else if (this.units.length === 0 && this.helicoptersRemaining === 0) {
        this.finishMission('defeat');
        return;
      }
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.14) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private dispatchZombieWorkerBatch() {
    const count = this.zombies.length;
    if (count === 0) return;
    const zPos = new Float32Array(count * 4);
    const zTargets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const z = this.zombies[i];
      const pBase = i * 4;
      zPos[pBase] = z.id;
      zPos[pBase + 1] = z.x;
      zPos[pBase + 2] = z.y;
      zPos[pBase + 3] = z.facing;

      const tBase = i * 3;
      if (z.wanderTarget) {
        zTargets[tBase] = z.wanderTarget.x;
        zTargets[tBase + 1] = z.wanderTarget.y;
        zTargets[tBase + 2] = 1;
      } else {
        zTargets[tBase] = this.outbreakCenter.x;
        zTargets[tBase + 1] = this.outbreakCenter.y;
        zTargets[tBase + 2] = 0;
      }
    }
    this.workerPool.setDispatchTick(this.frameTick);
    this.workerPool.dispatchBatch(this.frameTick, zPos, zTargets, count);
  }

  private finishMission(outcome: 'victory' | 'defeat') {
    this.running = false;
    this.outcome = outcome;
    this.workerPool.clearAdvice();
    soundEngine.stopHelicopterLoop();
    soundEngine.stopSirenLoop();
    if (outcome === 'victory') {
      soundEngine.playVictory();
      this.logEvent('success', 'Tahliye operasyonu başarıyla tamamlandı!');
    } else {
      soundEngine.playDefeat();
      this.logEvent('alert', 'Sektör savunması çöktü · Operasyon başarısız.');
    }
    const snap = this.getHudSnapshot();
    this.callbacks.onHudUpdate(snap);
    this.callbacks.onMissionEnd(snap);
  }

  private updateHelicopters(dt: number) {
    let anyFlying = false;

    for (let i = this.helicopters.length - 1; i >= 0; i--) {
      const h = this.helicopters[i];

      if (h.state === 'landed') {
        h.rotorAngle += dt * 3.2;
        if (h.passengers >= h.maxCapacity) {
          h.stateTimer += dt;
          if (h.stateTimer >= 0.9) {
            h.state = 'ascending';
            h.stateTimer = 2.2;
          }
        }
        continue;
      }

      anyFlying = true;
      h.rotorAngle += dt * 26;

      if (h.state === 'inbound') {
        const dx = h.targetX - h.x;
        const dy = h.targetY - h.y;
        const dist = Math.hypot(dx, dy);
        const speed = dist < 45 ? Math.max(14, dist * 0.8) : 45;
        if (dist <= 3.0) {
          h.x = h.targetX;
          h.y = h.targetY;
          h.state = 'descending';
          h.stateTimer = h.mode === 'gunship' ? 20 : 2.5;
          if (h.mode === 'evac' && this.navMesh && !this.heliFlowFields.has(h.id)) {
            this.heliFlowFields.set(h.id, this.navMesh.buildFlowField(h.targetX, h.targetY, h.evacRadius + 40));
          }
        } else {
          h.facing = Math.atan2(dy, dx);
          h.x += (dx / dist) * speed * dt;
          h.y += (dy / dist) * speed * dt;
        }
      } else if (h.state === 'descending') {
        if (h.mode === 'gunship') {
          h.stateTimer -= dt;
          h.altitude = 0.55;
          h.facing += dt * 0.7;
          h.fireTimer -= dt;
          if (h.fireTimer <= 0) {
            const hit = this.zombieHash.findNearest(h.x, h.y, 130);
            if (hit) {
              h.fireTimer = 0.22;
              this.spawnGunfireEffects(h.x, h.y, Math.atan2(hit.item.y - h.y, hit.item.x - h.x), 'heavy', hit.item.x, hit.item.y);
              this.damageZombie(hit.item, 34, h.x, h.y);
              soundEngine.playRealisticShot('heavy', h.x, h.y);
            }
          }
          if (h.stateTimer <= 0) {
            h.state = 'ascending';
            h.stateTimer = 1.6;
          }
        } else {
          h.stateTimer -= dt;
          h.altitude = Math.max(0, h.stateTimer / 2.5);
          if (h.stateTimer <= 0) {
            h.state = 'landed';
            h.altitude = 0;
            h.stateTimer = 0;
            if (this.navMesh && !this.heliFlowFields.has(h.id)) {
              this.heliFlowFields.set(h.id, this.navMesh.buildFlowField(h.targetX, h.targetY, h.evacRadius + 40));
            }
            this.logEvent('info', `Tahliye helikopteri #${h.id} iniş yaptı · Sivil alımı aktif.`);
            this.emitHud();
          }
        }
      } else if (h.state === 'ascending') {
        this.heliFlowFields.delete(h.id);
        h.stateTimer -= dt;
        h.altitude = Math.min(1, 1 - h.stateTimer / 2.2);
        const exitX = h.entryX ?? Math.cos(h.facing) * (this.halfSize * 0.9);
        const exitY = h.entryY ?? Math.sin(h.facing) * (this.halfSize * 0.9);
        if (h.stateTimer <= 0) {
          h.state = 'outbound';
          h.facing = Math.atan2(exitY - h.y, exitX - h.x);
        }
      } else if (h.state === 'outbound') {
        const exitX = h.entryX ?? Math.cos(h.facing) * (this.halfSize * 0.9);
        const exitY = h.entryY ?? Math.sin(h.facing) * (this.halfSize * 0.9);
        const dx = exitX - h.x;
        const dy = exitY - h.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 10) {
          this.heliFlowFields.delete(h.id);
          this.helicopters.splice(i, 1);
          this.emitHud();
        } else {
          h.facing = Math.atan2(dy, dx);
          h.x += (dx / dist) * 48 * dt;
          h.y += (dy / dist) * 48 * dt;
        }
      }
    }

    soundEngine.setHelicopterFlying(anyFlying || this.chinooks.length > 0);
  }

  /**
   * Moves CH-47 Chinook heavy transports across their corridor, dropping 10 paratroopers
   * in 5 parallel pairs (2x5 staggered stick formation).
   */
  private updateChinooks(dt: number) {
    const dropThresholds = [0.28, 0.39, 0.5, 0.61, 0.72];

    for (let i = this.chinooks.length - 1; i >= 0; i--) {
      const ch = this.chinooks[i];
      const runLen = Math.max(120, Math.hypot(ch.endX - ch.startX, ch.endY - ch.startY));
      ch.progress += (62 / runLen) * dt;
      ch.x = ch.startX + (ch.endX - ch.startX) * ch.progress;
      ch.y = ch.startY + (ch.endY - ch.startY) * ch.progress;
      ch.rotorAngle += dt * 32;

      while (
        ch.nextDropIdx < dropThresholds.length &&
        ch.progress >= dropThresholds[ch.nextDropIdx]
      ) {
        const idxA = ch.nextDropIdx * 2;
        const idxB = idxA + 1;
        const spotA = ch.dropTargets[idxA] ?? this.findNearestOpenSpot(ch.x, ch.y, 1.35, 100);
        const spotB = ch.dropTargets[idxB] ?? this.findNearestOpenSpot(ch.x, ch.y, 1.35, 100);
        this.units.push(this.createUnit('soldier', 'paratrooper', spotA.x, spotA.y, true));
        this.units.push(this.createUnit('soldier', 'paratrooper', spotB.x, spotB.y, true));
        this.soldiersInitial += 2;
        ch.droppedCount += 2;
        ch.nextDropIdx++;
        this.soldiersCap = Math.max(
          this.soldiersCap,
          this.units.filter((u) => u.kind === 'soldier').length
        );
        soundEngine.playParachuteDrop(ch.x, ch.y);
      }

      if (ch.progress > 1.25) {
        this.chinooks.splice(i, 1);
      }
    }

    if (this.chinooks.length > 0) {
      soundEngine.setHelicopterFlying(true);
    }
  }

  private updateA10Strikes(dt: number) {
    for (let i = this.airstrikes.length - 1; i >= 0; i--) {
      const s = this.airstrikes[i];
      const runLen = Math.max(40, Math.hypot(s.endX - s.startX, s.endY - s.startY));
      const progressSpeed = 140 / runLen;
      s.progress += progressSpeed * dt;
      s.planeX = s.startX + (s.endX - s.startX) * s.progress;
      s.planeY = s.startY + (s.endY - s.startY) * s.progress;

      if (s.progress >= -0.08 && s.progress <= 1.0) {
        s.cannonTimer -= dt;
        if (s.cannonTimer <= 0) {
          s.cannonTimer = 0.08;
          if (s.bombedIndices.size === 0) {
            soundEngine.playGau8Burst(s.planeX, s.planeY);
          }
          const gx = s.planeX + Math.cos(s.angle) * 35 + (Math.random() - 0.5) * 14;
          const gy = s.planeY + Math.sin(s.angle) * 35 + (Math.random() - 0.5) * 14;
          this.muzzleFlashes.push({
            x: s.planeX + Math.cos(s.angle) * 11,
            y: s.planeY + Math.sin(s.angle) * 11,
            angle: s.angle,
            weapon: 'heavy',
            life: 0.075,
            maxLife: 0.075,
          });
          this.impactSparks.push({
            x: gx,
            y: gy,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.5) * 14,
            size: 1.9,
            color: '#fef08a',
            life: 0.16,
            maxLife: 0.16,
          });
          this.spawnParticles(gx, gy, '#f97316', 5);
        }
      }

      const bombThresholds = [0.15, 0.4, 0.65, 0.9];
      for (let bIdx = 0; bIdx < bombThresholds.length; bIdx++) {
        if (s.progress >= bombThresholds[bIdx] && !s.bombedIndices.has(bIdx)) {
          s.bombedIndices.add(bIdx);
          const bx = s.startX + (s.endX - s.startX) * bombThresholds[bIdx] + (Math.random() - 0.5) * 10;
          const by = s.startY + (s.endY - s.startY) * bombThresholds[bIdx] + (Math.random() - 0.5) * 10;
          this.detonateBomb(bx, by, s.bombRadius);
        }
      }

      if (s.progress > 1.55) {
        this.airstrikes.splice(i, 1);
      }
    }
  }

  /**
   * Bombardment damages ALL entities (zombies, civilians, police, soldiers, vehicles).
   * Spawns After-Effects-style Volumetric Explosion -> Fireball -> Smoke -> 3D Crater sequence.
   */
  private detonateBomb(x: number, y: number, radius: number) {
    soundEngine.playExplosion(x, y);

    this.craters.push({
      id: this.nextId++,
      x,
      y,
      radius: radius * 0.62,
      seed: Math.random() * Math.PI * 2,
      variant: Math.floor(Math.random() * 4),
      smokeTimer: 8.5,
    });
    if (this.craters.length > 90) this.craters.shift();

    this.explosions.push({
      id: this.nextId++,
      x,
      y,
      radius,
      age: 0,
      duration: 2.35,
      seed: Math.random() * 20,
      rotation: Math.random() * Math.PI * 2,
    });

    this.fires.push({
      id: this.nextId++,
      x,
      y,
      radius: radius * 0.44,
      intensity: 1,
      life: 28,
      maxLife: 28,
      seed: Math.random() * 25,
    });
    if (this.fires.length > 60) this.fires.shift();

    this.shockwaves.push({
      x,
      y,
      radius: 2,
      maxRadius: radius * 1.55,
      life: 0.42,
      maxLife: 0.42,
      color: '#fde047',
    });
    this.spawnParticles(x, y, '#f97316', 18);
    this.spawnParticles(x, y, '#fef08a', 10);

    const blastReach = radius * 1.35;

    // 1. Damage Zombies (via spatial hash)
    const nearbyZ = this.zombieHash.queryRadius(x, y, blastReach + 4);
    for (let i = 0; i < nearbyZ.length; i++) {
      const z = nearbyZ[i];
      const d = Math.hypot(z.x - x, z.y - y);
      if (d <= blastReach) {
        this.damageZombie(z, 340 * (1 - d / (radius * 1.5)), x, y);
      }
    }

    // 2. Damage Civilians (no immunity!)
    const nearbyC = this.civilianHash.queryRadius(x, y, blastReach + 4);
    for (let i = 0; i < nearbyC.length; i++) {
      const c = nearbyC[i];
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= blastReach) {
        const dmg = 160 * (1 - d / (radius * 1.5));
        c.hp -= dmg;
        c.hitFlash = 0.2;
        const a = Math.atan2(c.y - y, c.x - x);
        this.spawnBloodParticles(c.x, c.y, a, '#b91c1c', 4);
        if (c.hp <= 0) {
          const idx = this.civilians.indexOf(c);
          if (idx !== -1) {
            this.civilians.splice(idx, 1);
            this.civiliansLost += 1;
            soundEngine.playDeathScream(c.gender, c.x, c.y);
            this.addBloodStain(c.x, c.y, 1.3, a, false);
            this.addCorpse(c.x, c.y, a, 'civilian', 'civ_male', c.shirtColor);
          }
        }
      }
    }

    // 3. Damage Police & Soldiers (no immunity!)
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.inVehicleId !== null || u.parachuteAlt > 0.35) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d <= blastReach) {
        const dmg = 210 * (1 - d / (radius * 1.5));
        u.hp -= dmg;
        u.hitFlash = 0.2;
        const a = Math.atan2(u.y - y, u.x - x);
        this.spawnBloodParticles(u.x, u.y, a, '#b91c1c', 4);
        if (u.hp <= 0) {
          if (u.kind === 'police') this.policeLosses += 1;
          else this.soldierLosses += 1;
          soundEngine.playDeathScream(u.gender ?? (u.id % 2 === 0 ? 'male' : 'female'), u.x, u.y);
          this.addBloodStain(u.x, u.y, 1.35, a, false);
          this.addCorpse(u.x, u.y, a, u.kind, `${u.kind}_${u.role}`, '#1e293b');
          this.units.splice(i, 1);
        }
      }
    }

    // 4. Damage Vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const d = Math.hypot(v.x - x, v.y - y);
      if (d <= blastReach) {
        v.hp -= 260 * (1 - d / (radius * 1.5));
        if (v.hp <= 0) {
          for (const occ of v.occupants) {
            if (occ.kind === 'police') this.policeLosses += 1;
            else this.soldierLosses += 1;
            const uIdx = this.units.indexOf(occ);
            if (uIdx !== -1) this.units.splice(uIdx, 1);
          }
          this.vehicles.splice(i, 1);
        }
      }
    }
  }

  private updateVehicles(dt: number) {
    let anySirenOn = false;
    let nearestSirenDist = Infinity;
    let nearestSirenX = 0;
    let nearestSirenY = 0;
    const listener = soundEngine.getListenerPosition();

    for (const v of this.vehicles) {
      if (v.muzzleFlash > 0) v.muzzleFlash = Math.max(0, v.muzzleFlash - dt);
      if (v.fireTimer > 0) v.fireTimer = Math.max(0, v.fireTimer - dt);

      if (v.sirenOn) {
        anySirenOn = true;
        const dSiren = Math.hypot(v.x - listener.x, v.y - listener.y);
        if (dSiren < nearestSirenDist) {
          nearestSirenDist = dSiren;
          nearestSirenX = v.x;
          nearestSirenY = v.y;
        }
      }

      // Keep manned vehicle occupants synced with vehicle coordinates
      for (const occ of v.occupants) {
        occ.x = v.x;
        occ.y = v.y;
      }

      // IMPORTANT: Empty vehicles CANNOT move or drive on their own!
      if (v.occupants.length === 0) {
        v.targetPos = null;
        continue;
      }

      if (v.targetPos) {
        const dx = v.targetPos.x - v.x;
        const dy = v.targetPos.y - v.y;
        const dist = Math.hypot(dx, dy);
        const reachDist = v.waypoints && v.waypoints.length > 0 ? 4.0 : 2.5;
        if (dist <= reachDist) {
          if (v.waypoints && v.waypoints.length > 0) {
            v.targetPos = v.waypoints.shift()!;
          } else {
            v.targetPos = null;
          }
        } else {
          const prevVx = v.x;
          const prevVy = v.y;
          const moved = this.moveEntityWithSteering(v.x, v.y, 2.4, v.targetPos.x, v.targetPos.y, v.speed * dt);
          if (
            !this.isWaterAt(moved.x, moved.y, Math.max(v.length, v.width) * 0.45) &&
            !isVehicleFootprintBlocked(moved.x, moved.y, v.length, v.width, moved.facing, 0.25, this.obstacleGrid)
          ) {
            v.x = moved.x;
            v.y = moved.y;
            v.angle = moved.facing;
          } else {
            v.x = prevVx;
            v.y = prevVy;
            v.targetPos = null;
            v.waypoints = undefined;
          }
        }
      }

      // Manned support abilities
      if (v.kind === 'ambulance') {
        v.actionTimer -= dt;
        if (v.actionTimer <= 0) {
          v.actionTimer = 0.8;
          const nearCivs = this.civilianHash.queryRadiusScratch(v.x, v.y, 24, this.civNeighborsScratch);
          for (let ci = 0; ci < nearCivs.length; ci++) {
            const c = nearCivs[ci];
            if (Math.hypot(c.x - v.x, c.y - v.y) <= 22 && (c.wounded || c.infected || c.hp < c.maxHp)) {
              c.hp = c.maxHp;
              c.wounded = false;
              c.infected = false;
              c.infectionStage = undefined;
              c.infectionStageDuration = undefined;
              c.infectionTimer = 0;
              c.vomitCooldown = 0;
              if (c.state === 'fallen') c.state = 'wandering';
              this.spawnParticles(c.x, c.y, '#34d399', 4);
            }
          }
          const nearUnits = this.unitHash.queryRadiusScratch(v.x, v.y, 24, this.unitNeighborsScratch);
          for (let ui = 0; ui < nearUnits.length; ui++) {
            const u = nearUnits[ui];
            if (u.inVehicleId === null && Math.hypot(u.x - v.x, u.y - v.y) <= 22 && (u.infected || u.hp < u.maxHp)) {
              u.hp = Math.min(u.maxHp, u.hp + 25);
              u.infected = false;
              u.infectionStage = undefined;
              u.infectionStageDuration = undefined;
              u.infectionTimer = 0;
              u.vomitCooldown = 0;
              this.spawnParticles(u.x, u.y, '#34d399', 4);
            }
          }
        }
      } else if (v.kind === 'fire_truck') {
        for (let fi = this.fires.length - 1; fi >= 0; fi--) {
          const fire = this.fires[fi];
          const d = Math.hypot(fire.x - v.x, fire.y - v.y);
          if (d <= 48) {
            fire.intensity -= dt * 0.35;
            this.tracers.push({
              x1: v.x,
              y1: v.y,
              x2: fire.x,
              y2: fire.y,
              color: '#38bdf8',
              life: 0.1,
              maxLife: 0.1,
              width: 3.5,
            });
            if (fire.intensity <= 0.1) {
              this.fires.splice(fi, 1);
            }
            break;
          }
        }
      } else if (v.kind === 'armored_apc' || v.kind === 'police_car' || v.kind === 'military_jeep') {
        const range = v.kind === 'armored_apc' ? 110 : 62;
        const hit = this.zombieHash.findNearest(
          v.x,
          v.y,
          range,
          (z) => hasBuildingLineOfSight(v.x, v.y, z.x, z.y, this.obstacleGrid)
        );
        if (hit) {
          const target = hit.item;
          v.turretAngle = Math.atan2(target.y - v.y, target.x - v.x);
          if (v.fireTimer <= 0) {
            const weapon: WeaponClass = v.kind === 'armored_apc' ? 'heavy' : 'rifle';
            v.fireTimer = v.kind === 'armored_apc' ? 0.25 : 0.42;
            v.muzzleFlash = 0.09;
            this.spawnGunfireEffects(v.x, v.y, v.turretAngle, weapon, target.x, target.y, v.length * 0.48);
            this.damageZombie(target, v.kind === 'armored_apc' ? 40 : 22, v.x, v.y);
            soundEngine.playRealisticShot(weapon, v.x, v.y);
          }
        }
      }
    }
    soundEngine.setSirenActive(anySirenOn);
    if (anySirenOn) {
      soundEngine.updateSirenSpatial(nearestSirenX, nearestSirenY);
    }
  }

  private updateUnits(dt: number) {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.inVehicleId !== null) {
        u.occluded = false;
        continue;
      }

      if (u.hitFlash > 0) u.hitFlash = Math.max(0, u.hitFlash - dt);
      if (u.muzzleFlash > 0) u.muzzleFlash = Math.max(0, u.muzzleFlash - dt);
      if (u.shootAnim > 0) u.shootAnim = Math.max(0, u.shootAnim - dt);
      if (u.fireTimer > 0) u.fireTimer = Math.max(0, u.fireTimer - dt);
      u.animTime += dt;

      if (u.infected) {
        const stage = u.infectionStage ?? 'vomiting';
        u.infectionTimer = Math.max(0, (u.infectionTimer ?? 0) - dt);

        if (stage === 'latent') {
          if (u.infectionTimer <= 0) {
            const vomitDur = 3.2 + Math.random() * 1.1;
            u.infectionStage = 'vomiting';
            u.infectionStageDuration = vomitDur;
            u.infectionDuration = vomitDur;
            u.infectionTimer = vomitDur;
            u.vomitCooldown = 0.03;
            u.exhausted = true;
          }
        } else if (stage === 'vomiting') {
          u.vomitCooldown = (u.vomitCooldown ?? 0.08) - dt;
          if (u.vomitCooldown <= 0) {
            u.vomitCooldown = 0.44 + Math.random() * 0.28;
            soundEngine.playBloodVomit(u.x, u.y);
            const vx = u.x + Math.cos(u.facing) * 0.72;
            const vy = u.y + Math.sin(u.facing) * 0.72;
            this.spawnBloodParticles(vx, vy, u.facing, '#dc2626', 6);
            this.addBloodStain(
              u.x + Math.cos(u.facing) * 1.15,
              u.y + Math.sin(u.facing) * 1.15,
              0.55 + Math.random() * 0.4,
              u.facing,
              false
            );
          }
          if (u.infectionTimer <= 0) {
            const dieDur = 0.95 + Math.random() * 0.2;
            u.infectionStage = 'dying';
            u.infectionStageDuration = dieDur;
            u.infectionDuration = dieDur;
            u.infectionTimer = dieDur;
            u.targetPos = null;
            u.waypoints = undefined;
            u.isMoving = false;
            soundEngine.playDeathScream(u.gender ?? (u.id % 2 === 0 ? 'male' : 'female'), u.x, u.y);
          }
        } else {
          // Stage 4: 'dying' -> immobility collapse followed by fresh_infected resurrection
          u.targetPos = null;
          u.isMoving = false;
          u.occluded = isEntityVisuallyOccludedAtCamera(
            u.x,
            u.y,
            this.cameraTiltDeg,
            this.obstacleGrid,
            this.occlusionZones
          );
          if (u.infectionTimer <= 0) {
            this.units.splice(i, 1);
            if (u.kind === 'police') this.policeLosses += 1;
            else this.soldierLosses += 1;
            const zSpot = this.findNearestOpenSpot(u.x, u.y, 1.1, 20);
            this.spawnZombie(zSpot.x, zSpot.y, 'fresh_infected', u.kind === 'soldier' ? '#15803d' : '#1d4ed8');
            this.zombiesSpawnedTotal += 1;
            this.addBloodStain(zSpot.x, zSpot.y, 1.35, u.facing, true);
            soundEngine.playInfection(zSpot.x, zSpot.y);
            soundEngine.playRadioComms('casualty', zSpot.x, zSpot.y);
            this.logEvent(
              'alert',
              u.kind === 'soldier'
                ? 'Enfekte asker kan kusup yere yığıldıktan sonra zombiye dönüştü!'
                : 'Enfekte polis kan kusup yere yığıldıktan sonra zombiye dönüştü!'
            );
          }
          continue;
        }
      }

      if (u.parachuteAlt > 0) {
        u.animState = 'parachuting';
        u.occluded = false;
        u.parachuteSway += dt * 3.5;
        u.parachuteAlt = Math.max(0, u.parachuteAlt - dt * 0.32);
        if (u.parachuteAlt <= 0) {
          u.animState = 'idle';
          this.spawnParticles(u.x, u.y, '#cbd5e1', 5);
        }
        continue;
      }

      // Check vehicle boarding target
      if (u.targetVehicleId !== null) {
        const veh = this.vehicles.find((v) => v.id === u.targetVehicleId);
        if (!veh || veh.occupants.length >= veh.maxOccupants) {
          u.targetVehicleId = null;
          u.targetPos = null;
          u.waypoints = undefined;
        } else {
          if (!u.targetPos) {
            u.targetPos = { x: veh.x, y: veh.y };
          }
          if (Math.hypot(veh.x - u.x, veh.y - u.y) <= 5.5) {
            u.inVehicleId = veh.id;
            u.targetVehicleId = null;
            u.targetPos = null;
            u.waypoints = undefined;
            u.selected = false;
            veh.occupants.push(u);
            veh.selected = true;
            soundEngine.playBoarded(veh.x, veh.y);
            this.emitHud();
            continue;
          }
        }
      }

      if (u.reloadTimer > 0) {
        u.reloadTimer = Math.max(0, u.reloadTimer - dt);
        u.animState = 'reloading';
        if (u.reloadTimer <= 0) {
          u.ammo = u.maxAmmo;
          u.animState = 'idle';
        }
      }

      if (u.role === 'medic' && u.fireTimer <= 0) {
        const woundedHit = this.civilianHash.findNearest(
          u.x,
          u.y,
          18,
          (c) => c.wounded || c.infected || c.hp < c.maxHp
        );
        if (woundedHit) {
          const woundedCiv = woundedHit.item;
          woundedCiv.hp = woundedCiv.maxHp;
          woundedCiv.wounded = false;
          woundedCiv.infected = false;
          woundedCiv.infectionStage = undefined;
          woundedCiv.infectionStageDuration = undefined;
          woundedCiv.infectionTimer = 0;
          woundedCiv.vomitCooldown = 0;
          if (woundedCiv.state === 'fallen') woundedCiv.state = 'wandering';
          u.fireTimer = 0.9;
          this.tracers.push({ x1: u.x, y1: u.y, x2: woundedCiv.x, y2: woundedCiv.y, color: '#34d399', life: 0.25, maxLife: 0.25 });
        } else {
          const hurtHit = this.unitHash.findNearest(
            u.x,
            u.y,
            18,
            (o) => o !== u && o.inVehicleId === null && (o.infected || o.hp < o.maxHp)
          );
          if (hurtHit) {
            const hurtUnit = hurtHit.item;
            hurtUnit.hp = Math.min(hurtUnit.maxHp, hurtUnit.hp + 20);
            hurtUnit.infected = false;
            hurtUnit.infectionStage = undefined;
            hurtUnit.infectionStageDuration = undefined;
            hurtUnit.infectionTimer = 0;
            hurtUnit.vomitCooldown = 0;
            u.fireTimer = 0.9;
            this.tracers.push({ x1: u.x, y1: u.y, x2: hurtUnit.x, y2: hurtUnit.y, color: '#34d399', life: 0.25, maxLife: 0.25 });
          }
        }
      }

      const prevUx = u.x;
      const prevUy = u.y;
      u.isMoving = false;
      if (u.targetPos) {
        const dx = u.targetPos.x - u.x;
        const dy = u.targetPos.y - u.y;
        const dist = Math.hypot(dx, dy);
        const reachThreshold = u.waypoints && u.waypoints.length > 0 ? 2.4 : 1.2;
        if (dist <= reachThreshold) {
          if (u.waypoints && u.waypoints.length > 0) {
            u.targetPos = u.waypoints.shift()!;
          } else {
            u.targetPos = null;
          }
        } else {
          // Stamina-aware tactical pace (vomiting victims stagger at 0.25x pace)
          const infSpeedMult = u.infected && u.infectionStage === 'vomiting' ? 0.25 : 1.0;
          const sprintMult =
            (u.exhausted ? (u.kind === 'police' ? 0.62 : 0.58) : u.kind === 'police' ? 1.12 : 1.0) *
            infSpeedMult;
          const moved = this.moveEntityWithSteering(
            u.x,
            u.y,
            u.radius,
            u.targetPos.x,
            u.targetPos.y,
            u.speed * sprintMult * dt,
            false,
            u,
            dt
          );
          const actualStep = Math.hypot(moved.x - u.x, moved.y - u.y);
          u.x = moved.x;
          u.y = moved.y;
          u.facing = moved.facing;
          if (actualStep > 0.01) {
            u.isMoving = true;
            const drain =
              u.kind === 'police'
                ? 9.0
                : u.role === 'heavy' || u.role === 'sniper'
                  ? 17.0
                  : 14.5;
            u.stamina = Math.max(0, u.stamina - drain * dt);
            if (u.stamina <= 0) u.exhausted = true;
            u.walkPhase += dt * (u.kind === 'police' ? 12 : 9.5) * (u.exhausted ? 0.68 : 1);
            if (u.reloadTimer <= 0) u.animState = !u.exhausted && u.speed > 3.6 ? 'running' : 'walking';
          }
        }
      }
      if (!u.isMoving) {
        const recov = u.kind === 'police' ? 15.0 : 11.0;
        u.stamina = Math.min(u.maxStamina, u.stamina + recov * dt);
        if (u.exhausted && u.stamina >= 28) u.exhausted = false;
      }

      // Soft unit-unit separation via SpatialHash so units never stack or lag O(N^2)
      const nearUnits = this.unitHash.queryRadiusScratch(u.x, u.y, 4, this.unitNeighborsScratch);
      for (let j = 0; j < nearUnits.length && j < 8; j++) {
        const o = nearUnits[j];
        if (o === u || o.inVehicleId !== null || o.parachuteAlt > 0) continue;
        const dx = u.x - o.x;
        const dy = u.y - o.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minD = u.radius + o.radius + 0.35;
        if (d < minD) {
          const push = (minD - d) * 0.45;
          u.x += (dx / d) * push;
          u.y += (dy / d) * push;
        }
      }
      const safe = resolveCircleObstacles(u.x, u.y, u.radius, this.obstacleGrid);
      u.x = safe.x;
      u.y = safe.y;
      u.inCover = safe.collided;
      if (this.isHardBlocked(u.x, u.y, u.radius * 0.78)) {
        if (!this.isHardBlocked(prevUx, prevUy, u.radius * 0.72)) {
          u.x = prevUx;
          u.y = prevUy;
        } else {
          const esc = this.findNearestOpenSpot(u.x, u.y, u.radius + 0.4, 150);
          u.x = esc.x;
          u.y = esc.y;
        }
      }
      u.inCoverGlow = u.inCover || isNearCoverOrTree(u.x, u.y, this.obstacleGrid);
      u.occluded = isEntityVisuallyOccludedAtCamera(
        u.x,
        u.y,
        this.cameraTiltDeg,
        this.obstacleGrid,
        this.occlusionZones
      );

      if (u.infected && u.infectionStage === 'vomiting') {
        continue;
      }

      let target: Zombie | null = null;
      if (u.focusZombieId !== null) {
        const focused = this.zombies.find((z) => z.id === u.focusZombieId);
        if (
          focused &&
          Math.hypot(focused.x - u.x, focused.y - u.y) <= u.range &&
          hasBuildingLineOfSight(u.x, u.y, focused.x, focused.y, this.obstacleGrid)
        ) {
          target = focused;
        }
      }

      if (!target) {
        const found = this.zombieHash.findNearest(
          u.x,
          u.y,
          u.range,
          (z) => hasBuildingLineOfSight(u.x, u.y, z.x, z.y, this.obstacleGrid)
        );
        if (found) target = found.item;
      }

      if (target && u.reloadTimer <= 0) {
        u.facing = Math.atan2(target.y - u.y, target.x - u.x);
        if (!u.isMoving) {
          u.animState = u.inCover ? 'cover' : u.role === 'sniper' || u.kind === 'soldier' ? 'aiming' : 'idle';
        }
        if (u.fireTimer <= 0) {
          const nearCommissioner =
            u.kind === 'police' &&
            this.unitHash.findNearest(
              u.x,
              u.y,
              45,
              (c) => c.inVehicleId === null && c.role === 'commissioner'
            ) !== null;
          u.fireTimer = nearCommissioner ? u.fireInterval * 0.8 : u.fireInterval;
          u.muzzleFlash = 0.09;
          u.shootAnim = 0.24;
          u.ammo -= 1;
          if (u.ammo <= 0) {
            u.reloadTimer = u.reloadDuration;
            u.animState = 'reloading';
          }

          this.spawnGunfireEffects(u.x, u.y, u.facing, u.weaponClass, target.x, target.y, u.radius + 0.65);
          this.damageZombie(target, u.damage, u.x, u.y);
          soundEngine.playRealisticShot(u.weaponClass, u.x, u.y);

          if (this.contactAlertCooldown <= 0) {
            this.contactAlertCooldown = 14;
            soundEngine.playRadioComms('contact', u.x, u.y);
            this.logEvent(
              'info',
              u.kind === 'police'
                ? 'Polis birimi zombi teması bildirdi · Ateş açıldı.'
                : 'Askerî birlik zombi sürüsüyle çatışmaya girdi.'
            );
          }
        }
      } else if (!u.isMoving && u.reloadTimer <= 0) {
        u.animState = u.inCover ? 'cover' : 'idle';
      }
    }
  }

  private spawnGunfireEffects(
    shooterX: number,
    shooterY: number,
    angle: number,
    weapon: WeaponClass,
    targetX?: number,
    targetY?: number,
    barrelOffset = 1.45
  ) {
    const mx = shooterX + Math.cos(angle) * barrelOffset;
    const my = shooterY + Math.sin(angle) * barrelOffset;
    const flashLife = weapon === 'sniper' ? 0.095 : weapon === 'heavy' ? 0.075 : 0.062;
    this.muzzleFlashes.push({
      x: mx,
      y: my,
      angle,
      weapon,
      life: flashLife,
      maxLife: flashLife,
    });
    if (this.muzzleFlashes.length > 260) this.muzzleFlashes.shift();

    // Eject rotating brass shell casing perpendicularly from receiver
    if (this.shellCasings.length < 220) {
      const ejectA = angle + Math.PI * 0.46 + (Math.random() - 0.5) * 0.45;
      const ejectSpd = 3.2 + Math.random() * 2.6;
      this.shellCasings.push({
        x: shooterX + Math.cos(angle) * (barrelOffset * 0.45),
        y: shooterY + Math.sin(angle) * (barrelOffset * 0.45),
        vx: Math.cos(ejectA) * ejectSpd,
        vy: Math.sin(ejectA) * ejectSpd,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 26,
        life: 0.42,
        maxLife: 0.42,
      });
    }

    if (targetX !== undefined && targetY !== undefined) {
      this.impactSparks.push({
        x: targetX + (Math.random() - 0.5) * 0.7,
        y: targetY + (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        size: weapon === 'sniper' || weapon === 'heavy' ? 1.15 : 0.8,
        color: '#fef08a',
        life: 0.11,
        maxLife: 0.11,
      });
      if (this.impactSparks.length > 220) this.impactSparks.shift();
    }
  }

  private damageZombie(z: Zombie, amount: number, srcX: number, srcY: number) {
    z.hp -= amount;
    z.hitFlash = 0.12;

    const shotAngle = Math.atan2(z.y - srcY, z.x - srcX);
    this.spawnBloodParticles(z.x, z.y, shotAngle, '#991b1b', 3);
    if (Math.random() < 0.45) {
      this.addBloodStain(
        z.x + Math.cos(shotAngle) * (1.2 + Math.random() * 1.5),
        z.y + Math.sin(shotAngle) * (1.2 + Math.random() * 1.5),
        0.5 + Math.random() * 0.6,
        shotAngle,
        false
      );
    }

    if (z.hp > 0 && (z.variant === 'heavy' || z.variant === 'fat') && z.animState !== 'knocked_down' && Math.random() < 0.09) {
      z.animState = 'knocked_down';
      z.stateTimer = 1.6;
    }

    if (z.hp <= 0) {
      const idx = this.zombies.indexOf(z);
      if (idx !== -1) {
        this.zombies.splice(idx, 1);
        this.zombiesKilled += 1;
        this.spawnBloodParticles(z.x, z.y, shotAngle, '#7f1d1d', 7);
        this.addBloodStain(z.x, z.y, 1.3 + Math.random() * 0.7, shotAngle, true);
        this.addCorpse(
          z.x,
          z.y,
          z.facing,
          'zombie',
          `zombie_${z.variant === 'fresh_infected' ? 'fresh' : z.variant}`,
          '#991b1b',
          z.variant === 'fat' ? 1.25 : 1,
          z.outfitId
        );
        soundEngine.playZombieDown(z.x, z.y);
      }
    }
  }

  private addBloodStain(x: number, y: number, radius: number, angle: number, isZombie: boolean) {
    this.bloodStains.push({ x, y, radius, angle, alpha: 0.78, isZombie });
    if (this.bloodStains.length > 2200) this.bloodStains.shift();
  }

  private addCorpse(
    x: number,
    y: number,
    angle: number,
    kind: Corpse['kind'],
    archetype: string,
    color: string,
    scale = 1,
    outfitId?: number
  ) {
    this.corpses.push({ x, y, angle, kind, archetype, color, scale, collapseProgress: 0, outfitId });
    if (this.corpses.length > 1600) this.corpses.shift();
  }

  private spawnBloodParticles(x: number, y: number, dirAngle: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = dirAngle + (Math.random() - 0.5) * 1.2;
      const spd = 4 + Math.random() * 11;
      const life = 0.22 + Math.random() * 0.25;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 0.4 + Math.random() * 0.45,
        color,
        life,
        maxLife: life,
      });
    }
  }

  private updateCivilians(dt: number) {
    const activeHelis = this.helicopters.filter(
      (h) => h.mode === 'evac' && (h.state === 'landed' || h.state === 'descending') && h.passengers < h.maxCapacity
    );

    // When population is huge (up to 10,000 civilians), stagger full AI steering across 3 slices for rock-solid 60 FPS
    const slices = this.civilians.length > 2400 ? 3 : this.civilians.length > 900 ? 2 : 1;
    const stepDt = dt * slices;
    const activeSlice = this.frameTick % slices;

    for (let i = this.civilians.length - 1; i >= 0; i--) {
      const c = this.civilians[i];
      if (c.hitFlash > 0) c.hitFlash = Math.max(0, c.hitFlash - dt);
      if (c.fireTimer > 0) c.fireTimer = Math.max(0, c.fireTimer - dt);
      if (c.shootAnim > 0) c.shootAnim = Math.max(0, c.shootAnim - dt);
      c.animTime += dt;

      if (c.infected) {
        const stage = c.infectionStage ?? 'vomiting';
        c.infectionTimer = Math.max(0, c.infectionTimer - dt);

        if (stage === 'latent') {
          if (c.infectionTimer <= 0) {
            const vomitDur = 3.2 + Math.random() * 1.1;
            c.infectionStage = 'vomiting';
            c.infectionStageDuration = vomitDur;
            c.infectionDuration = vomitDur;
            c.infectionTimer = vomitDur;
            c.vomitCooldown = 0.03;
            c.exhausted = true;
          }
        } else if (stage === 'vomiting') {
          c.vomitCooldown = (c.vomitCooldown ?? 0.08) - dt;
          if (c.vomitCooldown <= 0) {
            c.vomitCooldown = 0.44 + Math.random() * 0.28;
            soundEngine.playBloodVomit(c.x, c.y);
            const vx = c.x + Math.cos(c.facing) * 0.68;
            const vy = c.y + Math.sin(c.facing) * 0.68;
            this.spawnBloodParticles(vx, vy, c.facing, '#dc2626', 6);
            this.addBloodStain(
              c.x + Math.cos(c.facing) * 1.1,
              c.y + Math.sin(c.facing) * 1.1,
              0.55 + Math.random() * 0.4,
              c.facing,
              false
            );
          }
          if (c.infectionTimer <= 0) {
            const dieDur = 0.95 + Math.random() * 0.2;
            c.infectionStage = 'dying';
            c.infectionStageDuration = dieDur;
            c.infectionDuration = dieDur;
            c.infectionTimer = dieDur;
            c.state = 'fallen';
            c.isMoving = false;
            soundEngine.playDeathScream(c.gender, c.x, c.y);
          }
        } else {
          // Stage 4: 'dying' -> collapse immobile then resurrect as fresh_infected
          c.state = 'fallen';
          c.isMoving = false;
          c.occluded = isEntityVisuallyOccludedAtCamera(
            c.x,
            c.y,
            this.cameraTiltDeg,
            this.obstacleGrid,
            this.occlusionZones
          );
          if (c.infectionTimer <= 0) {
            this.civilians.splice(i, 1);
            this.civiliansLost += 1;
            const zSpot = this.findNearestOpenSpot(c.x, c.y, 1.1, 20);
            this.spawnZombie(zSpot.x, zSpot.y, 'fresh_infected', c.shirtColor);
            this.zombiesSpawnedTotal += 1;
            this.addBloodStain(zSpot.x, zSpot.y, 1.25, c.facing, true);
            soundEngine.playInfection(zSpot.x, zSpot.y);
          }
          continue;
        }
      }

      if (c.state === 'fallen') continue;
      if (slices > 1 && i % slices !== activeSlice) {
        if (c.isMoving) c.walkPhase += dt * 9;
        continue;
      }

      const prevCx = c.x;
      const prevCy = c.y;
      c.isMoving = false;

      if (c.armed && c.fireTimer <= 0 && (!c.infected || c.infectionStage === 'latent')) {
        const hitZ = this.zombieHash.findNearest(c.x, c.y, 28);
        if (hitZ && hasBuildingLineOfSight(c.x, c.y, hitZ.item.x, hitZ.item.y, this.obstacleGrid)) {
          c.fireTimer = 0.85;
          c.shootAnim = 0.24;
          c.facing = Math.atan2(hitZ.item.y - c.y, hitZ.item.x - c.x);
          this.spawnGunfireEffects(c.x, c.y, c.facing, 'pistol', hitZ.item.x, hitZ.item.y, c.radius + 0.5);
          this.damageZombie(hitZ.item, 13, c.x, c.y);
          soundEngine.playRealisticShot('pistol', c.x, c.y);
        }
      }

      let nearestHeli: Helicopter | null = null;
      let nearestHeliDist = Infinity;
      for (let hi = 0; hi < activeHelis.length; hi++) {
        const h = activeHelis[hi];
        const d = Math.hypot(h.x - c.x, h.y - c.y);
        if (d <= h.evacRadius && d < nearestHeliDist) {
          nearestHeliDist = d;
          nearestHeli = h;
        }
      }

      if (nearestHeli) {
        c.state = 'boarding';
        c.targetHeliId = nearestHeli.id;

        if (
          nearestHeli.state === 'landed' &&
          nearestHeliDist <= 5.0 &&
          nearestHeli.passengers < nearestHeli.maxCapacity
        ) {
          nearestHeli.passengers += 1;
          this.civiliansEvacuated += 1;
          this.evacBatchCounter += 1;
          this.civilians.splice(i, 1);
          soundEngine.playBoarded(nearestHeli.x, nearestHeli.y);
          this.spawnParticles(nearestHeli.x, nearestHeli.y, '#34d399', 4);
          if (this.evacLogCooldown <= 0) {
            this.evacLogCooldown = 6.5;
            soundEngine.playRadioComms('evac', nearestHeli.x, nearestHeli.y);
            this.logEvent('info', `${this.evacBatchCounter} sivil tahliye helikopterine ulaştı.`);
            this.evacBatchCounter = 0;
          }
          continue;
        }

        const civInfMult = c.infected && c.infectionStage === 'vomiting' ? 0.25 : 1.0;
        const stamMult = (c.exhausted ? 0.58 : 1.0) * civInfMult;
        const spd = (c.wounded ? c.speed * 0.6 : c.speed) * stamMult;
        const flowField = this.heliFlowFields.get(nearestHeli.id);
        const flowTarget =
          flowField && this.navMesh && nearestHeliDist > 12
            ? this.navMesh.sampleFlowTarget(flowField, c.x, c.y, 14)
            : null;
        const steerX = flowTarget ? flowTarget.x : nearestHeli.x;
        const steerY = flowTarget ? flowTarget.y : nearestHeli.y;
        const moved = this.moveEntityWithSteering(c.x, c.y, c.radius, steerX, steerY, spd * stepDt, false, c, stepDt);
        c.x = moved.x;
        c.y = moved.y;
        c.facing = moved.facing;
        c.isMoving = true;
        c.stamina = Math.max(0, c.stamina - 14.0 * stepDt);
        if (c.stamina <= 0) c.exhausted = true;
        c.walkPhase += stepDt * (c.exhausted ? 8.5 : 13);
      } else {
        // Fast spatial hash lookup for nearby zombie threats (within 38m)
        const threatHit = this.zombieHash.findNearest(c.x, c.y, 38);
        if (threatHit) {
          if (c.wounded && !c.infected) {
            c.state = 'calling_help';
            c.stamina = Math.min(c.maxStamina, c.stamina + 14.0 * stepDt);
          } else {
            const threat = threatHit.item;
            const threatDist = threatHit.dist;
            c.state = threatDist < 12 ? 'panicking' : 'running';
            if (threatDist < 12 && Math.random() < 0.014) {
              soundEngine.playCivilianScream(c.gender, c.x, c.y);
            }
            const dx = c.x - threat.x;
            const dy = c.y - threat.y;
            const d = Math.hypot(dx, dy) || 1;
            const civInfMult = c.infected && c.infectionStage === 'vomiting' ? 0.25 : 1.0;
            const stamMult = (c.exhausted ? 0.58 : 1.0) * civInfMult;
            const moved = this.moveEntityWithSteering(
              c.x,
              c.y,
              c.radius,
              c.x + (dx / d) * 26,
              c.y + (dy / d) * 26,
              c.speed * stamMult * stepDt,
              false,
              c,
              stepDt
            );
            const step = Math.hypot(moved.x - c.x, moved.y - c.y);
            c.x = moved.x;
            c.y = moved.y;
            c.facing = moved.facing;
            if (step < 0.01 && threatDist < 18) {
              c.state = 'hiding';
              c.stamina = Math.min(c.maxStamina, c.stamina + 18.0 * stepDt);
            } else {
              c.isMoving = true;
              c.stamina = Math.max(0, c.stamina - 14.0 * stepDt);
              if (c.stamina <= 0) c.exhausted = true;
              c.walkPhase += stepDt * (c.exhausted ? 8.5 : 13);
            }
          }
        } else if (c.wounded) {
          c.state = 'calling_help';
          c.stamina = Math.min(c.maxStamina, c.stamina + 16.0 * stepDt);
        } else {
          c.state = 'wandering';
          c.stamina = Math.min(c.maxStamina, c.stamina + 10.0 * stepDt);
          if (c.exhausted && c.stamina >= 28) c.exhausted = false;
          c.wanderTimer -= stepDt;
          if (
            !c.wanderTarget ||
            c.wanderTimer <= 0 ||
            Math.hypot(c.wanderTarget.x - c.x, c.wanderTarget.y - c.y) < 1.5
          ) {
            c.wanderTimer = 3.5 + Math.random() * 4.5;
            const a = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 18;
            const wy = clamp(c.y + Math.sin(a) * dist, -this.halfSize + 12, this.halfSize - 12);
            const wx = clamp(
              c.x + Math.cos(a) * dist,
              -this.halfSize + 12,
              this.getMaxLandX(wy, 20)
            );
            c.wanderTarget = { x: wx, y: wy };
          }
          const moved = this.moveEntityWithSteering(
            c.x,
            c.y,
            c.radius,
            c.wanderTarget.x,
            c.wanderTarget.y,
            c.speed * 0.34 * stepDt,
            false,
            c,
            stepDt
          );
          if (Math.hypot(moved.x - c.x, moved.y - c.y) > 0.005) {
            c.isMoving = true;
            c.walkPhase += stepDt * 6;
          }
          c.x = moved.x;
          c.y = moved.y;
          c.facing = moved.facing;
        }
      }

      // Soft separation using zero-alloc spatial hash neighborhood
      const neighbors = this.civilianHash.queryRadiusScratch(c.x, c.y, 2.5, this.civNeighborsScratch);
      for (let j = 0; j < neighbors.length && j < 6; j++) {
        const o = neighbors[j];
        if (o === c) continue;
        const dx = c.x - o.x;
        const dy = c.y - o.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minD = c.radius + o.radius + 0.15;
        if (d < minD) {
          const push = (minD - d) * 0.4;
          c.x += (dx / d) * push;
          c.y += (dy / d) * push;
        }
      }
      const safeC = resolveCircleObstacles(c.x, c.y, c.radius, this.obstacleGrid);
      c.x = safeC.x;
      c.y = safeC.y;
      if (this.isHardBlocked(c.x, c.y, c.radius * 0.78)) {
        if (!this.isHardBlocked(prevCx, prevCy, c.radius * 0.72)) {
          c.x = prevCx;
          c.y = prevCy;
        } else {
          const esc = this.findNearestOpenSpot(c.x, c.y, c.radius + 0.4, 150);
          c.x = esc.x;
          c.y = esc.y;
        }
      }
      c.inCoverGlow = safeC.collided || isNearCoverOrTree(c.x, c.y, this.obstacleGrid);
      c.occluded = isEntityVisuallyOccludedAtCamera(
        c.x,
        c.y,
        this.cameraTiltDeg,
        this.obstacleGrid,
        this.occlusionZones
      );
    }
  }

  /**
   * 3-Rule Craig Reynolds Boids Flocking Steering (Separation + Alignment + Cohesion).
   * Causes idle/patrolling zombies to organically gather into cohesive hordes.
   */
  public computeZombieBoidsSteering(z: Zombie): {
    steerX: number;
    steerY: number;
    sepX: number;
    sepY: number;
    cohX: number;
    cohY: number;
    aliX: number;
    aliY: number;
    neighbors: number;
  } {
    const herd = this.zombieHash.queryRadiusScratch(z.x, z.y, 26, this.zombieNeighborsScratch);
    let sepX = 0;
    let sepY = 0;
    let aliX = 0;
    let aliY = 0;
    let cohSumX = 0;
    let cohSumY = 0;
    let neighbors = 0;

    for (let k = 0; k < herd.length && neighbors < 14; k++) {
      const o = herd[k];
      if (o === z) continue;
      const dx = o.x - z.x;
      const dy = o.y - z.y;
      const d = Math.hypot(dx, dy);
      if (d <= 0.001 || d > 26) continue;

      if (d < 3.6) {
        const repulse = (3.6 - d) / 3.6;
        sepX -= (dx / d) * repulse;
        sepY -= (dy / d) * repulse;
      }
      aliX += Math.cos(o.facing);
      aliY += Math.sin(o.facing);
      cohSumX += o.x;
      cohSumY += o.y;
      neighbors++;
    }

    if (neighbors === 0) {
      return { steerX: 0, steerY: 0, sepX: 0, sepY: 0, cohX: 0, cohY: 0, aliX: 0, aliY: 0, neighbors: 0 };
    }

    const cohRawX = cohSumX / neighbors - z.x;
    const cohRawY = cohSumY / neighbors - z.y;
    const cohLen = Math.hypot(cohRawX, cohRawY) || 1;
    const cohX = cohRawX / cohLen;
    const cohY = cohRawY / cohLen;

    const aliLen = Math.hypot(aliX, aliY) || 1;
    const nAliX = aliX / aliLen;
    const nAliY = aliY / aliLen;

    const sepLen = Math.hypot(sepX, sepY);
    const nSepX = sepLen > 0.001 ? sepX / sepLen : 0;
    const nSepY = sepLen > 0.001 ? sepY / sepLen : 0;

    const rawX = nSepX * 0.42 + nAliX * 0.28 + cohX * 0.55;
    const rawY = nSepY * 0.42 + nAliY * 0.28 + cohY * 0.55;
    const rawLen = Math.hypot(rawX, rawY) || 1;

    return {
      steerX: rawX / rawLen,
      steerY: rawY / rawLen,
      sepX: nSepX,
      sepY: nSepY,
      cohX,
      cohY,
      aliX: nAliX,
      aliY: nAliY,
      neighbors,
    };
  }

  private updateZombies(dt: number) {
    const slices = this.zombies.length > 2000 ? 3 : this.zombies.length > 800 ? 2 : 1;
    const stepDt = dt * slices;
    const activeSlice = this.frameTick % slices;
    let navSolvesThisFrame = 0;
    const canSolveNav = () => {
      if (navSolvesThisFrame >= 28) return false;
      navSolvesThisFrame++;
      return true;
    };

    for (let i = 0; i < this.zombies.length; i++) {
      const z = this.zombies[i];
      if (z.hitFlash > 0) z.hitFlash = Math.max(0, z.hitFlash - dt);
      if (z.attackTimer > 0) z.attackTimer = Math.max(0, z.attackTimer - dt);
      if (z.attackAnim > 0) z.attackAnim = Math.max(0, z.attackAnim - dt);
      z.animTime += dt;

      if (z.animState === 'knocked_down') {
        z.stateTimer -= dt;
        if (z.stateTimer <= 0) {
          z.animState = 'getting_up';
          z.stateTimer = 0.65;
        }
        continue;
      }
      if (z.animState === 'getting_up') {
        z.stateTimer -= dt;
        if (z.stateTimer <= 0) z.animState = 'walking';
        continue;
      }

      if (slices > 1 && i % slices !== activeSlice) {
        if (z.isMoving) z.walkPhase += dt * (z.variant === 'runner' ? 12 : 7);
        continue;
      }

      const prevZx = z.x;
      const prevZy = z.y;
      z.isMoving = false;
      const detectRange = 120;
      let bestTarget: { kind: 'unit' | 'civilian'; ref: Unit | Civilian; dist: number } | null = null;

      const civHit = this.civilianHash.findNearest(z.x, z.y, detectRange);
      if (civHit) {
        bestTarget = { kind: 'civilian', ref: civHit.item, dist: civHit.dist };
      }

      const unitSearchRadius = bestTarget ? Math.min(detectRange, bestTarget.dist) : detectRange;
      const unitHit = this.unitHash.findNearest(
        z.x,
        z.y,
        unitSearchRadius,
        (u) => u.inVehicleId === null && u.parachuteAlt <= 0
      );
      if (unitHit && (!bestTarget || unitHit.dist < bestTarget.dist)) {
        bestTarget = { kind: 'unit', ref: unitHit.item, dist: unitHit.dist };
      }

      if (Math.random() < 0.008) {
        soundEngine.playZombieVocal(z.x, z.y, Boolean(bestTarget));
      }

      // Query Worker Pool advice (if available) or compute 3-rule Boids Flocking ("Sürü İçgüdüsü")
      const workerAdvice = this.workerPool.getAdvice(z.id, this.frameTick);
      let flockPullX = workerAdvice ? workerAdvice.flockX : 0;
      let flockPullY = workerAdvice ? workerAdvice.flockY : 0;
      if (!workerAdvice || !bestTarget) {
        const boids = this.computeZombieBoidsSteering(z);
        if (boids.neighbors > 0) {
          flockPullX = boids.steerX;
          flockPullY = boids.steerY;
        }
      }

      if (bestTarget) {
        const tx = bestTarget.ref.x;
        const ty = bestTarget.ref.y;
        let steerX = tx;
        let steerY = ty;
        if (this.navMesh && bestTarget.dist > 14 && !this.navMesh.hasNavLineOfSight(z.x, z.y, tx, ty)) {
          if (workerAdvice) {
            steerX = workerAdvice.steerX;
            steerY = workerAdvice.steerY;
          } else {
            const wp = this.navMesh.getCachedNextWaypoint(z.x, z.y, tx, ty, this.frameTick, canSolveNav);
            if (wp) {
              steerX = wp.x;
              steerY = wp.y;
            }
          }
        }
        // Apply gentle horde swarming pull when target is not within immediate lunge distance
        if (bestTarget.dist > 9 && (flockPullX !== 0 || flockPullY !== 0)) {
          const sdx = steerX - z.x;
          const sdy = steerY - z.y;
          const sDist = Math.hypot(sdx, sdy) || 1;
          const bx = (sdx / sDist) * 0.78 + flockPullX * 0.22;
          const by = (sdy / sDist) * 0.78 + flockPullY * 0.22;
          steerX = z.x + bx * 18;
          steerY = z.y + by * 18;
        }
        const moved = this.moveEntityWithSteering(z.x, z.y, z.radius, steerX, steerY, z.speed * stepDt, true, z, stepDt);
        z.x = moved.x;
        z.y = moved.y;
        z.facing = moved.facing;
        z.isMoving = true;
        z.animState = z.variant === 'crawler' ? 'crawling' : z.variant === 'runner' ? 'running' : 'walking';
        z.walkPhase += stepDt * (z.variant === 'runner' ? 14 : 8.5);

        const touchDist = z.radius + bestTarget.ref.radius + 0.9;
        if (Math.hypot(tx - z.x, ty - z.y) <= touchDist && z.attackTimer <= 0) {
          z.attackTimer = 0.9;
          z.attackAnim = 0.34;
          z.animState = 'biting';
          let dmg = z.damage;
          if (bestTarget.kind === 'unit' && (bestTarget.ref as Unit).role === 'riot_shield') {
            dmg *= 0.45;
          }
          bestTarget.ref.hp -= dmg;
          bestTarget.ref.hitFlash = 0.16;
          this.spawnBloodParticles(bestTarget.ref.x, bestTarget.ref.y, z.facing, '#b91c1c', 3);
          this.addBloodStain(bestTarget.ref.x, bestTarget.ref.y, 0.7, z.facing, false);

          if (bestTarget.kind === 'civilian') {
            const civ = bestTarget.ref as Civilian;
            soundEngine.playCivilianScream(civ.gender, civ.x, civ.y);
            if (!civ.infected) {
              const latentDur = 1.6 + Math.random() * 1.1;
              civ.infected = true;
              civ.infectionStage = 'latent';
              civ.infectionStageDuration = latentDur;
              civ.infectionDuration = latentDur;
              civ.infectionTimer = latentDur;
              civ.lastBiteAt = this.missionTimeSec;
              civ.vomitCooldown = 0.04;
              civ.wounded = true;
              civ.hp = Math.max(16, civ.hp);
            } else if (civ.infectionStage !== 'dying') {
              civ.hp = Math.max(8, civ.hp);
            } else if (civ.hp <= 0) {
              const cIdx = this.civilians.indexOf(civ);
              if (cIdx !== -1) {
                this.civilians.splice(cIdx, 1);
                this.civiliansLost += 1;
                soundEngine.playDeathScream(civ.gender, civ.x, civ.y);
                const zSpot = this.findNearestOpenSpot(civ.x, civ.y, 1.1, 20);
                this.spawnZombie(zSpot.x, zSpot.y, 'fresh_infected', civ.shirtColor);
                this.zombiesSpawnedTotal += 1;
                this.addBloodStain(civ.x, civ.y, 1.35, z.facing, false);
                soundEngine.playInfection(civ.x, civ.y);
              }
            }
          } else if (bestTarget.kind === 'unit') {
            const unit = bestTarget.ref as Unit;
            const unitGender = unit.gender ?? (unit.id % 2 === 0 ? 'male' : 'female');
            if (!unit.infected && (unit.hp <= 0 || Math.random() < 0.58)) {
              const latentDur = 1.7 + Math.random() * 1.1;
              unit.infected = true;
              unit.infectionStage = 'latent';
              unit.infectionStageDuration = latentDur;
              unit.infectionDuration = latentDur;
              unit.infectionTimer = latentDur;
              unit.lastBiteAt = this.missionTimeSec;
              unit.vomitCooldown = 0.04;
              unit.hp = Math.max(18, unit.hp);
              soundEngine.playCivilianScream(unitGender, unit.x, unit.y);
            } else if (unit.infected && unit.infectionStage !== 'dying') {
              unit.hp = Math.max(8, unit.hp);
            } else if (unit.hp <= 0) {
              const uIdx = this.units.indexOf(unit);
              if (uIdx !== -1) {
                if (unit.kind === 'police') this.policeLosses += 1;
                else this.soldierLosses += 1;
                soundEngine.playDeathScream(unitGender, unit.x, unit.y);
                this.addBloodStain(unit.x, unit.y, 1.4, z.facing, false);
                this.addCorpse(unit.x, unit.y, unit.facing, unit.kind, `${unit.kind}_${unit.role}`, unit.kind === 'soldier' ? '#15803d' : '#1d4ed8');
                this.units.splice(uIdx, 1);
                soundEngine.playRadioComms('casualty', unit.x, unit.y);
                this.logEvent(
                  'alert',
                  unit.kind === 'police'
                    ? 'Polis ekibi personeli devre dışı kaldı!'
                    : 'Askerî personel çatışmada devre dışı kaldı!'
                );
              }
            }
          }
        }
      } else {
        z.wanderTimer -= stepDt;
        if (
          !z.wanderTarget ||
          z.wanderTimer <= 0 ||
          Math.hypot(z.wanderTarget.x - z.x, z.wanderTarget.y - z.y) < 2
        ) {
          z.wanderTimer = 3.5 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2;
          const dist = 20 + Math.random() * 45;
          const wy = clamp(z.y * 0.85 + Math.sin(a) * dist, -this.halfSize + 12, this.halfSize - 12);
          const wx = clamp(
            z.x * 0.85 + Math.cos(a) * dist,
            -this.halfSize + 12,
            this.getMaxLandX(wy, 22)
          );
          z.wanderTarget = { x: wx, y: wy };
        }
        let wx = z.wanderTarget.x;
        let wy = z.wanderTarget.y;
        if (
          this.navMesh &&
          Math.hypot(wx - z.x, wy - z.y) > 16 &&
          !this.navMesh.hasNavLineOfSight(z.x, z.y, wx, wy)
        ) {
          if (workerAdvice) {
            wx = workerAdvice.steerX;
            wy = workerAdvice.steerY;
          } else {
            const wp = this.navMesh.getCachedNextWaypoint(z.x, z.y, wx, wy, this.frameTick, canSolveNav);
            if (wp) {
              wx = wp.x;
              wy = wp.y;
            }
          }
        }
        // Boids Flocking ("Sürü İçgüdüsü"): idle/patrolling zombies clump together into cohesive packs
        if (flockPullX !== 0 || flockPullY !== 0) {
          const wdx = wx - z.x;
          const wdy = wy - z.y;
          const wDist = Math.hypot(wdx, wdy) || 1;
          wx = z.x + ((wdx / wDist) * 0.42 + flockPullX * 0.58) * 22;
          wy = z.y + ((wdy / wDist) * 0.42 + flockPullY * 0.58) * 22;
        }
        const moved = this.moveEntityWithSteering(
          z.x,
          z.y,
          z.radius,
          wx,
          wy,
          z.speed * 0.62 * stepDt,
          true,
          z,
          stepDt
        );
        z.x = moved.x;
        z.y = moved.y;
        z.facing = moved.facing;
        z.isMoving = true;
        z.animState = z.variant === 'crawler' ? 'crawling' : 'wandering';
        z.walkPhase += stepDt * 6.5;
      }

      const nearbyZ = this.zombieHash.queryRadiusScratch(z.x, z.y, 2.5, this.zombieNeighborsScratch);
      for (let j = 0; j < nearbyZ.length && j < 6; j++) {
        const o = nearbyZ[j];
        if (o === z) continue;
        const dx = z.x - o.x;
        const dy = z.y - o.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minD = z.radius + o.radius + 0.2;
        if (d < minD) {
          const push = (minD - d) * 0.45;
          z.x += (dx / d) * push;
          z.y += (dy / d) * push;
        }
      }
      this.enforceQuarantineForZombie(z);
      const safe = resolveCircleObstacles(z.x, z.y, z.radius, this.obstacleGrid);
      z.x = safe.x;
      z.y = safe.y;
      if (this.isHardBlocked(z.x, z.y, z.radius * 0.78)) {
        if (!this.isHardBlocked(prevZx, prevZy, z.radius * 0.72)) {
          z.x = prevZx;
          z.y = prevZy;
        } else {
          const esc = this.findNearestOpenSpot(z.x, z.y, z.radius + 0.4, 150);
          z.x = esc.x;
          z.y = esc.y;
        }
      }
      z.inCoverGlow = safe.collided || isNearCoverOrTree(z.x, z.y, this.obstacleGrid);
      z.occluded = isEntityVisuallyOccludedAtCamera(
        z.x,
        z.y,
        this.cameraTiltDeg,
        this.obstacleGrid,
        this.occlusionZones
      );
    }
  }

  private updateQuarantineZones(dt: number) {
    for (let qi = this.quarantineZones.length - 1; qi >= 0; qi--) {
      const qz = this.quarantineZones[qi];
      if (qz.status === 'scanning') {
        qz.scanProgress = Math.min(1, qz.scanProgress + dt / 1.1);
        if (qz.scanProgress >= 1) {
          const towers: QuarantineTower[] = [];
          const barriers: QuarantineBarrier[] = [];
          const garrisonUnitIds: number[] = [];

          // 1. Place Watchtowers strictly on verified open ground (no buildings, water, trees, vehicles)
          for (let ai = 0; ai < 8 && towers.length < 4; ai++) {
            const a = (ai / 8) * Math.PI * 2 + Math.PI * 0.125;
            const tx = qz.x + Math.cos(a) * (qz.radius * 0.84);
            const ty = qz.y + Math.sin(a) * (qz.radius * 0.84);
            if (
              Math.abs(tx) < this.halfSize - 8 &&
              Math.abs(ty) < this.halfSize - 8 &&
              !this.isWaterAt(tx, ty, 3.0) &&
              isCircleClearOfObstacles(tx, ty, 3.0, this.obstacles, undefined, undefined, this.bridges) &&
              this.vehicles.every((v) => Math.hypot(v.x - tx, v.y - ty) > 7.5)
            ) {
              const twIdStr = `q-tower-${qz.id}-${towers.length}`;
              towers.push({
                id: this.nextId++,
                x: tx,
                y: ty,
                angle: a,
                searchlightAngle: a,
                fireTimer: Math.random() * 0.4,
                active: true,
              });
              const twOb = createRectObstacle(twIdStr, 'barricade', tx, ty, 4.4, 4.4, 0);
              this.obstacles.push(twOb);
              this.obstacleGrid.insert(twOb);
              this.navMesh?.markDynamicBarricade(twOb);
            }
          }

          if (towers.length === 0) {
            this.quarantineZones.splice(qi, 1);
            soundEngine.playPlacementInvalid();
            this.logEvent('warn', 'Arazi taraması başarısız: Kuleler için temiz zemin bulunamadı.');
            this.emitHud();
            continue;
          }

          // 2. Place Perimeter Road Barriers only along clear unobstructed ground
          for (let bi = 0; bi < 8 && barriers.length < 4; bi++) {
            const a = (bi / 8) * Math.PI * 2;
            const bx = qz.x + Math.cos(a) * qz.radius;
            const by = qz.y + Math.sin(a) * qz.radius;
            const tangent = a + Math.PI * 0.5;
            const len = 14;
            const sx1 = bx - Math.cos(tangent) * (len * 0.5);
            const sy1 = by - Math.sin(tangent) * (len * 0.5);
            const sx2 = bx + Math.cos(tangent) * (len * 0.5);
            const sy2 = by + Math.sin(tangent) * (len * 0.5);
            if (
              !this.isWaterAt(bx, by, 2.2) &&
              !isSegmentBlockedByObstacles(sx1, sy1, sx2, sy2, 1.5, this.obstacleGrid) &&
              this.vehicles.every((v) => Math.hypot(v.x - bx, v.y - by) > 9)
            ) {
              const barId = `q-bar-${qz.id}-${barriers.length}`;
              barriers.push({
                id: barId,
                x: bx,
                y: by,
                w: len,
                h: 2.2,
                angle: tangent,
                hp: 520,
                maxHp: 520,
              });
              const barOb = createRectObstacle(barId, 'barricade', bx, by, len, 2.2, tangent);
              this.obstacles.push(barOb);
              this.obstacleGrid.insert(barOb);
              this.navMesh?.markDynamicBarricade(barOb);
            }
          }

          // 3. Garrison infantry soldiers near open tower bases
          for (let gi = 0; gi < towers.length && garrisonUnitIds.length < 4; gi++) {
            const tw = towers[gi];
            const gSpot = this.findNearestOpenSpot(tw.x - Math.cos(tw.searchlightAngle) * 4.5, tw.y - Math.sin(tw.searchlightAngle) * 4.5, 1.25, 22);
            const guard = this.createUnit('soldier', 'infantry', gSpot.x, gSpot.y);
            guard.selected = false;
            this.units.push(guard);
            this.soldiersInitial += 1;
            this.soldiersCap = Math.max(this.soldiersCap, this.units.filter((u) => u.kind === 'soldier').length);
            garrisonUnitIds.push(guard.id);
          }

          if (this.navMesh && this.workerPool.isActive()) {
            this.workerPool.syncNavMesh(this.navMesh.exportGridData());
          }
          this.heliFlowFields.clear();

          qz.towers = towers;
          qz.barriers = barriers;
          qz.garrisonUnitIds = garrisonUnitIds;
          qz.status = 'active';
          qz.active = true;
          soundEngine.playBarricadeBuild();
          soundEngine.playRadioComms('lz', qz.x, qz.y);
          this.logEvent(
            'success',
            `Karantina üssü kuruldu (${towers.length} gözetleme kulesi, ${barriers.length} bariyer, ${garrisonUnitIds.length} nöbetçi asker).`
          );
          this.emitHud();
        }
        continue;
      }

      // Active watchtowers sweep night floodlights & engage nearby zombies
      for (let ti = 0; ti < qz.towers.length; ti++) {
        const tw = qz.towers[ti];
        if (!tw.active) continue;
        tw.searchlightAngle += dt * (ti % 2 === 0 ? 0.55 : -0.48);
        tw.fireTimer = Math.max(0, (tw.fireTimer ?? 0) - dt);
        if ((tw.fireTimer ?? 0) <= 0) {
          const hit = this.zombieHash.findNearest(
            tw.x,
            tw.y,
            82,
            (z) => hasBuildingLineOfSight(tw.x, tw.y, z.x, z.y, this.obstacleGrid)
          );
          if (hit) {
            tw.fireTimer = 0.42;
            const aim = Math.atan2(hit.item.y - tw.y, hit.item.x - tw.x);
            this.spawnGunfireEffects(tw.x, tw.y, aim, 'rifle', hit.item.x, hit.item.y, 1.8);
            this.damageZombie(hit.item, 32, tw.x, tw.y);
            soundEngine.playRealisticShot('rifle', tw.x, tw.y);
          }
        }
      }
    }
  }

  private enforceQuarantineForZombie(z: Zombie) {
    for (let qi = 0; qi < this.quarantineZones.length; qi++) {
      const qz = this.quarantineZones[qi];
      if (!qz.active || qz.status !== 'active') continue;
      const dx = z.x - qz.x;
      const dy = z.y - qz.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const band = 5;
      if (Math.abs(d - qz.radius) < band) {
        const targetR = d >= qz.radius ? qz.radius + band : qz.radius - band;
        const nx = qz.x + (dx / d) * targetR;
        const ny = qz.y + (dy / d) * targetR;
        if (!this.isHardBlocked(nx, ny, z.radius * 0.78)) {
          z.x = nx;
          z.y = ny;
        }
      }
    }
  }

  private moveEntityWithSteering(
    x: number,
    y: number,
    radius: number,
    tx: number,
    ty: number,
    stepDist: number,
    respectQuarantine = false,
    agent?: { steerBias?: 1 | -1; steerLockTimer?: number; facing?: number },
    dt = 0.016
  ): { x: number; y: number; facing: number } {
    const baseAngle = Math.atan2(ty - y, tx - x);
    if (agent && (agent.steerLockTimer ?? 0) > 0) {
      agent.steerLockTimer = Math.max(0, (agent.steerLockTimer ?? 0) - dt);
    }
    const bias: 1 | -1 = agent?.steerBias ?? 1;
    const tryAngles = [
      0,
      bias * 0.45,
      -bias * 0.45,
      bias * 0.9,
      -bias * 0.9,
      bias * 1.35,
      -bias * 1.35,
      bias * 1.85,
      -bias * 1.85,
    ];

    const reach = stepDist + radius + 3.5;
    const rawNearby = this.obstacleGrid.queryBoxScratch(x - reach, y - reach, x + reach, y + reach);
    const localObs = this.steerObsScratch;
    localObs.length = 0;
    for (let k = 0; k < rawNearby.length; k++) localObs.push(rawNearby[k]);

    let bestX = x;
    let bestY = y;
    let bestScore = -Infinity;
    let bestSign = 0;
    const startWalkable = this.navMesh ? this.navMesh.isWorldWalkable(x, y) : false;

    for (let i = 0; i < tryAngles.length; i++) {
      const offset = tryAngles[i];
      const a = baseAngle + offset;
      const cx = clamp(x + Math.cos(a) * stepDist, -this.halfSize + 4, this.halfSize - 4);
      const cy = clamp(y + Math.sin(a) * stepDist, -this.halfSize + 4, this.halfSize - 4);

      if (respectQuarantine && this.quarantineZones.length > 0) {
        let crossesQ = false;
        for (let qi = 0; qi < this.quarantineZones.length; qi++) {
          const qz = this.quarantineZones[qi];
          if (!qz.active || qz.status !== 'active') continue;
          const wasIn = Math.hypot(x - qz.x, y - qz.y) < qz.radius;
          const nowIn = Math.hypot(cx - qz.x, cy - qz.y) < qz.radius;
          if (wasIn !== nowIn) {
            crossesQ = true;
            break;
          }
        }
        if (crossesQ) continue;
      }

      const mx = (x + cx) * 0.5;
      const my = (y + cy) * 0.5;
      if (this.isWaterAt(cx, cy, radius) || this.isWaterAt(mx, my, radius * 0.5)) {
        continue;
      }
      if (startWalkable && this.navMesh && !this.navMesh.isWorldWalkable(cx, cy)) {
        continue;
      }

      const sideSign = offset === 0 ? 0 : offset > 0 ? 1 : -1;
      const antiFlipPenalty =
        agent && (agent.steerLockTimer ?? 0) > 0 && sideSign !== 0 && sideSign !== bias ? 1.4 : 0;

      if (localObs.length === 0) {
        if (i === 0) return { x: cx, y: cy, facing: baseAngle };
        const movedDist = Math.hypot(cx - x, cy - y);
        const progress = Math.hypot(tx - x, ty - y) - Math.hypot(tx - cx, ty - cy);
        const score = progress + movedDist * 0.45 - antiFlipPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestX = cx;
          bestY = cy;
          bestSign = sideSign;
        }
        continue;
      }

      const res = resolveCircleObstacles(cx, cy, radius, localObs);
      if (isPointInHardObstacle(res.x, res.y, radius * 0.72, localObs) || this.isWaterAt(res.x, res.y, radius * 0.75)) {
        continue;
      }
      if (!res.collided && i === 0) {
        return { x: res.x, y: res.y, facing: baseAngle };
      }

      const movedDist = Math.hypot(res.x - x, res.y - y);
      const progress = Math.hypot(tx - x, ty - y) - Math.hypot(tx - res.x, ty - res.y);
      const score = progress + movedDist * 0.45 - (res.collided ? 0.5 : 0) - antiFlipPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestX = res.x;
        bestY = res.y;
        bestSign = sideSign;
      }
    }

    if (agent && bestSign !== 0) {
      if (bestSign !== agent.steerBias && (agent.steerLockTimer ?? 0) <= 0) {
        agent.steerBias = bestSign as 1 | -1;
      }
      agent.steerLockTimer = 0.55;
    }

    let rawFacing = Math.hypot(bestX - x, bestY - y) > 0.005 ? Math.atan2(bestY - y, bestX - x) : baseAngle;
    if (agent && agent.facing !== undefined) {
      let diff = rawFacing - agent.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = Math.min(1, dt * 10);
      rawFacing = agent.facing + diff * maxTurn;
    }

    return {
      x: bestX,
      y: bestY,
      facing: rawFacing,
    };
  }

  private updateEffects(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      this.muzzleFlashes[i].life -= dt;
      if (this.muzzleFlashes[i].life <= 0) this.muzzleFlashes.splice(i, 1);
    }
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const sc = this.shellCasings[i];
      sc.x += sc.vx * dt;
      sc.y += sc.vy * dt;
      sc.vx *= 0.88;
      sc.vy *= 0.88;
      sc.angle += dt * 14;
      sc.life -= dt;
      if (sc.life <= 0) this.shellCasings.splice(i, 1);
    }
    for (let i = this.impactSparks.length - 1; i >= 0; i--) {
      this.impactSparks[i].life -= dt;
      if (this.impactSparks[i].life <= 0) this.impactSparks.splice(i, 1);
    }
    for (let i = this.orderMarkers.length - 1; i >= 0; i--) {
      this.orderMarkers[i].life -= dt;
      if (this.orderMarkers[i].life <= 0) this.orderMarkers.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      sw.radius = sw.maxRadius * (1 - sw.life / sw.maxLife);
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }
    for (const c of this.corpses) {
      if (c.collapseProgress < 1) {
        c.collapseProgress = Math.min(1, c.collapseProgress + dt * 1.9);
      }
    }
    for (const cr of this.craters) {
      if (cr.smokeTimer > 0) cr.smokeTimer = Math.max(0, cr.smokeTimer - dt);
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.age += dt;
      if (exp.age >= exp.duration) this.explosions.splice(i, 1);
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.life -= dt;
      if (f.life <= 0) this.fires.splice(i, 1);
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 4 + Math.random() * 12;
      const life = 0.22 + Math.random() * 0.28;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 0.45 + Math.random() * 0.55,
        color,
        life,
        maxLife: life,
      });
    }
  }

  private getDayPhase(): DayPhase {
    const t = this.timeOfDay;
    if (t >= 0.2 && t < 0.34) return 'Şafak';
    if (t >= 0.34 && t < 0.68) return 'Gündüz';
    if (t >= 0.68 && t < 0.82) return 'Akşam';
    return 'Gece';
  }

  public getHudSnapshot(): HudSnapshot {
    let selectedPolice = 0;
    let selectedSoldiers = 0;
    let policeAlive = 0;
    let soldiersAlive = 0;
    let staminaSum = 0;
    let activeStaminaCount = 0;

    const selectedUnits: HudSnapshot['selectedUnits'] = [];
    for (const u of this.units) {
      if (u.kind === 'police') {
        policeAlive++;
        if (u.selected && u.inVehicleId === null) selectedPolice++;
      } else {
        soldiersAlive++;
        if (u.selected && u.inVehicleId === null) selectedSoldiers++;
      }
      if (u.inVehicleId === null) {
        staminaSum += (u.stamina / Math.max(1, u.maxStamina)) * 100;
        activeStaminaCount++;
      }
      if (u.selected && u.inVehicleId === null && selectedUnits.length < 18) {
        selectedUnits.push({
          id: u.id,
          kind: u.kind,
          role: u.role,
          weaponClass: u.weaponClass,
          hp: Math.ceil(u.hp),
          maxHp: u.maxHp,
          stamina: Math.round(u.stamina),
          maxStamina: u.maxStamina,
          exhausted: u.exhausted,
          ammo: u.ammo,
          maxAmmo: u.maxAmmo,
          infected: Boolean(u.infected),
        });
      }
    }

    const selectedVehicles = this.vehicles
      .filter((v) => v.selected)
      .map((v) => ({
        id: v.id,
        kind: v.kind,
        hp: Math.ceil(v.hp),
        maxHp: v.maxHp,
        occupants: v.occupants.length,
        maxOccupants: v.maxOccupants,
        sirenOn: v.sirenOn,
        occupantRoles: v.occupants.map((o) => o.role),
      }));

    const zombieDenom = Math.max(1, this.zombiesSpawnedTotal);
    const zombieKillRatePct = Math.min(100, Math.round((this.zombiesKilled / zombieDenom) * 100));
    const resolvedCivs = this.civiliansEvacuated + this.civiliansLost;
    const civDenom = Math.max(1, resolvedCivs > 0 ? Math.max(this.civiliansInitial, resolvedCivs) : this.civiliansInitial);
    const civEvacEfficiencyPct = Math.min(100, Math.round((this.civiliansEvacuated / civDenom) * 100));
    const totalDeployedUnits = Math.max(1, this.policeInitial + this.soldiersInitial);
    const totalUnitLosses = this.policeLosses + this.soldierLosses;
    const unitLossPct = Math.min(100, Math.round((totalUnitLosses / totalDeployedUnits) * 100));

    return {
      zombiesAlive: this.zombies.length,
      zombiesInitial: this.zombiesInitial,
      zombiesKilled: this.zombiesKilled,
      civiliansAlive: this.civilians.length,
      civiliansInitial: this.civiliansInitial,
      civiliansEvacuated: this.civiliansEvacuated,
      civiliansLost: this.civiliansLost,
      policeAlive,
      policeCap: this.policeCap,
      policeInitial: this.policeInitial,
      policeLosses: this.policeLosses,
      soldiersAlive,
      soldiersCap: this.soldiersCap,
      soldiersInitial: this.soldiersInitial,
      soldiersLosses: this.soldierLosses,
      zombieKillRatePct,
      civEvacEfficiencyPct,
      unitLossPct,
      avgUnitStaminaPct: activeStaminaCount > 0 ? Math.round(staminaSum / activeStaminaCount) : 100,
      vehiclesCount: this.vehicles.length,
      helicoptersRemaining: this.helicoptersRemaining,
      helicoptersTotal: this.helicoptersTotal,
      activeHelicopters: this.helicopters.map((h) => ({
        id: h.id,
        passengers: h.passengers,
        maxCapacity: h.maxCapacity,
        state: h.state,
        mode: h.mode,
        x: h.x,
        y: h.y,
      })),
      activeChinooks: this.chinooks.length,
      activeAirstrikes: this.airstrikes.length,
      barricadesCount: this.barricades.length,
      barricadesRemaining: Math.max(0, this.barricadesMax - this.barricadesBuiltCount),
      barricadesMax: this.barricadesMax,
      quarantineCount: this.quarantineZones.length,
      quarantineRemaining: Math.max(0, this.quarantineMax - this.quarantineZones.length),
      quarantineMax: this.quarantineMax,
      selectedCount: selectedPolice + selectedSoldiers + selectedVehicles.length,
      selectedPolice,
      selectedSoldiers,
      selectedUnits,
      selectedVehicles,
      reinforceCooldown: Number(this.reinforceCooldown.toFixed(0)),
      outbreakCenter: { ...this.outbreakCenter },
      missionTimeSec: Math.floor(this.missionTimeSec),
      timeOfDay: this.timeOfDay,
      dayPhase: this.getDayPhase(),
      lodLabel: this.currentLodLabel,
      sirenMode: this.sirenMode,
      frozen: this.frozen,
      outcome: this.outcome,
      eventLog: [...this.eventLog],
    };
  }

  private emitHud() {
    this.callbacks.onHudUpdate(this.getHudSnapshot());
  }

  public renderOnMap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    proj: MapProjector,
    options: {
      showObstacles: boolean;
      selectionBox: { x1: number; y1: number; x2: number; y2: number } | null;
      heliPlacementHover: { x: number; y: number } | null;
      linePreview?: { x1: number; y1: number; x2: number; y2: number; color: string } | null;
      viewBounds?: { minX: number; maxX: number; minY: number; maxY: number } | null;
      skipClear?: boolean;
    }
  ) {
    if (!options.skipClear) {
      ctx.clearRect(0, 0, width, height);
    }
    const ppm = Math.max(0.05, proj.pixelsPerMeter);
    const lod = computeLODTier(ppm);
    this.currentLodLabel = lod.label;
    const checkGlowCover = lod.tier <= 1;
    const vb = options.viewBounds;
    const aff = proj.affine;

    // 0. NavMesh Walkability Grid Overlay (only when toggled on by player)
    if (options.showObstacles && this.navMesh) {
      this.navMesh.renderDebugOverlay(ctx, width, height, proj.project, vb);
    }

    // 1. Sector Boundary Border
    const tl = proj.project(-this.halfSize, -this.halfSize);
    const br = proj.project(this.halfSize, this.halfSize);
    if (tl && br) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(tl.px, tl.py, br.px - tl.px, br.py - tl.py);
      ctx.restore();
    }

    // 2. Permanent Bomb Craters, Blood Pools & Corpses (with viewport culling & affine projection)
    for (let i = 0; i < this.craters.length; i++) {
      const crater = this.craters[i];
      if (vb && (crater.x < vb.minX - 60 || crater.x > vb.maxX + 60 || crater.y < vb.minY - 60 || crater.y > vb.maxY + 60)) continue;
      const px = aff ? aff.px0 + crater.x * aff.scaleX : proj.project(crater.x, crater.y)?.px;
      const py = aff ? aff.py0 + crater.y * (aff.scaleY + aff.quadY * crater.y) : proj.project(crater.x, crater.y)?.py;
      if (px === undefined || py === undefined || px < -80 || px > width + 80 || py < -80 || py > height + 80) continue;
      renderCrater(ctx, px, py, ppm, crater);
    }

    if (ppm >= 0.35) {
      for (let i = 0; i < this.bloodStains.length; i++) {
        const b = this.bloodStains[i];
        if (vb && (b.x < vb.minX - 15 || b.x > vb.maxX + 15 || b.y < vb.minY - 15 || b.y > vb.maxY + 15)) continue;
        const px = aff ? aff.px0 + b.x * aff.scaleX : proj.project(b.x, b.y)?.px;
        const py = aff ? aff.py0 + b.y * (aff.scaleY + aff.quadY * b.y) : proj.project(b.x, b.y)?.py;
        if (px === undefined || py === undefined || px < -20 || px > width + 20 || py < -20 || py > height + 20) continue;
        renderBloodStain(ctx, px, py, ppm, b);
      }
    }

    if (ppm >= 0.42) {
      for (let i = 0; i < this.corpses.length; i++) {
        const corpse = this.corpses[i];
        if (vb && (corpse.x < vb.minX - 15 || corpse.x > vb.maxX + 15 || corpse.y < vb.minY - 15 || corpse.y > vb.maxY + 15)) continue;
        const px = aff ? aff.px0 + corpse.x * aff.scaleX : proj.project(corpse.x, corpse.y)?.px;
        const py = aff ? aff.py0 + corpse.y * (aff.scaleY + aff.quadY * corpse.y) : proj.project(corpse.x, corpse.y)?.py;
        if (px === undefined || py === undefined || px < -24 || px > width + 24 || py < -24 || py > height + 24) continue;
        renderCorpse(ctx, px, py, ppm, corpse);
      }
    }

    // 3. Quarantine Zones (Scanning Radar + Active Watchtowers & Barriers)
    for (let i = 0; i < this.quarantineZones.length; i++) {
      const qz = this.quarantineZones[i];
      const p = proj.project(qz.x, qz.y);
      if (!p) continue;
      renderQuarantineZone(ctx, p.px, p.py, ppm, qz, this.elapsedVisual, proj.project);
    }

    // 3b. Automatic Zombie Density Heatmap Layer (Soft Red Thermal Glow)
    renderZombieHeatmap(
      ctx,
      width,
      height,
      ppm,
      proj.project,
      this.zombies,
      vb,
      this.halfSize,
      this.elapsedVisual
    );

    // 4. City Obstacles (viewport-culled via viewBounds when available)
    const obsList = vb
      ? this.obstacleGrid.queryBoxScratch(vb.minX - 60, vb.minY - 60, vb.maxX + 60, vb.maxY + 60)
      : this.obstacles;
    for (let i = 0; i < obsList.length; i++) {
      const ob = obsList[i];
      if (ob.kind === 'barricade') continue;
      if (ob.kind === 'vehicle' && ob.x !== undefined && ob.y !== undefined && ob.w && ob.h) {
        if (ppm < 0.25) continue;
        const px = aff ? aff.px0 + ob.x * aff.scaleX : proj.project(ob.x, ob.y)?.px;
        const py = aff ? aff.py0 + ob.y * (aff.scaleY + aff.quadY * ob.y) : proj.project(ob.x, ob.y)?.py;
        if (px === undefined || py === undefined || px < -40 || px > width + 40 || py < -40 || py > height + 40) continue;
        renderStaticVehicleModel(ctx, px, py, ob.w * ppm, ob.h * ppm, ob.angle ?? 0, ob.color ?? '#64748b');
        continue;
      }

      if (!options.showObstacles) continue;

      if (ob.shape === 'circle' && ob.x !== undefined && ob.y !== undefined && ob.radius !== undefined) {
        const p = proj.project(ob.x, ob.y);
        if (!p || p.px < -30 || p.px > width + 30 || p.py < -30 || p.py > height + 30) continue;
        const r = Math.max(2, ob.radius * ppm);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ob.shape === 'rect' && ob.x !== undefined && ob.y !== undefined && ob.w && ob.h) {
        const p = proj.project(ob.x, ob.y);
        if (!p || p.px < -80 || p.px > width + 80 || p.py < -80 || p.py > height + 80) continue;
        ctx.save();
        ctx.translate(p.px, p.py);
        ctx.rotate(ob.angle ?? 0);
        const rw = ob.w * ppm;
        const rh = ob.h * ppm;
        ctx.strokeStyle = ob.kind === 'barrier' ? 'rgba(56, 189, 248, 0.42)' : 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
        ctx.restore();
      } else if (ob.shape === 'polygon' && ob.points && ob.points.length >= 3) {
        const p0 = proj.project(ob.minX, ob.minY);
        const p1 = proj.project(ob.maxX, ob.maxY);
        if (p0 && p1 && (p1.px < 0 || p0.px > width || p1.py < 0 || p0.py > height)) continue;
        ctx.strokeStyle =
          ob.kind === 'tree'
            ? 'rgba(52, 211, 153, 0.35)'
            : ob.kind === 'barrier'
              ? 'rgba(56, 189, 248, 0.4)'
              : 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        let started = false;
        for (const pt of ob.points) {
          const p = proj.project(pt.x, pt.y);
          if (!p) continue;
          if (!started) {
            ctx.moveTo(p.px, p.py);
            started = true;
          } else {
            ctx.lineTo(p.px, p.py);
          }
        }
        if (started) {
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // 5. Player Barricades & Fires
    for (const bar of this.barricades) {
      const p = proj.project(bar.x, bar.y);
      if (!p) continue;
      renderBarricade(ctx, p.px, p.py, ppm, bar);
    }

    for (const fire of this.fires) {
      const p = proj.project(fire.x, fire.y);
      if (!p || p.px < -90 || p.px > width + 90 || p.py < -90 || p.py > height + 90) continue;
      renderFireSpot(ctx, p.px, p.py, ppm, fire, this.elapsedVisual);
    }

    // 6. Helicopter LZ Hover & Evac Rings
    if (options.heliPlacementHover) {
      const p = proj.project(options.heliPlacementHover.x, options.heliPlacementHover.y);
      if (p) {
        const blocked = isPointBlocked(options.heliPlacementHover.x, options.heliPlacementHover.y, 4.5, this.obstacleGrid);
        ctx.save();
        ctx.fillStyle = blocked ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
        ctx.strokeStyle = blocked ? '#ef4444' : '#34d399';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(p.px, p.py, 100 * ppm, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const h of this.helicopters) {
      const p = proj.project(h.targetX, h.targetY);
      if (!p) continue;
      const radPx = h.evacRadius * ppm;
      const pulse = 0.65 + Math.sin(this.elapsedVisual * 4) * 0.25;
      ctx.save();
      ctx.fillStyle = h.mode === 'gunship' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.07)';
      ctx.strokeStyle = h.mode === 'gunship' ? `rgba(248, 113, 113, ${pulse})` : `rgba(52, 211, 153, ${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(p.px, p.py, radPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (options.linePreview) {
      const p1 = proj.project(options.linePreview.x1, options.linePreview.y1);
      const p2 = proj.project(options.linePreview.x2, options.linePreview.y2);
      if (p1 && p2) {
        ctx.save();
        ctx.strokeStyle = options.linePreview.color;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
        ctx.fillStyle = options.linePreview.color;
        ctx.beginPath();
        ctx.arc(p2.px, p2.py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 7. Vehicles (3D Emergency Lightbars synced to active sirenMode)
    for (const v of this.vehicles) {
      const p = proj.project(v.x, v.y);
      if (!p || p.px < -60 || p.px > width + 60 || p.py < -60 || p.py > height + 60) continue;
      renderDynamicVehicleModel(ctx, p.px, p.py, ppm, v, this.elapsedVisual, this.sirenMode);
    }

    // 8. Order Markers & Unit Paths
    for (const m of this.orderMarkers) {
      const p = proj.project(m.x, m.y);
      if (!p) continue;
      const ratio = m.life / m.maxLife;
      ctx.save();
      ctx.globalAlpha = ratio;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.px, p.py, 5 + (1 - ratio) * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    for (const u of this.units) {
      if (!u.selected || !u.targetPos || u.inVehicleId !== null) continue;
      const pts: { x: number; y: number }[] = [{ x: u.x, y: u.y }, u.targetPos, ...(u.waypoints ?? [])];
      ctx.beginPath();
      let started = false;
      for (const pt of pts) {
        const p = proj.project(pt.x, pt.y);
        if (!p) continue;
        if (!started) {
          ctx.moveTo(p.px, p.py);
          started = true;
        } else {
          ctx.lineTo(p.px, p.py);
        }
      }
      if (started) ctx.stroke();
    }
    for (const v of this.vehicles) {
      if (!v.selected || !v.targetPos) continue;
      const pts: { x: number; y: number }[] = [{ x: v.x, y: v.y }, v.targetPos, ...(v.waypoints ?? [])];
      ctx.beginPath();
      let started = false;
      for (const pt of pts) {
        const p = proj.project(pt.x, pt.y);
        if (!p) continue;
        if (!started) {
          ctx.moveTo(p.px, p.py);
          started = true;
        } else {
          ctx.lineTo(p.px, p.py);
        }
      }
      if (started) ctx.stroke();
    }
    ctx.restore();

    // 9. 2D Sprite Sheet Entities (Zero-alloc inline affine projection + viewport culling for 15,000 agents!)
    const cullPad = 24;
    if (lod.tier === 3) {
      if (aff) {
        const { px0, py0, scaleX, scaleY, quadY } = aff;
        ctx.fillStyle = '#f8fafc';
        for (let i = 0; i < this.civilians.length; i++) {
          const c = this.civilians[i];
          if (vb && (c.x < vb.minX - cullPad || c.x > vb.maxX + cullPad || c.y < vb.minY - cullPad || c.y > vb.maxY + cullPad)) continue;
          const px = px0 + c.x * scaleX;
          const py = py0 + c.y * (scaleY + quadY * c.y);
          if (px >= -4 && px <= width + 4 && py >= -4 && py <= height + 4) {
            ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
          }
        }
        ctx.fillStyle = '#ef4444';
        for (let i = 0; i < this.zombies.length; i++) {
          const z = this.zombies[i];
          if (vb && (z.x < vb.minX - cullPad || z.x > vb.maxX + cullPad || z.y < vb.minY - cullPad || z.y > vb.maxY + cullPad)) continue;
          const px = px0 + z.x * scaleX;
          const py = py0 + z.y * (scaleY + quadY * z.y);
          if (px >= -4 && px <= width + 4 && py >= -4 && py <= height + 4) {
            ctx.fillRect(px - 1.8, py - 1.8, 3.6, 3.6);
          }
        }
        for (let i = 0; i < this.units.length; i++) {
          const u = this.units[i];
          if (u.inVehicleId !== null) continue;
          if (vb && (u.x < vb.minX - cullPad || u.x > vb.maxX + cullPad || u.y < vb.minY - cullPad || u.y > vb.maxY + cullPad)) continue;
          const px = px0 + u.x * scaleX;
          const py = py0 + u.y * (scaleY + quadY * u.y);
          if (px >= -6 && px <= width + 6 && py >= -6 && py <= height + 6) {
            ctx.fillStyle = u.kind === 'soldier' ? '#22c55e' : '#38bdf8';
            ctx.fillRect(px - 2.4, py - 2.4, 4.8, 4.8);
          }
        }
      } else {
        ctx.fillStyle = '#f8fafc';
        for (let i = 0; i < this.civilians.length; i++) {
          const c = this.civilians[i];
          const p = proj.project(c.x, c.y);
          if (p && p.px >= -4 && p.px <= width + 4 && p.py >= -4 && p.py <= height + 4) {
            ctx.fillRect(p.px - 1.5, p.py - 1.5, 3, 3);
          }
        }
        ctx.fillStyle = '#ef4444';
        for (let i = 0; i < this.zombies.length; i++) {
          const z = this.zombies[i];
          const p = proj.project(z.x, z.y);
          if (p && p.px >= -4 && p.px <= width + 4 && p.py >= -4 && p.py <= height + 4) {
            ctx.fillRect(p.px - 1.8, p.py - 1.8, 3.6, 3.6);
          }
        }
        for (let i = 0; i < this.units.length; i++) {
          const u = this.units[i];
          if (u.inVehicleId !== null) continue;
          const p = proj.project(u.x, u.y);
          if (p && p.px >= -6 && p.px <= width + 6 && p.py >= -6 && p.py <= height + 6) {
            ctx.fillStyle = u.kind === 'soldier' ? '#22c55e' : '#38bdf8';
            ctx.fillRect(p.px - 2.4, p.py - 2.4, 4.8, 4.8);
          }
        }
      }
    } else if (aff) {
      const { px0, py0, scaleX, scaleY, quadY } = aff;
      for (let i = 0; i < this.civilians.length; i++) {
        const c = this.civilians[i];
        if (vb && (c.x < vb.minX - cullPad || c.x > vb.maxX + cullPad || c.y < vb.minY - cullPad || c.y > vb.maxY + cullPad)) continue;
        const px = px0 + c.x * scaleX;
        const py = py0 + c.y * (scaleY + quadY * c.y);
        if (px < -24 || px > width + 24 || py < -24 || py > height + 24) continue;
        renderCivilianSprite(ctx, px, py, ppm, c, checkGlowCover && Boolean(c.inCoverGlow));
      }

      for (let i = 0; i < this.zombies.length; i++) {
        const z = this.zombies[i];
        if (vb && (z.x < vb.minX - cullPad || z.x > vb.maxX + cullPad || z.y < vb.minY - cullPad || z.y > vb.maxY + cullPad)) continue;
        const px = px0 + z.x * scaleX;
        const py = py0 + z.y * (scaleY + quadY * z.y);
        if (px < -26 || px > width + 26 || py < -26 || py > height + 26) continue;
        renderZombieSprite(ctx, px, py, ppm, z, checkGlowCover && Boolean(z.inCoverGlow));
      }

      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.inVehicleId !== null) continue;
        if (vb && (u.x < vb.minX - cullPad || u.x > vb.maxX + cullPad || u.y < vb.minY - cullPad || u.y > vb.maxY + cullPad)) continue;
        const px = px0 + u.x * scaleX;
        const py = py0 + u.y * (scaleY + quadY * u.y);
        if (px < -30 || px > width + 30 || py < -30 || py > height + 30) continue;
        renderUnitSprite(ctx, px, py, ppm, u, checkGlowCover && Boolean(u.inCoverGlow), this.elapsedVisual);
      }
    } else {
      for (let i = 0; i < this.civilians.length; i++) {
        const c = this.civilians[i];
        const p = proj.project(c.x, c.y);
        if (!p || p.px < -24 || p.px > width + 24 || p.py < -24 || p.py > height + 24) continue;
        renderCivilianSprite(ctx, p.px, p.py, ppm, c, checkGlowCover && Boolean(c.inCoverGlow));
      }

      for (let i = 0; i < this.zombies.length; i++) {
        const z = this.zombies[i];
        const p = proj.project(z.x, z.y);
        if (!p || p.px < -26 || p.px > width + 26 || p.py < -26 || p.py > height + 26) continue;
        renderZombieSprite(ctx, p.px, p.py, ppm, z, checkGlowCover && Boolean(z.inCoverGlow));
      }

      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.inVehicleId !== null) continue;
        const p = proj.project(u.x, u.y);
        if (!p || p.px < -30 || p.px > width + 30 || p.py < -30 || p.py > height + 30) continue;
        renderUnitSprite(ctx, p.px, p.py, ppm, u, checkGlowCover && Boolean(u.inCoverGlow), this.elapsedVisual);
      }
    }

    // 9a. Occluded silhouette pass deferred to 11b (drawn cleanly after night wash)

    // 9b. Volumetric 3D-Style Explosion -> Fireball -> Smoke Sequences
    for (const exp of this.explosions) {
      const p = proj.project(exp.x, exp.y);
      if (!p || p.px < -140 || p.px > width + 140 || p.py < -140 || p.py > height + 140) continue;
      renderVolumetricExplosion(ctx, p.px, p.py, ppm, exp);
    }

    // 10. Muzzle Flashes, Shell Casings, Impact Sparks, Medic/Water Beams & Shockwaves
    for (let i = 0; i < this.shellCasings.length; i++) {
      const sc = this.shellCasings[i];
      const p = proj.project(sc.x, sc.y);
      if (!p || p.px < -12 || p.px > width + 12 || p.py < -12 || p.py > height + 12) continue;
      renderShellCasing(ctx, p.px, p.py, ppm, sc);
    }

    for (let i = 0; i < this.muzzleFlashes.length; i++) {
      const mf = this.muzzleFlashes[i];
      const p = proj.project(mf.x, mf.y);
      if (!p || p.px < -30 || p.px > width + 30 || p.py < -30 || p.py > height + 30) continue;
      renderMuzzleFlash(ctx, p.px, p.py, ppm, mf);
    }

    for (let i = 0; i < this.impactSparks.length; i++) {
      const sp = this.impactSparks[i];
      const p = proj.project(sp.x, sp.y);
      if (!p || p.px < -20 || p.px > width + 20 || p.py < -20 || p.py > height + 20) continue;
      renderImpactSpark(ctx, p.px, p.py, ppm, sp);
    }

    for (const t of this.tracers) {
      const p1 = proj.project(t.x1, t.y1);
      const p2 = proj.project(t.x2, t.y2);
      if (!p1 || !p2) continue;
      ctx.save();
      ctx.globalAlpha = t.life / t.maxLife;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.width ?? 1.8;
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of this.particles) {
      const p = proj.project(pt.x, pt.y);
      if (!p) continue;
      ctx.save();
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(p.px, p.py, Math.max(1.4, pt.radius * ppm), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const sw of this.shockwaves) {
      const p = proj.project(sw.x, sw.y);
      if (!p) continue;
      ctx.save();
      ctx.globalAlpha = sw.life / sw.maxLife;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.px, p.py, sw.radius * ppm, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 11. Atmospheric Day / Night Lighting Overlay + Dynamic Flashlights / Headlights / 3D Rotating Sirens
    renderDayNightAtmosphere(
      ctx,
      width,
      height,
      ppm,
      this.timeOfDay,
      this.elapsedVisual,
      proj.project,
      this.units,
      this.vehicles,
      this.helicopters,
      this.fires,
      this.quarantineZones,
      this.explosions,
      this.sirenMode
    );

    // 11b. Stencil-Masked ZOS Neon Occluded Entity Outlines (masked strictly to building/tree/shadow geometry)
    if (ppm >= 0.42 && lod.tier <= 2) {
      const occludedItems: OccludedSilhouetteItem[] = [];

      for (let i = 0; i < this.civilians.length; i++) {
        const c = this.civilians[i];
        if (!c.occluded) continue;
        if (vb && (c.x < vb.minX - cullPad || c.x > vb.maxX + cullPad || c.y < vb.minY - cullPad || c.y > vb.maxY + cullPad)) continue;
        const p = aff
          ? { px: aff.px0 + c.x * aff.scaleX, py: aff.py0 + c.y * (aff.scaleY + aff.quadY * c.y) }
          : proj.project(c.x, c.y);
        if (!p || p.px < -24 || p.px > width + 24 || p.py < -24 || p.py > height + 24) continue;
        occludedItems.push({
          px: p.px,
          py: p.py,
          faction: 'civilian',
          facing: c.facing,
          scaleMult: 0.96,
          isSelected: false,
        });
      }

      for (let i = 0; i < this.zombies.length; i++) {
        const z = this.zombies[i];
        if (!z.occluded) continue;
        if (vb && (z.x < vb.minX - cullPad || z.x > vb.maxX + cullPad || z.y < vb.minY - cullPad || z.y > vb.maxY + cullPad)) continue;
        const p = aff
          ? { px: aff.px0 + z.x * aff.scaleX, py: aff.py0 + z.y * (aff.scaleY + aff.quadY * z.y) }
          : proj.project(z.x, z.y);
        if (!p || p.px < -24 || p.px > width + 24 || p.py < -24 || p.py > height + 24) continue;
        const scaleMult = z.variant === 'fat' ? 1.2 : z.variant === 'heavy' ? 1.12 : 1.0;
        occludedItems.push({
          px: p.px,
          py: p.py,
          faction: 'zombie',
          facing: z.facing,
          scaleMult,
          isSelected: false,
        });
      }

      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.inVehicleId !== null || u.parachuteAlt > 0 || !u.occluded) continue;
        if (vb && (u.x < vb.minX - cullPad || u.x > vb.maxX + cullPad || u.y < vb.minY - cullPad || u.y > vb.maxY + cullPad)) continue;
        const p = aff
          ? { px: aff.px0 + u.x * aff.scaleX, py: aff.py0 + u.y * (aff.scaleY + aff.quadY * u.y) }
          : proj.project(u.x, u.y);
        if (!p || p.px < -26 || p.px > width + 26 || p.py < -26 || p.py > height + 26) continue;
        occludedItems.push({
          px: p.px,
          py: p.py,
          faction: u.kind,
          facing: u.facing,
          scaleMult: 1.05,
          isSelected: u.selected,
        });
      }

      if (occludedItems.length > 0) {
        renderOccludedSilhouettesMasked(
          ctx,
          width,
          height,
          ppm,
          this.cameraTiltDeg,
          proj.project,
          this.occlusionZones,
          vb,
          occludedItems
        );
      }
    }

    // 12. Flying Helicopters, CH-47 Chinooks & Low-Altitude A-10 Aircraft (drawn crisp above twilight/night wash)
    for (const h of this.helicopters) {
      const p = proj.project(h.x, h.y);
      if (!p) continue;
      renderHelicopterModel(ctx, p.px, p.py, ppm, h, this.elapsedVisual);
    }

    for (const ch of this.chinooks) {
      const p = proj.project(ch.x, ch.y);
      if (!p || p.px < -140 || p.px > width + 140 || p.py < -140 || p.py > height + 140) continue;
      renderChinookModel(ctx, p.px, p.py, ppm, ch, this.elapsedVisual);
    }

    for (const strike of this.airstrikes) {
      const p = proj.project(strike.planeX, strike.planeY);
      if (!p) continue;
      renderA10Plane(ctx, p.px, p.py, ppm, strike);
    }

    // 13. Age of Empires Selection Box
    if (options.selectionBox) {
      const { x1, y1, x2, y2 } = options.selectionBox;
      const bx = Math.min(x1, x2);
      const by = Math.min(y1, y2);
      const bw = Math.abs(x2 - x1);
      const bh = Math.abs(y2 - y1);
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    }
  }

  public renderMinimap(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    viewBoundsMeters: { minX: number; maxX: number; minY: number; maxY: number } | null
  ) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090e1a';
    ctx.fillRect(0, 0, w, h);

    const toMini = (mx: number, my: number) => ({
      px: ((mx + this.halfSize) / (this.halfSize * 2)) * w,
      py: ((my + this.halfSize) / (this.halfSize * 2)) * h,
    });

    const step = this.obstacles.length > 1800 ? 2 : 1;
    for (let i = 0; i < this.obstacles.length; i += step) {
      const ob = this.obstacles[i];
      const tl = toMini(ob.minX, ob.minY);
      const br = toMini(ob.maxX, ob.maxY);
      ctx.fillStyle =
        ob.kind === 'barricade'
          ? '#fbbf24'
          : ob.kind === 'barrier'
            ? 'rgba(14, 116, 144, 0.72)'
            : ob.kind === 'vehicle'
              ? 'rgba(251, 191, 36, 0.55)'
              : ob.kind === 'tree'
                ? 'rgba(16, 185, 129, 0.45)'
                : 'rgba(100, 116, 139, 0.6)';
      ctx.fillRect(tl.px, tl.py, Math.max(1.2, br.px - tl.px), Math.max(1.2, br.py - tl.py));
    }

    const civStep = Math.max(1, Math.floor(this.civilians.length / 800));
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < this.civilians.length; i += civStep) {
      const c = this.civilians[i];
      const p = toMini(c.x, c.y);
      ctx.fillRect(p.px - 1, p.py - 1, 2, 2);
    }

    if (this.zombies.length > 0) {
      const miniBins = 18;
      const heatBins = new Float32Array(miniBins * miniBins);
      const fullSpan = this.halfSize * 2;
      for (let i = 0; i < this.zombies.length; i++) {
        const z = this.zombies[i];
        const bx = Math.max(0, Math.min(miniBins - 1, Math.floor(((z.x + this.halfSize) / fullSpan) * miniBins)));
        const by = Math.max(0, Math.min(miniBins - 1, Math.floor(((z.y + this.halfSize) / fullSpan) * miniBins)));
        heatBins[by * miniBins + bx] += 1;
      }
      const cellW = w / miniBins;
      const cellH = h / miniBins;
      for (let by = 0; by < miniBins; by++) {
        for (let bx = 0; bx < miniBins; bx++) {
          const cnt = heatBins[by * miniBins + bx];
          if (cnt <= 0) continue;
          const a = Math.min(0.45, 0.08 + (1 - Math.exp(-cnt / 6)) * 0.36);
          ctx.fillStyle = `rgba(239, 68, 68, ${a.toFixed(2)})`;
          ctx.fillRect(bx * cellW - cellW * 0.25, by * cellH - cellH * 0.25, cellW * 1.5, cellH * 1.5);
        }
      }
    }

    const zStep = Math.max(1, Math.floor(this.zombies.length / 800));
    ctx.fillStyle = '#ef4444';
    for (let i = 0; i < this.zombies.length; i += zStep) {
      const z = this.zombies[i];
      const p = toMini(z.x, z.y);
      ctx.fillRect(p.px - 1.2, p.py - 1.2, 2.4, 2.4);
    }

    for (const u of this.units) {
      if (u.inVehicleId !== null) continue;
      const p = toMini(u.x, u.y);
      ctx.fillStyle = u.kind === 'soldier' ? '#10b981' : '#3b82f6';
      ctx.fillRect(p.px - 1.8, p.py - 1.8, 3.6, 3.6);
    }

    ctx.fillStyle = '#fbbf24';
    for (const heli of this.helicopters) {
      const p = toMini(heli.x, heli.y);
      ctx.beginPath();
      ctx.arc(p.px, p.py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (viewBoundsMeters) {
      const tl = toMini(viewBoundsMeters.minX, viewBoundsMeters.minY);
      const br = toMini(viewBoundsMeters.maxX, viewBoundsMeters.maxY);
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.px, tl.py, br.px - tl.px, br.py - tl.py);
    }
  }
}
