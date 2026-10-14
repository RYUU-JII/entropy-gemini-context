import React, { useState, useEffect, useMemo } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

const BOOT_LOG_KEYS = [
  'boot.sequence.initializing_void_runner',
  'boot.sequence.loading_tactical_interface',
  'boot.sequence.mounting_file_system',
  'boot.sequence.checking_neural_link',
  'boot.sequence.bypassing_security',
  'boot.sequence.optimizing_dopamine',
  'boot.sequence.system_ready',
];

export default function BootSequence({ onComplete }) {
  const { t } = useAppTranslation('common');
  const bootLogs = useMemo(
    () => BOOT_LOG_KEYS.map((key) => t(key)),
    [t]
  );
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    // Check if all lines are printed
    if (lineIndex >= bootLogs.length) {
      const finishTimeout = setTimeout(() => {
        if (onComplete) onComplete();
      }, 800);
      return () => clearTimeout(finishTimeout);
    }

    const currentLineText = bootLogs[lineIndex];

    if (charIndex < currentLineText.length) {
      // Type next character
      const typingSpeed = Math.random() * 30 + 20; // Random speed between 20ms and 50ms
      const typeTimeout = setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, typingSpeed);
      return () => clearTimeout(typeTimeout);
    } else {
      // Line finished, wait before starting next line
      const lineDelay = 150;
      const nextLineTimeout = setTimeout(() => {
        setLineIndex((prev) => prev + 1);
        setCharIndex(0);
      }, lineDelay);
      return () => clearTimeout(nextLineTimeout);
    }
  }, [lineIndex, charIndex, onComplete, bootLogs]);

  return (
    <div className="boot-sequence-overlay">
      <div className="boot-content">
        {/* Render completed lines */}
        {bootLogs.slice(0, lineIndex).map((text, i) => (
          <div key={i} className="boot-line" style={{ opacity: 1, animation: 'none' }}>
            <span className="boot-prefix">&gt;</span>
            {text}
          </div>
        ))}

        {/* Render current typing line */}
        {lineIndex < bootLogs.length && (
          <div className="boot-line" style={{ opacity: 1, animation: 'none' }}>
            <span className="boot-prefix">&gt;</span>
            {bootLogs[lineIndex].slice(0, charIndex)}
            <span className="boot-cursor">_</span>
          </div>
        )}
      </div>
      
      <div className="boot-footer">
        <span>{t('boot.sequence.footer_os')}</span>
        <span>{t('boot.sequence.footer_hypervisor')}</span>
      </div>
    </div>
  );
}
