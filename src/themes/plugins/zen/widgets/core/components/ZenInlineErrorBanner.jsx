import { isZenUiErrorState } from '../zenUiErrorState.js';

export function ZenInlineErrorBanner({
    errorState = null,
    className = '',
} = {}) {
    if (!isZenUiErrorState(errorState)) {
        return null;
    }

    return (
        <div
            className={`mt-3 rounded-[18px] border border-rose-200 bg-rose-50/80 px-3 py-2 text-rose-700 ${className}`.trim()}
            role="alert"
        >
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-rose-300 bg-white/80 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.12em] text-rose-700">
                    {errorState.code}
                </span>
                {typeof errorState.causeCode === 'string' && errorState.causeCode.trim() && (
                    <span className="rounded-full border border-rose-200 bg-rose-100/80 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.12em] text-rose-600">
                        Cause {errorState.causeCode}
                    </span>
                )}
            </div>
            <p className="mt-1 text-[9px] font-semibold leading-4 text-rose-700">
                {errorState.message}
            </p>
            {typeof errorState.causeMessage === 'string'
                && errorState.causeMessage.trim()
                && errorState.causeMessage !== errorState.message && (
                    <p className="mt-1 text-[8px] font-medium leading-4 text-rose-600">
                        Root cause: {errorState.causeMessage}
                    </p>
            )}
        </div>
    );
}

export default ZenInlineErrorBanner;
