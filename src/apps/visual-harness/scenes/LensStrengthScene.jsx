import React, { useLayoutEffect, useState } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { buildLensCard } from '../../dashboard/tabs/tools/artifactCards/buildLensCard.jsx';
import { materializeArtifactControlSurface } from '../../dashboard/tabs/tools/artifactCards/shared.jsx';
import ArtifactControlDock from '../../../themes/core/tools/ArtifactControlDock.jsx';
import { ZenArtifactControlGarden } from '../../../themes/plugins/zen/api/artifactControls.js';
import koTools from '../../../i18n/locales/ko/tools.js';
import koCommon from '../../../i18n/locales/ko/common.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../dashboard/tailwind.css';

const i18n = createInstance();
let themeId;
const initial = { grayscale:70, blur:20, brightness:35, contrast:45, saturation:60 };
function LensStrengthScene({ signalReady }) {
  const [strengths, setStrengths] = useState(initial);
  const [enabled, setEnabled] = useState(Object.fromEntries(Object.keys(initial).map(key => [key, true])));
  const [fullscreen, setFullscreen] = useState(true);
  const card = buildLensCard({ shell:{canonicalId:'lens'}, t:i18n.getFixedT('ko','tools'), state:{themeId, artifactFamilies:{lens:{
    enabled:true, fullscreenVisualRelaxation:{enabled:fullscreen,eligible:true},
    children:Object.fromEntries(Object.keys(initial).map(key=>[key,{enabled:enabled[key],value:strengths[key]}])),
  }}}, handlers:{artifactFamilies:{lens:{setSuspended:async()=>{},fullscreenVisualRelaxation:{toggle:async value=>setFullscreen(value)},
    children:Object.fromEntries(Object.keys(initial).map(key=>[key,{
      toggle:async value=>setEnabled(previous=>({...previous,[key]:value})),
      setValue:async value=>setStrengths(previous=>({...previous,[key]:value})),
    }])),
  }}}});
  const surface=materializeArtifactControlSurface(card.controlSurface);
  useLayoutEffect(()=>{
    let active=true;
    document.fonts.ready.then(()=>requestAnimationFrame(async()=>{
      if(!active)return;
      if(document.querySelectorAll('input[type="range"]').length!==5)throw new Error('LENS_STRENGTH_CONTROLS_INCOMPLETE');
      const row=document.querySelector('[data-artifact-control-child-key="grayscale"]');
      const group=row?.closest('details[data-artifact-control-group]');
      if(group&&!group.open){
        group.querySelector('summary').click();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(!active)return;
        if(!group.open)throw new Error('LENS_STRENGTH_GROUP_NOT_OPEN');
      }
      if(themeId==='zen'){
        const summary=row?.querySelector('button[aria-expanded][aria-controls]');
        if(!summary)throw new Error('LENS_STRENGTH_DISCLOSURE_MISSING');
        if(summary.getAttribute('aria-expanded')==='false')summary.click();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(!active)return;
        if(summary.getAttribute('aria-expanded')!=='true')throw new Error('LENS_STRENGTH_DISCLOSURE_NOT_OPEN');
      }
      const input=row?.querySelector('input[type="range"]');
      if(!input?.getClientRects().length||input.closest('[hidden]'))throw new Error('LENS_STRENGTH_CONTROL_NOT_VISIBLE');
      if(document.documentElement.scrollWidth>innerWidth)throw new Error('LENS_STRENGTH_HORIZONTAL_OVERFLOW');
      signalReady();
    }));
    return()=>{active=false;};
  },[signalReady]);
  return <I18nextProvider i18n={i18n}><main className="font-sans" style={{minHeight:'100vh',padding:'28px 16px',background:'var(--color-surface)',color:'var(--color-on-surface)'}}>
    <section style={{maxWidth:660,margin:'0 auto'}}>
      {themeId==='zen'?<ZenArtifactControlGarden rowGroups={surface.dock.blocks.filter(block=>block.kind==='rows')}/>:<ArtifactControlDock model={surface.dock} variant={themeId}/>}
    </section>
  </main></I18nextProvider>;
}
export default defineVisualSceneImplementation({Component:LensStrengthScene,prepare:async({manifest})=>{
  themeId=manifest.themeId;
  await i18n.init({lng:'ko',resources:{ko:{tools:koTools,common:koCommon}},defaultNS:'tools',interpolation:{escapeValue:false}});
}});
