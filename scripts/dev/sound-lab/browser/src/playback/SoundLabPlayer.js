import { getDefaultSynthRegistry } from '../../../engine/synths/SynthRegistry.js';
import { resolveLiveSoundStatus } from '../../../scanner/soundCatalogScanner.js';
import { AudioAnalyzer } from '../../../engine/analysis/AudioAnalyzer.js';

// Every audition owns its context. Switching, stopping, or hiding the page
// closes that context, including nodes scheduled by product synth functions.
export class SoundLabPlayer {
  constructor({ AudioContextCtor = globalThis.AudioContext } = {}) {
    this.AudioContextCtor = AudioContextCtor;
    this.context = null;
    this.epoch = 0;
    this.timer = null;
    this.frame = null;
    this.onState = () => {};
    this.onError = error => console.error('[sound-lab]', error);
  }
  async stop() {
    this.epoch += 1;
    clearTimeout(this.timer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    const context = this.context;
    this.context = null;
    this.onState(false);
    if (context && context.state !== 'closed') await context.close();
  }
  async play(target, candidate, parameters) {
    const closing = this.stop();
    const epoch = this.epoch;
    await closing;
    if (epoch !== this.epoch) return false;
    if (!candidate) throw new Error('아직 청음할 시안이 없습니다. 먼저 에이전트와 방향을 논의하세요.');
    if (typeof this.AudioContextCtor !== 'function') throw new Error('이 브라우저는 WebAudio 청음을 지원하지 않습니다.');
    const context = new this.AudioContextCtor();
    this.context = context;
    try {
      if (context.state === 'suspended') await context.resume();
      if (epoch !== this.epoch) return false;
      if (context.state !== 'running') throw new Error('오디오 재생이 허용되지 않았습니다. 청음 버튼을 다시 눌러 주세요.');
      let result;
      if (candidate.role === 'product') {
        const live = resolveLiveSoundStatus(target.theme, target.id, target.kind);
        if (live.status !== 'SYNTH' || !live.hasPlayFunction) throw new Error('제품 합성 연결을 찾을 수 없습니다.');
        result = live.descriptor.play({ audioContext: context });
      } else {
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.connect(context.destination);
        result = getDefaultSynthRegistry().get(candidate.synthId)(context, analyser, parameters);
        const renderer = new AudioAnalyzer(analyser);
        const render = () => {
          if (epoch !== this.epoch) return;
          const canvas = document.getElementById('visualizerCanvas');
          if (document.getElementById('technicalDetails')?.open && canvas) renderer.renderToCanvas(canvas);
          this.frame = requestAnimationFrame(render);
        };
        render();
      }
      if (result !== true) throw new Error('합성 함수가 재생 실패를 보고했습니다. 진단 로그를 확인하세요.');
      this.onState(true);
      this.timer = setTimeout(() => { void this.stop().catch(this.onError); }, (target.duration + 1) * 1000);
      return true;
    } catch (error) {
      if (epoch === this.epoch) await this.stop();
      throw error;
    }
  }
}
