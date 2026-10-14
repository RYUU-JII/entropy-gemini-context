export class StudioDetailComponent {
  constructor(store, player) { this.store = store; this.player = player; this.signature = ''; }
  bindEvents() {
    document.getElementById('btnPlayCurrent').addEventListener('click', async () => {
      const draft = this.store.getDraft();
      const candidate = this.store.getSelectedCandidate();
      const parameters = { ...draft.parameters };
      try {
        const scheduled = await this.player.play(this.store.getSelectedTarget(), candidate, parameters);
        if (scheduled && candidate === this.store.getSelectedCandidate() && JSON.stringify(parameters) === JSON.stringify(draft.parameters)) this.store.markAuditioned();
      } catch (error) { this.store.message = error.message; this.store.notify(); }
    });
    document.getElementById('btnStop').addEventListener('click', () => {
      void this.player.stop().catch(error => { this.store.message = error.message; this.store.notify(); });
    });
    this.player.onError = error => { this.store.message = error.message; this.store.notify(); };
    for (const [id, key] of [['sliderIntensity', 'intensity'], ['sliderPitch', 'basePitch']]) {
      document.getElementById(id).addEventListener('input', event => this.store.setParameter(key, Number(event.target.value)));
    }
    document.getElementById('btnResetFactors').addEventListener('click', () => {
      const candidate = this.store.getSelectedCandidate();
      if (candidate) {
        this.store.getDraft().auditioned = false;
        this.store.updateDraft('parameters', { ...candidate.parameters });
      }
    });
  }
  render() {
    const target = this.store.getSelectedTarget();
    const candidate = this.store.getSelectedCandidate();
    const draft = this.store.getDraft();
    const set = (id, text) => { document.getElementById(id).textContent = text; };
    set('detailBreadcrumbs', `${target.theme.toUpperCase()} / ${target.group}`);
    set('detailTitle', target.name);
    set('detailMoment', target.moment);
    set('detailPurpose', target.purpose);
    set('listeningQuestion', target.question);
    set('detailId', target.id);
    set('detailDesc', target.concept);
    set('productStatus', ({ SYNTH: '제품 코드에 합성 연결', ASSET: '제품 코드에 파일 연결', SILENT: '제품에서 명시적 무음', PLANNED: '제품 미연결' })[target.productStatus]);
    set('candidateNote', candidate ? candidate.changeNote : '아직 등록된 시안이 없습니다. 아래에 사용 맥락이나 원하는 느낌을 남겨 에이전트와 방향을 정하세요.');
    set('candidateSource', candidate ? `${candidate.version} · ${candidate.sourcePath}` : '새 시안 대기');
    set('candidateRationale', candidate ? candidate.rationale : '무음도 하나의 디자인 선택입니다.');
    set('playbackStatus', this.store.playing ? '재생 중 · 다른 시안을 선택하면 정지합니다' : `${target.duration}초 목표 길이 · 단독 청음`);
    set('analyserNote', candidate?.role === 'research' ? '연구 시안 청음 중 파형과 스펙트럼을 표시합니다.' : '제품 연결본은 제품 합성 함수를 직접 재생합니다. 파형 분석은 연구 시안에서 사용할 수 있습니다.');
    document.getElementById('visualizerCanvas').hidden = candidate?.role !== 'research';
    document.getElementById('btnPlayCurrent').disabled = candidate === null;
    document.getElementById('btnStop').disabled = !this.store.playing;
    const signature = `${target.id}/${candidate?.id}`;
    if (signature !== this.signature) {
      this.signature = signature;
      const list = document.getElementById('candidateList');
      list.replaceChildren();
      for (const item of target.candidates) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'candidate-card';
        button.setAttribute('aria-pressed', String(item.id === candidate.id));
        for (const [tag, text] of [['small', item.role === 'product' ? 'PRODUCT / 비교 기준' : `RESEARCH / ${item.version}`], ['strong', item.name]]) {
          const element = document.createElement(tag); element.textContent = text; button.append(element);
        }
        button.addEventListener('click', () => this.store.setSelectedCandidate(item.id));
        list.append(button);
      }
      const layers = document.getElementById('physicalLayersList');
      layers.replaceChildren();
      for (const layer of target.layers) { const li = document.createElement('li'); li.textContent = layer; layers.append(li); }
    }
    const research = candidate?.role === 'research';
    document.getElementById('factorControls').hidden = !research;
    document.getElementById('pitchControl').hidden = !Object.hasOwn(draft.parameters, 'basePitch');
    if (research) {
      document.getElementById('sliderIntensity').value = draft.parameters.intensity;
      set('lblIntensity', `${Math.round(draft.parameters.intensity * 100)}%`);
      if (Object.hasOwn(draft.parameters, 'basePitch')) {
        const slider = document.getElementById('sliderPitch');
        slider.min = candidate.parameters.basePitch * 0.5; slider.max = candidate.parameters.basePitch * 1.5;
        slider.value = draft.parameters.basePitch;
        set('lblPitch', `${Math.round(draft.parameters.basePitch)} Hz`);
      }
    }
  }
}
