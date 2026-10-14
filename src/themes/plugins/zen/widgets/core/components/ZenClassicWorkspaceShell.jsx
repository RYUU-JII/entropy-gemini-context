export function resolveZenClassicWorkspaceShellState({
    experimental = false,
    embedded = false,
    homeEmbedded = false,
} = {}) {
    const isHomeEmbedded = !experimental && embedded && homeEmbedded;
    return {
        isHomeEmbedded,
        containerClassName: `relative h-full w-full min-h-0 min-w-0 ${isHomeEmbedded ? 'overflow-visible' : 'overflow-hidden'} flex flex-col group font-sans ${experimental
            ? 'rounded-[22px] border'
            : isHomeEmbedded
                ? 'rounded-none border-0 bg-transparent'
                : 'rounded-[28px]'
            }`,
        containerStyle: isHomeEmbedded
            ? undefined
            : {
                backgroundColor: 'var(--color-surface-sunken)',
                borderColor: experimental ? 'var(--color-border-muted)' : 'transparent',
                boxShadow: '0 14px 42px -24px rgba(57, 65, 53, 0.28)',
            },
        viewportStyle: isHomeEmbedded
            ? {
                background: 'var(--zen-layer-l2-surface)',
                borderColor: 'var(--color-border-muted)',
                boxShadow: '0 22px 60px -28px rgba(93, 64, 55, 0.35)',
            }
            : undefined,
        contentClassName: `relative z-10 h-full w-full min-h-0 flex flex-col ${isHomeEmbedded ? 'overflow-visible' : 'overflow-hidden'} ${experimental ? 'p-1.5 sm:p-2 gap-1.5' : 'p-0 gap-0'}`,
    };
}

export function ZenClassicWorkspaceShell({
    containerRef,
    experimental = false,
    embedded = false,
    homeEmbedded = false,
    children = null,
}) {
    const shellState = resolveZenClassicWorkspaceShellState({
        experimental,
        embedded,
        homeEmbedded,
    });
    const content = typeof children === 'function'
        ? children(shellState)
        : children;

    return (
        <div
            ref={containerRef}
            className={shellState.containerClassName}
            style={shellState.containerStyle}
        >
            <div className={shellState.contentClassName}>
                {content}
            </div>
        </div>
    );
}

export default ZenClassicWorkspaceShell;
