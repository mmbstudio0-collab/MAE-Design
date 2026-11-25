import React from 'react';
import { MinMaxRange } from '../game/types';

interface MinMaxControlProps {
  label: string;
  accentClass: string;
  value: MinMaxRange;
  limitMin: number;
  limitMax: number;
  step?: number;
  onChange: (next: MinMaxRange) => void;
}

export const MinMaxControl: React.FC<MinMaxControlProps> = ({
  label,
  accentClass,
  value,
  limitMin,
  limitMax,
  step = 1,
  onChange,
}) => {
  const handleMin = (raw: number) => {
    const clamped = Math.max(limitMin, Math.min(limitMax, raw));
    onChange({
      min: clamped,
      max: Math.max(clamped, value.max),
    });
  };

  const handleMax = (raw: number) => {
    const clamped = Math.max(limitMin, Math.min(limitMax, raw));
    onChange({
      min: Math.min(value.min, clamped),
      max: clamped,
    });
  };

  return (
    <div className="p-2.5 rounded-md bg-[#090d14] border border-slate-800/90 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${accentClass}`}>{label}</span>
        <span className="text-[11px] font-mono-num text-slate-300">
          {value.min} – {value.max}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center justify-between gap-1.5 bg-[#0e1420] border border-slate-800 rounded px-2 py-1">
          <span className="text-[10px] font-mono-num text-slate-500">MIN</span>
          <input
            type="number"
            min={limitMin}
            max={limitMax}
            step={step}
            value={value.min}
            onChange={(e) => handleMin(Number(e.target.value) || limitMin)}
            className="w-20 bg-transparent text-right text-xs font-mono-num text-slate-100 focus:outline-none"
          />
        </label>
        <label className="flex items-center justify-between gap-1.5 bg-[#0e1420] border border-slate-800 rounded px-2 py-1">
          <span className="text-[10px] font-mono-num text-slate-500">MAX</span>
          <input
            type="number"
            min={limitMin}
            max={limitMax}
            step={step}
            value={value.max}
            onChange={(e) => handleMax(Number(e.target.value) || limitMax)}
            className="w-20 bg-transparent text-right text-xs font-mono-num text-slate-100 focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
};
