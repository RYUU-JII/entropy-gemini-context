import { REVIEW_DECISIONS, REVIEW_TAGS, assertReviewRequest, formatAgentRequest } from '../../../workspace/soundWorkspace.js';

export class AgentPromptCardComponent {
  constructor(store) { this.store = store; this.historySignature = ''; }
  bindEvents() {
    for (const [value, label] of Object.entries(REVIEW_DECISIONS)) {
      const option = document.createElement('option'); option.value = value; option.textContent = label;
      document.getElementById('reviewDecision').append(option);
    }
    for (const tag of REVIEW_TAGS) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = tag; button.dataset.tag = tag;
      button.addEventListener('click', () => {
        const tags = this.store.getDraft().tags;
        this.store.updateDraft('tags', tags.includes(tag) ? tags.filter(value => value !== tag) : [...tags, tag]);
      });
      document.getElementById('feedbackTags').append(button);
    }
    for (const [id, key, event] of [['reviewDecision', 'decision', 'change'], ['reviewContext', 'context', 'input'], ['reviewNote', 'note', 'input']]) {
      document.getElementById(id).addEventListener(event, change => this.store.updateDraft(key, change.target.value));
    }
    document.getElementById('btnSaveReview').addEventListener('click', () => { void this.save(); });
    document.getElementById('btnConnect').addEventListener('click', () => { void this.connect(); });
    document.getElementById('btnCopyPrompt').addEventListener('click', async () => {
      try {
        if (!navigator.clipboard) throw new Error('자동 복사를 사용할 수 없습니다. 아래 요청문을 선택해 복사하세요.');
        await navigator.clipboard.writeText(document.getElementById('agentPromptText').value);
        this.store.message = '에이전트 요청을 복사했습니다. 대화에 붙여 넣어 주세요.';
      } catch (error) { this.store.message = `복사 실패: ${error.message}`; }
      this.store.notify();
    });
  }
  async connect() {
    if (location.protocol === 'file:') {
      this.store.message = '파일로 열면 청음과 요청 복사가 가능합니다. 피드백을 파일에 저장하려면 npm run dev:sound-lab으로 로컬 작업 공간을 여세요.';
      this.store.notify(); return;
    }
    try {
      const response = await fetch('/api/workspace', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.revision !== this.store.buildRevision) throw new Error('새 빌드가 있습니다. 작성 중인 요청을 복사한 뒤 페이지를 새로고침하세요.');
      if (!Array.isArray(data.reviews)) throw new Error('피드백 목록 응답이 올바르지 않습니다.');
      this.store.reviews = data.reviews;
      this.store.connected = true;
      this.store.message = '피드백을 저장하면 로컬 연구소 파일에 기록됩니다. 에이전트가 이 기록을 이어서 읽을 수 있습니다.';
    } catch (error) {
      this.store.connected = false;
      this.store.message = `작업 공간 연결 실패: ${error.message}`;
    }
    this.store.notify();
  }
  async save() {
    if (!this.store.connected || this.store.saving) return;
    const draft = this.store.getDraft();
    const request = this.store.makeReviewRequest();
    try {
      assertReviewRequest(request, this.store.targets, this.store.buildRevision);
      this.store.saving = true; this.store.notify();
      const response = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sound-Lab': 'review' }, body: JSON.stringify(request),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!data.record || data.record.id !== request.requestId) throw new Error('저장 확인 응답이 올바르지 않습니다.');
      this.store.reviews = [data.record, ...this.store.reviews.filter(record => record.id !== data.record.id)];
      if (draft.requestId === request.requestId) draft.dirty = false;
      this.store.message = '피드백을 연구소 파일에 저장했습니다. 요청을 복사해 에이전트와 이어서 논의하세요.';
    } catch (error) {
      this.store.message = `피드백 저장 실패: ${error.message}. 작성 내용은 화면에 남아 있습니다.`;
    } finally { this.store.saving = false; this.store.notify(); }
  }
  render() {
    const target = this.store.getSelectedTarget();
    const candidate = this.store.getSelectedCandidate();
    const draft = this.store.getDraft();
    for (const [id, key] of [['reviewDecision', 'decision'], ['reviewContext', 'context'], ['reviewNote', 'note']]) {
      const element = document.getElementById(id);
      if (element.value !== draft[key]) element.value = draft[key];
    }
    document.getElementById('reviewContext').placeholder = target.moment;
    document.querySelectorAll('[data-tag]').forEach(button => button.setAttribute('aria-pressed', String(draft.tags.includes(button.dataset.tag))));
    document.getElementById('reviewSubject').textContent = candidate ? `${candidate.name} · ${candidate.version}에 대한 피드백` : '새 소리의 방향에 대한 피드백';
    document.getElementById('draftStatus').textContent = draft.dirty ? '저장하지 않은 피드백' : '기능과 시안마다 피드백을 따로 기록합니다';
    document.getElementById('auditionStatus').textContent = draft.auditioned ? '현재 조건으로 청음 실행됨' : '현재 조건은 아직 청음하지 않았습니다';
    document.getElementById('btnSaveReview').disabled = !this.store.connected || this.store.saving || (draft.decision === 'prefer' && !draft.auditioned);
    document.getElementById('btnSaveReview').textContent = this.store.saving ? '저장 중…' : '피드백 저장';
    document.getElementById('agentPromptText').value = formatAgentRequest(target, candidate, draft, this.store.buildRevision);
    const records = this.store.getReviews();
    const signature = JSON.stringify([target.id, records.map(record => record.id)]);
    if (signature !== this.historySignature) {
      this.historySignature = signature;
      const list = document.getElementById('reviewHistory'); list.replaceChildren();
      if (!records.length) {
        const p = document.createElement('p'); p.className = 'muted'; p.textContent = '아직 저장된 피드백이 없습니다.'; list.append(p);
      }
      for (const record of records) {
        const article = document.createElement('article'); article.className = 'review-record';
        const title = document.createElement('strong');
        title.textContent = `${REVIEW_DECISIONS[record.request.decision]} · ${record.candidate ? record.candidate.name : '방향 논의'}`;
        const meta = document.createElement('small');
        meta.textContent = `${new Date(record.savedAt).toLocaleString('ko-KR')} · ${record.request.buildRevision.slice(0, 10)}${record.request.buildRevision !== this.store.buildRevision ? ' · 이전 빌드 기록' : ''}`;
        const note = document.createElement('p'); note.textContent = [record.request.tags.join(' · '), record.request.note].filter(Boolean).join('\n');
        const detail = document.createElement('p'); detail.className = 'muted';
        detail.textContent = `${record.request.context || record.target.moment} · 청음 조건 ${JSON.stringify(record.request.parameters)}`;
        article.append(title, meta, note, detail); list.append(article);
      }
    }
  }
}
