import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { emitZenTrace, isZenTraceEnabled } from '@zen-trace';
import { ZenBonsaiPlumeModelClient } from '../../model/bonsai/plume/ZenBonsaiPlumeModelClient.js';

const emitModelTiming = event => emitZenTrace('bonsai_model:timing', event);

// The immutable anatomy belongs to this mounted surface and seed. Life-state
// updates project it again without regenerating or persisting the study.
export function useZenBonsaiPlumeTopology({
    enabled,
    lifetimeEnabled = enabled,
    seed,
    lifeState,
    phenotype,
}) {
    const clientRef = useRef(null);
    // The surface owns one releasable accepted result. React's state/update
    // history carries only a revision; commit effects keep scalar identity.
    const resolvedRef = useRef(null);
    const [resolvedRevision, setResolvedRevision] = useState(0);
    const setResolved = useCallback(value => {
        resolvedRef.current = value;
        setResolvedRevision(revision => revision + 1);
    }, []);
    // Study preparation can precede release of the canonical life snapshot.
    const projectionKey = enabled && lifeState !== null
        ? JSON.stringify({ seed, lifeState, phenotype })
        : null;
    useEffect(() => {
        if (!lifetimeEnabled) return undefined;
        const client = new ZenBonsaiPlumeModelClient({
            seed,
            onDiagnosticEvent: isZenTraceEnabled() ? emitModelTiming : undefined,
        });
        clientRef.current = client;
        return () => {
            client.dispose();
            if (resolvedRef.current?.client === client) resolvedRef.current = null;
            if (clientRef.current === client) clientRef.current = null;
        };
    }, [lifetimeEnabled, seed]);

    useEffect(() => {
        if (!enabled || !lifetimeEnabled) return undefined;
        const client = clientRef.current;
        let current = true;
        client.prepare({ lifeState, phenotype, projectionKey }).catch(error => {
            if (current) setResolved({ client, seed, projectionKey, error, preparationFailed: true });
        });
        return () => {
            current = false;
            client.park();
        };
        // Active demand prepares once; parking cancels work without dropping a
        // completed study. Life changes use PROJECT below, not a new PREPARE.
    }, [enabled, lifetimeEnabled, seed, setResolved]);

    useEffect(() => {
        if (!enabled || !lifetimeEnabled || projectionKey === null) return undefined;
        const client = clientRef.current;
        let current = true;
        client.project({ ...JSON.parse(projectionKey), projectionKey }).then(topology => {
            if (current) {
                client.markUIAccepted({ projectionKey });
                setResolved({ client, seed, projectionKey, topology });
            }
        }, error => {
            if (current) setResolved({ client, seed, projectionKey, error });
        });
        return () => { current = false; client.cancelProjection(); };
    }, [enabled, lifetimeEnabled, seed, projectionKey, setResolved]);

    const resolved = resolvedRef.current;
    const accepted = enabled && lifetimeEnabled && resolved?.seed === seed && resolved.client === clientRef.current
        ? resolved : null;
    // Keep the DTO out of effect history. A new accepted revision still commits
    // when parking/reuse returns the same client, projection key and pose.
    const committedClient = accepted?.topology && accepted.projectionKey === projectionKey ? accepted.client : null;
    useLayoutEffect(() => {
        if (committedClient) committedClient.markUICommitted({ projectionKey });
    }, [committedClient, projectionKey, resolvedRevision]);
    if (accepted?.error && (accepted.preparationFailed || accepted.projectionKey === projectionKey)) throw accepted.error;
    // Same-seed updates retain the accepted picture while the next projection is
    // pending. Consumers must not acknowledge it as the requested materialization.
    const topology = accepted?.topology ?? null;
    return {
        topology,
        pending: enabled && (topology === null || accepted.projectionKey !== projectionKey),
        requestKey: projectionKey,
        acceptedKey: topology === null ? null : accepted.projectionKey,
    };
}
