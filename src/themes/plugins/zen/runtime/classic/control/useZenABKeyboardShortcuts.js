import { useEffect } from 'react';

const isEditable = (element) => {
    const nodeName = element?.nodeName?.toUpperCase();
    if (!nodeName) {
        return false;
    }
    if (nodeName === 'INPUT' || nodeName === 'TEXTAREA' || nodeName === 'SELECT') {
        return true;
    }
    if (element?.isContentEditable) {
        return true;
    }
    return false;
};

export const useZenABKeyboardShortcuts = ({
    enabled = false,
    abPair = null,
    isGenerating = false,
    onChoose = null,
    onPass = null,
    onBothGood = null,
} = {}) => {
    useEffect(() => {
        if (!enabled || !abPair || isGenerating) {
            return undefined;
        }
        const onKeyDown = (event) => {
            if (isEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            if (event.key === '1' || event.code === 'Numpad1' || event.key === 'ArrowLeft') {
                event.preventDefault();
                onChoose?.('A');
                return;
            }
            if (event.key === '2' || event.code === 'Numpad2' || event.key === 'ArrowRight') {
                event.preventDefault();
                onChoose?.('B');
                return;
            }
            if (
                event.key === ' '
                || event.key === 'Spacebar'
                || event.key === 'ArrowUp'
                || event.code === 'ArrowUp'
            ) {
                event.preventDefault();
                onPass?.();
                return;
            }
            if (event.key === 'ArrowDown' || event.code === 'ArrowDown') {
                event.preventDefault();
                onBothGood?.();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [enabled, abPair, isGenerating, onChoose, onPass, onBothGood]);
};
