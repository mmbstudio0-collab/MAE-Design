export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type CommandTool =
  | 'command'
  | 'spawn_zombie'
  | 'spawn_civilian'
  | 'spawn_police'
  | 'spawn_soldier'
  | 'call_heli'
  | 'spawn_vehicle'
  | 'airstrike'
  | 'barricade'
  | 'quarantine';

export interface MinMaxRange {
  min: number;
  max: number;
}

export type ZombieSpawnMode = 'random' | 'north' | 'south' | 'west' | 'east';

export interface GeoOrigin {
  lat: number;
  lng: number;
}

export interface TacticalSectorPreset {
  id: string;
  name: string;
  subtitle: string;
  origin: GeoOrigin;
  defaultHalfSize: number;
  recommendedZoom: number;
}

export interface MissionConfig {
  zombies: MinMaxRange;
  civilians: MinMaxRange;
  police: MinMaxRange;
  soldiers: MinMaxRange;
  helicopters: MinMaxRange;
  sectorSizeMeters: number;
  zombieSpawnMode: ZombieSpawnMode;
  armedCivilianPct: number; // 0..100
  origin: GeoOrigin;
  sectorName: string;
}

export type UnitKind = 'police' | 'soldier';

export type PoliceRole =
  | 'normal'
  | 'traffic'
  | 'special_ops'
  | 'swat'
  | 'commissioner'
  | 'riot_shield';

export type SoldierRole =
  | 'infantry'
  | 'commando'
  | 'sniper'
  | 'heavy'
  | 'medic'
  | 'paratrooper';

export type UnitRole = PoliceRole | SoldierRole;

export type WeaponClass = 'pistol' | 'smg' | 'rifle' | 'heavy' | 'sniper';

export type ZombieVariant =
  | 'walker'
  | 'runner'
  | 'heavy'
  | 'fat'
  | 'crawler'
  | 'fresh_infected';

export type VehicleKind =
  | 'police_car'
  | 'police_van'
  | 'ambulance'
  | 'fire_truck'
  | 'civilian_car'
  | 'motorcycle'
  | 'military_jeep'
  | 'armored_apc';

export interface ToolSelection {
  tool: CommandTool;
  zombieVariant: ZombieVariant;
  civilianPreset: 'random' | 'armed' | 'wounded';
  policeRole: PoliceRole;
  soldierRole: SoldierRole;
  heliMode: 'evac' | 'gunship';
  vehicleKind: VehicleKind;
}

export type DayPhase = 'Şafak' | 'Gündüz' | 'Akşam' | 'Gece';

export type SirenMode = 'wail' | 'yelp' | 'hi_lo';

export type SpriteAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'shoot'
  | 'hit'
  | 'death';

export interface Unit {
  id: number;
  kind: UnitKind;
  role: UnitRole;
  weaponClass: WeaponClass;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  exhausted: boolean;
  radius: number;
  speed: number;
  range: number;
  fireInterval: number;
  fireTimer: number;
  damage: number;
  ammo: number;
  maxAmmo: number;
  reloadTimer: number;
  reloadDuration: number;
  facing: number;
  targetPos: { x: number; y: number } | null;
  waypoints?: { x: number; y: number }[];
  targetVehicleId: number | null;
  focusZombieId: number | null;
  selected: boolean;
  hitFlash: number;
  muzzleFlash: number;
  walkPhase: number;
  isMoving: boolean;
  animState:
    | 'idle'
    | 'walking'
    | 'running'
    | 'aiming'
    | 'reloading'
    | 'cover'
    | 'parachuting';
  inCover: boolean;
  inCoverGlow?: boolean;
  carryingCivilianId: number | null;
  parachuteAlt: number;
  parachuteSway: number;
  inVehicleId: number | null;
  animTime: number;
  shootAnim: number;
  steerBias?: 1 | -1;
  steerLockTimer?: number;
  garrisonZoneId?: number;
  infected?: boolean;
  infectionStage?: InfectionStage;
  infectionTimer?: number;
  infectionDuration?: number;
  infectionStageDuration?: number;
  lastBiteAt?: number;
  vomitCooldown?: number;
  gender?: CivilianGender;
  occluded?: boolean;
}

export type InfectionStage = 'latent' | 'vomiting' | 'dying';

