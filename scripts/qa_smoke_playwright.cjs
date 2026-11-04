const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
function serveFile(p,res){const full=path.resolve(root,'.'+decodeURIComponent(p));if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return;}const file=fs.existsSync(full)&&fs.statSync(full).isDirectory()?path.join(full,'index.html'):full;try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end(String(e.message));}}
const server=http.createServer((req,res)=>serveFile(new URL(req.url,'http://localhost').pathname,res));
const fakeTitle={
 id:1,slug:'test-series',title:'Example Series',kind:'series',status:'published',synopsis:'A sample',genres:['Drama'],seasons:[
 {id:10,season_number:1,name:'Season One',episodes:[{id:11,episode_number:1,title:'Pilot',synopsis:'',runtime_minutes:30},{id:12,episode_number:2,title:'Next',synopsis:'',runtime_minutes:31}]}
 ],assets:[
 {id:100,episode_id:12,role:'episode',format:'mkv',provider:'r2',r2_key:'series/s01e02.mkv'},
 {id:90,episode_id:11,role:'episode',format:'mkv',provider:'r2',r2_key:'series/s01e01.mkv'}
 ],public_assets:[]
};
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 let browser;
 try {
   browser=await chromium.launch({headless:true});
   for(const [name,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]]){
     const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
     const page=await context.newPage(),errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.goto(url+'/watch/',{waitUntil:'domcontentloaded'});
     await page.locator('.media-card').first().waitFor();
     await page.locator('.media-card').first().evaluate(card=>{
       card.querySelector('.card-desc').textContent=('An unusually long synopsis with many extra details. ').repeat(20);
       card.querySelector('.card-meta span').textContent='Horror / Science Fiction / Adventure / Drama / Documentary / Mystery';
     });
     await page.waitForTimeout(200);
     const clamp=await page.locator('.media-card .card-desc').first().evaluate(el=>getComputedStyle(el).webkitLineClamp);
     assert.equal(clamp,'3','Description must be limited to three lines');
     const metrics=await page.evaluate(()=>{
       const cards=[...document.querySelectorAll('.media-card')];
       return cards.map(c=>{const r=c.getBoundingClientRect(),meta=c.querySelector('.card-meta').getBoundingClientRect(),action=c.querySelector('.card-action').getBoundingClientRect(),visual=c.querySelector('.card-visual').getBoundingClientRect();return {row:Math.round(r.top),meta:Math.round(meta.top),button:Math.round(action.top),visual:Math.round(visual.height)};});
     });
     assert(metrics.length>=3,'Expected demo cards on '+name);
     const groups={};for(const card of metrics)(groups[card.row]??=[]).push(card);
     for(const row of Object.values(groups))if(row.length>1){
       for(const k of ['meta','button','visual'])assert(Math.max(...row.map(x=>x[k]))-Math.min(...row.map(x=>x[k]))<=2,k+' misaligned '+name);
     }
     assert.equal(await page.locator('.sr-cinematic-wave').count(),1,'Wave not mounted');
     await page.locator('[data-filter="series"]').click();
     assert.equal(await page.locator('.media-card').count(),3,'series filter');
     await page.goto(url+'/watch/play/?id=midnight-district&season=1&episode=1',{waitUntil:'domcontentloaded'});
     await page.locator('#sr-episodes .sr-episode-card').first().waitFor();
     assert(await page.locator('#sr-episodes .sr-episode-card').count()>=3);
     assert.deepEqual(errors,[],name+' browser errors');
     console.log('PASS',name,'card alignment, responsive width, catalog filters, wave and carousel');
     await context.close();
   }
   const context=await browser.newContext({viewport:{width:1200,height:850}});
   const studio=await context.newPage();
   await studio.route('**/screenroom-server/api/admin/**',async route=>{
     const pathname=new URL(route.request().url()).pathname;
     const payload=pathname.endsWith('/session')?{authenticated:true}:pathname.endsWith('/csrf')?{csrf:'x'}:
       pathname.endsWith('/titles')?{data:[{id:1,slug:'test-series',title:'Example Series',kind:'series',status:'published'}]}:fakeTitle;
     await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
   });
   await studio.goto(url+'/screenroom-server/studio/',{waitUntil:'domcontentloaded'});
   await studio.locator('.title-item').first().waitFor();
   await studio.locator('.title-item').first().click();
   await studio.locator('.asset-entry').first().waitFor();
   const headings=await studio.locator('.asset-label strong').allTextContents();
   assert.deepEqual(headings,['S01 E01 — Pilot','S01 E02 — Next']);
   const details=await studio.locator('.asset-label small').allTextContents();
   assert(details[0].includes('s01e01.mkv')&&details[1].includes('s01e02.mkv'));
   await studio.locator('.asset-entry').first().getByRole('button',{name:'EDIT'}).click();
   assert.equal(await studio.locator('#asset-episode').inputValue(),'11');
   console.log('PASS Studio attached media ordered by season/episode and Edit keeps original ID');
   await context.close();
   const prod=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'});
   const mobile=await prod.newPage();
   await mobile.route('https://screenroom.devrijonn.com/**',async route=>{
     const pathname=new URL(route.request().url()).pathname;
     if(pathname.startsWith('/screenroom-api/')) {
       const payload={...fakeTitle,assets:undefined,public_assets:[]};
       await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});return;
     }
     const rel=pathname==='/'?'/watch/index.html':'/watch'+pathname.replace(/\/$/,'/index.html');
     const full=path.resolve(root,'.'+rel);
     try{await route.fulfill({status:200,contentType:mime[path.extname(full)]||'application/octet-stream',body:fs.readFileSync(full)});}
     catch(e){await route.fulfill({status:404,body:String(e.message)});}
   });
   await mobile.goto('https://screenroom.devrijonn.com/play/?id=test-series&season=1&episode=2',{waitUntil:'domcontentloaded'});
   await mobile.getByText('COMING SOON').waitFor();
   assert((await mobile.locator('.player-placeholder p').textContent()).includes('not been released'));
   console.log('PASS unreleased episode shows Coming Soon rather than technical error');
   const fullscreen=await mobile.evaluate(async()=>{
     const module=await import('/assets/vendor/securestream.js?v=0.3.6');
     const div=document.createElement('div');div.className='screenroom-video';document.querySelector('#playback-content').append(div);
     const player=new module.SecureStreamPlayer({container:div,id:'fullscreen-qa',src:'https://media.invalid/demo.mp4'});
     player.universal=document.createElement('movi-player');
     await player.toggleFullscreen();
     const root=div.querySelector('.ssp-player'),stage=root.querySelector('.ssp-stage'),bottom=root.querySelector('.ssp-bottom');
     const rect=root.getBoundingClientRect(),sr=stage.getBoundingClientRect(),br=bottom.getBoundingClientRect();
     const state={simulated:root.classList.contains('ssp-simulated-landscape'),width:Math.round(rect.width),height:Math.round(rect.height),stageHeight:Math.round(sr.height),bottomX:Math.round(br.x),bottomY:Math.round(br.y),bottomW:Math.round(br.width),bottomH:Math.round(br.height)};
     await player.toggleFullscreen();player.destroy();return state;
   });
   assert(fullscreen.simulated,'iOS portrait should simulate landscape for original MKV');
   assert(Math.abs(fullscreen.width-390)<4&&Math.abs(fullscreen.height-844)<4,'fullscreen not viewport fitted '+JSON.stringify(fullscreen));
   assert(fullscreen.bottomX>-12&&fullscreen.bottomY>-12&&fullscreen.bottomX+fullscreen.bottomW<402&&fullscreen.bottomY+fullscreen.bottomH<856,'fullscreen controls clipped '+JSON.stringify(fullscreen));
   console.log('PASS iPhone-like viewport rotation and control bounds',fullscreen);
   await prod.close();
 } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;server.close();});
