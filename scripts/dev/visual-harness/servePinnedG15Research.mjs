import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';

// Preserve source bytes for the lab's hash verifier. This is a raw static mount
// inside the existing QA-owned server; it starts no server or browser itself.
export function pinnedG15ResearchPlugin(rootDir){
    const prefix='/__zen_g15_research/',root=resolve(rootDir,'scripts/dev/zen-bonsai-morphology-research/g15-4-typed-developmental-scheduler');
    const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'};
    return{name:'qa-pinned-g15-research',configureServer(server){server.middlewares.use((req,res,next)=>{
        const url=new URL(req.url,'http://127.0.0.1');if(!url.pathname.startsWith(prefix))return next();
        if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
        let path;try{path=resolve(root,decodeURIComponent(url.pathname.slice(prefix.length)));}catch(error){next(error);return;}
        if(!path.startsWith(root+sep)||!types[extname(path)]){res.writeHead(403);res.end();return;}
        readFile(path).then(body=>{res.writeHead(200,{'Content-Type':types[extname(path)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);}).catch(error=>{if(error.code==='ENOENT'){res.writeHead(404);res.end('Pinned research resource missing');}else next(error);});
    });}};
}