export type CivilianGender = 'male' | 'female';
export type CivilianAgeGroup = 'adult' | 'elderly';
export type CivilianHairStyle = 'short' | 'long' | 'bun' | 'bald';
export type CivilianGear = 'none' | 'backpack' | 'handbag' | 'briefcase';

export interface Civilian {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  exhausted: boolean;
  radius: number;
  speed: number;
  facing: number;
  wanderTarget: { x: number; y: number } | null;
  wanderTimer: number;
  state:
    | 'wandering'
    | 'running'
    | 'panicking'
    | 'boarding'
    | 'hiding'
    | 'calling_help'
    | 'carried'
    | 'fallen';
  targetHeliId: number | null;
  hitFlash: number;
  walkPhase: number;
  isMoving: boolean;
  shirtColor: string;
  gender: CivilianGender;
  ageGroup: CivilianAgeGroup;
  hairStyle: CivilianHairStyle;
  hairColor: string;
  gear: CivilianGear;
  armed: boolean;
  fireTimer: number;
  wounded: boolean;
  infected: boolean;
  infectionStage?: InfectionStage;
  infectionTimer: number;
  infectionDuration?: number;
  infectionStageDuration?: number;
  lastBiteAt?: number;
  vomitCooldown?: number;
  helpWavePhase: number;
  inCoverGlow?: boolean;
  occluded?: boolean;
  animTime: number;
  shootAnim: number;
  steerBias?: 1 | -1;
  steerLockTimer?: number;
}

export interface Zombie {
  id: number;
  variant: ZombieVariant;
  outfitId: number; // 0..127 (128 distinct modeled outfits)
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  facing: number;
  attackTimer: number;
  attackAnim: number;
  wanderTarget: { x: number; y: number } | null;
  wanderTimer: number;
  hitFlash: number;
  walkPhase: number;
  isMoving: boolean;
  animState:
    | 'wandering'
    | 'chasing'
    | 'walking'
    | 'running'
    | 'biting'
    | 'knocked_down'
    | 'getting_up'
    | 'crawling';
  stateTimer: number;
  shirtColor?: string;
  inCoverGlow?: boolean;
  occludedReveal?: boolean;
  occluded?: boolean;
  animTime: number;
  steerBias?: 1 | -1;
  steerLockTimer?: number;
}

export interface Helicopter {
  id: number;
  mode: 'evac' | 'gunship';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state:
    | 'inbound'
    | 'descending'
    | 'landed'
    | 'ascending'
    | 'outbound'
    | 'patrolling';
  altitude: number;
  rotorAngle: number;
  facing: number;
  passengers: number;
  maxCapacity: number;
  stateTimer: number;
  evacRadius: number;
  fireTimer: number;
  spotlightAngle: number;
  entryX?: number;
  entryY?: number;
}

export interface ChinookDrop {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angle: number;
  progress: number;
  rotorAngle: number;
  dropTargets: { x: number; y: number }[];
  droppedCount: number;
  nextDropIdx: number;
}

export interface VehicleEntity {
  id: number;
  kind: VehicleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  length: number;
  width: number;
  speed: number;
  hp: number;
  maxHp: number;
  maxOccupants: number;
  occupants: Unit[];
  targetPos: { x: number; y: number } | null;
  waypoints?: { x: number; y: number }[];
  selected: boolean;
  sirenOn: boolean;
  sirenPhase: number;
  fireTimer: number;
  turretAngle: number;
  muzzleFlash: number;
  actionTimer: number;
  color: string;
}

export interface A10Strike {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  planeX: number;
  planeY: number;
  angle: number;
  progress: number;
  bombedIndices: Set<number>;
  cannonTimer: number;
  bombRadius: number;
}

export interface Crater {
  id: number;
  x: number;
  y: number;
  radius: number;
  seed: number;
  variant: number;
  smokeTimer: number;
}

export interface FireSpot {
  id: number;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  life: number;
  maxLife: number;
  seed: number;
}

export interface ExplosionEffect {
  id: number;
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
  seed: number;
  rotation: number;
}

export interface BloodStain {
  x: number;
  y: number;
  radius: number;
  angle: number;
  alpha: number;
  isZombie: boolean;
}

export interface Corpse {
  x: number;
  y: number;
  angle: number;
  kind: 'zombie' | 'civilian' | 'police' | 'soldier';
  archetype: string;
  outfitId?: number;
  color: string;
  scale: number;
  collapseProgress: number;
}

