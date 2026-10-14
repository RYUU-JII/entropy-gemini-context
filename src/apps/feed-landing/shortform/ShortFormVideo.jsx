import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';

export default function ShortFormVideo({ video, active, suspended, reducedMotion, onLike }) {
  const ref = useRef(null);
  const [paused, setPaused] = useState(reducedMotion);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  // Once a source is admitted, keep its loading policy stable. Switching a
  // partly loaded video back to preload=none aborts its range request in Chrome.
  const [admitted, setAdmitted] = useState(active);
  useEffect(() => { if (active) setAdmitted(true); }, [active]);
  useEffect(() => { if (reducedMotion) setPaused(true); }, [reducedMotion]);
  useEffect(() => {
    if (active && ref.current.currentTime !== 0) ref.current.currentTime = 0;
  }, [active]);
  useEffect(() => {
    const element = ref.current;
    let canceled = false;
    const reconcile = () => {
      if (!active || suspended || paused || document.hidden) { element.pause(); return; }
      const promise = element.play();
      if (promise) promise.then(() => { if (!canceled) setBlocked(false); }).catch((failure) => {
        if (canceled || document.hidden) return;
        if (failure.name === 'NotAllowedError') setBlocked(true);
        else setError(`영상을 재생하지 못했습니다. (${failure.name})`);
      });
    };
    reconcile();
    document.addEventListener('visibilitychange', reconcile);
    return () => { canceled = true; document.removeEventListener('visibilitychange', reconcile); element.pause(); };
  }, [active, suspended, paused]);

  const togglePlayback = () => {
    if (blocked) {
      ref.current.play().then(() => setBlocked(false)).catch((failure) => setError(`영상을 재생하지 못했습니다. (${failure.name})`));
    } else setPaused(!paused);
  };
  return (
    <div className="short-video">
      <video
        ref={ref} src={video.src} poster={video.poster}
        muted loop playsInline preload={admitted ? 'auto' : 'none'}
        aria-label="천천히 회전하는 빛의 리본" disablePictureInPicture
        onError={() => setError('영상 파일을 불러오지 못했습니다.')}
        onTimeUpdate={() => {
          const element = ref.current;
          if (Number.isFinite(element.duration) && element.duration > 0) setProgress(element.currentTime / element.duration);
        }}
      />
      <button type="button" className="short-playback-surface" aria-label={paused || blocked ? '영상 재생' : '영상 일시정지'} onClick={togglePlayback} onDoubleClick={onLike}>
        {(paused || blocked) && <span className="short-play-indicator"><Icon name="play" size={30} /></span>}
      </button>
      <div className="short-video-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
      {error && <p role="alert" className="short-video-error">{error}</p>}
    </div>
  );
}
