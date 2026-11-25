import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Biohazard,
  Car,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Map as MapIcon,
  Moon,
  MousePointer,
  Pause,
  Plane,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  Snowflake,
  SquareCheck,
  Sun,
  Sunrise,
  Sunset,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { CitySearch } from './components/CitySearch';
import { EventLogPanel } from './components/EventLogPanel';
import { MinMaxControl } from './components/MinMaxControl';
import { OperationsReportPanel } from './components/OperationsReportPanel';
import { OfflineBanner, PWAInstallButton } from './components/PWAInstallButton';
import { SelectedPanel } from './components/SelectedPanel';
import { TacticalMapOverlay } from './components/TacticalMapOverlay';
import { TacticalZombieEngine } from './game/engine';
import { enhanceSectorWithAiVision, fetchRealOsmObstacles, TACTICAL_SECTORS } from './game/obstacles';
import {
  CameraTiltDeg,
  PERSPECTIVE_DISTANCE_PX,
  TILT_45_SCALE,
} from './game/perspective';
import {
  PREBAKED_SECTOR_ORIGIN,
  buildPrebakedCitySector,
} from './game/prebakedMap';
import {
  CommandTool,
  GameState,
  GeoOrigin,
  HudSnapshot,
  MissionConfig,
  ObstacleStats,
  PoliceRole,
  SoldierRole,
  ToolSelection,
  VehicleKind,
  ZombieSpawnMode,
  ZombieVariant,
} from './game/types';

const DEFAULT_SECTOR = TACTICAL_SECTORS[0];

const DEFAULT_CONFIG: MissionConfig = {
  zombies: { min: 45, max: 85 },
  civilians: { min: 70, max: 110 },
  police: { min: 6, max: 12 },
  soldiers: { min: 4, max: 8 },
  helicopters: { min: 3, max: 5 },
  sectorSizeMeters: DEFAULT_SECTOR.defaultHalfSize * 2,
  zombieSpawnMode: 'random',
  armedCivilianPct: 15,
  origin: DEFAULT_SECTOR.origin,
  sectorName: DEFAULT_SECTOR.name,
};

const INITIAL_HUD: HudSnapshot = {
  zombiesAlive: 0,
  zombiesInitial: 0,
  zombiesKilled: 0,
  civiliansAlive: 0,
  civiliansInitial: 0,
  civiliansEvacuated: 0,
  civiliansLost: 0,
  policeAlive: 0,
  policeCap: 12,
  policeInitial: 0,
  policeLosses: 0,
  soldiersAlive: 0,
  soldiersCap: 8,
  soldiersInitial: 0,
  soldiersLosses: 0,
  zombieKillRatePct: 0,
  civEvacEfficiencyPct: 0,
  unitLossPct: 0,
  avgUnitStaminaPct: 100,
  vehiclesCount: 0,
  helicoptersRemaining: 0,
  helicoptersTotal: 0,
  activeHelicopters: [],
  activeChinooks: 0,
  activeAirstrikes: 0,
  barricadesCount: 0,
  barricadesRemaining: 8,
  barricadesMax: 8,
  quarantineCount: 0,
  quarantineRemaining: 3,
  quarantineMax: 3,
  selectedCount: 0,
  selectedPolice: 0,
  selectedSoldiers: 0,
  selectedUnits: [],
  selectedVehicles: [],
  reinforceCooldown: 0,
  outbreakCenter: { x: 0, y: 0 },
  missionTimeSec: 0,
  timeOfDay: 0.48,
  dayPhase: 'Gündüz',
  lodLabel: 'LOD-0 Detaylı Sprite',
  sirenMode: 'wail',
  frozen: false,
  outcome: 'ongoing',
  eventLog: [],
};

const INITIAL_STATS: ObstacleStats = {
  total: 0,
  buildings: 0,
  courtyards: 0,
  trees: 0,
  vehicles: 0,
  barriers: 0,
  bridges: 0,
  roads: 0,
  aiDetected: 0,
  shadowZones: 0,
};

const DEFAULT_TOOL: ToolSelection = {
  tool: 'command',
  zombieVariant: 'walker',
  civilianPreset: 'random',
  policeRole: 'normal',
  soldierRole: 'infantry',
  heliMode: 'evac',
  vehicleKind: 'police_car',
};

const ZOMBIE_LABELS: { id: ZombieVariant; label: string }[] = [
  { id: 'walker', label: 'Yürüyen' },
  { id: 'runner', label: 'Koşan' },
  { id: 'heavy', label: 'Ağır/Dayanıklı' },
  { id: 'fat', label: 'Şişman' },
  { id: 'crawler', label: 'Sürünen' },
  { id: 'fresh_infected', label: 'Yeni Enfekte' },
];

const POLICE_LABELS: { id: PoliceRole; label: string }[] = [
  { id: 'normal', label: 'Normal Polis' },
  { id: 'traffic', label: 'Trafik Polisi' },
  { id: 'special_ops', label: 'Özel Harekât' },
  { id: 'swat', label: 'SWAT Ekibi' },
  { id: 'commissioner', label: 'Komiser' },
  { id: 'riot_shield', label: 'Kalkanlı Ekip' },
];

const SOLDIER_LABELS: { id: SoldierRole; label: string }[] = [
  { id: 'infantry', label: 'Piyade' },
  { id: 'commando', label: 'Komando' },
  { id: 'sniper', label: 'Keskin Nişancı' },
  { id: 'heavy', label: 'Ağır Silahlı' },
  { id: 'medic', label: 'Sağlıkçı' },
  { id: 'paratrooper', label: 'Paraşütçü' },
];

const VEHICLE_LABELS: { id: VehicleKind; label: string }[] = [
  { id: 'police_car', label: 'Polis Arabası' },
  { id: 'police_van', label: 'Polis Minibüsü' },
  { id: 'ambulance', label: 'Ambulans' },
  { id: 'fire_truck', label: 'İtfaiye' },
  { id: 'civilian_car', label: 'Sivil Oto' },
  { id: 'motorcycle', label: 'Motosiklet' },
  { id: 'military_jeep', label: 'Askerî Jip' },
  { id: 'armored_apc', label: 'Zırhlı Araç' },
];

