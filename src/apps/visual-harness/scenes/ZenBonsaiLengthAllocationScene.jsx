import React from 'react';
import {defineVisualSceneImplementation} from '../visualSceneContract.js';
const ensure=(condition,label)=>{if(!condition)throw Error('D1_LENGTH_QA_'+label);};
async function waitFor(predicate){const end=Date.now()+55000;while(Date.now()<end){const value=predicate();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw Error('D1_LENGTH_QA_TIMEOUT');}
function ZenBonsaiLengthAllocationScene({signalReady}){
    const frame=React.useRef(null),running=React.useRef(false),[error,setError]=React.useState(null),[receipt,setReceipt]=React.useState(null);
    if(error)throw error;
    async function loaded(){
        if(running.current)return;running.current=true;
        try{
            const win=frame.current.contentWindow;let api=await waitFor(()=>win.__developmentLab);await api.ready;
            const started=Date.now();
            async function change(selector,value){const el=win.document.querySelector(selector);ensure(el,'CONTROL');if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new win.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,0));await api.idle();ensure(!api.snapshot().error,'CHANGE');}
            await change('#events',240);await change('#ending','child-budgeted');
            for(const key of ['scaffoldRetention','branchRetention','forkCarry']){
                await change(`input[type=checkbox][data-factor=${key}]`,true);
                ensure(api.snapshot().pair[1].trace.some(t=>t.key===key&&t.enabled),'FACTOR_USED_'+key);
            }
            await change('input[data-factor=branchRetention][data-part=mean][data-index="1"]',.8);
            const m=api.snapshot().pair[1].metrics;ensure(m.retentionCount>0,'COMMITTED_RETENTION');ensure(m.retentionRecords.every(r=>!r.terminalGrowth),'TERMINAL_OWNER');
            const previous=api,url=win.location.href;frame.current.src=url;api=await waitFor(()=>win.__developmentLab!==previous&&win.__developmentLab);await api.ready;
            const snapshot=api.snapshot();ensure(!snapshot.error,'REPLAY');ensure(snapshot.request.contract==='zen_g15_development_lab_v3','CONTRACT');
            ensure(snapshot.request.settings.factors.branchRetention.mean[1]===.8,'CURVE_REPLAY');
            for(const key of ['scaffoldRetention','branchRetention','forkCarry'])ensure(snapshot.request.settings.factors[key].enabled,'ENABLED_REPLAY');
            ensure(win.document.documentElement.scrollWidth<=win.innerWidth+1,'OVERFLOW');
            const result={version:snapshot.version,checks:['three-controls-used','curve-edit','v3-url-replay','committed-retention','terminal-owner','no-overflow'],retentionCount:snapshot.pair[1].metrics.retentionCount,elapsedMs:Date.now()-started};
            setReceipt(result);console.info('D1_LENGTH_QA_COMPLETE',JSON.stringify(result));signalReady();
        }catch(e){setError(e);}
    }
    return <main><iframe ref={frame} onLoad={loaded} title="D1 길이·자원 실험" src="/__zen_g15_research/current/research/development-lab/index.html?qa=1" style={{width:'100%',height:1120,border:0}}/><pre data-visual-capture="length-receipt">{receipt?JSON.stringify(receipt,null,2):'V3 control flow in progress'}</pre></main>;
}
export default defineVisualSceneImplementation({Component:ZenBonsaiLengthAllocationScene});
