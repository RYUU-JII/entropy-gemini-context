import React from 'react';
import {defineVisualSceneImplementation} from '../visualSceneContract.js';
const waitFor=async predicate=>{const end=Date.now()+55000;while(Date.now()<end){const result=predicate();if(result)return result;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('D1_QA_TIMEOUT');};
const ensure=(condition,label)=>{if(!condition)throw Error('D1_QA_'+label);};
function ZenBonsaiDevelopmentScene({signalReady}){
    const frame=React.useRef(null),running=React.useRef(false),[error,setError]=React.useState(null),[receipt,setReceipt]=React.useState(null);
    if(error)throw error;
    async function loaded(){
        if(running.current)return;running.current=true;
        try{
            let win=frame.current.contentWindow,api=await waitFor(()=>win.__developmentLab);await api.ready;
            const initial=api.snapshot();ensure(!initial.error&&initial.pair.length===2,'INITIAL');
            const started=Date.now();console.info('D1_QA_PROGRESS',JSON.stringify({step:'initial',elapsedMs:0}));
            ensure(win.document.querySelectorAll('#ending').length===1,'ONE_ENDING_CONTROL');
            ensure(initial.pair[0].request.settings.ending==='original'&&initial.pair[1].request.settings.ending==='budgeted-ledger','ENDING_DEFAULT');
            async function change(selector,value){const el=win.document.querySelector(selector);ensure(el,'CONTROL');if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new win.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));await api.idle();ensure(!api.snapshot().error,'CHANGE');}
            await change('#ending','original');
            ensure(JSON.stringify(api.snapshot().pair[0].metrics)===JSON.stringify(api.snapshot().pair[1].metrics),'NEUTRAL_PAIR');
            await change('#ending','renewal');await change('#ending','developmental');
            ensure(api.snapshot().pair[1].metrics.terminalCompleted>0,'TERMINAL_GROWTH');
            for(const ending of ['budgeted','budgeted-work','budgeted-commit','budgeted-ledger','budgeted-free','local-ending','local-branching'])await change('#ending',ending);
            ensure(api.snapshot().pair[1].metrics.terminalCompleted>0,'FUNDED_COMPLETION');
            ensure(Number.isFinite(api.snapshot().pair[1].metrics.highestTipRun)&&Number.isFinite(api.snapshot().pair[1].metrics.longestUpperRun),'UPPER_RUN_METRICS');
            for(const ending of ['child-planned','child-budgeted']){
                await change('#ending',ending);
                const m=api.snapshot().pair[1].metrics;
                ensure(m.childQuoteCount>0&&m.childConstructionPlans.length>0,'CHILD_COST_QUOTES');
                ensure(m.shortChildBirths===0,'VIABLE_CHILD_BIRTHS');
            }
            await change('#ending','local-branching');
            console.info('D1_QA_PROGRESS',JSON.stringify({step:'ending-modes',elapsedMs:Date.now()-started}));
            await change('input[type=checkbox][data-factor=aperture]',true);
            await change('input[data-factor=aperture][data-part=mean][data-index="0"]',115);
            const changed=api.snapshot();ensure(changed.request.settings.factors.aperture.mean[0]===115,'CURVE_INPUT');
            ensure(changed.pair[1].trace.some(t=>t.key==='aperture'&&t.enabled),'CURVE_USED');
            const url=win.location.href,oldApi=api;frame.current.src=url;
            api=await waitFor(()=>win.__developmentLab!==oldApi&&win.__developmentLab);await api.ready;
            ensure(api.snapshot().request.settings.factors.aperture.mean[0]===115,'URL_REPLAY');
            console.info('D1_QA_PROGRESS',JSON.stringify({step:'replay',elapsedMs:Date.now()-started}));
            for(const key of ['bend','axisReturn','reversal'])await change(`input[type=checkbox][data-factor=${key}]`,true);
            win.document.getElementById('pin').click();await new Promise(resolve=>setTimeout(resolve,0));await api.idle();
            await change('#seed',2882771980);
            ensure(api.snapshot().pair.every(r=>r.request.seed===2882771980),'PAIRED_SEED');
            // Change B after pinning so the captured pair explains a real intervention.
            await change('input[data-factor=axisReturn][data-part=mean][data-index="1"]',.6);
            win.document.getElementById('cohort').click();await new Promise(resolve=>setTimeout(resolve,0));await api.idle();
            ensure(api.snapshot().cohort.length===8,'COHORT');
            console.info('D1_QA_PROGRESS',JSON.stringify({step:'cohort',elapsedMs:Date.now()-started}));
            await change('#view','full');await change('#view','wood');
            const snapshot=api.snapshot();ensure(!snapshot.error,'FINAL');
            ensure(win.document.documentElement.scrollWidth<=win.innerWidth+1,'OVERFLOW');
            const result={version:snapshot.version,checks:['one-ending-control','ending-default','ending-modes','child-cost-quotes','viable-child-births','terminal-growth','neutral-pair','curve-enabled','curve-edit','URL-replay','pin','same-seed','eight-seed-cohort','wood-full-toggle','horizontal-overflow'],pair:snapshot.pair.map(r=>({seed:r.request.seed,segments:r.metrics.segments,settled:r.metrics.settled,ending:r.metrics.endingStatus,thickTips:r.metrics.thickTips})),cohort:snapshot.cohort.length};
            setReceipt(result);window.__zenBonsaiDevelopmentEvidence=result;signalReady();
        }catch(e){setError(e);}
    }
    return <main style={{width:'100%',margin:0}}><iframe ref={frame} onLoad={loaded} title="G15 성장 성향 실험실" src="/__zen_g15_research/current/research/development-lab/index.html?qa=1" style={{width:'100%',height:1120,border:0,display:'block'}}/><pre data-visual-capture="development-receipt" style={{fontSize:12,padding:20}}>{receipt?JSON.stringify(receipt,null,2):'D1 browser flow in progress'}</pre></main>;
}
export default defineVisualSceneImplementation({Component:ZenBonsaiDevelopmentScene});
