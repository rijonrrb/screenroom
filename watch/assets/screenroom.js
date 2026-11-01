/* SCREENROOM frontend: catalog, title details, and playback integration. */
let titles = [
{id:'the-last-signal',kind:'movie',title:'The Last Signal',year:'2025',genre:'Sci-Fi / Mystery',rating:'PG-13',length:'1h 52m',description:'A distant transmission interrupts the quiet routine of a remote observatory, opening a mystery its team never intended to find.',symbol:'S',colors:['#3d4651','#111822'],episodes:[],seasons:[]},
{id:'midnight-district',kind:'series',title:'Midnight District',year:'2024',genre:'Crime / Drama',rating:'TV-14',length:'1 Season',description:'When a city stops sleeping, a journalist follows threads that reveal more than an ordinary headline.',symbol:'M',colors:['#403728','#18120e'],seasons:[{number:1,name:'Season One',episodes:[{number:1,title:'After Hours',description:'A call made just before midnight leads to an unfamiliar address.',length:'42 min'},{number:2,title:'Unlisted',description:'A recovered recording alters the direction of the investigation.',length:'46 min'},{number:3,title:'The Crossing',description:'New evidence connects two stories thought unrelated.',length:'44 min'}]}]},
{id:'between-tides',kind:'movie',title:'Between Tides',year:'2026',genre:'Drama / Adventure',rating:'PG',length:'1h 39m',description:'Returning to a familiar coast, a cartographer discovers that some routes cannot be drawn on a map.',symbol:'T',colors:['#29474a','#0e2029'],episodes:[],seasons:[]},
{id:'the-archive',kind:'series',title:'The Archive',year:'2025',genre:'Thriller / Mystery',rating:'TV-14',length:'2 Seasons',description:'Inside a sealed collection of records, forgotten decisions begin to affect the present.',symbol:'A',colors:['#473342','#151019'],seasons:[{number:1,name:'Season One',episodes:[{number:1,title:'Inventory',description:'An old file appears with no record of its arrival.',length:'48 min'},{number:2,title:'The Index',description:'The team uncovers a pattern in the missing entries.',length:'45 min'}]},{number:2,name:'Season Two',episodes:[{number:1,title:'Revision',description:'A second investigation starts where the previous one ended.',length:'51 min'},{number:2,title:'The Keeper',description:'A witness emerges from an unlikely place.',length:'48 min'}]}]},
{id:'glass-horizon',kind:'movie',title:'Glass Horizon',year:'2023',genre:'Drama / Romance',rating:'PG-13',length:'2h 06m',description:'Two architects attempt to rebuild a landmark while reconciling different visions of the future.',symbol:'G',colors:['#534236','#1d1b22'],episodes:[],seasons:[]},
{id:'north-of-nowhere',kind:'series',title:'North of Nowhere',year:'2026',genre:'Adventure / Documentary',rating:'TV-PG',length:'1 Season',description:'A small team traces overlooked landscapes through stories told by those who call them home.',symbol:'N',colors:['#3b554f','#152521'],seasons:[{number:1,name:'Season One',episodes:[{number:1,title:'First Light',description:'The journey begins before sunrise.',length:'38 min'},{number:2,title:'Beyond the Pass',description:'An old road reveals a remarkable history.',length:'41 min'}]}]}
];
const q=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const base=document.body.dataset.watchBase||'./';
const page=document.body.dataset.page;
const titleHref=t=>base+(t.kind==='series'?'series/':'title/')+'?id='+encodeURIComponent(t.id);
const playHref=(t,season,episode)=>base+'play/?id='+encodeURIComponent(t.id)+(season?'&season='+encodeURIComponent(season):'')+(episode?'&episode='+encodeURIComponent(episode):'');
const getTitle=()=>titles.find(t=>t.id===params.get('id'));
const colors=t=>'--tone1:'+t.colors[0]+';--tone2:'+t.colors[1];
const escapeHtml=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let previewNotice='Preview catalog only: the titles and descriptions are fictional UI examples. TMDB metadata, admin management and Cloudflare R2 playback are not connected yet.';
function card(t){return '<a class="media-card" href="'+titleHref(t)+'" aria-label="View '+escapeHtml(t.title)+' details"><div class="card-visual'+(t.poster_url?' has-poster':'')+'" style="'+colors(t)+'" data-mark="'+t.symbol+'"><span class="card-kicker">'+(t.kind==='series'?'SERIES':'FILM')+' / '+t.year+'</span>'+(t.poster_url?'<img class="card-poster" src="'+escapeHtml(t.poster_url)+'" alt="" loading="lazy">':'<span class="abstract" aria-hidden="true"></span>')+'</div><div class="card-copy"><h3>'+escapeHtml(t.title)+'</h3><p class="card-desc">'+escapeHtml(t.description)+'</p><div class="card-meta"><span>'+escapeHtml(t.genre)+'</span><span>'+escapeHtml(t.length)+'</span></div><div class="card-action">VIEW '+(t.kind==='series'?'EPISODES':'DETAILS')+' ↗</div></div></a>'}
function catalog(){
let active='all';
const search=q('#catalog-search'),grid=q('#catalog-grid'),message=q('#catalog-message'),count=q('#result-count');

function render(){const term=search.value.trim().toLowerCase();const filtered=titles.filter(t=>(active==='all'||t.kind===active)&&[t.title,t.description,t.genre,t.year].join(' ').toLowerCase().includes(term));grid.innerHTML=filtered.map(card).join('');count.textContent=filtered.length+' OF '+titles.length+' TITLES';message.hidden=filtered.length>0;message.textContent=filtered.length?'':'NO TITLES FOUND. TRY ANOTHER SEARCH.'}
search.addEventListener('input',render);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{const selected=x===b;x.classList.toggle('active',selected);x.setAttribute('aria-pressed',String(selected))});render()}));
render();}
function detail(t){if(!t){return '<div class="empty">This title is not available in the preview catalog. <a href="'+base+'">BACK TO CATALOG ↗</a></div>'}
return '<div class="detail-hero"><div><p class="crumb"><a href="'+base+'">SCREENROOM</a> / '+(t.kind==='series'?'SERIES':'MOVIES')+' / '+escapeHtml(t.title.toUpperCase())+'</p><div class="eyebrow">AN ORIGINAL SCREENROOM PREVIEW</div><h1 class="detail-headline">'+escapeHtml(t.title.toUpperCase())+'<span class="dot">.</span></h1><div class="detail-info"><span class="pill key">'+(t.kind==='series'?'SERIES':'FILM')+'</span><span class="pill">'+t.year+'</span><span class="pill">'+escapeHtml(t.genre)+'</span>'+(t.rating?'<span class="pill">'+escapeHtml(t.rating)+'</span>':'')+(t.length?'<span class="pill">'+escapeHtml(t.length)+'</span>':'')+'</div><p class="detail-description">'+escapeHtml(t.description)+'</p><div class="detail-actions"><a class="primary-btn" href="'+(t.kind==='series'&&t.seasons.length&&t.seasons[0].episodes.length?playHref(t,t.seasons[0].number,t.seasons[0].episodes[0].number):playHref(t))+'">▶ WATCH NOW</a><button class="ghost-btn" id="trailer-btn" type="button">TRAILER</button></div></div><div class="detail-art'+(t.backdrop_url?' has-backdrop':'')+'" data-mark="'+t.symbol+'" style="'+colors(t)+'">'+(t.backdrop_url?'<img class="detail-backdrop" src="'+escapeHtml(t.backdrop_url)+'" alt="">':'<span>VISUAL PLACEHOLDER / '+t.year+'</span>')+'</div></div>'+(previewNotice?'<div class="notice-box">'+escapeHtml(previewNotice)+'</div>':'');}
function renderDetail(){const t=getTitle(),target=q('#detail-content');if(!target)return;target.innerHTML=detail(t);q('#trailer-btn')?.addEventListener('click',()=>void showTrailer(t));if(t&&t.kind==='series'){const section=document.createElement('section');section.className='panel-section';section.innerHTML='<div class="season-row"><h2>EPISODES<span class="dot">.</span></h2><label><span class="sr-only">Choose season</span><select class="season-select" id="season-picker"></select></label></div><div class="episode-list" id="episode-list"></div>';target.append(section);const select=q('#season-picker');t.seasons.forEach(s=>select.add(new Option('SEASON '+s.number,s.number)));function episodes(){const season=t.seasons.find(s=>String(s.number)===select.value);q('#episode-list').innerHTML=season.episodes.map(e=>'<article class="episode"><div class="episode-image">'+(e.still_url?'<img class="episode-still" src="'+escapeHtml(e.still_url)+'" alt="" loading="lazy">':String(e.number).padStart(2,'0'))+'</div><div><h3>'+escapeHtml(e.title)+'</h3><p>'+escapeHtml(e.description)+'</p><small>S'+season.number+' E'+e.number+' / '+e.length+'</small></div><a class="episode-watch-btn" href="'+playHref(t,season.number,e.number)+'">WATCH NOW</a></article>').join('')}select.addEventListener('change',episodes);episodes()}}
function renderPlay(){const t=getTitle(),target=q('#playback-content');if(!target)return;if(!t){target.innerHTML='<div class="empty">Invalid title. <a href="'+base+'">BACK TO CATALOG ↗</a></div>';return}const firstSeason=t.kind==='series'?t.seasons.find(s=>s.number===1)||t.seasons[0]:null;const firstEpisode=firstSeason?.episodes.find(e=>e.number===1)||firstSeason?.episodes[0];const season=params.get('season')??(firstSeason?String(firstSeason.number):null),episode=params.get('episode')??(firstEpisode?String(firstEpisode.number):null);const ep=t.kind==='series'?t.seasons.flatMap(s=>s.episodes.map(e=>({...e,season:s.number}))).find(e=>String(e.season)===season&&String(e.number)===episode):null;target.innerHTML='<p class="crumb"><a href="'+base+'">SCREENROOM</a> / <a href="'+titleHref(t)+'">'+escapeHtml(t.title.toUpperCase())+'</a> / PLAYBACK</p><h1 class="detail-headline">'+escapeHtml(t.title.toUpperCase())+'<span class="dot">.</span></h1>'+(ep?'<p class="eyebrow">SEASON '+ep.season+' / EPISODE '+ep.number+' — '+escapeHtml(ep.title)+'</p>':'')+'<div class="player-placeholder" role="status"><span class="eyebrow">SECURESTREAM INTEGRATION</span><strong>STREAM NOT CONNECTED</strong><p>For the live build, an authenticated API will verify the Cloudflare R2 object and return a browser-compatible playback URL to SecureStream Player.</p><a class="outline-link" href="'+titleHref(t)+'">← BACK TO DETAILS</a></div>'+(previewNotice?'<div class="notice-box">'+escapeHtml(previewNotice)+'</div>':'');if(remoteMode)void mountStream(t,ep);}
let remoteMode=false;
const API_BASE='https://screenroom.devrijonn.com/screenroom-api';
const mins=n=>n?Math.floor(n/60)+'h '+String(n%60).padStart(2,'0')+'m':'';
function convertTitle(x){
 return {
  id:x.slug,kind:x.kind,title:x.title,year:String(x.release_year||''),
  genre:(x.genres||[]).join(' / '),rating:'',length:x.kind==='series'?'Series':mins(x.runtime_minutes),
  description:x.synopsis||'No summary provided.',symbol:(x.title||'?').slice(0,1).toUpperCase(),
  colors:['#35414b','#111820'],poster_url:x.poster_url,backdrop_url:x.backdrop_url,
   public_assets:x.public_assets||[],trailer_url:x.trailer_url||null,
  seasons:(x.seasons||[]).map(se=>({number:se.season_number,name:se.name,episodes:(se.episodes||[]).map(ep=>({
   id:ep.id,number:ep.episode_number,title:ep.title,description:ep.synopsis||'',
   still_url:ep.still_url,length:mins(ep.runtime_minutes)
  }))}))
 };
}
async function getAPI(route){
 const response=await fetch(API_BASE+route,{signal:AbortSignal.timeout(5500)});
 if(!response.ok)throw new Error('API returned '+response.status);
 return response.json();
}
async function hydrateData(){
 if(location.hostname!=='screenroom.devrijonn.com')return;
 try{
  if(page==='catalog'){
   const data=await getAPI('/api/titles?type=all&page=1');
   titles=(data.data||[]).map(convertTitle);
  }else{
   const slug=new URLSearchParams(location.search).get('id');
   if(!slug)return;
   const data=await getAPI('/api/titles/'+encodeURIComponent(slug));
   titles=[convertTitle(data)];
  }
  remoteMode=true;
  previewNotice='';
 }catch(e){titles=[];remoteMode=false;previewNotice='SCREENROOM catalog is temporarily unavailable. Please try again later.';console.warn('SCREENROOM: backend not ready.');}
}
async function mountStream(t,ep){
 const box=document.querySelector('.player-placeholder');
 if(!box||!remoteMode)return;
 const asset=(t.public_assets||[]).find(a=>ep?a.episode_id===ep.id&&a.role==='episode':a.title_id&&!a.episode_id&&a.role==='feature');
 if(!asset){
  const paragraph=box.querySelector('p');if(paragraph)paragraph.textContent='No playable video has been attached for this selection yet.';
  return;
 }
 try{
  const stream=await getAPI('/api/stream/'+encodeURIComponent(asset.id));
  if(!stream.url)throw new Error('No authorized playback URL returned.');
  const module=await import('./vendor/securestream.js?v=0.3.1');
  const div=document.createElement('div');div.className='screenroom-video';
  box.replaceWith(div);
  new module.SecureStreamPlayer({
   container:div,src:stream.url,id:'screenroom-'+t.id+(ep?'-'+ep.id:''),
   title:t.title+(ep?' — '+ep.title:''),poster:t.backdrop_url||t.poster_url||undefined,
    showWatermarkControl:false,preferOriginalMediaEngine:stream.format==='mp4'
  });
 }catch(error){
  const paragraph=box.querySelector('p');
  if(paragraph)paragraph.textContent='Playback is unavailable: '+error.message;
 }
}


