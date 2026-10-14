import React, { useEffect, useRef } from 'react';
import ZenSignalScannerOverlay from '../core/ZenSignalScannerOverlay.jsx';
import { ZEN_POND_REGISTRATION_PRESENTATION } from '../../../../pond/contracts/zenPondRegistrationPresentation.js';
import './zenSignalScannerInvitation.css';

export default function ZenSignalScannerView({
    className = '',
    frameVariant = 'card',
    containerRef,
    viewportRef,
    backgroundHostRef,
    foregroundHostRef,
    interactionSurfaceRef,
    hoveredDomain,
    hoveredAction,
    invitationInteractive = false,
    invitationRegistrationActive = false,
    invitationPresentationVisible = false,
    invitationGuidance = null,
    invitationHint,
    invitationApproachHint,
    onInvitationKoiActivate,
    handlePointerMove,
    handlePointerDown,
    handlePointerLeave,
    pondReadiness = null,
    pondUnderpaintStyle = null,
    showSwimModelBadge,
    showRerollControls = true,
    swimModelBadge,
    activeDomainForReroll,
    domainBadgeText,
    domainSelectPromptText,
    rerollWithinLabel,
    rerollBreedLabel,
    rerollAllColorLabel,
    rerollAllBreedLabel,
    rerollSceneLabel,
    handleRerollWithinBreed,
    handleRerollBreed,
    handleRerollAllColor,
    handleRerollAllBreed,
    handleRerollScene,
    canRerollAll = false,
    waterEffectsDebugPanel = null,
}) {
    const invitationEntryRef = useRef(null);
    const firstUseHintVisible = invitationInteractive && invitationPresentationVisible
        && !invitationRegistrationActive && invitationGuidance !== null;
    useEffect(() => {
        if (!firstUseHintVisible) return undefined;
        let paintedFrame = null;
        const preparationFrame = requestAnimationFrame(() => {
            paintedFrame = requestAnimationFrame(() => {
                const entry = invitationEntryRef.current;
                if (document.hidden || !entry?.isConnected) return;
                const bounds = entry.getBoundingClientRect();
                if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0
                    || bounds.right <= 0 || bounds.top >= window.innerHeight
                    || bounds.left >= window.innerWidth) return;
                invitationGuidance.onPresented();
            });
        });
        return () => {
            cancelAnimationFrame(preparationFrame);
            if (paintedFrame !== null) cancelAnimationFrame(paintedFrame);
        };
    }, [firstUseHintVisible, invitationGuidance]);
    const usesSlabAperture = frameVariant === 'slab-aperture';
    const underpaintStyle = pondUnderpaintStyle && typeof pondUnderpaintStyle === 'object'
        ? pondUnderpaintStyle
        : {
            backgroundColor: '#1A2B20',
            backgroundImage: 'radial-gradient(circle at 38% 32%, #2E4636 0%, #233829 44%, #1A2B20 100%)',
        };
    return (
        <div
            ref={containerRef}
            data-frame-variant={frameVariant}
            className={`relative h-full w-full ${usesSlabAperture ? 'overflow-hidden p-0' : 'rounded-[32px] p-3'} ${className}`}
            style={usesSlabAperture
                ? { backgroundColor: 'transparent' }
                : {
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 10px 40px rgba(93, 64, 55, 0.12)',
                }}
        >
            <div
                ref={viewportRef}
                className={`relative h-full w-full overflow-hidden ${usesSlabAperture ? 'rounded-none' : 'rounded-[20px]'}`}
                style={usesSlabAperture
                    ? {
                        boxShadow: 'inset 0 16px 34px rgba(0,0,0,0.32)',
                    }
                    : {
                        boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.5)',
                        border: '3px solid var(--color-border-strong)',
                    }}
            >
                <ZenSignalScannerOverlay
                    showSwimModelBadge={showSwimModelBadge}
                    showRerollControls={showRerollControls}
                    swimModelBadge={swimModelBadge}
                    activeDomainForReroll={activeDomainForReroll}
                    domainBadgeText={domainBadgeText}
                    selectPromptText={domainSelectPromptText}
                    rerollWithinLabel={rerollWithinLabel}
                    rerollBreedLabel={rerollBreedLabel}
                    rerollAllColorLabel={rerollAllColorLabel}
                    rerollAllBreedLabel={rerollAllBreedLabel}
                    rerollSceneLabel={rerollSceneLabel}
                    onRerollWithinBreed={handleRerollWithinBreed}
                    onRerollBreed={handleRerollBreed}
                    onRerollAllColor={handleRerollAllColor}
                    onRerollAllBreed={handleRerollAllBreed}
                    onRerollScene={handleRerollScene}
                    canRerollAll={canRerollAll}
                />
                <div
                    ref={backgroundHostRef}
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={underpaintStyle}
                    data-pond-readiness-phase={pondReadiness?.phase || 'unknown'}
                    aria-hidden="true"
                />
                <div
                    ref={foregroundHostRef}
                    className="absolute inset-0 z-[15] pointer-events-none"
                    aria-hidden="true"
                />
                <div
                    ref={interactionSurfaceRef}
                    className="absolute inset-0 z-[16]"
                    style={{ cursor: hoveredDomain || hoveredAction ? 'pointer' : 'default', touchAction: 'none',
                        pointerEvents: invitationRegistrationActive ? 'none' : 'auto' }}
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerDown}
                    onPointerLeave={handlePointerLeave}
                />
                {invitationInteractive && invitationPresentationVisible && !invitationRegistrationActive ? (
                    <button
                        ref={invitationEntryRef}
                        type="button"
                        data-first-site-registration-entry="true"
                        data-guidance-id={firstUseHintVisible ? invitationGuidance.item.guideId : undefined}
                        onClick={onInvitationKoiActivate}
                        className="zen-pond-invitation-entry"
                        style={{ left: `${ZEN_POND_REGISTRATION_PRESENTATION.editor.x * 100}%`,
                            top: ZEN_POND_REGISTRATION_PRESENTATION.editorTopCss }}
                        data-first-use-hint={firstUseHintVisible}
                        data-invitation-attending={hoveredAction === 'register_protected_site'}
                    >
                        {firstUseHintVisible ? invitationHint : invitationApproachHint}
                    </button>
                ) : null}
                {waterEffectsDebugPanel}
            </div>
            <div
                className={`pointer-events-none absolute inset-0 ${usesSlabAperture ? 'rounded-none' : 'rounded-[32px]'} shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]`}
            />
        </div>
    );
}
