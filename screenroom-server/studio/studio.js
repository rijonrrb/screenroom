'use strict';
const $=id=>document.getElementById(id);
const base=location.pathname.includes('/studio')?location.pathname.split('/studio')[0]:'/screenroom-api';
let csrf=sessionStorage.getItem('screenroom_csrf')||'',selected=null,titles=[];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=(msg,good=true)=>{$('notice').textContent=msg;$('notice').style.borderColor=good?'#f5c518':'#ed7272';};
const jsonForm=form=>Object.fromEntries(new FormData(form));
async function api(route,options={}){
 const headers={'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers};
 if(!['GET','HEAD'].includes(options.method||'GET')&&csrf)headers['X-SCREENROOM-CSRF']=csrf;
 const r=await fetch(base+route,{credentials:'same-origin',...options,headers});
 let data;try{data=await r.json();}catch{data={error:'Unexpected server response.'};}
 if(!r.ok)throw Error(data.error||'Request failed ('+r.status+').');
 return data;
}
async function attempt(fn){
 try{await fn();}catch(e){notify(e.message||'Unexpected error.',false);}
}
function showDashboard(show){$('dashboard').hidden=!show;$('login-screen').hidden=show;$('logout').hidden=!show;}
async function boot(){
 try{
  await api('/api/admin/session');
  if(!csrf){const x=await api('/api/admin/csrf');csrf=x.csrf;sessionStorage.setItem('screenroom_csrf',csrf);}
  showDashboard(true);await loadTitles();
 }catch{showDashboard(false);}
}
$('login-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 const f=jsonForm(e.target);
 const data=await api('/api/admin/login',{method:'POST',body:JSON.stringify(f)});
 csrf=data.csrf;sessionStorage.setItem('screenroom_csrf',csrf);
 e.target.reset();showDashboard(true);notify('Signed in successfully.');await loadTitles();
});});
$('logout').addEventListener('click',()=>attempt(async()=>{
 await api('/api/admin/logout',{method:'POST',body:'{}'});
 csrf='';sessionStorage.removeItem('screenroom_csrf');selected=null;showDashboard(false);notify('Signed out.');
}));
async function loadTitles(){
 const d=await api('/api/admin/titles');titles=d.data;
 $('title-count').textContent=titles.length;
 $('published-count').textContent=titles.filter(x=>x.status==='published').length;
 $('draft-count').textContent=titles.filter(x=>x.status==='draft').length;
 const target=$('title-list');target.replaceChildren();
 if(!titles.length)target.innerHTML='<p class="muted">Nothing here yet. Create a draft or search TMDB.</p>';
 titles.forEach(t=>{
  const b=document.createElement('button');b.type='button';
  b.className='title-item'+(selected?.id===t.id?' active':'');
  b.innerHTML='<div><strong>'+escapeHTML(t.title)+'</strong><small>'+escapeHTML(t.kind.toUpperCase())+' • '+escapeHTML(t.slug)+'</small></div><em>'+escapeHTML(t.status)+'</em>';
  b.addEventListener('click',()=>attempt(()=>loadEditor(t.id)));target.append(b);
 });
}
async function loadEditor(id){
 selected=await api('/api/admin/titles/'+id);
 $('editor').hidden=false;$('editor-heading').textContent=selected.title.toUpperCase()+' / EDIT';
 const form=$('edit-form');
 for(const field of ['title','synopsis','poster_url','backdrop_url','release_year','status']){
  const input=form.elements.namedItem(field);if(input)input.value=selected[field]??'';
 }
 form.elements.namedItem('genres').value=(selected.genres||[]).join(', ');
 $('series-editor').hidden=selected.kind!=='series';
 const seasons=$('seasons-list'),seasonOptions=$('episode-season'),episodeOptions=$('asset-episode');
 seasons.replaceChildren();seasonOptions.replaceChildren();episodeOptions.replaceChildren();
 episodeOptions.add(new Option('Not applicable',''));
 for(const season of selected.seasons||[]){
  seasonOptions.add(new Option('Season '+season.season_number,season.id));
  const section=document.createElement('div');section.className='season-entry';
  section.innerHTML='<strong>SEASON '+escapeHTML(season.season_number)+' — '+escapeHTML(season.name)+'</strong>';
  const importButton=document.createElement('button');importButton.className='outline';importButton.type='button';importButton.textContent='IMPORT TMDB EPISODES';
  importButton.addEventListener('click',()=>attempt(async()=>{const d=await api('/api/admin/tmdb/import-episodes',{method:'POST',body:JSON.stringify({season_id:season.id})});notify(d.imported+' episodes imported.');await loadEditor(id);}));
  section.append(importButton);
  for(const e of season.episodes||[]){
   const p=document.createElement('p');p.className='episode-entry';
   p.textContent='EP '+e.episode_number+' / '+e.title;section.append(p);
   episodeOptions.add(new Option('S'+season.season_number+' E'+e.episode_number+' — '+e.title,e.id));
  }
  seasons.append(section);
 }
 const assets=$('assets-list');assets.replaceChildren();
 (selected.assets||[]).forEach(a=>{const d=document.createElement('div');d.textContent=a.role+' / '+a.format+' / '+(a.provider||'r2')+' / '+(a.r2_key||a.source_url||'');assets.append(d);});
 $('asset-role').value=selected.kind==='movie'?'feature':'episode';
 $('asset-episode').disabled=selected.kind==='movie';
 $('source-search-title').value=selected.title;
 syncProvider();
 await loadTitles();
 $('editor').scrollIntoView({behavior:'smooth',block:'start'});
}
$('refresh').addEventListener('click',()=>attempt(loadTitles));
$('create-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 const b=jsonForm(e.target);if(!b.release_year)delete b.release_year;if(!b.runtime_minutes)delete b.runtime_minutes;
 const d=await api('/api/admin/titles',{method:'POST',body:JSON.stringify(b)});
 e.target.reset();notify('Draft created.');await loadTitles();await loadEditor(d.id);
});});
$('edit-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 if(!selected)return;
 const b=jsonForm(e.target);b.genres=b.genres.split(',').map(x=>x.trim()).filter(Boolean);
 b.release_year=b.release_year?Number(b.release_year):null;
 await api('/api/admin/titles/'+selected.id,{method:'PATCH',body:JSON.stringify(b)});
 notify('Title updated.');await loadEditor(selected.id);
});});
$('tmdb-quick-search').addEventListener('click',()=>{
 const form=$('create-form'),tmdb=$('tmdb-form');
 tmdb.elements.namedItem('type').value=form.elements.namedItem('kind').value;
 tmdb.elements.namedItem('q').value=form.elements.namedItem('title').value.trim();
 if(!tmdb.elements.namedItem('q').value){notify('Enter the title to search TMDB.',false);return;}
 tmdb.requestSubmit();
});
$('tmdb-url-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 const url=e.target.elements.namedItem('tmdb_url').value.trim();
 const kind=$('tmdb-form').elements.namedItem('type').value;
 const d=await api('/api/admin/tmdb/import',{method:'POST',body:JSON.stringify({kind,tmdb_url:url})});
 notify('Imported metadata from TMDB URL.');await loadTitles();await loadEditor(d.id);
});});
$('tmdb-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 const form=jsonForm(e.target);
 const d=await api('/api/admin/tmdb/search?type='+encodeURIComponent(form.type)+'&q='+encodeURIComponent(form.q));
 const results=$('tmdb-results');results.replaceChildren();
 if(!d.results?.length){results.innerHTML='<p class="muted">No metadata found.</p>';return;}
 d.results.forEach(item=>{
  const b=document.createElement('button');b.className='tmdb-result';b.type='button';
  b.innerHTML='<span>'+escapeHTML(item.title)+' ('+escapeHTML(item.year)+')</span><span>IMPORT ↗</span>';
  b.addEventListener('click',()=>attempt(async()=>{
   const x=await api('/api/admin/tmdb/import',{method:'POST',body:JSON.stringify({kind:form.type,tmdb_id:item.id})});
   notify('TMDB metadata imported as draft.');await loadTitles();await loadEditor(x.id);
  }));results.append(b);
 });
});});
$('season-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 if(!selected||selected.kind!=='series')return;
 const b=jsonForm(e.target);b.title_id=selected.id;
 await api('/api/admin/seasons',{method:'POST',body:JSON.stringify(b)});
 e.target.reset();notify('Season added.');await loadEditor(selected.id);
});});
$('episode-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 if(!selected)return;
 await api('/api/admin/episodes',{method:'POST',body:JSON.stringify(jsonForm(e.target))});
 e.target.reset();notify('Episode created.');await loadEditor(selected.id);
});});
const sourceNames={
 r2:'R2 requires a private MP4 object key. Keep R2 credentials in cPanel, not in the video URL.',
 internet_archive:'Search Archive items, inspect the original file and its license before selecting. Some items are not licensed for reuse.',
 wikimedia_commons:'Only directly playable MP4 results are listed. Check the Commons file page for license and attribution.',
 nasa_library:'NASA has informational and educational footage, not a movie catalog. Check NASA media rules and third-party rights.',
 authorized_https:'Enter a direct MP4 or HLS URL on an approved domain in MEDIA_ALLOWED_HOSTS. Embeds/iframe URLs are not supported.'
};
function syncProvider(){
 const provider=$('asset-provider').value,isR2=provider==='r2';
 $('asset-r2-box').hidden=!isR2;$('asset-url-box').hidden=isR2;
 $('source-rights-box').hidden=isR2;$('verify-asset').hidden=!isR2;
 $('source-search-form').hidden=!['internet_archive','wikimedia_commons','nasa_library'].includes(provider);
 $('asset-form').elements.namedItem('r2_key').required=isR2;
 $('asset-form').elements.namedItem('source_url').required=!isR2;
 if(isR2)$('asset-form').elements.namedItem('format').value='mp4';
 $('source-help').textContent=sourceNames[provider]||'';
 $('source-search-results').replaceChildren();
}
$('asset-provider').addEventListener('change',()=>{
 syncProvider();
 if(selected&&['internet_archive','wikimedia_commons','nasa_library'].includes($('asset-provider').value)){
  $('source-search-title').value=selected.title;
  $('source-search-form').requestSubmit();
 }
});
$('source-search-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 const provider=$('asset-provider').value,q=$('source-search-title').value.trim();
 const results=$('source-search-results');results.replaceChildren();
 const d=await api('/api/admin/sources/search?provider='+encodeURIComponent(provider)+'&q='+encodeURIComponent(q));
 if(provider!==$('asset-provider').value)return;
 if(!d.results?.length){results.textContent='No eligible video results found. You can still enter an authorized direct URL.';return;}
 d.results.forEach(item=>{
  const div=document.createElement('div');div.className='season-entry';
  const title=document.createElement('strong');title.textContent=item.title;
  const license=document.createElement('p');license.className='muted';license.textContent='License/rights: '+(item.license||'Review source page');
  const link=document.createElement('a');link.href=item.page;link.target='_blank';link.rel='noopener noreferrer';link.textContent='REVIEW SOURCE & RIGHTS ↗';
  const button=document.createElement('button');button.className='outline';button.type='button';button.textContent='USE THIS VIDEO';
  button.addEventListener('click',()=>attempt(async()=>{
   const resolved=item.url?{url:item.url,format:item.format||'mp4'}:await api('/api/admin/sources/resolve?provider='+encodeURIComponent(provider)+'&id='+encodeURIComponent(item.id));
   $('asset-form').elements.namedItem('source_url').value=resolved.url;
   $('asset-form').elements.namedItem('format').value=resolved.format;
   $('asset-form').elements.namedItem('rights_confirmed').checked=false;
   notify('Video URL selected. Verify source rights before attaching.');
  }));
  div.append(title,license,link,button);results.append(div);
 });
});});
$('asset-role').addEventListener('change',()=>{$('asset-episode').disabled=$('asset-role').value!=='episode';});
$('asset-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 if(!selected)return;
 const b=jsonForm(e.target);
 if(b.provider==='r2'){delete b.source_url;delete b.rights_confirmed;}
 else{delete b.r2_key;b.rights_confirmed=e.target.elements.namedItem('rights_confirmed').checked;}
 if(b.role==='episode'){if(!b.episode_id)throw Error('Choose an episode.');delete b.title_id;}
 else{b.title_id=selected.id;delete b.episode_id;}
 if(b.role==='episode')delete b.title_id;
 await api('/api/admin/assets',{method:'POST',body:JSON.stringify(b)});
 e.target.reset();syncProvider();notify('Media attached.');await loadEditor(selected.id);
});});
$('verify-asset').addEventListener('click',()=>attempt(async()=>{
 const key=$('asset-form').elements.namedItem('r2_key').value;
 const d=await api('/api/admin/assets/verify',{method:'POST',body:JSON.stringify({r2_key:key})});
 notify('R2 object verified. '+(d.bytes||0)+' bytes / '+(d.contentType||'Unknown MIME'));
}));
syncProvider();
boot();
