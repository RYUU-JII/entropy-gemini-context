const label = (tag, text, className = '') => {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
};

export class SoundLedgerComponent {
  constructor(listElement, store) { this.listElement = listElement; this.store = store; this.signature = ''; }
  bindEvents() {
    document.getElementById('searchInput').addEventListener('input', event => this.store.setFilter('searchQuery', event.target.value));
    for (const [id, key] of [['themeFilter', 'themeFilter'], ['reviewFilter', 'reviewFilter']]) {
      document.getElementById(id).addEventListener('change', event => this.store.setFilter(key, event.target.value));
    }
    document.querySelectorAll('[data-scope]').forEach(button => button.addEventListener('click', () => {
      this.store.setFilter('scopeFilter', button.dataset.scope);
    }));
  }
  render() {
    const targets = this.store.getFilteredTargets();
    const signature = JSON.stringify([targets.map(item => item.id), this.store.selectedSoundId, this.store.themeFilter, this.store.scopeFilter, this.store.reviewFilter, this.store.reviews.map(item => item.id)]);
    if (signature === this.signature) return;
    this.signature = signature;
    document.getElementById('themeFilter').value = this.store.themeFilter;
    document.getElementById('reviewFilter').value = this.store.reviewFilter;
    document.querySelectorAll('[data-scope]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === this.store.scopeFilter)));
    document.getElementById('resultCount').textContent = `${targets.length}개의 사운드 순간`;
    this.listElement.replaceChildren();
    if (!targets.length) this.listElement.append(label('p', '검색 조건에 맞는 소리가 없습니다. 필터를 바꾸어 보세요.', 'empty-state'));
    const groups = new Map();
    for (const target of targets) {
      const key = `${target.theme} / ${target.group}`;
      if (!groups.has(key)) {
        const section = document.createElement('section');
        section.append(label('h3', `${target.theme.toUpperCase()} · ${target.group}`, 'group-title'));
        groups.set(key, section);
        this.listElement.append(section);
      }
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'sound-card';
      card.setAttribute('aria-pressed', String(target.id === this.store.selectedSoundId));
      card.append(label('span', target.name, 'sound-name'));
      const research = target.candidates.filter(item => item.role === 'research').length;
      const metadata = [];
      if (['SYNTH', 'ASSET'].includes(target.productStatus)) metadata.push('제품 연결');
      if (research) metadata.push(`시안 ${research}`);
      if (!target.candidates.length) metadata.push('방향 논의');
      if (this.store.getReviews(target.id).length) metadata.push('피드백 있음');
      card.append(label('span', metadata.join(' · '), 'sound-meta'));
      card.addEventListener('click', () => this.store.setSelectedSoundId(target.id));
      groups.get(key).append(card);
    }
  }
}
