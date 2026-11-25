import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { TacticalLogEntry } from '../game/types';

interface EventLogPanelProps {
  entries: TacticalLogEntry[];
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ entries }) => {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || collapsed) return;
    el.scrollTop = el.scrollHeight;
  }, [entries.length, collapsed]);

  return (
    <section
      aria-label="Olay Günlüğü"
      className="pointer-events-auto w-[268px] tactical-panel backdrop-blur-md rounded-md text-slate-100 overflow-hidden"
    >
      <header className="px-3 py-2 border-b border-slate-800/90 bg-slate-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <h2 className="font-display text-[11px] font-bold uppercase tracking-wider text-slate-100 truncate">
            Telsiz &amp; Olay Günlüğü
          </h2>
          <span className="font-mono-num text-[10px] text-slate-400 shrink-0">
            [{entries.length}]
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Olay Günlüğünü Genişlet' : 'Olay Günlüğünü Daralt'}
          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </header>

      {!collapsed && (
        <div
          ref={scrollRef}
          className="max-h-[148px] overflow-y-auto px-2.5 py-2 space-y-1.5 text-[11px] leading-snug"
        >
          {entries.length === 0 ? (
            <div className="text-slate-400 text-[10px] py-1">
              Telsiz ve saha raporları bekleniyor...
            </div>
          ) : (
            entries.map((item) => {
              const colorClass =
                item.severity === 'alert'
                  ? 'text-rose-300'
                  : item.severity === 'warn'
                    ? 'text-amber-300'
                    : item.severity === 'success'
                      ? 'text-emerald-300'
                      : 'text-sky-200';
              return (
                <div key={item.id} className="flex items-start gap-1.5">
                  <span className="font-mono-num text-[10px] text-slate-500 shrink-0 pt-px">
                    [{item.timestampText}]
                  </span>
                  <span className={colorClass}>{item.message}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};