async function showTrailer(t){
 if(t?.trailer_url){
  const link=new URL(t.trailer_url);
  if(link.protocol==='https:'&&['www.youtube.com','youtube.com'].includes(link.hostname)){window.open(link.href,'_blank','noopener,noreferrer');return;}
 }
 const asset=(t?.public_assets||[]).find(a=>a.role==='trailer'&&a.title_id);
 if(!remoteMode||!asset){alert('No trailer is linked for this title yet.');return;}
 let dialog;
 try{
  const stream=await getAPI('/api/stream/'+encodeURIComponent(asset.id));
  if(!stream.url)throw new Error('Trailer is not available.');
  const module=await import('./vendor/securestream.js?v=0.3.1');
  dialog=document.createElement('dialog');dialog.className='sr-trailer-dialog';
  dialog.innerHTML='<div class="sr-trailer-head"><strong>OFFICIAL TRAILER</strong><button type="button" class="sr-trailer-close">CLOSE ✕</button></div><div class="sr-trailer-content"></div>';
  document.body.append(dialog);
  dialog.querySelector('.sr-trailer-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();
  new module.SecureStreamPlayer({
   container:dialog.querySelector('.sr-trailer-content'),src:stream.url,
   id:'screenroom-trailer-'+t.id,title:t.title+' · Trailer',
   poster:t.backdrop_url||t.poster_url||undefined,showWatermarkControl:false
   });
 }catch(error){if(dialog?.open)dialog.close();alert('Trailer unavailable: '+error.message);}
}

(async()=>{await hydrateData();if(page==='catalog')catalog();else if(page==='play')renderPlay();else renderDetail();})();