export interface MuzzleFlashEffect {
  x: number;
  y: number;
  angle: number;
  weapon: WeaponClass;
  life: number;
  maxLife: number;
}

export interface ShellCasingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  life: number;
  maxLife: number;
}

export interface ImpactSparkEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Barricade {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  hp: number;
  maxHp: number;
}

export interface QuarantineTower {
  id: number;
  x: number;
  y: number;
  angle: number;
  searchlightAngle: number;
  fireTimer?: number;
  active: boolean;
}

export interface QuarantineBarrier {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  hp: number;
  maxHp: number;
}

export interface QuarantineZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  status: 'scanning' | 'active';
  scanProgress: number; // 0..1
  towers: QuarantineTower[];
  barriers: QuarantineBarrier[];
  garrisonUnitIds: number[];
}

export interface PlacementValidation {
  valid: boolean;
  reason?: string;
}

export interface BridgeCorridor {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  halfWidth: number;
}

export interface ObstacleStats {
  total: number;
  buildings: number;
  courtyards?: number;
  trees: number;
  vehicles: number;
  barriers: number;
  bridges?: number;
  roads: number;
  aiDetected?: number;
  shadowZones?: number;
}

export type ObstacleKind = 'building' | 'tree' | 'vehicle' | 'barrier' | 'barricade';

export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  shape: 'polygon' | 'circle' | 'rect';
  x: number;
  y: number;
  radius: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  angle?: number;
  points?: { x: number; y: number }[];
  holes?: { x: number; y: number }[][];
  isWater?: boolean;
  heightMeters?: number;
  source?: 'osm' | 'ai_vision' | 'fallback';
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  color?: string;
}

export interface OcclusionZone {
  id: string;
  kind: 'tree_canopy' | 'building_roof' | 'narrow_shadow' | 'barrier';
  shape: 'circle' | 'rect' | 'polygon';
  x: number;
  y: number;
  radius: number;
  w?: number;
  h?: number;
  angle?: number;
  points?: { x: number; y: number }[];
  heightMeters: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SelectedUnitHud {
  id: number;
  kind: UnitKind;
  role: UnitRole;
  weaponClass: WeaponClass;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  exhausted: boolean;
  ammo: number;
  maxAmmo: number;
  infected?: boolean;
}

export interface SelectedVehicleHud {
  id: number;
  kind: VehicleKind;
  hp: number;
  maxHp: number;
  occupants: number;
  maxOccupants: number;
  sirenOn: boolean;
  occupantRoles: UnitRole[];
}

export type TacticalLogSeverity = 'info' | 'warn' | 'alert' | 'success';

export interface TacticalLogEntry {
  id: number;
  timestampText: string;
  missionSec: number;
  severity: TacticalLogSeverity;
  message: string;
}

export interface HudSnapshot {
  zombiesAlive: number;
  zombiesInitial: number;
  zombiesKilled: number;
  civiliansAlive: number;
  civiliansInitial: number;
  civiliansEvacuated: number;
  civiliansLost: number;
  policeAlive: number;
  policeCap: number;
  policeInitial: number;
  policeLosses: number;
  soldiersAlive: number;
  soldiersCap: number;
  soldiersInitial: number;
  soldiersLosses: number;
  zombieKillRatePct: number;
  civEvacEfficiencyPct: number;
  unitLossPct: number;
  avgUnitStaminaPct: number;
  vehiclesCount: number;
  helicoptersRemaining: number;
  helicoptersTotal: number;
  activeHelicopters: {
    id: number;
    passengers: number;
    maxCapacity: number;
    state: string;
    mode: 'evac' | 'gunship';
    x: number;
    y: number;
  }[];
  activeChinooks: number;
  activeAirstrikes: number;
  barricadesCount: number;
  barricadesRemaining: number;
  barricadesMax: number;
  quarantineCount: number;
  quarantineRemaining: number;
  quarantineMax: number;
  selectedCount: number;
  selectedPolice: number;
  selectedSoldiers: number;
  selectedUnits: SelectedUnitHud[];
  selectedVehicles: SelectedVehicleHud[];
  reinforceCooldown: number;
  outbreakCenter: { x: number; y: number };
  missionTimeSec: number;
  timeOfDay: number;
  dayPhase: DayPhase;
  lodLabel: string;
  frozen: boolean;
  sirenMode: SirenMode;
  outcome: 'ongoing' | 'victory' | 'defeat';
  eventLog: TacticalLogEntry[];
}
