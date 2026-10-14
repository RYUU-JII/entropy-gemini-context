import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import {
  resolveZenAmbientPresentation,
} from '@/themes/plugins/zen/api/environment.js';

function parseHexOrRgb(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return { r: 255, g: 255, b: 255 };
  const str = colorStr.trim();
  const hex = /^#?([0-9a-f]{6})$/i.exec(str);
  if (hex) {
    const val = parseInt(hex[1], 16);
    return { r: (val >> 16) & 255, g: (val >> 8) & 255, b: val & 255 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(str);
  if (rgba) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) };
  }
  return { r: 255, g: 255, b: 255 };
}

function getRelativeLuminance({ r, g, b }) {
  const normalize = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

function calculateContrastRatio(colorA, colorB) {
  const lumA = getRelativeLuminance(parseHexOrRgb(colorA));
  const lumB = getRelativeLuminance(parseHexOrRgb(colorB));
  const brighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Number(((brighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function ContrastBadge({ ratio, label }) {
  const isPass = ratio >= 4.5;
  const isLargePass = ratio >= 3.0;

  return (
    <div className="flex items-center justify-between p-2.5 rounded bg-[#0F1216]/40 border border-[#2D3440]/60">
      <span className="text-xs font-medium text-[#C5C9D3]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold text-[#E2E7ED]">{ratio}:1</span>
        {isPass ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" /> PASS (AA)
          </span>
        ) : isLargePass ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-700/50 px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" /> LARGE ONLY
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 border border-rose-700/50 px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" /> FAIL
          </span>
        )}
      </div>
    </div>
  );
}

export default function ZenSolarTokenRefinementLab() {
  const [hour, setHour] = useState(14.0);

  const ambientPresentation = useMemo(() => {
    const fakeEpoch = new Date(2026, 7, 3, Math.floor(hour), Math.floor((hour % 1) * 60)).getTime();
    return resolveZenAmbientPresentation({
      solarLocationProfile: null,
      nowMs: fakeEpoch,
    });
  }, [hour]);

  const cssVars = ambientPresentation?.cssVariables || {};
  const shellTop = cssVars['--zen-ambient-shell-top'] || '#fdfbf7';
  const shellBottom = cssVars['--zen-ambient-shell-bottom'] || '#f8f6f0';
  const textColor = cssVars['--zen-ambient-text'] || '#4a4a4a';
  const textMuted = cssVars['--zen-ambient-text-muted'] || '#8d8d8d';
  const primaryColor = cssVars['--zen-ambient-primary'] || '#5d4037';
  const borderColor = cssVars['--zen-ambient-border'] || '#e8e6e1';

  const textContrast = useMemo(() => calculateContrastRatio(textColor, shellTop), [textColor, shellTop]);
  const mutedContrast = useMemo(() => calculateContrastRatio(textMuted, shellTop), [textMuted, shellTop]);
  const primaryContrast = useMemo(() => calculateContrastRatio(primaryColor, shellTop), [primaryColor, shellTop]);

  const timeSnaps = [
    { label: 'Dawn (06:00)', value: 6.0, icon: Sunrise },
    { label: 'Noon (12:00)', value: 12.0, icon: Sun },
    { label: 'Sunset (18:00)', value: 18.0, icon: Sunset },
    { label: 'Dusk (20:00)', value: 20.0, icon: Moon },
    { label: 'Midnight (00:00)', value: 0.0, icon: Clock },
  ];

  return (
    <div className="w-full h-full p-6 bg-[#0E1015] text-[#E1E5ED] overflow-y-auto flex flex-col gap-6">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#252A34] pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-[#E5E9F0]">
            <Palette className="w-5 h-5 text-amber-400" />
            Zen Solar Token Refinement Lab
          </h1>
          <p className="text-xs text-[#9AA2B1] mt-1">
            24시간 태양광 보간 팔레트 및 WCAG 가독성 대비율 실시간 검증 연구소
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1.5 rounded bg-[#181C24] border border-[#2B313E] text-amber-300">
            Phase: <strong className="uppercase">{ambientPresentation?.phase || 'day'}</strong>
          </span>
          <button
            onClick={() => setHour(14.0)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-[#1C222E] hover:bg-[#252D3D] text-[#C5CEDD] border border-[#333D50] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset (14:00)
          </button>
        </div>
      </header>

      {/* Time Scrubber Controls */}
      <section className="bg-[#141820] border border-[#242A36] rounded-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#A8B2C1] uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            Solar Time Scrubber: <span className="text-amber-400 font-mono text-sm">{hour.toFixed(2)}h</span>
          </label>
          <div className="flex items-center gap-2">
            {timeSnaps.map((snap) => {
              const Icon = snap.icon;
              return (
                <button
                  key={snap.label}
                  onClick={() => setHour(snap.value)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition ${
                    Math.abs(hour - snap.value) < 0.1
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-[#1D2330] text-[#9AA2B1] border-[#2E3646] hover:bg-[#262F42]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {snap.label.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="24"
          step="0.1"
          value={hour}
          onChange={(e) => setHour(parseFloat(e.target.value))}
          className="w-full h-2 bg-[#202736] rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
      </section>

      {/* Main Grid: Component Preview vs. Contrast Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Component Preview Canvas (2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-[#A8B2C1] flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            Live UI Component Preview Canvas
          </h2>

          <div
            className="p-6 rounded-xl border transition-colors duration-500 flex flex-col gap-6"
            style={{
              background: `linear-gradient(180deg, ${shellTop}, ${shellBottom})`,
              borderColor: borderColor,
            }}
          >
            {/* Mock Header Card */}
            <div
              className="p-5 rounded-lg border transition-colors duration-300 flex flex-col gap-3"
              style={{
                borderColor: borderColor,
                background: cssVars['--zen-ambient-layer-l2-top'] || 'rgba(255, 255, 255, 0.2)',
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold" style={{ color: textColor }}>
                  🌸 禪 (Zen) Atmosphere Panel Sample
                </h3>
                <span
                  className="text-xs px-2.5 py-1 rounded font-medium border"
                  style={{
                    color: primaryColor,
                    borderColor: borderColor,
                    backgroundColor: 'rgba(0,0,0,0.03)',
                  }}
                >
                  Active Solar Phase
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                시간의 흐름에 따라 변화하는 태양광 보간 톤앤매너 미리보기입니다. 텍스트 가독성과 배경 색상 간의 균형을 실시간으로 확인할 수 있습니다.
              </p>
            </div>

            {/* Mock Action Buttons & Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold" style={{ color: textMuted }}>
                  Sample Action Controls
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 text-xs font-semibold rounded shadow-sm transition"
                    style={{
                      backgroundColor: primaryColor,
                      color: '#FFFFFF',
                    }}
                  >
                    Primary Action
                  </button>
                  <button
                    className="px-4 py-2 text-xs font-medium rounded border transition"
                    style={{
                      borderColor: borderColor,
                      color: textColor,
                    }}
                  >
                    Secondary Ghost
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold" style={{ color: textMuted }}>
                  Sample Form Control
                </label>
                <input
                  type="text"
                  readOnly
                  value="Sample input content..."
                  className="w-full text-xs px-3 py-2 rounded border focus:outline-hidden"
                  style={{
                    color: textColor,
                    borderColor: borderColor,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contrast Inspector (1 col) */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-[#A8B2C1] flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            WCAG 2.1 Contrast Inspector
          </h2>

          <div className="bg-[#141820] border border-[#242A36] rounded-lg p-4 flex flex-col gap-3">
            <ContrastBadge ratio={textContrast} label="Primary Text vs Panel" />
            <ContrastBadge ratio={mutedContrast} label="Muted Text vs Panel" />
            <ContrastBadge ratio={primaryContrast} label="Primary Action vs Panel" />

            <div className="mt-3 pt-3 border-t border-[#232936] flex flex-col gap-2 font-mono text-[11px] text-[#8C96A6]">
              <div className="flex justify-between">
                <span>--zen-ambient-shell-top:</span>
                <span className="text-[#C8D1E0]">{shellTop}</span>
              </div>
              <div className="flex justify-between">
                <span>--zen-ambient-shell-bottom:</span>
                <span className="text-[#C8D1E0]">{shellBottom}</span>
              </div>
              <div className="flex justify-between">
                <span>--zen-ambient-text:</span>
                <span className="text-[#C8D1E0]">{textColor}</span>
              </div>
              <div className="flex justify-between">
                <span>--zen-ambient-primary:</span>
                <span className="text-[#C8D1E0]">{primaryColor}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
