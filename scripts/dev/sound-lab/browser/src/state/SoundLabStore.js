import { createSoundWorkspace } from '../../../workspace/soundWorkspace.js';

export class SoundLabStore {
  constructor(targets = createSoundWorkspace()) {
    if (!targets.length) throw new Error('SOUND_LAB_TARGETS_EMPTY');
    this.targets = targets;
    this.selectedSoundId = targets[0].id;
    this.themeFilter = 'zen';
    this.scopeFilter = 'all';
    this.searchQuery = '';
    this.reviewFilter = 'all';
    this.listeners = new Set();
    this.drafts = new Map();
    this.selectedCandidates = new Map();
    this.reviews = [];
    this.connected = false;
    this.saving = false;
    this.playing = false;
    this.message = '';
    this.buildRevision = globalThis.ENTROPY_SOUND_LAB_BUILD_REVISION;
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() { for (const listener of this.listeners) listener(this); }
  getSelectedTarget() {
    const target = this.targets.find(item => item.id === this.selectedSoundId);
    if (!target) throw new Error('SOUND_LAB_SELECTION_INVALID');
    return target;
  }
  getSelectedCandidate() {
    const target = this.getSelectedTarget();
    if (!target.candidates.length) return null;
    const id = this.selectedCandidates.has(target.id) ? this.selectedCandidates.get(target.id) : target.candidates[0].id;
    const candidate = target.candidates.find(item => item.id === id);
    if (!candidate) throw new Error('SOUND_LAB_CANDIDATE_SELECTION_INVALID');
    return candidate;
  }
  getDraft() {
    const candidate = this.getSelectedCandidate();
    const key = candidate === null ? this.selectedSoundId : candidate.id;
    if (!this.drafts.has(key)) this.drafts.set(key, {
      context: '', decision: 'discuss', tags: [], note: '',
      parameters: candidate === null ? {} : { ...candidate.parameters },
      auditioned: false, dirty: false, requestId: null,
    });
    return this.drafts.get(key);
  }
  setSelectedSoundId(id) {
    if (!this.targets.some(target => target.id === id)) throw new Error('SOUND_LAB_SELECTION_INVALID');
    this.selectedSoundId = id;
    this.notify();
  }
  setSelectedCandidate(id) {
    if (!this.getSelectedTarget().candidates.some(item => item.id === id)) throw new Error('SOUND_LAB_CANDIDATE_SELECTION_INVALID');
    this.selectedCandidates.set(this.selectedSoundId, id);
    this.notify();
  }
  setFilter(key, value) { this[key] = value; this.notify(); }
  updateDraft(key, value) {
    Object.assign(this.getDraft(), { [key]: value, dirty: true, requestId: null });
    this.notify();
  }
  setParameter(key, value) {
    const draft = this.getDraft();
    this.updateDraft('parameters', { ...draft.parameters, [key]: value });
    draft.auditioned = false;
    this.notify();
  }
  markAuditioned() { this.getDraft().auditioned = true; this.getDraft().requestId = null; this.notify(); }
  getReviews(targetId = this.selectedSoundId) { return this.reviews.filter(record => record.request.targetId === targetId); }
  getFilteredTargets() {
    const query = this.searchQuery.toLowerCase().trim();
    return this.targets.filter(target => (this.themeFilter === 'all' || target.theme === this.themeFilter)
      && (this.scopeFilter === 'all' || target.scope === this.scopeFilter)
      && (this.reviewFilter !== 'unreviewed' || !this.getReviews(target.id).length)
      && (this.reviewFilter !== 'planned' || !target.candidates.length)
      && (!query || [target.name, target.id, target.group, target.moment].some(text => text.toLowerCase().includes(query))));
  }
  getStatistics() {
    return {
      total: this.targets.length,
      product: this.targets.filter(target => ['SYNTH', 'ASSET'].includes(target.productStatus)).length,
      candidates: this.targets.reduce((sum, target) => sum + target.candidates.filter(item => item.role === 'research').length, 0),
      reviewed: this.targets.filter(target => this.getReviews(target.id).length).length,
    };
  }
  makeReviewRequest() {
    const draft = this.getDraft();
    if (draft.requestId === null) draft.requestId = crypto.randomUUID();
    return {
      schemaVersion: 1, requestId: draft.requestId, buildRevision: this.buildRevision,
      targetId: this.selectedSoundId, candidateId: this.getSelectedCandidate()?.id ?? null,
      context: draft.context, decision: draft.decision, tags: [...draft.tags], note: draft.note,
      parameters: { ...draft.parameters }, auditioned: draft.auditioned,
    };
  }
}
