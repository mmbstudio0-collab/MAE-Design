import React from 'react';
import { BellRing, LogOut, Shield, Truck } from 'lucide-react';
import {
  PoliceRole,
  SelectedUnitHud,
  SelectedVehicleHud,
  SirenMode,
  SoldierRole,
  UnitRole,
  VehicleKind,
  WeaponClass,
} from '../game/types';

interface SelectedPanelProps {
  selectedUnits: SelectedUnitHud[];
  selectedVehicles: SelectedVehicleHud[];
  sirenMode: SirenMode;
  onUnloadVehicles: () => void;
  onToggleSirens: () => void;
  onChangeSirenMode: (mode: SirenMode) => void;
}

const ROLE_LABELS: Record<UnitRole, string> = {
  normal: 'Normal Polis',
  traffic: 'Trafik Polisi',
  special_ops: 'Özel Harekât',
  swat: 'SWAT Ekibi',
  commissioner: 'Polis Komiseri',
  riot_shield: 'Kalkanlı Ekip',
  infantry: 'Piyade Askeri',
  commando: 'Komando',
  sniper: 'Keskin Nişancı',
  heavy: 'Ağır Silahlı',
  medic: 'Askerî Sağlıkçı',
  paratrooper: 'Paraşütçü',
};

const WEAPON_LABELS: Record<WeaponClass, string> = {
  pistol: '9mm Tabanca',
  smg: 'Hafif Makineli',
  rifle: 'Piyade Tüfeği',
  heavy: 'Ağır Mak. Tüfek',
  sniper: 'Keskin Nişancı',
};

const VEHICLE_LABELS: Record<VehicleKind, string> = {
  police_car: 'Polis Arabası',
  police_van: 'Polis Minibüsü',
  ambulance: 'Ambulans',
  fire_truck: 'İtfaiye Aracı',
  civilian_car: 'Sivil Otomobil',
  motorcycle: 'Motosiklet',
  military_jeep: 'Askerî Jip',
  armored_apc: 'Zırhlı Araç (APC)',
};

