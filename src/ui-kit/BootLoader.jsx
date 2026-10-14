import React from 'react';
import { useAppTranslation } from './hooks/useAppTranslation.js';

export default function BootLoader() {
    const { t } = useAppTranslation('common');
    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center font-mono text-xs overflow-hidden cursor-none select-none">
            {/* Background Grid Effect */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg className="w-full h-full">
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-6">
                {/* Core Loader Ring */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                    <div className="absolute inset-0 border-t-2 border-white/80 rounded-full animate-spin" />
                    <div className="absolute inset-2 border-2 border-white/10 rounded-full" />
                    <div className="absolute inset-2 border-b-2 border-white/60 rounded-full animate-[spin_1.5s_linear_infinite_reverse]" />
                </div>

                {/* Status Text Block */}
                <div className="flex flex-col items-center gap-1">
                    <div className="text-white font-bold tracking-[0.2em] animate-pulse">
                        {t('boot.system_boot')}
                    </div>
                    <div className="flex flex-col items-center text-white/50 text-[10px] space-y-0.5">
                        <span className="animate-[fade_0.2s_ease-in-out_infinite]">{t('boot.initializing_kernel')}</span>
                        <span className="animate-[fade_0.3s_ease-in-out_infinite] animation-delay-100">{t('boot.loading_modules')}</span>
                        <span className="animate-[fade_0.4s_ease-in-out_infinite] animation-delay-200">{t('boot.establishing_uplink')}</span>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="absolute bottom-10 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white w-full origin-left animate-[progress_1.5s_ease-in-out_forwards]" />
            </div>

            <style>{`
        @keyframes progress {
            0% { transform: scaleX(0); }
            50% { transform: scaleX(0.4); }
            80% { transform: scaleX(0.8); }
            100% { transform: scaleX(1); }
        }
      `}</style>
        </div>
    );
}
