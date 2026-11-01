'use strict';
const $=id=>document.getElementById(id);
const base=location.pathname.includes('/studio')?location.pathname.split('/studio')[0]:'/screenroom-api';
let csrf=sessionStorage.getItem('screenroom_csrf')||'',selected=null,titles=[],editingAssetId=null,toastTimer=null;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=(msg,good=true,autoHide=true)=>{
 const notice=$('notice');clearTimeout(toastTimer);notice.textContent=msg;
 notice.dataset.type=good?'success':'error';notice.hidden=false;
 if(autoHide)toastTimer=setTimeout(()=>{notice.textContent='';notice.hidden=true;},3500);
};
const jsonForm=form=>Object.fromEntries(new FormData(form));
async function api(route,options={}){
 const method=options.method||'GET',mutation=!['GET','HEAD'].includes(method);
 async function send(){
  const headers={'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers};
  if(mutation&&csrf)headers['X-SCREENROOM-CSRF']=csrf;
  const r=await fetch(base+route,{credentials:'same-origin',...options,headers});
  let data;try{data=await r.json();}catch{data={error:'Unexpected server response.'};}
  return {r,data};
 }
 let result=await send();
 if(mutation&&result.r.status===403&&result.data.error==='Invalid CSRF token.'){
  // Another open tab may have rotated the per-session CSRF token; fetch and retry once.
  const response=await fetch(base+'/api/admin/csrf',{credentials:'same-origin',headers:{Accept:'application/json'}});
  if(response.ok){
   const fresh=await response.json();
   if(fresh.csrf){
    csrf=fresh.csrf;
    sessionStorage.setItem('screenroom_csrf',csrf);
    result=await send();
   }
  }
 }
 if(!result.r.ok)throw Error(result.data.error||'Request failed ('+result.r.status+').');
 return result.data;
}
async function attempt(fn){
 notify('Working…',true,false);
 try{await fn();if($('notice').textContent==='Working…')notify('Completed successfully.');}
 catch(e){notify(e.message||'Unexpected error.',false);}
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
 const targetSelect=$('tmdb-target');
 const previousTarget=targetSelect.value;
 targetSelect.replaceChildren(new Option('Create new / reuse exact TMDB match',''));
 for(const title of titles.filter(item=>item.status==='draft')){
  targetSelect.add(new Option('UPDATE DRAFT: '+title.title+' ('+title.kind.toUpperCase()+')',String(title.id)));
 }
 if(previousTarget && [...targetSelect.options].some(opt=>opt.value===previousTarget))targetSelect.value=previousTarget;
 if(!titles.length)target.innerHTML='<p class="muted">Nothing here yet. Create a draft or search TMDB.</p>';
  titles.forEach(t=>{
   const row=document.createElement('div');row.className='title-row';
   const b=document.createElement('button');b.type='button';
  b.className='title-item'+(selected?.id===t.id?' active':'');
  b.innerHTML='<div><strong>'+escapeHTML(t.title)+'</strong><small>'+escapeHTML(t.kind.toUpperCase())+' • '+escapeHTML(t.slug)+'</small></div><em>'+escapeHTML(t.status)+'</em>';
   b.addEventListener('click',()=>attempt(()=>loadEditor(t.id)));row.append(b);
   const remove=document.createElement('button');remove.type='button';remove.className='outline title-remove';
   remove.textContent='DELETE';remove.setAttribute('aria-label','Delete '+t.title);
   remove.addEventListener('click',()=>attempt(async()=>{
    if(!confirm('Permanently delete "'+t.title+'" from the catalog and remove its seasons and media links? The R2 source files will NOT be deleted.')){notify('Delete cancelled.');return;}
    await api('/api/admin/titles/'+t.id,{method:'DELETE'});
    if(selected?.id===t.id){selected=null;$('editor').hidden=true;resetAssetEditor();}
    notify('Title deleted from catalog. R2 files were preserved.');await loadTitles();
   }));
   row.append(remove);target.append(row);
 });
}
async function loadEditor(id){
 selected=await api('/api/admin/titles/'+id);
 $('editor').hidden=false;$('editor-heading').textContent=selected.title.toUpperCase()+' / EDIT';
 const form=$('edit-form');
  for(const field of ['title','synopsis','poster_url','backdrop_url','trailer_url','release_year','status']){
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
  (selected.assets||[]).forEach(a=>{
   const row=document.createElement('div');row.className='asset-entry';
   const label=document.createElement('span');label.textContent=a.role+' / '+a.format+' / '+(a.provider||'r2')+' / '+(a.r2_key||a.source_url||'');
   const edit=document.createElement('button');edit.className='outline';edit.type='button';edit.textContent='EDIT';
   edit.addEventListener('click',()=>{editAsset(a);$('asset-form').scrollIntoView({behavior:'smooth',block:'center'});});
   const remove=document.createElement('button');remove.className='outline';remove.type='button';remove.textContent='DELETE';
   remove.addEventListener('click',()=>attempt(async()=>{
    if(!confirm('Delete this media link from the catalog? The source file in R2 is preserved.')){notify('Delete cancelled.');return;}
    await api('/api/admin/assets/'+a.id,{method:'DELETE'});
    notify('Media link removed. R2 file preserved.');await loadEditor(selected.id);
   }));
   row.append(label,edit,remove);assets.append(row);
  });
 $('asset-role').value=selected.kind==='movie'?'feature':'episode';
 $('asset-episode').disabled=selected.kind==='movie';
 $('source-search-title').value=selected.title;
  resetAssetEditor();
  const primary=(selected.assets||[]).find(a=>a.role==='feature'&&selected.kind==='movie');
  if(primary)editAsset(primary,true);
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
 const target=$('tmdb-target').value;
 const payload={kind,tmdb_url:url};if(target)payload.target_title_id=Number(target);
 $('tmdb-feedback').textContent='Importing metadata from TMDB URL…';
 let d;
 try{d=await api('/api/admin/tmdb/import',{method:'POST',body:JSON.stringify(payload)});}
 catch(error){$('tmdb-feedback').textContent=error.message||'TMDB URL import failed.';throw error;}
 $('tmdb-feedback').textContent=d.created?'TMDB draft created.':'Existing title updated from TMDB.';
 notify($('tmdb-feedback').textContent);await loadTitles();await loadEditor(d.id);
});});
$('tmdb-form').addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{
 const form=jsonForm(e.target);
 $('tmdb-feedback').textContent='Searching TMDB…';
 let d;
 try{d=await api('/api/admin/tmdb/search?type='+encodeURIComponent(form.type)+'&q='+encodeURIComponent(form.q));}
 catch(error){$('tmdb-feedback').textContent=error.message||'TMDB search failed.';throw error;}
 $('tmdb-feedback').textContent=(d.results?.length||0)+' matching TMDB titles found. Choose the correct release/year.';
 const results=$('tmdb-results');results.replaceChildren();
 if(!d.results?.length){results.innerHTML='<p class="muted">No metadata found.</p>';return;}
 d.results.forEach(item=>{
  const b=document.createElement('button');b.className='tmdb-result';b.type='button';
  b.innerHTML='<span>'+escapeHTML(item.title)+' ('+escapeHTML(item.year)+')</span><span>IMPORT ↗</span>';
  b.addEventListener('click',()=>attempt(async()=>{
   const selectedId=$('tmdb-target').value;
   const prior=b.textContent;
   const buttons=[...results.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
   b.textContent='IMPORTING METADATA…';
   $('tmdb-feedback').textContent='Importing '+item.title+' from TMDB…';
   try{
    const payload={kind:form.type,tmdb_id:item.id};
    if(selectedId)payload.target_title_id=Number(selectedId);
    const x=await api('/api/admin/tmdb/import',{method:'POST',body:JSON.stringify(payload)});
    $('tmdb-feedback').textContent=x.created?'New metadata draft created.':'Existing title metadata refreshed. No duplicate was created.';
    notify($('tmdb-feedback').textContent);
    await loadTitles();await loadEditor(x.id);
   }catch(error){
    $('tmdb-feedback').textContent=error.message||'TMDB import failed. Please retry.';
    $('tmdb-feedback').scrollIntoView({block:'nearest'});
    notify($('tmdb-feedback').textContent,false);
   }finally{
    buttons.forEach(button=>button.disabled=false);
    b.textContent=prior;
   }
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
  r2:'Enter the exact original R2 object key, e.g. movies/my-film.mkv (not a signed URL). Original bytes remain unchanged.',
 internet_archive:'Search Archive items, inspect the original file and its license before selecting. Some items are not licensed for reuse.',
 wikimedia_commons:'Only directly playable MP4 results are listed. Check the Commons file page for license and attribution.',
 nasa_library:'NASA has informational and educational footage, not a movie catalog. Check NASA media rules and third-party rights.',
 authorized_https:'Enter a direct MP4 or HLS URL on an approved domain in MEDIA_ALLOWED_HOSTS. Embeds/iframe URLs are not supported.'
};
function resetAssetEditor(){
 editingAssetId=null;const form=$('asset-form');form.reset();
 $('save-asset').textContent='ATTACH ASSET +';$('cancel-asset-edit').hidden=true;
 form.elements.namedItem('role').value=selected?.kind==='series'?'episode':'feature';
 $('asset-episode').disabled=selected?.kind!=='series';
 syncProvider();
}
function editAsset(a,quiet=false){
 editingAssetId=a.id;const form=$('asset-form');
 form.elements.namedItem('provider').value=a.provider||'r2';
 form.elements.namedItem('role').value=a.role;
 form.elements.namedItem('episode_id').value=a.episode_id||'';
 form.elements.namedItem('r2_key').value=a.r2_key||'';
 form.elements.namedItem('source_url').value=a.source_url||'';
 form.elements.namedItem('format').value=a.format;
 syncProvider();$('asset-episode').disabled=a.role!=='episode';
 $('save-asset').textContent='SAVE MEDIA CHANGES';$('cancel-asset-edit').hidden=false;
 if(!quiet)notify('Existing media loaded. Update the key and format, then save.');
}
$('cancel-asset-edit').addEventListener('click',()=>{resetAssetEditor();notify('Media edit cancelled.');});
function syncProvider(){
 const provider=$('asset-provider').value,isR2=provider==='r2';
 $('asset-r2-box').hidden=!isR2;$('asset-url-box').hidden=isR2;
 $('source-rights-box').hidden=isR2;$('verify-asset').hidden=!isR2;
 $('source-search-form').hidden=!['internet_archive','wikimedia_commons','nasa_library'].includes(provider);
 $('asset-form').elements.namedItem('r2_key').required=isR2;
 $('asset-form').elements.namedItem('source_url').required=!isR2;
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
  if(editingAssetId)b.replace_asset_id=editingAssetId;
  const updated=Boolean(editingAssetId);
  await api('/api/admin/assets',{method:'POST',body:JSON.stringify(b)});
  resetAssetEditor();notify(updated?'Media replaced successfully. Watch Now will use the new source.':'Media attached.');
  await loadEditor(selected.id);
});});
$('verify-asset').addEventListener('click',()=>attempt(async()=>{
 const key=$('asset-form').elements.namedItem('r2_key').value;
 const d=await api('/api/admin/assets/verify',{method:'POST',body:JSON.stringify({r2_key:key})});
 notify('R2 object verified. '+(d.bytes||0)+' bytes / '+(d.contentType||'Unknown MIME'));
}));
$('asset-form').elements.namedItem('r2_key').addEventListener('input',e=>{
 if(e.target.value.trim())notify('Object key entered. Click VERIFY IN R2 to confirm availability.');
});
$('asset-form').elements.namedItem('r2_key').addEventListener('input',e=>{
 if(e.target.value.trim())notify('Object key entered. Click VERIFY IN R2 to confirm availability.');
});
syncProvider();
boot();
