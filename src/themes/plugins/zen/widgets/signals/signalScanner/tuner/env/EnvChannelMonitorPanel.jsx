import React from 'react';
const clamp01 = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
};
const toFinite = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const CHANNEL_GROUPS = Object.freeze([Object.freeze({
  id: 'illumination',
  label: '광량 채널',
  hint: '직사광/주변광/스펙큘러',
  channels: Object.freeze([Object.freeze({
    id: 'directLight',
    label: '직사광',
    min: 0,
    max: 1.6
  }), Object.freeze({
    id: 'ambientLight',
    label: '주변광',
    min: 0,
    max: 1.0
  }), Object.freeze({
    id: 'specularResponse',
    label: '하이라이트',
    min: 0,
    max: 1.0
  })])
}), Object.freeze({
  id: 'surface',
  label: '수면/반사 채널',
  hint: '물결/반사/거칠기',
  channels: Object.freeze([Object.freeze({
    id: 'waveEnergy',
    label: '물결 에너지',
    min: 0,
    max: 1.0
  }), Object.freeze({
    id: 'roughness',
    label: '거칠기',
    min: 0,
    max: 1.0
  }), Object.freeze({
    id: 'cloudReflectionFactor',
    label: '구름 반사',
    min: 0,
    max: 1.0
  }), Object.freeze({
    id: 'mirrorFactor',
    label: '거울 반사',
    min: 0,
    max: 1.0
  })])
}), Object.freeze({
  id: 'volume',
  label: '수질 채널',
  hint: '탁도/투과/바닥 가시성',
  channels: Object.freeze([Object.freeze({
    id: 'turbidity',
    label: '탁도',
    min: 0,
    max: 1.0
  }), Object.freeze({
    id: 'transmittance',
    label: '투과율',
    min: 0,
    max: 1.0
  }), Object.freeze({
    id: 'bottomVisibility',
    label: '바닥 시인성',
    min: 0,
    max: 1.0
  })])
})]);
export default function EnvChannelMonitorPanel({
  t,
  channelValues = null
}) {
  if (!t) return null;
  const safeValues = channelValues && typeof channelValues === 'object' ? channelValues : {};
  return <div className="rounded-2xl border border-border/40 bg-surface/20 p-3">
            <div className="mb-3 space-y-1">
                <p className="text-xs font-semibold text-on-surface">
                    {t('tools:koi_tuner.env_channels.title', {})}
                </p>
                <p className="text-xs text-on-surface-muted">
                    {t('tools:koi_tuner.env_channels.hint', {})}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {CHANNEL_GROUPS.map(group => <div key={`env-channel-group-${group.id}`} className="rounded-xl border border-border/25 bg-surface-sunken/45 p-2">
                        <div className="mb-2 space-y-1 px-1">
                            <p className="text-xs font-semibold text-on-surface">
                                {t(`tools:koi_tuner.env_channels.group.${group.id}.label`, {})}
                            </p>
                            <p className="text-xs text-on-surface-muted">
                                {t(`tools:koi_tuner.env_channels.group.${group.id}.hint`, {})}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            {group.channels.map(channel => {
            const value = toFinite(safeValues[channel.id], 0);
            const normalized = clamp01((value - channel.min) / (channel.max - channel.min || 1));
            return <div key={`env-channel-${channel.id}`} className="rounded-xl border border-border/25 bg-surface-sunken/60 px-3 py-2">
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-xs text-on-surface">
                                                {t(`tools:koi_tuner.env_channels.${channel.id}.label`, {})}
                                            </span>
                                            <span className="font-mono text-xs text-accent">
                                                {value.toFixed(3)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface/60 ring-1 ring-inset ring-border/25">
                                            <div className="h-full rounded-full bg-accent/70" style={{
                  width: `${Math.round(normalized * 100)}%`
                }} />
                                        </div>
                                    </div>;
          })}
                        </div>
                    </div>)}
            </div>
        </div>;
}
