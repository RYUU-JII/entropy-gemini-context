import { lazy, Suspense, useEffect, useState } from 'react';
import ZenCoreStatusClassic from './ZenCoreStatusClassic';
import {
    loadZenCoreStatusVNext,
    zenCoreStatusDevelopmentWorkspace,
} from '@zen-core-status-vnext-entry';

const CLASSIC_WORKSPACE_MODE = 'classic';
const ZEN_VNEXT_BUILD_AVAILABLE = typeof loadZenCoreStatusVNext === 'function';
if (ZEN_VNEXT_BUILD_AVAILABLE !== Boolean(zenCoreStatusDevelopmentWorkspace)) {
    throw new Error('ZEN_CORE_STATUS_BUILD_ENTRY_CONTRACT_INVALID');
}
const ZenCoreStatusVNext = ZEN_VNEXT_BUILD_AVAILABLE
    ? lazy(loadZenCoreStatusVNext)
    : null;
const WORKSPACE_TABS = zenCoreStatusDevelopmentWorkspace?.tabs || Object.freeze([]);

const resolveBuildSupportedWorkspaceMode = (mode) => {
    if (zenCoreStatusDevelopmentWorkspace) {
        return zenCoreStatusDevelopmentWorkspace.resolveMode(mode);
    }
    if (mode !== CLASSIC_WORKSPACE_MODE) {
        throw new Error('ZEN_DEVELOPMENT_WORKSPACE_NOT_AVAILABLE');
    }
    return CLASSIC_WORKSPACE_MODE;
};

const readPersistedWorkspaceMode = () => {
    if (!zenCoreStatusDevelopmentWorkspace) {
        return CLASSIC_WORKSPACE_MODE;
    }
    return resolveBuildSupportedWorkspaceMode(
        zenCoreStatusDevelopmentWorkspace.readMode(
            zenCoreStatusDevelopmentWorkspace.classicMode,
        ),
    );
};

const persistWorkspaceMode = (mode) => {
    if (!zenCoreStatusDevelopmentWorkspace) {
        resolveBuildSupportedWorkspaceMode(mode);
        return;
    }
    zenCoreStatusDevelopmentWorkspace.writeMode(
        resolveBuildSupportedWorkspaceMode(mode),
    );
};

const WorkspaceFallback = ({ experimental = false }) => (
    <div
        className={`h-full w-full overflow-hidden ${experimental ? 'rounded-[32px] border border-border-muted bg-surface-sunken/80' : 'rounded-[28px] bg-surface-sunken/80'} animate-pulse`}
    />
);

const renderWorkspace = (mode, props) => {
    if (
        zenCoreStatusDevelopmentWorkspace
        && resolveBuildSupportedWorkspaceMode(mode)
            === zenCoreStatusDevelopmentWorkspace.researchMode
        && ZenCoreStatusVNext
    ) {
        return (
            <Suspense fallback={<WorkspaceFallback experimental={props?.experimental} />}>
                <ZenCoreStatusVNext {...props} />
            </Suspense>
        );
    }
    return <ZenCoreStatusClassic {...props} />;
};

export default function ZenCoreStatus({
    workspaceMode,
    experimental = false,
    embedded = false,
    homeEmbedded = false,
    ...rest
}) {
    const explicitMode = workspaceMode === undefined || workspaceMode === null
        ? null
        : resolveBuildSupportedWorkspaceMode(workspaceMode);
    const hasExplicitMode = explicitMode !== null;
    const [activeMode, setActiveMode] = useState(() => (
        hasExplicitMode
            ? explicitMode
            : readPersistedWorkspaceMode()
    ));

    useEffect(() => {
        if (!hasExplicitMode) {
            return;
        }
        setActiveMode(explicitMode);
    }, [explicitMode, hasExplicitMode]);

    useEffect(() => {
        if (hasExplicitMode || !zenCoreStatusDevelopmentWorkspace) {
            return;
        }
        persistWorkspaceMode(activeMode);
    }, [activeMode, hasExplicitMode]);

    const workspaceProps = {
        experimental,
        embedded,
        homeEmbedded,
        ...rest,
    };

    if (!zenCoreStatusDevelopmentWorkspace) {
        return renderWorkspace(CLASSIC_WORKSPACE_MODE, workspaceProps);
    }

    if (hasExplicitMode) {
        return renderWorkspace(activeMode, workspaceProps);
    }

    return (
        <div className="h-full w-full min-h-0 flex flex-col gap-2">
            <div className="shrink-0 flex items-center justify-between gap-3 rounded-[24px] border border-border-muted bg-surface-overlay/92 px-3 py-2">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-on-surface-muted">
                        Bonsai Workspace
                    </p>
                    <p className="text-[11px] text-on-surface-muted">
                        Production and research stay in separate workspaces.
                    </p>
                </div>
                <div className="inline-flex shrink-0 rounded-full border border-border bg-surface-elevated p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                    {WORKSPACE_TABS.map((tab) => {
                        const isActive = activeMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveMode(tab.id)}
                                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${isActive
                                    ? 'bg-[#2E5B4F] text-[#F6F1E8]'
                                    : 'text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface'
                                    }`}
                                title={tab.detail}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="min-h-0 flex-1">
                {renderWorkspace(activeMode, workspaceProps)}
            </div>
        </div>
    );
}
