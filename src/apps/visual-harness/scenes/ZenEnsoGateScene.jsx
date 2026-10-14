import React, { useLayoutEffect, useRef } from 'react';
import { createEnsoGateArmedFrame, createEnsoGateGesture, updateEnsoGateGesture } from '../../../domains/nudge/interaction/EnsoGateGesture.js';
import { createEnsoGateView, drawEnsoGateGestureFrame, removeEnsoGateView, setEnsoGateRouteVars } from '../../../domains/nudge/interaction/ensoGateView.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import './zenEnsoGateScene.css';
const specimens=['armed','drawing','leave-ready','enter-ready'];
function frameFor(id,width,height) {
 const bounds={viewportWidth:width,viewportHeight:height};
 const armed=createEnsoGateArmedFrame(bounds);
 if(id==='armed')return armed;
 const gesture=createEnsoGateGesture({...bounds,...armed.start,now:1000});
 return updateEnsoGateGesture(gesture,{x:armed.center.x+armed.radius*(id==='leave-ready'?-1:id==='drawing'?.55:1),y:armed.center.y,now:1500});
}
function ZenEnsoGateScene({signalReady}) {
 const hosts=useRef(new Map());
 useLayoutEffect(()=>{
  const views=[];
  for(const id of ['desktop',...specimens]) {
   const host=hosts.current.get(id);
   const view=createEnsoGateView(); views.push(view); host.appendChild(view); view.dataset.entry='ready';
   const frame=frameFor(id==='desktop'?'armed':id,host.clientWidth,host.clientHeight);
   setEnsoGateRouteVars(view,frame); drawEnsoGateGestureFrame({view},frame);
  }
  document.fonts.ready.then(signalReady);
  return()=>views.forEach(removeEnsoGateView);
 },[signalReady]);
 return <main className="visual-enso-page" data-visual-capture="enso-sequence">
  <header className="visual-enso-title"><h1>Barrier · Consumption boundary</h1><p>Production presentation · one deliberate direction · no circle or second confirmation</p></header>
  <div className="visual-enso-screen visual-enso-desktop" data-visual-capture="enso-desktop" ref={el=>{if(el)hosts.current.set('desktop',el);}}/>
  <section className="visual-enso-grid">{specimens.map(id=><article key={id} data-visual-capture={'enso-'+id}><h2>{id}</h2><div className="visual-enso-screen" ref={el=>{if(el)hosts.current.set(id,el);}}/></article>)}</section>
 </main>;
}
export default defineVisualSceneImplementation({Component:ZenEnsoGateScene});
