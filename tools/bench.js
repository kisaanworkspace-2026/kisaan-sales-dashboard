// Speed benchmark. Needs: python3 -m http.server 8123 in the project folder, a gz+base64 payload text file made from tools/make_synthetic.py output.
// Usage: PORT=8123 NODE_PATH=<playwright> node tools/bench.js payload.gz.txt label out.json
const {chromium}=require('playwright');const fs=require('fs');
const PORT=process.env.PORT||8123;const [,, file, label, out] = process.argv; const S=require('path').dirname(file);
(async()=>{const gz=fs.readFileSync(file,'utf8');const b=await chromium.launch();const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1500,height:1000}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()=='error'&&errs.push('CON '+m.text()));
await p.addInitScript(()=>{window.__lt=[];try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push(e.duration))).observe({entryTypes:['longtask']})}catch(e){}; try{localStorage.setItem('ksd_pin','1234')}catch(e){}});
await p.route('**/js/config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.CFG={API_URL:'http://localhost:"+PORT+"/api/exec',SAMPLE_URL:'',TITLE:'K',CURRENCY:'AUD',TYPE_COLORS:{b2b:'#1f7a5a',b2c:'#2f6fbb',manual_b2c:'#e0a526',preferred:'#7a5cc2'},PALETTE:['#1f7a5a','#2f6fbb','#e0a526','#d1495b','#7a5cc2','#2aa5b3','#e07a3f','#8a9a5b']};"}));
let dl=0;await p.route('**/api/exec*',async r=>{const u=r.request().url();const h={'access-control-allow-origin':'*','content-type':'application/json'};
 if(u.includes('a=ver'))return r.fulfill({headers:h,body:JSON.stringify({v:'syn1'})});
 if(u.includes('tab=interstate'))return r.fulfill({headers:h,body:JSON.stringify({v:'e',gz:Buffer.from(require('zlib').gzipSync(JSON.stringify({v:'e',n:0,dict:{type:[],prod:[],city:[],addr:[],cust:[]},d:[],o:[],i:[],t:[],p:[],q:[],a:[],c:[],y:[],ad:[]}))).toString('base64')})});
 dl++;return r.fulfill({headers:h,body:'{"v":"syn1","gz":"'+gz+'"}'})});
const res={label,errs};
const ready=async()=>{await p.waitForFunction(()=>document.querySelector('#splash')?.classList.contains('gone')&&document.querySelector('.kpi .kv'),null,{timeout:180000})};
const lt=async()=>Math.round(Math.max(0,...(await p.evaluate(()=>window.__lt))));
let t=Date.now();await p.goto('http://localhost:'+PORT+'/#/overview');await ready();res.firstLoadMs=Date.now()-t;res.firstLoadLongestBlockMs=await lt();
await p.waitForTimeout(6000);
// reload with IndexedDB cache
t=Date.now();await p.goto('about:blank');t=Date.now();await p.goto('http://localhost:'+PORT+'/#/overview');await ready();res.reloadMs=Date.now()-t;res.reloadLongestBlockMs=await lt();
await p.waitForTimeout(2500);
// page switches (first visit = mount+update, second visit = update only)
const pages=['orders','products','customers','geography','channels','stores','overview'];res.pages={};
for(const pg of pages){const ms=[];for(let k=0;k<2;k++){const m=await p.evaluate(async pg=>{const t0=performance.now();location.hash='#/'+pg;await new Promise(r=>{const c=()=>{const h=document.querySelector('.pagehead h2');if(h&&h.textContent.toLowerCase().includes(pg==='channels'?'b2b':pg==='stores'?'b2b':pg==='geography'?'cities':pg)&&!document.querySelector('#splash:not(.gone)'))requestAnimationFrame(()=>setTimeout(r,0));else if(performance.now()-t0>60000)r();else setTimeout(c,2)};c()});return performance.now()-t0},pg);ms.push(Math.round(m));
  await p.evaluate(()=>{location.hash='#/zzz'});await p.waitForTimeout(100);}res.pages[pg]=ms;}
await p.goto('http://localhost:'+PORT+'/#/overview');await p.waitForTimeout(2500);
// filter clicks on the overview, products and customers pages
res.filter={};for(const pg of ['overview','products','customers']){await p.evaluate(pg=>location.hash='#/'+pg,pg);await p.waitForTimeout(2500);
 const m=await p.evaluate(async()=>{const out=[];const D=Store.D;for(const [dim,val] of [['types',D.dict.type[0]],['types',D.dict.type[0]],['cities',D.dict.city[3]],['cities',D.dict.city[3]],['preset-30',0],['preset-all',0]]){const t0=performance.now();
   if(dim.startsWith('preset'))F.set({preset:dim==='preset-30'?'30d':'all'});else F.toggle(dim,val);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0))));out.push(Math.round(performance.now()-t0));}return out});res.filter[pg]=m;}
await p.evaluate(()=>F.clear());await p.waitForTimeout(500);
res.heapMB=await p.evaluate(()=>performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null);
// KPI snapshots for the number comparison
res.kpi={};for(const pg of ['overview','orders','products','customers','geography','stores','channels']){await p.evaluate(pg=>location.hash='#/'+pg,pg);await p.waitForTimeout(2500);res.kpi[pg]=await p.locator('.kpi .kv, .tcard .kv').allTextContents();}
res.kpiStats=await p.evaluate(()=>{F.set({preset:'all'});return null});await p.waitForTimeout(2500);await p.evaluate(()=>location.hash='#/overview');await p.waitForTimeout(2500);res.kpiAll=await p.locator('.kpi .kv').allTextContents();
res.nOrders=await p.evaluate(()=>Store.D.nOrders);res.totalRev=await p.evaluate(()=>{let s=0;const D=Store.D;for(let k=0;k<D.nOrders;k++)s+=D.oTotal[k];return Math.round(s*100)/100});
res.errs=errs;fs.writeFileSync(out,JSON.stringify(res,null,1));console.log(JSON.stringify({label,firstLoadMs:res.firstLoadMs,blk:res.firstLoadLongestBlockMs,reloadMs:res.reloadMs,rblk:res.reloadLongestBlockMs,pages:res.pages,filter:res.filter,heapMB:res.heapMB,rev:res.totalRev,errs:errs.slice(0,3)}));await b.close()})()
