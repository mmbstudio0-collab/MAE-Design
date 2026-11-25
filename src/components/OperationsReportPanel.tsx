import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface OperationsReportPanelProps {
  hud: HudSnapshot;
}

export const OperationsReportPanel: React.FC<OperationsReportPanelProps> = ({ hud }) => {
  const [collapsed, setCollapsed] = useState(false);

  const unitTotalLosses = hud.policeLosses + hud.soldiersLosses;

  return (
    <section
      aria-label="Operasyon Raporu"
      className="pointer-events-auto w-[268px] tactical-panel backdrop-blur-md rounded-md text-slate-100 overflow-hidden"
    >
      <header className="px-3 py-2 border-b border-slate-800/90 bg-slate-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <BarChart3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <h2 className="font-display text-[11px] font-bold uppercase tracking-wider text-slate-100 truncate">
            Operasyon Raporu
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Operasyon Raporunu Genişlet' : 'Operasyon Raporunu Daralt'}
          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </header>

      {!collapsed && (
        <div className="p-3 space-y-2.5 text-[11px]">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 font-medium">Zombi İmha Oranı</span>
              <span className="font-mono-num font-bold text-rose-400">
                %{hud.zombieKillRatePct}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-sm bg-slate-800/90 overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-[width] duration-300"
                style={{ width: `${hud.zombieKillRatePct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400">
              <span>{hud.zombiesKilled} imha</span>
              <span>{hud.zombiesAlive} aktif tehdit</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 font-medium">Sivil Tahliye Verimliliği</span>
              <span className="font-mono-num font-bold text-emerald-400">
                %{hud.civEvacEfficiencyPct}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-sm bg-slate-800/90 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${hud.civEvacEfficiencyPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400">
              <span>{hud.civiliansEvacuated} kurtarıldı</span>
              <span>{hud.civiliansLost} kayıp</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 font-medium">Birim Kayıp Oranı</span>
              <span className="font-mono-num font-bold text-amber-300">
                %{hud.unitLossPct}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-sm bg-slate-800/90 overflow-hidden flex">
              {unitTotalLosses > 0 ? (
                <>
                  <div
                    className="h-full bg-sky-400 transition-[width] duration-300"
                    style={{
                      width: `${Math.round((hud.policeLosses / Math.max(1, hud.policeInitial + hud.soldiersInitial)) * 100)}%`,
                    }}
                  />
                  <div
                    className="h-full bg-amber-400 transition-[width] duration-300"
                    style={{
                      width: `${Math.round((hud.soldiersLosses / Math.max(1, hud.policeInitial + hud.soldiersInitial)) * 100)}%`,
                    }}
                  />
                </>
              ) : null}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400">
              <span className="text-sky-300">Polis -{hud.policeLosses}</span>
              <span className="text-emerald-300">Asker -{hud.soldiersLosses}</span>
              <span className="text-amber-300">Kond %{hud.avgUnitStaminaPct}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
