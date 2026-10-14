import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';

function inspectBonsaiDebug() {
  const dock = document.querySelector('.dashboard-bonsai-debug-dock');
  const panel = document.querySelector('[data-testid="zen-bonsai-debug-panel"]');
  const receipt = panel?.querySelector('[data-testid="zen-bonsai-activation-receipt"]');
  const rect = node => { const r = node.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height }; };
  return { panel: panel ? rect(panel) : null, dock: dock ? rect(dock) : null,
    console: rect(document.querySelector('.console-frame')),
    viewport: { width:innerWidth,height:innerHeight },
    activation: panel?.querySelector('input[aria-label="활성화도 force"]')?.value,
    requested: receipt?.dataset.requested, ratio: receipt?.dataset.renderedRatio, signal: receipt?.dataset.renderedSignal,
    seed: panel ? Number(panel.dataset.treeSeed) : null,
    identityRevision: panel ? Number(panel.dataset.identityRevision) : null,
    canvasReady: document.querySelector('[data-main-presentation-surface="bonsai"] canvas')?.dataset.mainCanvasPresentationReady,
    panelFocused: panel?.contains(document.activeElement) === true,
    trace: (globalThis.__ENTROPY_ZEN_RENDER_TRACE__?.history?.() ?? [])
      .filter(entry => entry.event === 'bonsai_worker:scene_frame_committed').slice(-8),
  };
}

export async function runDashboardBonsaiDebugJourney({ harness, page, signal, capture, record, settleLayout }) {
  const samples=[];
  const read = () => evaluate(harness.cdp,page.sessionId,`(${inspectBonsaiDebug.toString()})()`);
  const wait = async (predicate,stage) => {
    const deadline=Date.now()+30000; let sample;
    while(Date.now()<deadline){ signal?.throwIfAborted(); sample=await read(); if(predicate(sample))return sample; await sleep(100); }
    const error=new Error('QA_BONSAI_DEBUG_STATE_TIMEOUT:'+stage); error.diagnostic=sample; throw error;
  };
  const click = async selector => {
    const point=await evaluate(harness.cdp,page.sessionId,`(() => {
      const node=document.querySelector(${JSON.stringify(selector)});
      if(!node||node.disabled)throw Error('QA_BONSAI_DEBUG_CONTROL_UNAVAILABLE:'+${JSON.stringify(selector)});
      const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      if(!node.contains(document.elementFromPoint(x,y)))throw Error('QA_BONSAI_DEBUG_CONTROL_OCCLUDED'); return {x,y};
    })()`);
    for(const type of ['mousePressed','mouseReleased'])await harness.cdp.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1},page.sessionId);
  };
  const key = async (keyName,code,windowsVirtualKeyCode) => {
    for(const type of ['keyDown','keyUp'])await harness.cdp.send('Input.dispatchKeyEvent',{type,key:keyName,code,windowsVirtualKeyCode},page.sessionId);
  };
  const requireZero = sample => {
    if(sample.activation!=='0'||sample.requested!=='0'||sample.ratio!=='0'||sample.signal!=='0'){
      const error=new Error('QA_BONSAI_DEBUG_FORCE_ZERO_REPLACED');error.diagnostic=sample;throw error;
    }
  };
  try{
    await wait(sample=>sample.dock!==null,'launcher');
    await click('[data-testid="zen-bonsai-debug-toggle"]');
    const opened=await wait(sample=>sample.panel!==null&&sample.signal!==undefined,'opened');
    if(opened.panel.x<opened.console.right+15||opened.panel.right>opened.viewport.width
      ||opened.panel.y<0||opened.panel.bottom>opened.viewport.height)throw Error('QA_BONSAI_DEBUG_DOCK_OVERLAPS_OR_CLIPS');
    const openedFrame=await settleLayout();
    samples.push({stage:'opened',...await read(),sceneFrame:openedFrame,screenshot:await capture('opened')});
    await click('input[aria-label="활성화도 force"]'); await key('Home','Home',36);
    const forced=await wait(sample=>sample.ratio==='0'&&sample.signal==='0','forced_zero'); requireZero(forced);
    samples.push({stage:'forced_zero',...forced,screenshot:await capture('zero')});
    // Observe later ordinary render/environment work, then replace the model
    // projection through a different control while retaining the activation force.
    await sleep(3000); const held=await read();requireZero(held); samples.push({stage:'held_zero',...held,screenshot:await capture('held-zero')});
    await click('input[aria-label="개화도 force"]');await key('Home','Home',36);
    await wait(sample=>sample.ratio==='0'&&sample.signal==='0','bloom_zero');
    await sleep(3000);const reprojected=await read();requireZero(reprojected);samples.push({stage:'reprojected_zero',...reprojected});
    await click('button[aria-label="활성화도 force 해제"]');
    samples.push({stage:'reset',...await wait(sample=>sample.requested==='live'&&sample.ratio==='unscored'&&sample.signal==='1'&&sample.panelFocused,'reset')});
    await click('button[aria-label="개화도 force 해제"]');
    const beforeReroll=await read();
    await click('button[aria-label="씨앗 재배정"]');
    const rerolled=await wait(sample=>sample.seed!==beforeReroll.seed&&sample.identityRevision>beforeReroll.identityRevision
      &&sample.canvasReady==='true'&&sample.panelFocused&&sample.trace.some(entry=>entry.details.treeSeed===sample.seed
        &&entry.index>beforeReroll.trace.at(-1)?.index),'reroll_frame');
    samples.push({stage:'rerolled',...rerolled,screenshot:await capture('rerolled')});
    await key('Escape','Escape',27);
    await wait(sample=>sample.panel===null,'closed');
    await settleLayout();
    const result={completed:true,input:'native_cdp',samples};await record(result);return result;
  }catch(error){await record({completed:false,samples,error:{message:error.message,diagnostic:error.diagnostic}});throw error;}
}
