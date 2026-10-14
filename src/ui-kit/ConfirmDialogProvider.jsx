import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

const ConfirmDialogContext = createContext(null);

const DEFAULT_OPTIONS = Object.freeze({
    title: 'Confirm action',
    description: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    danger: false,
});

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

let confirmRequestSequence = 0;

const normalizeOptionText = (value, fallback) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const normalizeConfirmOptions = (options = {}) => ({
    title: normalizeOptionText(options.title, DEFAULT_OPTIONS.title),
    description: normalizeOptionText(options.description, DEFAULT_OPTIONS.description),
    confirmLabel: normalizeOptionText(options.confirmLabel, DEFAULT_OPTIONS.confirmLabel),
    cancelLabel: normalizeOptionText(options.cancelLabel, DEFAULT_OPTIONS.cancelLabel),
    danger: Boolean(options.danger),
});

const getFocusableElements = (container) => {
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        return !element.hasAttribute('disabled');
    });
};

export function ConfirmDialogProvider({ children }) {
    const [activeRequest, setActiveRequest] = useState(null);
    const requestQueueRef = useRef([]);
    const activeRequestRef = useRef(null);
    const previousFocusRef = useRef(null);
    const dialogRef = useRef(null);
    const cancelButtonRef = useRef(null);
    const confirmButtonRef = useRef(null);
    const focusRafRef = useRef(null);

    useEffect(() => {
        activeRequestRef.current = activeRequest;
    }, [activeRequest]);

    const settleActiveRequest = useCallback((accepted) => {
        setActiveRequest((current) => {
            if (!current) return current;
            current.resolve(Boolean(accepted));
            return requestQueueRef.current.shift() || null;
        });
    }, []);

    const confirm = useCallback((options = {}) => new Promise((resolve) => {
        const nextRequest = {
            id: ++confirmRequestSequence,
            options: normalizeConfirmOptions(options),
            resolve,
        };

        setActiveRequest((current) => {
            if (!current) {
                return nextRequest;
            }
            requestQueueRef.current.push(nextRequest);
            return current;
        });
    }), []);

    useEffect(() => () => {
        if (focusRafRef.current) {
            cancelAnimationFrame(focusRafRef.current);
            focusRafRef.current = null;
        }

        const current = activeRequestRef.current;
        if (current?.resolve) {
            current.resolve(false);
        }

        requestQueueRef.current.forEach((queued) => {
            if (queued?.resolve) queued.resolve(false);
        });
        requestQueueRef.current = [];
    }, []);

    useEffect(() => {
        if (!activeRequest || typeof document === 'undefined') return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [activeRequest]);

    useEffect(() => {
        if (!activeRequest || typeof document === 'undefined') return undefined;

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        focusRafRef.current = requestAnimationFrame(() => {
            const target = cancelButtonRef.current || confirmButtonRef.current || dialogRef.current;
            if (target && typeof target.focus === 'function') {
                target.focus();
            }
        });

        return () => {
            if (focusRafRef.current) {
                cancelAnimationFrame(focusRafRef.current);
                focusRafRef.current = null;
            }

            const previousFocus = previousFocusRef.current;
            if (previousFocus && document.contains(previousFocus) && typeof previousFocus.focus === 'function') {
                previousFocus.focus();
            }
            previousFocusRef.current = null;
        };
    }, [activeRequest]);

    useEffect(() => {
        if (!activeRequest || typeof document === 'undefined') return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                settleActiveRequest(false);
                return;
            }

            if (event.key !== 'Tab') return;

            const focusable = getFocusableElements(dialogRef.current);
            if (!focusable.length) {
                event.preventDefault();
                dialogRef.current?.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey) {
                if (activeElement === first || !dialogRef.current?.contains(activeElement)) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeRequest, settleActiveRequest]);

    const contextValue = useMemo(() => ({ confirm }), [confirm]);

    const titleId = activeRequest ? `confirm-dialog-title-${activeRequest.id}` : undefined;
    const descriptionId = activeRequest ? `confirm-dialog-description-${activeRequest.id}` : undefined;

    return (
        <ConfirmDialogContext.Provider value={contextValue}>
            {children}
            {activeRequest && (
                <div
                    className="fixed inset-0 z-[12000] flex items-center justify-center px-4 py-6"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            settleActiveRequest(false);
                        }
                    }}
                >
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-hidden="true" />

                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={descriptionId}
                        tabIndex={-1}
                        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-5 shadow-2xl"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <h2 id={titleId} className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-on-surface">
                            {activeRequest.options.title}
                        </h2>

                        {activeRequest.options.description && (
                            <p id={descriptionId} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-on-surface-muted">
                                {activeRequest.options.description}
                            </p>
                        )}

                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                ref={cancelButtonRef}
                                type="button"
                                onClick={() => settleActiveRequest(false)}
                                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-on-surface-muted transition hover:border-accent hover:text-on-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40"
                            >
                                {activeRequest.options.cancelLabel}
                            </button>
                            <button
                                ref={confirmButtonRef}
                                type="button"
                                onClick={() => settleActiveRequest(true)}
                                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-hidden focus-visible:ring-2 ${activeRequest.options.danger
                                    ? 'bg-danger/90 text-white hover:bg-danger focus-visible:ring-danger/35'
                                    : 'bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent/35'
                                    }`}
                            >
                                {activeRequest.options.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmDialogContext.Provider>
    );
}

export function useConfirmDialog() {
    const context = useContext(ConfirmDialogContext);
    if (!context) {
        throw new Error('useConfirmDialog must be used within ConfirmDialogProvider.');
    }
    return context;
}