const ZOMBIE_SPAWN_OPTIONS: { id: ZombieSpawnMode; label: string }[] = [
  { id: 'random', label: 'Rastgele' },
  { id: 'north', label: 'Kuzey' },
  { id: 'south', label: 'Güney' },
  { id: 'west', label: 'Batı' },
  { id: 'east', label: 'Doğu' },
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDayClock(timeOfDay: number): string {
  const totalMinutes = Math.floor((((timeOfDay % 1) + 1) % 1) * 24 * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [config, setConfig] = useState<MissionConfig>(DEFAULT_CONFIG);
  const [cityName, setCityName] = useState(DEFAULT_SECTOR.name);
  const [origin, setOrigin] = useState<GeoOrigin>(DEFAULT_SECTOR.origin);
  const [recommendedZoom, setRecommendedZoom] = useState<number>(DEFAULT_SECTOR.recommendedZoom);
  const [mapTypeId, setMapTypeId] = useState<'satellite' | 'hybrid'>('satellite');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);

  const [showObstacles, setShowObstacles] = useState(false);
  const [tiltDeg, setTiltDeg] = useState<CameraTiltDeg>(0);
  const [obstacleStats, setObstacleStats] = useState<ObstacleStats>(INITIAL_STATS);
  const [scanSource, setScanSource] = useState<'osm' | 'osm+ai' | 'fallback'>('osm');
  const [osmScanning, setOsmScanning] = useState(false);
  const [aiScanWarning, setAiScanWarning] = useState<string | null>(null);
  const [toolSelection, setToolSelection] = useState<ToolSelection>(DEFAULT_TOOL);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const jumpToMetersRef = useRef<((x: number, y: number) => void) | null>(null);
  const gameStateRef = useRef(gameState);
  const scanReqIdRef = useRef(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaWarning(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const engine = useMemo(
    () =>
      new TacticalZombieEngine(
        {
          onHudUpdate: (snap) => setHud(snap),
          onMissionEnd: (snap) => {
            setHud(snap);
            setToolSelection((prev) => ({ ...prev, tool: 'command' }));
            setGameState('GAME_OVER');
          },
        },
        DEFAULT_CONFIG
      ),
    []
  );

  const scanSectorObstacles = useCallback(
    async (targetOrigin: GeoOrigin, sectorSizeMeters: number) => {
      const reqId = ++scanReqIdRef.current;
      setOsmScanning(true);
      setAiScanWarning(null);
      engine.setOrigin(targetOrigin);

      const half = sectorSizeMeters / 2;
      const result = await fetchRealOsmObstacles(targetOrigin, half);
      if (reqId !== scanReqIdRef.current) return;

      const isNearChicago =
        Math.hypot(targetOrigin.lat - PREBAKED_SECTOR_ORIGIN.lat, targetOrigin.lng - PREBAKED_SECTOR_ORIGIN.lng) <
        0.02;

      if (result.status === 'fallback' && isNearChicago) {
        const pre = buildPrebakedCitySector(half);
        engine.setObstacles(pre.obstacles, pre.roadSpots, pre.bridges, true, pre.occlusionZones);
        setObstacleStats(pre.stats);
        setScanSource('fallback');
        setOsmScanning(false);
        return;
      }

      // Render OSM base immediately, then progressively enhance with Gemini Vision satellite building/tree/shadow scan
      engine.setObstacles(result.obstacles, result.roadSpots, result.bridges, false, result.occlusionZones);
      setObstacleStats(result.stats);
      setScanSource(result.status);

      const aiResult = await enhanceSectorWithAiVision(targetOrigin, half, result);
      if (reqId !== scanReqIdRef.current) return;

      engine.setObstacles(aiResult.obstacles, aiResult.roadSpots, aiResult.bridges, false, aiResult.occlusionZones);
      setObstacleStats(aiResult.stats);
      setScanSource(aiResult.status);
      setAiScanWarning(aiResult.aiError ?? null);
      setOsmScanning(false);
    },
    [engine]
  );

  useEffect(() => {
    scanSectorObstacles(origin, config.sectorSizeMeters);
  }, [scanSectorObstacles, origin, config.sectorSizeMeters]);

  const handleSelectPresetSector = (presetId: string) => {
    const preset = TACTICAL_SECTORS.find((s) => s.id === presetId);
    if (!preset) return;
    setOrigin(preset.origin);
    setCityName(preset.name);
    setRecommendedZoom(preset.recommendedZoom);
    setConfig((prev) => ({
      ...prev,
      origin: preset.origin,
      sectorName: preset.name,
      sectorSizeMeters: preset.defaultHalfSize * 2,
    }));
  };

  const handleSelectCustomLocation = (loc: GeoOrigin, label: string) => {
    setOrigin(loc);
    setCityName(label);
    setRecommendedZoom(17);
    setConfig((prev) => ({
      ...prev,
      origin: loc,
      sectorName: label,
    }));
  };

  const handleStartMission = useCallback(() => {
    soundEngine.preloadAssets();
    setToolSelection(DEFAULT_TOOL);
    setStatusMessage(null);
    engine.setOrigin(origin);
    engine.startMission({
      ...config,
      origin,
      sectorName: cityName,
    });
    setGameState('PLAYING');
  }, [engine, origin, config, cityName]);

  const handleTogglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      engine.setPaused(true);
      setGameState('PAUSED');
    } else if (gameStateRef.current === 'PAUSED') {
      engine.setPaused(false);
      setGameState('PLAYING');
    }
  }, [engine]);

  const handleReturnToSetup = useCallback(() => {
    engine.setPaused(true);
    setToolSelection(DEFAULT_TOOL);
    setGameState('TITLE_MENU');
  }, [engine]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const showTempMessage = useCallback((msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  const selectTool = useCallback((tool: CommandTool) => {
    setToolSelection((prev) => ({
      ...prev,
      tool: prev.tool === tool && tool !== 'command' ? 'command' : tool,
    }));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName || '')) return;
      if (e.code === 'Escape') {
        if (toolSelection.tool !== 'command') {
          setToolSelection((prev) => ({ ...prev, tool: 'command' }));
          return;
        }
        if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'PAUSED') {
          handleTogglePause();
          return;
        }
      }
      if (e.code === 'KeyP' && (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'PAUSED')) {
        handleTogglePause();
        return;
      }
      if (e.code === 'KeyT') {
        setTiltDeg((prev) => (prev === 0 ? 45 : 0));
        return;
      }
      if (gameStateRef.current !== 'PLAYING') return;

      if (e.code === 'KeyG') {
        const count = engine.unloadSelectedVehicles();
        if (count > 0) {
          showTempMessage(`${count} personel araçtan indirildi.`);
        }
      } else if (e.code === 'KeyH') {
        if (engine.hasSelectedVehicles()) {
          engine.toggleSelectedSirens();
        } else {
          selectTool('call_heli');
        }
      } else if (e.code === 'KeyM') {
        if (engine.hasSelectedVehicles()) {
          const nextMode = engine.cycleSirenMode();
          const label = nextMode === 'wail' ? 'Wail (Uzun)' : nextMode === 'yelp' ? 'Yelp (Hızlı)' : 'Hi-Lo (Çift Ton)';
          showTempMessage(`Siren modu: ${label}`);
        }
      } else if (e.code === 'KeyV') {
        selectTool('call_heli');
      } else if (e.code === 'KeyB') {
        selectTool('airstrike');
      } else if (e.code === 'Digit1') {
        engine.selectByKind('police');
      } else if (e.code === 'Digit2') {
        engine.selectByKind('soldier');
      } else if (e.code === 'KeyQ') {
        engine.selectByKind('all');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine, handleTogglePause, selectTool, showTempMessage, toolSelection.tool]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const half = engine.getHalfSize();
    const xMeters = (nx * 2 - 1) * half;
    const yMeters = (ny * 2 - 1) * half;
    jumpToMetersRef.current?.(xMeters, yMeters);
  };

  const toolBannerText = useMemo(() => {
    switch (toolSelection.tool) {
      case 'spawn_zombie':
        return 'Zombi Oluşturma: Haritada açık bir yola sol tıklayın (Sağ Tık: İptal)';
      case 'spawn_civilian':
        return 'Sivil Oluşturma: Haritada açık bir noktaya sol tıklayın (Sağ Tık: İptal)';
      case 'spawn_police':
        return 'Polis Çağırma: Ekibin konuşlanacağı açık caddeye sol tıklayın (Sağ Tık: İptal)';
      case 'spawn_soldier':
        return toolSelection.soldierRole === 'paratrooper'
          ? 'CH-47 Chinook İndirme: 10 paraşütçü bırakılacak bölgeye sol tıklayın (Sağ Tık: İptal)'
          : 'Asker İndirme: Birliğin ineceği açık noktaya sol tıklayın';
      case 'call_heli':
        return toolSelection.heliMode === 'gunship'
          ? 'Silahlı Helikopter Desteği: Devriye atacağı noktaya sol tıklayın'
          : 'Tahliye Helikopteri: Açık bir cadde veya meydana sol tıklayın (100m yarıçap · 30 sivil)';
      case 'spawn_vehicle':
        return 'Araç Oluşturma: Aracın yerleştirileceği yola sol tıklayın';
      case 'airstrike':
        return 'A-10 Hava Desteği: Taarruz koridorunu sürükleyin (Tüm birimler hasar görür!)';
      case 'barricade':
        return `Sokak Barikatı (${hud.barricadesRemaining}/${hud.barricadesMax}): Yeşil alan temiz, kırmızı engelli — sürükleyip bırakın`;
      case 'quarantine':
        return `Karantina Bölgesi (${hud.quarantineRemaining}/${hud.quarantineMax}): Yeşil çember temiz — sürükleyip bırakınca arazi taranır`;
      default:
        return null;
    }
  }, [toolSelection, hud.barricadesRemaining, hud.barricadesMax, hud.quarantineRemaining, hud.quarantineMax]);

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  return (
    <APIProvider apiKey={mapsApiKey} language="tr" region="TR">
      <div className="h-screen w-screen bg-[#070a10] text-slate-100 flex flex-col overflow-hidden">
        {quotaWarning && (
          <div className="sticky top-0 z-50 w-full bg-amber-950/95 border-b border-amber-500/70 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Google Haritalar API kotası aşıldı. Uydu katmanı kısıtlı olabilir; simülasyon ve OSM engel ağı çalışmaya devam eder.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQuotaWarning(false)}
              className="p-1 text-amber-300 hover:text-white cursor-pointer shrink-0"
              aria-label="Uyarıyı kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {aiScanWarning && !osmScanning && (
          <div className="sticky top-0 z-40 w-full bg-slate-900/95 border-b border-amber-500/40 px-4 py-1.5 flex items-center justify-between gap-3 text-[11px] text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Uydu görsel bina taraması tamamlanamadı ({aiScanWarning}); OSM harita engelleri aktif.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAiScanWarning(null)}
              className="p-0.5 text-amber-300 hover:text-white cursor-pointer shrink-0"
              aria-label="Uyarıyı kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <header className="h-14 shrink-0 bg-[#090d14]/95 border-b border-slate-800/90 px-4 flex items-center justify-between gap-4 z-30">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-2 h-6 bg-amber-500 rounded-xs shrink-0" aria-hidden="true" />
            <span className="font-display text-base sm:text-lg font-bold tracking-wider uppercase text-white whitespace-nowrap">
              Karantina Hattı
            </span>
            <span className="hidden md:inline text-xs font-mono-num text-slate-400 truncate max-w-[200px]">
              {cityName}
            </span>
          </div>

          {gameState !== 'TITLE_MENU' ? (
            <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto py-1 text-xs font-mono-num">
              <div className="flex items-center gap-1.5 text-slate-200 whitespace-nowrap shrink-0">
                <Users className="w-3.5 h-3.5 text-slate-300" />
                <span>
                  Sivil {hud.civiliansAlive} ·{' '}
                  <strong className="text-emerald-400">Tahliye {hud.civiliansEvacuated}</strong>
                </span>
              </div>
              <div className="text-rose-400 font-semibold whitespace-nowrap shrink-0">
                Zombi {hud.zombiesAlive}
              </div>
              <div className="text-sky-400 font-semibold whitespace-nowrap shrink-0">
                Polis {hud.policeAlive}/{hud.policeCap}
              </div>
              <div className="text-emerald-400 font-semibold whitespace-nowrap shrink-0">
                Asker {hud.soldiersAlive}/{hud.soldiersCap}
              </div>
              <div className="text-amber-300 font-semibold whitespace-nowrap shrink-0">
                Heli {hud.helicoptersRemaining}/{hud.helicoptersTotal}
              </div>
              <div className="hidden lg:block text-slate-300 whitespace-nowrap shrink-0">
                Kondisyon %{hud.avgUnitStaminaPct}
              </div>
              <button
                type="button"
                onClick={() => engine.cycleTimeOfDay()}
                title="30 dk Gündüz / 30 dk Gece döngüsü (Evre değiştirmek için tıklayın)"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#0e1522] hover:bg-slate-800 border border-slate-700/80 text-amber-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hud.dayPhase === 'Gündüz' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                ) : hud.dayPhase === 'Şafak' ? (
                  <Sunrise className="w-3.5 h-3.5 text-orange-300" />
                ) : hud.dayPhase === 'Akşam' ? (
                  <Sunset className="w-3.5 h-3.5 text-rose-300" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-sky-300" />
                )}
                <span>
                  {formatDayClock(hud.timeOfDay)} · {hud.dayPhase}
                </span>
              </button>
              <div className="hidden xl:block text-slate-400 whitespace-nowrap shrink-0">
                {formatTime(hud.missionTimeSec)}
              </div>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
              <span className={osmScanning ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
                {osmScanning
                  ? 'Uydu + AI Bina & Gölge Analizi Yapılıyor...'
                  : scanSource === 'osm+ai'
                    ? 'Canlı Google Uydu + AI + OSM Engel Ağı'
                    : scanSource === 'osm'
                      ? 'Canlı Google Uydu + OSM Engel Ağı'
                      : 'Yedek Sektör Engel Ağı'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-slate-300">
                {`${obstacleStats.buildings} bina · ${obstacleStats.trees} ağaç · ${obstacleStats.vehicles} araç · ${obstacleStats.aiDetected ?? 0} AI tespit · ${obstacleStats.shadowZones ?? 0} gölge`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setMapTypeId((m) => (m === 'satellite' ? 'hybrid' : 'satellite'))}
              title="Uydu / Etiketli Uydu görünümünü değiştir"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                mapTypeId === 'hybrid'
                  ? 'bg-sky-500/20 border-sky-400/70 text-sky-200'
                  : 'bg-[#0e1522] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{mapTypeId === 'hybrid' ? 'Etiketli Uydu' : 'Saf Uydu'}</span>
            </button>

            <button
              type="button"
              onClick={() => setTiltDeg((t) => (t === 0 ? 45 : 0))}
              title="Harita perspektifini 0° ve 45° arasında değiştir [T]"
              aria-pressed={tiltDeg === 45}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                tiltDeg === 45
                  ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                  : 'bg-[#0e1522] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{tiltDeg === 45 ? '45° Kuş Bakışı' : '0° Yukarıdan'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowObstacles((v) => !v)}
              title="Navmesh yürünemez ızgarasını ve bina/su engel sınırlarını göster/gizle"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                showObstacles
                  ? 'bg-slate-800 border-slate-600 text-slate-100'
                  : 'bg-[#0e1522] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {showObstacles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">Navmesh &amp; Engel</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Sesi Aç' : 'Sesi Kapat'}
              className="p-2 rounded bg-[#0e1522] border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <button
                type="button"
                onClick={handleTogglePause}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 hover:bg-slate-700 whitespace-nowrap cursor-pointer"
              >
                {gameState === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{gameState === 'PAUSED' ? 'Devam Et' : 'Menü'}</span>
              </button>
            )}
          </div>
        </header>

        <div ref={viewportRef} className="relative flex-1 w-full overflow-hidden bg-[#070a10]">
          <div
            ref={stageRef}
            className="absolute transition-transform duration-500 ease-out"
            style={
              tiltDeg === 45
                ? {
                    left: '-30%',
                    top: '-42%',
                    width: '160%',
                    height: '184%',
                    transformOrigin: '50% 50%',
                    transform: `perspective(${PERSPECTIVE_DISTANCE_PX}px) rotateX(45deg) scale(${TILT_45_SCALE})`,
                  }
                : {
                    left: '0%',
                    top: '0%',
                    width: '100%',
                    height: '100%',
                    transformOrigin: '50% 50%',
                    transform: `perspective(${PERSPECTIVE_DISTANCE_PX}px) rotateX(0deg) scale(1)`,
                  }
            }
          >
            <TacticalMapOverlay
              engine={engine}
              origin={origin}
              recommendedZoom={recommendedZoom}
              mapTypeId={mapTypeId}
              gameState={gameState}
              showObstacles={showObstacles}
              tiltDeg={tiltDeg}
              viewportRef={viewportRef}
              stageRef={stageRef}
              toolSelection={toolSelection}
              onResetTool={() => setToolSelection((prev) => ({ ...prev, tool: 'command' }))}
              onStatusToast={showTempMessage}
              minimapCanvasRef={minimapCanvasRef}
              jumpToMetersRef={jumpToMetersRef}
            />
          </div>

          {tiltDeg === 45 && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-16 z-10 bg-gradient-to-b from-slate-950/65 via-slate-950/20 to-transparent"
              aria-hidden="true"
            />
          )}

          {/* Setup Drawer + Tactical Briefing Card */}
          {gameState === 'TITLE_MENU' && (
            <>
              <aside className="absolute top-3 left-3 bottom-3 w-[calc(100%-24px)] sm:w-[468px] tactical-panel backdrop-blur-md rounded-md z-20 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-gradient-to-br from-[#0b1019] via-[#0d1421] to-[#1a150e]">
                  <div className="flex items-center justify-between gap-2">
                    <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                      Karantina Hattı
                    </h1>
                    <span className="text-[10px] font-mono-num uppercase tracking-widest text-amber-400 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 rounded-xs">
                      Takti̇k Komuta
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    Gerçek Google Haritalar uydu görünümü üzerinde binalar, iç avlular, su kütleleri, köprüler, ağaçlar ve park halindeki araçlar analiz edilerek yürünemez alanlar kilitlenir.
                  </p>

                  {/* Quick Force Scale Presets */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          zombies: { min: 45, max: 85 },
                          civilians: { min: 70, max: 110 },
                          police: { min: 6, max: 12 },
                          soldiers: { min: 4, max: 8 },
                          helicopters: { min: 3, max: 5 },
                          zombieSpawnMode: 'random',
                        }))
                      }
                      className="px-2 py-1.5 rounded bg-[#0e1522] hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      Standart Salgın
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          zombies: { min: 250, max: 450 },
                          civilians: { min: 350, max: 600 },
                          police: { min: 14, max: 28 },
                          soldiers: { min: 10, max: 22 },
                          helicopters: { min: 5, max: 8 },
                          zombieSpawnMode: 'north',
                        }))
                      }
                      className="px-2 py-1.5 rounded bg-[#0e1522] hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-rose-300 cursor-pointer whitespace-nowrap"
                    >
                      Kuzey Kuşatması
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          zombies: { min: 900, max: 1600 },
                          civilians: { min: 1800, max: 3000 },
                          police: { min: 24, max: 48 },
                          soldiers: { min: 18, max: 36 },
                          helicopters: { min: 8, max: 14 },
                          sectorSizeMeters: 2500,
                          zombieSpawnMode: 'east',
                        }))
                      }
                      className="px-2 py-1.5 rounded bg-[#0e1522] hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-amber-300 cursor-pointer whitespace-nowrap"
                    >
                      Büyük Sektör (2.5km)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          zombies: { min: 3500, max: 5000 },
                          civilians: { min: 7000, max: 10000 },
                          police: { min: 45, max: 90 },
                          soldiers: { min: 35, max: 75 },
                          helicopters: { min: 12, max: 22 },
                          sectorSizeMeters: 5000,
                          zombieSpawnMode: 'random',
                        }))
                      }
                      className="px-2 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-700/60 text-[11px] font-semibold text-rose-200 cursor-pointer whitespace-nowrap"
                    >
                      Dev Salgın (5K / 10K)
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Real-World Location Search + Tactical Sector Presets */}
                  <div className="p-3 rounded-md bg-[#090d14] border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                        Operasyon Bölgesi (Google Uydu + AI + OSM)
                      </span>
                      <button
                        type="button"
                        onClick={() => scanSectorObstacles(origin, config.sectorSizeMeters)}
                        disabled={osmScanning}
                        className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 disabled:opacity-50 cursor-pointer"
                      >
                        {osmScanning ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        <span>Araziyi Tara</span>
                      </button>
                    </div>

                    <CitySearch onSelectLocation={handleSelectCustomLocation} disabled={osmScanning} />

                    <div className="grid grid-cols-2 gap-1.5">
                      {TACTICAL_SECTORS.map((sec) => {
                        const active =
                          Math.abs(sec.origin.lat - origin.lat) < 0.002 &&
                          Math.abs(sec.origin.lng - origin.lng) < 0.002;
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => handleSelectPresetSector(sec.id)}
                            className={`text-left px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-500/15 border-amber-500/70 text-amber-200'
                                : 'bg-[#0e1420] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-[11px] font-semibold truncate">{sec.name}</div>
                            <div className="text-[9px] text-slate-400 truncate">{sec.subtitle}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-6 gap-1 text-center font-mono-num pt-1">
                      <div className="p-1.5 rounded bg-[#0e1420] border border-slate-800/80">
                        <div className="text-xs font-bold text-rose-400">{obstacleStats.buildings}</div>
                        <div className="text-[9px] text-slate-400">Bina</div>
                      </div>
                      <div className="p-1.5 rounded bg-[#0e1420] border border-slate-800/80">
                        <div className="text-xs font-bold text-orange-300">{obstacleStats.courtyards ?? 0}</div>
                        <div className="text-[9px] text-slate-400">Avlu</div>
                      </div>
                      <div className="p-1.5 rounded bg-[#0e1420] border border-slate-800/80">
                        <div className="text-xs font-bold text-emerald-400">{obstacleStats.trees}</div>
                        <div className="text-[9px] text-slate-400">Ağaç</div>
                      </div>
                      <div className="p-1.5 rounded bg-[#0e1420] border border-slate-800/80">
                        <div className="text-xs font-bold text-amber-400">{obstacleStats.vehicles}</div>
                        <div className="text-[9px] text-slate-400">Araç</div>
                      </div>
                      <div className="p-1.5 rounded bg-[#0e1420] border border-slate-800/80">
                        <div className="text-xs font-bold text-sky-400">{obstacleStats.barriers}</div>
                        <div className="text-[9px] text-slate-400">Su/Set</div>
                      </div>
                      <div className="p-1.5 rounded bg-[#0e1420] border border-slate-800/80">
                        <div className="text-xs font-bold text-cyan-300">{obstacleStats.bridges ?? 0}</div>
                        <div className="text-[9px] text-slate-400">Köprü</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400 pt-0.5 px-0.5">
                      <span>
                        AI Uydu Tespiti: <strong className="text-amber-300">{obstacleStats.aiDetected ?? 0}</strong> bina/çatı
                      </span>
                      <span>
                        Gölge &amp; Örtü Alanı: <strong className="text-emerald-300">{obstacleStats.shadowZones ?? 0}</strong> bölge
                      </span>
                    </div>
                  </div>

                  {/* Armed Civilian Ratio Slider */}
                  <div className="p-3 rounded-md bg-[#090d14] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 font-semibold">Silahlı Sivil Oranı</span>
                      <span className="font-mono-num font-bold text-amber-300">%{config.armedCivilianPct}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={config.armedCivilianPct}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, armedCivilianPct: Number(e.target.value) }))
                      }
                      aria-label="Silahlı Sivil Oranı"
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>%0 Silahsız</span>
                      <span>Sivillerin kendini savunma oranı</span>
                      <span>%100 Silahlı</span>
                    </div>
                  </div>

                  {/* Zombie Spawn Mode Selector */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-medium flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-rose-400" />
                        <span>Zombi Doğuş Bölgesi</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {config.zombieSpawnMode === 'random' ? 'Rastgele Dağılım' : 'Tek Cepheden Akın'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 p-1 bg-[#090d14] border border-slate-800 rounded-md">
                      {ZOMBIE_SPAWN_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setConfig((c) => ({ ...c, zombieSpawnMode: opt.id }))}
                          className={`py-1.5 px-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            config.zombieSpawnMode === opt.id
                              ? 'bg-rose-600 text-white font-semibold'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300 font-medium">Sektör Çapı</span>
                    <div className="inline-flex bg-[#090d14] border border-slate-800 rounded p-0.5">
                      {[
                        { m: 1000, label: '1km' },
                        { m: 1600, label: '1.6km' },
                        { m: 2500, label: '2.5km' },
                        { m: 5000, label: '5km' },
                      ].map((opt) => (
                        <button
                          key={opt.m}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, sectorSizeMeters: opt.m }))}
                          className={`px-2 py-1 rounded-xs text-[11px] font-mono-num transition-colors cursor-pointer ${
                            config.sectorSizeMeters === opt.m
                              ? 'bg-slate-800 text-amber-300 font-semibold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <MinMaxControl
                      label="Zombi Sayısı (Maks. 5.000)"
                      accentClass="text-rose-400"
                      value={config.zombies}
                      limitMin={5}
                      limitMax={5000}
                      onChange={(zombies) => setConfig((c) => ({ ...c, zombies }))}
                    />
                    <MinMaxControl
                      label="İnsan / Sivil Sayısı (Maks. 10.000)"
                      accentClass="text-slate-200"
                      value={config.civilians}
                      limitMin={10}
                      limitMax={10000}
                      onChange={(civilians) => setConfig((c) => ({ ...c, civilians }))}
                    />
                    <MinMaxControl
                      label="Polis Sayısı (Başlangıç - Maksimum)"
                      accentClass="text-sky-400"
                      value={config.police}
                      limitMin={1}
                      limitMax={150}
                      onChange={(police) => setConfig((c) => ({ ...c, police }))}
                    />
                    <MinMaxControl
                      label="Asker Sayısı (Başlangıç - Maksimum)"
                      accentClass="text-emerald-400"
                      value={config.soldiers}
                      limitMin={1}
                      limitMax={150}
                      onChange={(soldiers) => setConfig((c) => ({ ...c, soldiers }))}
                    />
                    <MinMaxControl
                      label="Tahliye Helikopteri (Kapasite: 30 Sivil)"
                      accentClass="text-amber-400"
                      value={config.helicopters}
                      limitMin={1}
                      limitMax={30}
                      onChange={(helicopters) => setConfig((c) => ({ ...c, helicopters }))}
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-slate-800 bg-[#090d14]">
                  <button
                    type="button"
                    disabled={osmScanning}
                    onClick={handleStartMission}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold uppercase tracking-wider text-sm transition-colors cursor-pointer"
                  >
                    {osmScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{osmScanning ? 'Arazi Taranıyor...' : 'Operasyonu Başlat'}</span>
                  </button>
                </div>
              </aside>

              {/* Bottom-Right Tactical Field Briefing Card (Desktop) */}
              <div className="hidden lg:block absolute bottom-4 right-4 w-[320px] tactical-panel backdrop-blur-md rounded-md p-4 z-20 space-y-2.5">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-amber-300">
                  Saha Rehberi ve Komuta
                </h2>
                <div className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                  <p>
                    <strong className="text-slate-100">Birim &amp; Araç:</strong> Sol tık/kutu ile seçin, sağ tıkla yönlendirin. Polise veya askere araca sağ tıklayarak bindirin; <strong className="text-sky-300">[G]</strong> ile indirin.
                  </p>
                  <p>
                    <strong className="text-slate-100">Barikat &amp; Karantina:</strong> Sürüklerken <strong className="text-emerald-400">Yeşil</strong> zemin kuruluma uygundur, <strong className="text-rose-400">Kırmızı</strong> engel çakışmasıdır. Karantina kurulmadan önce zemin taranır.
                  </p>
                  <p className="text-slate-400">
                    Bina ve ağaç altında kalan <span className="text-rose-400 font-semibold">zombi (kırmızı)</span>, <span className="text-emerald-400 font-semibold">asker (yeşil)</span>, <span className="text-sky-400 font-semibold">polis (mavi)</span> ve <span className="text-slate-100 font-semibold">siviller (beyaz)</span> içi boş neon siluetle görünür.
                  </p>
                </div>
              </div>
            </>
          )}

          {gameState !== 'TITLE_MENU' && (
            <>
              {statusMessage && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded tactical-panel border-amber-500/70 text-amber-200 text-xs font-medium">
                  {statusMessage}
                </div>
              )}

              {toolBannerText && gameState === 'PLAYING' && !statusMessage && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded tactical-panel border-emerald-500/70 text-emerald-200 text-xs font-medium">
                  {toolBannerText}
                </div>
              )}

              {/* Left-Side Tactical HUD Stack: Operations Report + Event Log */}
              <div className="hidden sm:flex flex-col gap-2 absolute top-3 left-3 z-20 pointer-events-none">
                <OperationsReportPanel hud={hud} />
                <EventLogPanel entries={hud.eventLog} />
              </div>

              {/* Minimap + Quick Center */}
              <div className="absolute bottom-24 sm:bottom-24 left-3 z-20 tactical-panel rounded-md p-1.5 hidden sm:block">
                <canvas
                  ref={minimapCanvasRef}
                  width={156}
                  height={156}
                  onClick={handleMinimapClick}
                  className="block rounded-xs cursor-pointer"
                  title="Haritada o noktaya gitmek için tıklayın"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono-num text-slate-400 px-0.5">
                  <span>{(config.sectorSizeMeters / 1000).toFixed(1)}km</span>
                  <button
                    type="button"
                    onClick={() => jumpToMetersRef.current?.(0, 0)}
                    className="text-amber-300 hover:underline cursor-pointer"
                  >
                    Merkeze Git
                  </button>
                </div>
              </div>

              {/* Right-Side Rail: Active Helicopters + Chinooks + Selected Forces Panel */}
              <div className="absolute top-14 right-3 z-20 flex flex-col items-end gap-2">
                {hud.activeChinooks > 0 && (
                  <div className="px-2.5 py-1.5 rounded tactical-panel border-emerald-500/60 text-xs font-mono-num text-emerald-300">
                    CH-47 Chinook İndirme: {hud.activeChinooks} Kol (10 Paraşütçü)
                  </div>
                )}
                {hud.activeHelicopters.length > 0 && (
                  <div className="flex flex-col gap-1.5 items-end">
                    {hud.activeHelicopters.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded tactical-panel border-emerald-500/50 text-xs font-mono-num"
                      >
                        <span className="text-emerald-300">
                          {h.mode === 'gunship' ? `Destek #${h.id}` : `Heli #${h.id}: ${h.passengers}/${h.maxCapacity}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {h.state === 'inbound'
                            ? 'Geliyor'
                            : h.state === 'descending'
                              ? 'İniyor'
                              : h.state === 'landed'
                                ? 'İndi'
                                : 'Kalkıyor'}
                        </span>
                        {h.state === 'landed' && (
                          <button
                            type="button"
                            onClick={() => engine.launchHelicopter(h.id)}
                            className="px-2 py-0.5 rounded-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-semibold cursor-pointer"
                          >
                            Kaldır
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {gameState === 'PLAYING' && (
                  <SelectedPanel
                    selectedUnits={hud.selectedUnits}
                    selectedVehicles={hud.selectedVehicles}
                    sirenMode={hud.sirenMode}
                    onUnloadVehicles={() => {
                      const count = engine.unloadSelectedVehicles();
                      if (count > 0) showTempMessage(`${count} personel araçtan indirildi.`);
                    }}
                    onToggleSirens={() => engine.toggleSelectedSirens()}
                    onChangeSirenMode={(mode) => engine.setSirenMode(mode)}
                  />
                )}
              </div>

              {/* Bottom Command & Control Deck */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-6xl flex flex-col items-center gap-1.5">
                {toolSelection.tool !== 'command' &&
                  toolSelection.tool !== 'airstrike' &&
                  toolSelection.tool !== 'barricade' &&
                  toolSelection.tool !== 'quarantine' && (
                    <div className="tactical-panel backdrop-blur-md rounded px-3 py-1.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                      {toolSelection.tool === 'spawn_zombie' &&
                        ZOMBIE_LABELS.map((z) => (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => setToolSelection((p) => ({ ...p, zombieVariant: z.id }))}
                            className={`px-2 py-1 rounded-xs cursor-pointer ${
                              toolSelection.zombieVariant === z.id
                                ? 'bg-rose-600 text-white font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {z.label}
                          </button>
                        ))}

                      {toolSelection.tool === 'spawn_civilian' &&
                        (
                          [
                            { id: 'random', label: 'Rastgele Sivil' },
                            { id: 'armed', label: 'Silahlı Sivil' },
                            { id: 'wounded', label: 'Yaralı Sivil' },
                          ] as const
                        ).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setToolSelection((p) => ({ ...p, civilianPreset: c.id }))}
                            className={`px-2 py-1 rounded-xs cursor-pointer ${
                              toolSelection.civilianPreset === c.id
                                ? 'bg-slate-100 text-slate-950 font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}

                      {toolSelection.tool === 'spawn_police' &&
                        POLICE_LABELS.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setToolSelection((p) => ({ ...p, policeRole: r.id }))}
                            className={`px-2 py-1 rounded-xs cursor-pointer ${
                              toolSelection.policeRole === r.id
                                ? 'bg-sky-500 text-slate-950 font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}

                      {toolSelection.tool === 'spawn_soldier' &&
                        SOLDIER_LABELS.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setToolSelection((p) => ({ ...p, soldierRole: r.id }))}
                            className={`px-2 py-1 rounded-xs cursor-pointer ${
                              toolSelection.soldierRole === r.id
                                ? 'bg-emerald-500 text-slate-950 font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}

                      {toolSelection.tool === 'call_heli' &&
                        (
                          [
                            { id: 'evac', label: 'Kurtarma Helikopteri (30 Sivil)' },
                            { id: 'gunship', label: 'Silahlı Destek Helikopteri' },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setToolSelection((p) => ({ ...p, heliMode: m.id }))}
                            className={`px-2 py-1 rounded-xs cursor-pointer ${
                              toolSelection.heliMode === m.id
                                ? 'bg-amber-400 text-slate-950 font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}

                      {toolSelection.tool === 'spawn_vehicle' &&
                        VEHICLE_LABELS.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setToolSelection((p) => ({ ...p, vehicleKind: v.id }))}
                            className={`px-2 py-1 rounded-xs cursor-pointer ${
                              toolSelection.vehicleKind === v.id
                                ? 'bg-amber-400 text-slate-950 font-semibold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                    </div>
                  )}

                {/* Main Command Dock */}
                <div className="w-full tactical-panel backdrop-blur-md rounded-md px-2.5 py-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => selectTool('command')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-semibold cursor-pointer ${
                      toolSelection.tool === 'command'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-[#121a28] text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                    <span>Yönet ({hud.selectedCount})</span>
                  </button>

                  <div className="hidden md:flex items-center gap-1 border-r border-slate-800 pr-2 mr-0.5">
                    <button
                      type="button"
                      onClick={() => engine.selectByKind('police')}
                      className="px-2 py-1 rounded-xs bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 cursor-pointer"
                    >
                      Polis [1]
                    </button>
                    <button
                      type="button"
                      onClick={() => engine.selectByKind('soldier')}
                      className="px-2 py-1 rounded-xs bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 cursor-pointer"
                    >
                      Asker [2]
                    </button>
                    <button
                      type="button"
                      onClick={() => engine.selectByKind('all')}
                      className="px-2 py-1 rounded-xs bg-[#121a28] hover:bg-slate-800 text-slate-200 cursor-pointer"
                    >
                      Tümü [Q]
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => selectTool('spawn_zombie')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-medium cursor-pointer ${
                      toolSelection.tool === 'spawn_zombie'
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#121a28] text-rose-300 hover:bg-slate-800'
                    }`}
                  >
                    <Biohazard className="w-3.5 h-3.5" />
                    <span>Zombi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTool('spawn_civilian')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-medium cursor-pointer ${
                      toolSelection.tool === 'spawn_civilian'
                        ? 'bg-slate-100 text-slate-950'
                        : 'bg-[#121a28] text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Sivil</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTool('spawn_police')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-medium cursor-pointer ${
                      toolSelection.tool === 'spawn_police'
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-[#121a28] text-sky-300 hover:bg-slate-800'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Polis</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTool('spawn_soldier')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-medium cursor-pointer ${
                      toolSelection.tool === 'spawn_soldier'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-[#121a28] text-emerald-300 hover:bg-slate-800'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Asker / Paraşüt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTool('call_heli')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-semibold cursor-pointer ${
                      toolSelection.tool === 'call_heli'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-amber-500/90 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    <span>Heli [V] ({hud.helicoptersRemaining})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTool('spawn_vehicle')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-medium cursor-pointer ${
                      toolSelection.tool === 'spawn_vehicle'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-[#121a28] text-amber-300 hover:bg-slate-800'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Araç</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTool('airstrike')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-semibold cursor-pointer ${
                      toolSelection.tool === 'airstrike'
                        ? 'bg-orange-500 text-slate-950'
                        : 'bg-orange-500/20 border border-orange-500/50 text-orange-300 hover:bg-orange-500/30'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5" />
                    <span>A-10 [B]</span>
                  </button>

                  <button
                    type="button"
                    disabled={hud.barricadesRemaining <= 0}
                    onClick={() => selectTool('barricade')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-mono-num font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      toolSelection.tool === 'barricade'
                        ? 'bg-yellow-400 text-slate-950'
                        : 'bg-[#121a28] text-yellow-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>Barikat ({hud.barricadesRemaining}/{hud.barricadesMax})</span>
                  </button>

                  <button
                    type="button"
                    disabled={hud.quarantineRemaining <= 0}
                    onClick={() => selectTool('quarantine')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-mono-num font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      toolSelection.tool === 'quarantine'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#121a28] text-amber-300 hover:bg-slate-800'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Karantina ({hud.quarantineRemaining}/{hud.quarantineMax})</span>
                  </button>

                  <div className="flex items-center gap-1 border-l border-slate-800 pl-2 ml-0.5">
                    <button
                      type="button"
                      onClick={() => engine.setFrozen(!hud.frozen)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-medium cursor-pointer ${
                        hud.frozen
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-[#121a28] text-sky-300 hover:bg-slate-800'
                      }`}
                    >
                      <Snowflake className="w-3.5 h-3.5" />
                      <span>{hud.frozen ? 'Devam' : 'Dondur'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => engine.stopOutbreak()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-medium cursor-pointer"
                    >
                      <SquareCheck className="w-3.5 h-3.5" />
                      <span>Salgını Bitir</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-30">
              <div className="w-full max-w-sm tactical-panel rounded-md p-6">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white mb-1">
                  Operasyon Duraklatıldı
                </h2>
                <p className="text-xs text-slate-400 mb-5 font-mono-num">
                  Tahliye: {hud.civiliansEvacuated} · Kalan Sivil: {hud.civiliansAlive} · Zombi: {hud.zombiesAlive}
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="w-full py-2.5 px-4 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm cursor-pointer"
                  >
                    Devam Et
                  </button>
                  <button
                    type="button"
                    onClick={handleStartMission}
                    className="w-full py-2.5 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm cursor-pointer"
                  >
                    Aynı Ayarlarla Yeniden Başlat
                  </button>
                  <button
                    type="button"
                    onClick={handleReturnToSetup}
                    className="w-full py-2.5 px-4 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium text-sm cursor-pointer"
                  >
                    Ayarlara Dön
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-30">
              <div className="w-full max-w-md tactical-panel rounded-md p-6">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-1">
                  {hud.outcome === 'victory' ? 'Tahliye Tamamlandı' : 'Sektör Kaybedildi'}
                </h2>
                <p className="text-sm text-slate-300 mb-5">
                  {hud.outcome === 'victory'
                    ? `${hud.civiliansEvacuated} sivil güvenli şekilde tahliye edildi.`
                    : 'Sivilleri tahliye edecek birlik ve helikopter kalmadı.'}
                </p>

                <div className="space-y-2.5 border-y border-slate-800 py-4 mb-6 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tahliye Edilen Sivil</span>
                    <span className="font-mono-num font-semibold text-emerald-400">
                      {hud.civiliansEvacuated} / {hud.civiliansInitial}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Enfekte Olan Sivil</span>
                    <span className="font-mono-num font-semibold text-rose-400">{hud.civiliansLost}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">İmha Edilen Zombi</span>
                    <span className="font-mono-num font-semibold text-slate-100">{hud.zombiesKilled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Operasyon Süresi</span>
                    <span className="font-mono-num font-semibold text-slate-100">
                      {formatTime(hud.missionTimeSec)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartMission}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Tekrar Oyna</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReturnToSetup}
                    className="py-2.5 px-4 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium text-sm cursor-pointer"
                  >
                    Ayarlara Dön
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <OfflineBanner />
      </div>
    </APIProvider>
  );
}
