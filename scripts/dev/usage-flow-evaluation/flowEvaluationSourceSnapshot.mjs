import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function validateSourceFiles(sourceFiles) {
    if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) {
        throw new Error('FLOW_EVALUATION_SOURCE_FILES_INVALID:nonempty_array_required');
    }
    if (new Set(sourceFiles).size !== sourceFiles.length) {
        throw new Error('FLOW_EVALUATION_SOURCE_FILES_INVALID:duplicate_path');
    }
    for (const file of sourceFiles) {
        if (typeof file !== 'string' || file.includes('\\') || path.isAbsolute(file)
            || file.split('/').some((part) => part === '' || part === '.' || part === '..')) {
            throw new Error('FLOW_EVALUATION_SOURCE_FILES_INVALID:canonical_relative_path_required');
        }
    }
}

export async function readFlowEvaluationHashes(root, sourceFiles) {
    validateSourceFiles(sourceFiles);
    const entries = await Promise.all(sourceFiles.map(async (file) => [
        file,
        createHash('sha256').update(await readFile(path.join(root, file))).digest('hex'),
    ]));
    return Object.freeze(Object.fromEntries(entries));
}

export async function assertFlowEvaluationHashesUnchanged(root, hashes) {
    if (hashes === null || typeof hashes !== 'object' || Array.isArray(hashes)) {
        throw new Error('FLOW_EVALUATION_SOURCE_HASHES_INVALID:map_required');
    }
    const entries = Object.entries(hashes);
    for (const [, hash] of entries) {
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
            throw new Error('FLOW_EVALUATION_SOURCE_HASHES_INVALID:sha256_required');
        }
    }
    // Read failures propagate, including disappearance; no previous hash or
    // partial snapshot is treated as fresh evidence.
    const current = await readFlowEvaluationHashes(root, entries.map(([file]) => file));
    const changedFiles = entries.filter(([file, hash]) => current[file] !== hash).map(([file]) => file);
    if (changedFiles.length > 0) {
        const error = new Error(`FLOW_EVALUATION_SOURCES_CHANGED:${changedFiles.join(',')}`);
        error.code = 'FLOW_EVALUATION_SOURCES_CHANGED';
        error.changedFiles = changedFiles;
        throw error;
    }
}
