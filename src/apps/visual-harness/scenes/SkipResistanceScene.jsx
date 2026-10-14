import React, { useLayoutEffect, useRef } from 'react';
import StatusIndicator from '../../../domains/nudge/indicator/view.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';

function SkipResistanceScene({ signalReady }) {
  const video = useRef(null);
  useLayoutEffect(() => {
    StatusIndicator.update({ indicatorEnabled:false, video:{visible:true,hasVideo:true} });
    StatusIndicator.setVideoTarget(video.current);
    StatusIndicator.pulseVideo();
    const host=document.querySelector('[data-friction-indicator-host]');
    if (!host?.shadowRoot) throw new Error('SKIP_RESISTANCE_SURFACE_MISSING');
    // Keep one production frame for a deterministic render-only capture.
    host.dataset.theme='zen';
    const freeze=document.createElement('style');
    freeze.textContent='.friction-video-frame { opacity:1 !important; animation:none !important; } .friction-video-frame::after { animation:none !important; }';
    host.shadowRoot.append(freeze);
    document.fonts.ready.then(signalReady);
    return()=>StatusIndicator.teardown();
  },[signalReady]);
  return <main style={{minHeight:'100vh',display:'grid',placeContent:'center',background:'#ecece4',color:'#263020',fontFamily:'var(--font-theme-ui)'}}>
    <section style={{width:800,maxWidth:'92vw'}}>
      <video ref={video} aria-label="Skip prevention feedback specimen" style={{display:'block',width:'100%',aspectRatio:'16/9',background:'radial-gradient(ellipse at 30% 15%,#767966,transparent 55%),linear-gradient(150deg,#3f5146,#171f1a 70%)'}}/>
      <p style={{fontSize:13,marginTop:20}}>멈춤의 돌 · 영상은 제자리에, 작은 돌이 건너뛰기를 받아냅니다.</p>
    </section>
  </main>;
}
export default defineVisualSceneImplementation({Component:SkipResistanceScene});
