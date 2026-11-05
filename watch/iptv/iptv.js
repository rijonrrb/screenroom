// Public third-party IPTV directories. Listings are not a rights or uptime guarantee.
const PLAYLISTS=[
 ['INTERNATIONAL','https://iptv-org.github.io/iptv/index.m3u'],
 ['NEWS','https://iptv-org.github.io/iptv/categories/news.m3u'],
 ['SPORTS','https://iptv-org.github.io/iptv/categories/sports.m3u'],
 ['ENTERTAINMENT','https://iptv-org.github.io/iptv/categories/entertainment.m3u']
];
const fallback=[{name:'France 24 English',country:'France',category:'News',streams:['https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_2300.m3u8']}];
const $=id=>document.getElementById(id),video=$('live-video');
let channels=fallback,engine=null,current=null,requestToken=0;
function parseM3U(text){
 const entries=[],lines=text.split(/\r?\n/);let meta=null;
 for(const raw of lines){
  const line=raw.trim();
  if(line.startsWith('#EXTINF:')){
   const attr=(key)=>{const m=line.match(new RegExp(key+'="([^"]*)"','i'));return m?m[1]:''};
   meta={name:(line.slice(line.indexOf(',')+1).trim()||attr('tvg-name')||'Unnamed channel'),country:attr('tvg-country')||'International',category:attr('group-title')||'Other'};
  }else if(meta && /^https:\/\//i.test(line)){
   // Only HTTPS URLs; unsupported transport protocols are intentionally excluded.
   if(/\.m3u8(?:[?#]|$)/i.test(line))entries.push({...meta,url:line});
   meta=null;
  }else if(line && !line.startsWith('#'))meta=null;
 }
 return entries;
}
function mergeLists(groups){
 const map=new Map();
 for(const items of groups)for(const c of items){
  const key=[c.name.toLowerCase(),c.country.toLowerCase()].join('|');
  if(!map.has(key))map.set(key,{name:c.name,country:c.country,category:c.category,streams:[]});
  const item=map.get(key);
  if(!item.streams.includes(c.url))item.streams.push(c.url);
 }
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function resetPlayer(){
 if(engine){engine.destroy();engine=null;}
 video.pause();video.removeAttribute('src');video.load();
}
function start(channel){
 current=channel;resetPlayer();$('now-title').textContent=channel.name;
 const selector=$('server-select');selector.replaceChildren();
 channel.streams.forEach((_,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent='SERVER '+(i+1);selector.append(option);});
 play();
}
function play(){
 if(!current)return;
 const url=current.streams[Number($('server-select').value)||0],token=++requestToken;
 resetPlayer();$('player-status').textContent='Connecting…';
 if(video.canPlayType('application/vnd.apple.mpegurl'))video.src=url;
 else if(window.Hls&&window.Hls.isSupported()){
  engine=new window.Hls({enableWorker:true});
  engine.on(window.Hls.Events.ERROR,(_event,data)=>{
   if(token===requestToken&&data.fatal){$('player-status').textContent='Stream unavailable. Try another server or channel.';engine.destroy();engine=null;}
  });
  engine.loadSource(url);engine.attachMedia(video);
 }else{$('player-status').textContent='This browser cannot play HLS streams.';return;}
 video.play().catch(()=>{if(token===requestToken)$('player-status').textContent='Tap play to begin, or try another server.';});
}
function fillFilter(id,values){
 const el=$(id),selected=el.value;el.replaceChildren();
 const all=document.createElement('option');all.value='';all.textContent='ALL '+id.split('-')[0].toUpperCase()+'S';el.append(all);
 for(const value of [...new Set(values)].sort()){const o=document.createElement('option');o.value=value;o.textContent=value;el.append(o);}
 el.value=[...el.options].some(o=>o.value===selected)?selected:'';
}
function render(){
 const q=$('channel-search').value.trim().toLowerCase(),country=$('country-filter').value,category=$('category-filter').value,sort=$('sort-filter').value;
 const matches=channels.filter(c=>(c.name+' '+c.country+' '+c.category).toLowerCase().includes(q)&&(!country||c.country===country)&&(!category||c.category===category))
  .sort((a,b)=>a[sort].localeCompare(b[sort]));
 $('channel-count').textContent=matches.length+' CHANNELS · '+channels.length+' LISTED (availability varies)';
 const root=$('channel-list');root.replaceChildren();
 // Limit DOM work on phones; search/filter still operates on all entries.
 for(const c of matches.slice(0,250)){
  const button=document.createElement('button');button.className='iptv-channel';button.type='button';
  button.textContent=c.name+' — '+c.country+' / '+c.category+(c.streams.length>1?' · '+c.streams.length+' SERVERS':'');
  button.setAttribute('aria-current',String(current===c));button.addEventListener('click',()=>{start(c);render();});root.append(button);
 }
 if(matches.length>250){const note=document.createElement('p');note.textContent='Showing first 250 channels. Search or filter to narrow results.';root.append(note);}
}
async function loadDirectories(){
 $('channel-count').textContent='Loading public channel directories…';
 const results=await Promise.allSettled(PLAYLISTS.map(async([label,url])=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(label+': '+response.status);return parseM3U(await response.text());}
  finally{clearTimeout(timer);}
 }));
 const lists=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
 if(lists.some(x=>x.length)){channels=mergeLists([...lists,...fallback.map(c=>c.streams.map(url=>({...c,url})))]);
  $('player-status').textContent='Choose a channel. Public streams may be offline or region restricted.';
 }else{$('player-status').textContent='Channel directories unavailable. Showing fallback channel.';}
 fillFilter('country-filter',channels.map(c=>c.country));
 fillFilter('category-filter',channels.map(c=>c.category));render();
}
for(const id of ['channel-search','country-filter','category-filter','sort-filter'])$(id).addEventListener('input',render);
$('server-select').addEventListener('change',play);
$('retry-stream').addEventListener('click',play);
video.addEventListener('playing',()=>$('player-status').textContent='LIVE');
video.addEventListener('error',()=>$('player-status').textContent='Playback failed. Try another server or channel.');
render();loadDirectories();
