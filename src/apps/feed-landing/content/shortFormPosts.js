import videoUrl from '../assets/shortform/ribbon-loop.mp4?url';
import posterUrl from '../assets/shortform/ribbon-poster.webp?url';

const FORMATS = ['reel', 'clip', 'reel', 'story', 'reel', 'clip', 'story', 'reel', 'clip', 'reel', 'story', 'reel'];
export const SHORT_FORM_FORMATS = Object.freeze(['reel', 'clip', 'story']);
const VIDEO = Object.freeze({ src: videoUrl, poster: posterUrl, durationSeconds: 6 });

// One actual original clip, repeated intentionally. No invented creators/counts.
export const SHORT_FORM_POSTS = Object.freeze(FORMATS.map((format, index) => Object.freeze({
  id: `short-${String(index + 1).padStart(2, '0')}`,
  authorId: 'entropy-studio',
  format,
  title: '빛이 접히는 순간.',
  body: '천천히 회전하는 빛의 결을 바라보았습니다.',
  video: VIDEO,
})));

export const SHORT_FORM_ENDING = Object.freeze({
  horizon: Object.freeze({ title: '이 숏폼도, 여기서 끝납니다.', detail: '더 불러올 영상이 없습니다.' }),
  afterword: Object.freeze({
    title: '방금 이 영상들은, 천천히 식었습니다.',
    lead: '영상은 그대로 두고, 그것을 넘겨 보는 값만 바꿨습니다.',
    stages: Object.freeze([
      Object.freeze({ effect: 'desaturation', title: '색이 빠졌습니다', where: '빛의 결이 회색이 되던 무렵부터' }),
      Object.freeze({ effect: 'signal', title: '반응이 가라앉았습니다', where: '내가 누른 하트까지' }),
      Object.freeze({ effect: 'blur', title: '형태가 흐려졌습니다', where: '영상이 뿌옇게 보이던 때' }),
      Object.freeze({ effect: 'shuffle', title: '글자가 풀어졌습니다', where: '캡션이 낯설어지던 무렵' }),
    ]),
  }),
  comparison: Object.freeze({
    lead: '처음 본 영상의 한 장면입니다. 원본으로 되돌려 보세요.',
    poster: posterUrl,
    alt: '처음 본 빛의 리본 영상의 한 장면',
  }),
});
