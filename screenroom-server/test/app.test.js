'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {app,slug,tmdbId,mediaURL}=require('../app.js');

test('slug conversion is deterministic',()=>{
 assert.equal(slug('Midnight District'),'midnight-district');
 assert.equal(slug('A:B & C!'),'a-b-c');
});
test('static admin and deliberate incomplete configuration are safe',async()=>{
 const server=app.listen(0);
 try{
  const prefix='http://127.0.0.1:'+server.address().port;
  const health=await fetch(prefix+'/health');assert.equal(health.status,503);
  assert.equal((await health.json()).stage,'database-configuration-required');
  const titles=await fetch(prefix+'/api/titles');assert.equal(titles.status,503);
  const page=await fetch(prefix+'/studio/');assert.equal(page.status,200);
  const html=await page.text();assert.match(html,/THE STUDIO/);assert.match(html,/ADMIN SIGN IN/);
  const js=await fetch(prefix+'/studio/studio.js');assert.equal(js.status,200);
  const unauthorized=await fetch(prefix+'/api/admin/titles');assert.equal(unauthorized.status,503);
  const deleteAttempt=await fetch(prefix+'/api/admin/titles/3/permanent',{
   method:'DELETE',headers:{'content-type':'application/json','origin':'https://screenroom.devrijonn.com'},
   body:JSON.stringify({confirm_title:'Inception'})
  });
  assert.equal(deleteAttempt.status,503); // Authentication remains mandatory.
  const crossOrigin=await fetch(prefix+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json','origin':'https://not-the-site.invalid'},body:JSON.stringify({username:'admin',password:'x'})});
  assert.equal(crossOrigin.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('TMDB manual fallback accepts only matching TMDB movie/TV links',()=>{
 assert.equal(tmdbId('https://www.themoviedb.org/movie/27205-inception','movie'),27205);
 assert.equal(tmdbId('https://www.themoviedb.org/tv/1399','series'),1399);
 assert.equal(tmdbId('27205','movie'),27205);
 assert.throws(()=>tmdbId('https://evil.example/movie/27205','movie'));
 assert.throws(()=>tmdbId('https://www.themoviedb.org/tv/1399','movie'));
});
test('external video provider allowlists and HTTPS reject unexpected hosts',()=>{
 assert.equal(mediaURL('https://archive.org/download/demo/film.mp4','internet_archive'),'https://archive.org/download/demo/film.mp4');
 assert.equal(mediaURL('https://upload.wikimedia.org/wikipedia/commons/a/ab/clip.mp4','wikimedia_commons'),'https://upload.wikimedia.org/wikipedia/commons/a/ab/clip.mp4');
 assert.equal(mediaURL('https://images-assets.nasa.gov/video.mp4','nasa_library'),'https://images-assets.nasa.gov/video.mp4');
 assert.throws(()=>mediaURL('http://archive.org/download/video.mp4','internet_archive'));
 assert.throws(()=>mediaURL('https://attacker.example/video.mp4','internet_archive'));
 assert.throws(()=>mediaURL('https://archive.org.evil.example/video.mp4','internet_archive'));
 assert.throws(()=>mediaURL('https://archive.org/download/video.mp4','authorized_https'));
 assert.throws(()=>mediaURL('https://archive.org/download/video.html','internet_archive'));
 assert.equal(mediaURL('https://archive.org/download/demo/original.mkv','internet_archive'),'https://archive.org/download/demo/original.mkv');
 assert.equal(mediaURL('https://archive.org/download/demo/recording.mp3','internet_archive'),'https://archive.org/download/demo/recording.mp3');
});
test('admin UI includes TMDB and media provider workflows',async()=>{
 const server=app.listen(0);
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/studio/');
  const html=await response.text();
  assert.match(html,/SEARCH THIS TITLE ON TMDB/);
  assert.match(html,/MANUAL FALLBACK/);
  assert.match(html,/Cloudflare R2/);
  assert.match(html,/Internet Archive/);
  assert.match(html,/Wikimedia Commons/);
  assert.match(html,/NASA Video Library/);
  assert.match(html,/rights_confirmed/);
  assert.match(html,/value="mkv"/);
  assert.match(html,/value="mp3"/);
  assert.match(html,/href="https:\/\/screenroom\.devrijonn\.com\/"/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