const UnitLogo: React.FC<{ kind: 'police' | 'soldier'; role: UnitRole }> = ({ kind, role }) => {
  if (kind === 'police') {
    const policeRole = role as PoliceRole;
    const accent =
      policeRole === 'traffic'
        ? '#facc15'
        : policeRole === 'swat' || policeRole === 'special_ops'
          ? '#60a5fa'
          : policeRole === 'commissioner'
            ? '#fbbf24'
            : '#38bdf8';
    return (
      <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" aria-hidden="true">
        <rect x="2" y="2" width="32" height="32" rx="4" fill="#090d14" stroke={accent} strokeWidth="1.5" />
        <path
          d="M18 6 L26 9.5 V17.5 C26 22.8 22.4 27 18 29 C13.6 27 10 22.8 10 17.5 V9.5 Z"
          fill="#1e3a8a"
          stroke={accent}
          strokeWidth="1.4"
        />
        {policeRole === 'riot_shield' ? (
          <>
            <rect x="14" y="12" width="8" height="12" rx="1" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1" />
            <rect x="15.5" y="14" width="5" height="2.2" fill="#e0f2fe" />
          </>
        ) : policeRole === 'commissioner' ? (
          <polygon
            points="18,10.5 19.6,14.5 23.8,14.8 20.5,17.4 21.6,21.5 18,19.1 14.4,21.5 15.5,17.4 12.2,14.8 16.4,14.5"
            fill="#fbbf24"
          />
        ) : policeRole === 'swat' || policeRole === 'special_ops' ? (
          <>
            <circle cx="18" cy="17.5" r="4.8" fill="none" stroke="#93c5fd" strokeWidth="1.3" />
            <line x1="18" y1="11" x2="18" y2="24" stroke="#93c5fd" strokeWidth="1.2" />
            <line x1="11.5" y1="17.5" x2="24.5" y2="17.5" stroke="#93c5fd" strokeWidth="1.2" />
          </>
        ) : policeRole === 'traffic' ? (
          <>
            <rect x="14.5" y="11" width="7" height="13" rx="1.5" fill="#1e293b" stroke="#facc15" strokeWidth="1" />
            <circle cx="18" cy="14" r="1.4" fill="#ef4444" />
            <circle cx="18" cy="17.5" r="1.4" fill="#facc15" />
            <circle cx="18" cy="21" r="1.4" fill="#22c55e" />
          </>
        ) : (
          <polygon
            points="18,11.5 19.4,15 23,15.3 20.2,17.6 21.1,21.2 18,19.2 14.9,21.2 15.8,17.6 13,15.3 16.6,15"
            fill="#bae6fd"
          />
        )}
      </svg>
    );
  }

  const soldierRole = role as SoldierRole;
  const accent =
    soldierRole === 'medic'
      ? '#f87171'
      : soldierRole === 'commando'
        ? '#f59e0b'
        : soldierRole === 'paratrooper'
          ? '#a3e635'
          : '#34d399';

  return (
    <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="32" height="32" rx="4" fill="#0b1510" stroke={accent} strokeWidth="1.5" />
      <polygon points="18,6 27,11 27,25 18,30 9,25 9,11" fill="#14532d" stroke={accent} strokeWidth="1.2" />
      {soldierRole === 'medic' ? (
        <>
          <rect x="16" y="12" width="4" height="12" rx="0.6" fill="#ef4444" />
          <rect x="12" y="16" width="12" height="4" rx="0.6" fill="#ef4444" />
        </>
      ) : soldierRole === 'sniper' ? (
        <>
          <circle cx="18" cy="18" r="5" fill="none" stroke="#d9f99d" strokeWidth="1.3" />
          <line x1="18" y1="10.5" x2="18" y2="25.5" stroke="#d9f99d" strokeWidth="1.1" />
          <line x1="10.5" y1="18" x2="25.5" y2="18" stroke="#d9f99d" strokeWidth="1.1" />
          <circle cx="18" cy="18" r="1.4" fill="#ef4444" />
        </>
      ) : soldierRole === 'paratrooper' ? (
        <>
          <path d="M10.5 16 C12 10.5, 24 10.5, 25.5 16 Z" fill="#bef264" />
          <line x1="12" y1="16" x2="18" y2="24" stroke="#ecfccb" strokeWidth="1" />
          <line x1="24" y1="16" x2="18" y2="24" stroke="#ecfccb" strokeWidth="1" />
          <circle cx="18" cy="24" r="1.6" fill="#fef08a" />
        </>
      ) : soldierRole === 'heavy' ? (
        <>
          <rect x="12" y="14" width="2.4" height="8" rx="0.6" fill="#fbbf24" />
          <rect x="15.4" y="13" width="2.4" height="9" rx="0.6" fill="#fbbf24" />
          <rect x="18.8" y="14" width="2.4" height="8" rx="0.6" fill="#fbbf24" />
          <rect x="22.2" y="15" width="2.4" height="7" rx="0.6" fill="#fbbf24" />
        </>
      ) : soldierRole === 'commando' ? (
        <>
          <polygon points="18,10 21,18 18,26 15,18" fill="#fde047" />
          <path d="M12 20 L18 24 L24 20" fill="none" stroke="#34d399" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <path d="M12 16 L18 11.5 L24 16" fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 21 L18 16.5 L24 21" fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
};

const VehicleLogo: React.FC<{ kind: VehicleKind; sirenOn: boolean }> = ({ kind, sirenOn }) => {
  const border =
    kind === 'armored_apc' || kind === 'military_jeep'
      ? '#4ade80'
      : kind === 'fire_truck' || kind === 'ambulance'
        ? '#f87171'
        : kind === 'police_car' || kind === 'police_van'
          ? '#38bdf8'
          : '#fbbf24';

  return (
    <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="32" height="32" rx="4" fill="#090d14" stroke={border} strokeWidth="1.5" />
      {kind === 'armored_apc' ? (
        <>
          <rect x="8" y="13" width="20" height="11" rx="2" fill="#3f6212" stroke="#bef264" strokeWidth="1" />
          <circle cx="18" cy="18.5" r="3.5" fill="#1a2e05" stroke="#d9f99d" strokeWidth="1" />
          <line x1="18" y1="18.5" x2="29" y2="18.5" stroke="#ecfccb" strokeWidth="2" />
        </>
      ) : kind === 'military_jeep' ? (
        <>
          <rect x="9" y="13" width="18" height="10" rx="1.5" fill="#365314" stroke="#a3e635" strokeWidth="1" />
          <polygon
            points="18,14.5 19,17 21.5,17.2 19.6,18.7 20.2,21.2 18,19.8 15.8,21.2 16.4,18.7 14.5,17.2 17,17"
            fill="#f8fafc"
          />
        </>
      ) : kind === 'ambulance' ? (
        <>
          <rect x="8" y="12" width="20" height="12" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
          <rect x="16.5" y="14" width="3" height="8" fill="#dc2626" />
          <rect x="14" y="16.5" width="8" height="3" fill="#dc2626" />
        </>
      ) : kind === 'fire_truck' ? (
        <>
          <rect x="7.5" y="12.5" width="21" height="11" rx="1.5" fill="#b91c1c" stroke="#fca5a5" strokeWidth="1" />
          <line x1="10" y1="16" x2="26" y2="16" stroke="#e2e8f0" strokeWidth="1.4" />
          <line x1="10" y1="20" x2="26" y2="20" stroke="#e2e8f0" strokeWidth="1.4" />
        </>
      ) : kind === 'motorcycle' ? (
        <>
          <circle cx="12" cy="21" r="4" fill="none" stroke="#fbbf24" strokeWidth="1.6" />
          <circle cx="24" cy="21" r="4" fill="none" stroke="#fbbf24" strokeWidth="1.6" />
          <path d="M12 21 L17 14 H22 L24 21" fill="none" stroke="#e2e8f0" strokeWidth="1.6" />
        </>
      ) : (
        <>
          <rect
            x="8"
            y="12.5"
            width="20"
            height="11"
            rx="2"
            fill={kind === 'civilian_car' ? '#475569' : '#1e3a8a'}
            stroke={border}
            strokeWidth="1"
          />
          <rect x="14" y="10.5" width="4" height="2" rx="0.5" fill={sirenOn ? '#ef4444' : '#94a3b8'} />
          <rect x="18" y="10.5" width="4" height="2" rx="0.5" fill={sirenOn ? '#3b82f6' : '#cbd5e1'} />
        </>
      )}
    </svg>
  );
};

export const SelectedPanel: React.FC<SelectedPanelProps> = ({
  selectedUnits,
  selectedVehicles,
  sirenMode,
  onUnloadVehicles,
  onToggleSirens,
  onChangeSirenMode,
}) => {
  if (selectedUnits.length === 0 && selectedVehicles.length === 0) return null;

  const hasOccupants = selectedVehicles.some((v) => v.occupants > 0);
  const anySirenOn = selectedVehicles.some((v) => v.sirenOn);

  const roleGroups = new Map<
    string,
    {
      kind: 'police' | 'soldier';
      role: UnitRole;
      weaponClass: WeaponClass;
      count: number;
      totalHp: number;
      maxHp: number;
      totalStamina: number;
      maxStamina: number;
      exhaustedCount: number;
      infectedCount: number;
      sample: SelectedUnitHud;
    }
  >();

  for (const u of selectedUnits) {
    const key = `${u.kind}:${u.role}`;
    const existing = roleGroups.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalHp += u.hp;
      existing.maxHp += u.maxHp;
      existing.totalStamina += u.stamina;
      existing.maxStamina += u.maxStamina;
      if (u.exhausted) existing.exhaustedCount += 1;
      if (u.infected) existing.infectedCount += 1;
    } else {
      roleGroups.set(key, {
        kind: u.kind,
        role: u.role,
        weaponClass: u.weaponClass,
        count: 1,
        totalHp: u.hp,
        maxHp: u.maxHp,
        totalStamina: u.stamina,
        maxStamina: u.maxStamina,
        exhaustedCount: u.exhausted ? 1 : 0,
        infectedCount: u.infected ? 1 : 0,
        sample: u,
      });
    }
  }
  const groupedUnits = Array.from(roleGroups.values());

  return (
    <aside
      aria-label="Seçili Birim ve Araçlar"
      className="w-[282px] max-h-[calc(100vh-12rem)] overflow-y-auto tactical-panel backdrop-blur-md rounded-md p-3 space-y-2.5"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 uppercase tracking-wider">
          {selectedVehicles.length > 0 ? (
            <Truck className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Seçili Kuvvetler</span>
        </div>
        <span className="text-[11px] font-mono-num text-amber-300">
          {selectedUnits.length > 0 ? `${selectedUnits.length} Birlik` : ''}
          {selectedUnits.length > 0 && selectedVehicles.length > 0 ? ' · ' : ''}
          {selectedVehicles.length > 0 ? `${selectedVehicles.length} Araç` : ''}
        </span>
      </div>

      {selectedVehicles.length > 0 && (
        <div className="space-y-2">
          {selectedVehicles.slice(0, 6).map((v) => {
            const hpPct = Math.max(0, Math.min(100, Math.round((v.hp / v.maxHp) * 100)));
            return (
              <div
                key={v.id}
                className="flex items-center gap-2.5 p-2 rounded bg-[#0c121c] border border-slate-800/90"
              >
                <VehicleLogo kind={v.kind} sirenOn={v.sirenOn} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-slate-100 truncate">
                      {VEHICLE_LABELS[v.kind]} #{v.id}
                    </span>
                    <span
                      className={`text-[10px] font-mono-num whitespace-nowrap ${
                        v.sirenOn ? 'text-rose-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {v.sirenOn ? 'SİREN AÇIK' : 'HAZIR'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${hpPct}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono-num text-slate-400">
                    <span>Zırh {Math.ceil(v.hp)}/{v.maxHp}</span>
                    <span>Mürettebat {v.occupants}/{v.maxOccupants}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={onToggleSirens}
              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                anySirenOn
                  ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span>{anySirenOn ? 'Siren Kapat [H]' : 'Siren Aç [H]'}</span>
            </button>

            <button
              type="button"
              disabled={!hasOccupants}
              onClick={onUnloadVehicles}
              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold bg-sky-500/20 border border-sky-500/50 text-sky-200 hover:bg-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Araçtan İn [G]</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Siren Modu [M]</span>
              <span className="font-mono-num uppercase text-rose-300">{sirenMode}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'wail', label: 'Wail · Uzun' },
                  { id: 'yelp', label: 'Yelp · Hızlı' },
                  { id: 'hi_lo', label: 'Hi-Lo · Çift' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeSirenMode(m.id)}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    sirenMode === m.id
                      ? 'bg-rose-500/25 border-rose-400/70 text-rose-100 font-semibold'
                      : 'bg-[#0c121c] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-snug">
            Araç boşken hareket etmez. Binmek için asker/polis seçip araca sağ tıklayın.
          </p>
        </div>
      )}

      {groupedUnits.length > 0 && (
        <div className="space-y-1.5">
          {groupedUnits.map((g) => {
            const hpPct = Math.max(0, Math.min(100, Math.round((g.totalHp / g.maxHp) * 100)));
            const stmPct = Math.max(
              0,
              Math.min(100, Math.round((g.totalStamina / Math.max(1, g.maxStamina)) * 100))
            );
            const isPolice = g.kind === 'police';
            const isExhausted = g.exhaustedCount > 0;
            return (
              <div
                key={`${g.kind}-${g.role}`}
                className="flex items-center gap-2.5 p-2 rounded bg-[#0c121c] border border-slate-800/90"
              >
                <UnitLogo kind={g.kind} role={g.role} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-slate-100 truncate">
                      {ROLE_LABELS[g.role]}
                    </span>
                    <span
                      className={`text-[10px] font-mono-num font-semibold whitespace-nowrap ${
                        g.infectedCount > 0
                          ? 'text-rose-400 animate-pulse'
                          : isPolice
                            ? 'text-sky-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {g.infectedCount > 0
                        ? `ENFEKTE${g.count > 1 ? ` (${g.infectedCount}/${g.count})` : ''}`
                        : g.count > 1
                          ? `x${g.count}`
                          : 'HAZIR'}
                    </span>
                  </div>

                  {/* HP Bar */}
                  <div className="mt-1 h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${isPolice ? 'bg-sky-400' : 'bg-emerald-400'}`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>

                  {/* Stamina Bar */}
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-mono-num uppercase text-slate-500">KOND</span>
                    <div className="flex-1 h-1 rounded-sm bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-[width] duration-200 ${
                          isExhausted ? 'bg-rose-400' : stmPct < 35 ? 'bg-amber-400' : 'bg-amber-300'
                        }`}
                        style={{ width: `${stmPct}%` }}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-mono-num ${
                        isExhausted ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      %{stmPct}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono-num text-slate-400">
                    <span>{WEAPON_LABELS[g.weaponClass]}</span>
                    {g.count === 1 ? (
                      <span>Mermi {g.sample.ammo}/{g.sample.maxAmmo}</span>
                    ) : (
                      <span>HP %{hpPct}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-400 leading-snug">
            Sağ Tık: İlerle / Ateş et · Araca Sağ Tık: Araca bin
          </p>
        </div>
      )}
    </aside>
  );
};
