'use strict';
const express=require('express'), helmet=require('helmet'), bcrypt=require('bcryptjs');
const mysql=require('mysql2/promise'), crypto=require('node:crypto'), path=require('node:path');
const {rateLimit}=require('express-rate-limit');
const {S3Client,GetObjectCommand,HeadObjectCommand}=require('@aws-sdk/client-s3');
const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
const env=process.env;
const base=(env.APP_BASE_PATH||'/screenroom-api').replace(/\/$/,'');
const origin=env.SITE_ORIGIN||'https://screenroom.devrijonn.com';
const configured=['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME'].every(k=>!!env[k]);
// Avoid cPanel/Passenger interpolation of dollar signs inside bcrypt hashes.
// Base64 encodes the full bcrypt hash for environment transport only.
const adminPasswordHash=env.ADMIN_PASSWORD_HASH_B64
 ?Buffer.from(env.ADMIN_PASSWORD_HASH_B64,'base64').toString('utf8')
 :(env.ADMIN_PASSWORD_HASH||'');
const authReady=Boolean(configured&&env.ADMIN_USERNAME&&/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(adminPasswordHash)&&env.SESSION_SECRET?.length>=48);
const r2Ready=['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET'].every(k=>!!env[k]);
const db=configured?mysql.createPool({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,waitForConnections:true,connectionLimit:5,timezone:'Z',charset:'utf8mb4'}):null;
const s3=r2Ready?new S3Client({region:'auto',endpoint:'https://'+env.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com',credentials:{accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY}}):null;
const app=express(), r=express.Router();
app.disable('x-powered-by');app.set('trust proxy',1);app.use(helmet());app.use(express.json({limit:'48kb'}));
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
const hash=x=>crypto.createHmac('sha256',env.SESSION_SECRET||'unconfigured').update(x).digest('hex');
function err(code,message){const e=new Error(message);e.status=code;throw e;}
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function str(v,max=250){if(typeof v!=='string'||!v.trim()||v.length>max)err(400,'Invalid text.');return v.trim();}
function opt(v,max=6000){return v===undefined||v===null||v===''?null:str(v,max);}
function num(v,max=999999999){const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>max)err(400,'Invalid number.');return n;}
function url(v){if(!v)return null;try{const u=new URL(str(v,1400));if(u.protocol!=='https:')throw 0;return u.href;}catch{err(400,'Artwork URL must use HTTPS.');}}
function list(v){if(v==null)return '[]';if(!Array.isArray(v)||v.length>25)err(400,'Invalid genres.');return JSON.stringify(v.map(x=>str(x,65)));}
function slug(v){return v.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,135);}
async function sql(q,p=[]){if(!db)err(503,'Database is not configured.');const [rows]=await db.execute(q,p);return rows;}
function requiresDB(req,res,next){return configured?next():next(Object.assign(new Error('Database not configured.'),{status:503}));}
function cookie(req){const m=(req.headers.cookie||'').match(/(?:^|;\s*)screenroom_sid=([0-9a-f]{64})/);return m?.[1]||'';}
function setCookie(res,token,seconds){res.cookie('screenroom_sid',token,{httpOnly:true,secure:true,sameSite:'strict',path:base,maxAge:seconds*1000});}
function checkOrigin(req,res,next){if(req.get('origin')!==origin)return next(Object.assign(new Error('Invalid request origin.'),{status:403}));next();}
async function admin(req,res,next){try{
 if(!authReady)err(503,'Admin login not configured.');
 const token=cookie(req);if(!token)err(401,'Sign in first.');
 const rows=await sql('SELECT csrf_hash FROM admin_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() LIMIT 1',[hash(token)]);
 if(!rows.length)err(401,'Session expired.');
 req.adminToken=token;req.csrfHash=rows[0].csrf_hash;next();
}catch(e){next(e);}}
function csrf(req,res,next){const v=req.get('x-screenroom-csrf')||'';if(!/^[0-9a-f]{64}$/.test(v)||hash(v)!==req.csrfHash)return next(Object.assign(new Error('Invalid CSRF token.'),{status:403}));next();}
function normalized(t){try{t.genres=typeof t.genres==='string'?JSON.parse(t.genres):t.genres||[];}catch{t.genres=[];}return t;}
async function details(slugId,drafts=false){
 const rows=await sql('SELECT * FROM titles WHERE slug=?'+(drafts?'':" AND status='published'")+' LIMIT 1',[slugId]);
 if(!rows.length)err(404,'Title not found.');
 const t=normalized(rows[0]);delete t.created_at;delete t.updated_at;
 if(t.kind==='series'){t.seasons=await sql('SELECT id,season_number,name,synopsis FROM seasons WHERE title_id=? ORDER BY season_number',[t.id]);
 for(const season of t.seasons)season.episodes=await sql('SELECT id,episode_number,title,synopsis,still_url,runtime_minutes FROM episodes WHERE season_id=? ORDER BY episode_number',[season.id]);}
 t.public_assets=await sql('SELECT id,title_id,episode_id,role,format,provider FROM media_assets WHERE title_id=? OR episode_id IN (SELECT e.id FROM episodes e JOIN seasons s ON s.id=e.season_id WHERE s.title_id=?)',[t.id,t.id]);
 return t;
}
r.get('/health',wrap(async(req,res)=>{if(!configured) return res.status(503).json({ok:false,stage:'database-configuration-required'});await sql('SELECT 1');res.json({ok:true,service:'SCREENROOM'});}));
r.get('/api/titles',requiresDB,wrap(async(req,res)=>{
 const kind=req.query.type||'all';if(!['all','movie','series'].includes(kind))err(400,'Invalid type.');
 const term=String(req.query.q||'').slice(0,100);const page=Math.max(1,Math.min(500,parseInt(req.query.page,10)||1));
 const conditions=["status='published'"],values=[];
 if(kind!=='all'){conditions.push('kind=?');values.push(kind);}
 if(term){conditions.push('title LIKE ?');values.push('%'+term+'%');}
 const rows=await sql('SELECT id,slug,kind,title,synopsis,release_year,genres,poster_url,backdrop_url,runtime_minutes FROM titles WHERE '+conditions.join(' AND ')+' ORDER BY id DESC LIMIT 24 OFFSET '+(page-1)*24,values);
 res.json({data:rows.map(normalized),page});
}));
r.get('/api/titles/:slug',requiresDB,wrap(async(req,res)=>res.json(await details(req.params.slug))));
r.get('/api/stream/:id',requiresDB,wrap(async(req,res)=>{
 const rows=await sql('SELECT a.format,a.r2_key,a.provider,a.source_url FROM media_assets a LEFT JOIN titles t ON t.id=a.title_id LEFT JOIN episodes e ON e.id=a.episode_id LEFT JOIN seasons s ON s.id=e.season_id LEFT JOIN titles t2 ON t2.id=s.title_id WHERE a.id=? AND COALESCE(t.status,t2.status)=? LIMIT 1',[num(req.params.id),'published']);
 if(!rows.length)err(404,'Media unavailable.');
 const asset=rows[0],provider=asset.provider||'r2';
 if(provider!=='r2')return res.json({url:mediaURL(asset.source_url,provider),expiresIn:0,format:asset.format,provider});
 if(asset.format!=='mp4')err(409,'Private R2 HLS requires an authenticated segment proxy.');
 if(!s3)err(503,'R2 not configured.');
 const signed=await getSignedUrl(s3,new GetObjectCommand({Bucket:env.R2_BUCKET,Key:asset.r2_key}),{expiresIn:900});
 res.json({url:signed,expiresIn:900,format:'mp4',provider:'r2'});
}));
r.use('/studio',express.static(path.join(__dirname,'studio'),{index:'index.html',dotfiles:'deny',maxAge:0}));
r.post('/api/admin/login',checkOrigin,rateLimit({windowMs:900000,limit:8,standardHeaders:'draft-7',legacyHeaders:false}),wrap(async(req,res)=>{
 if(!authReady)err(503,'Admin login not configured.');
 const user=String(req.body?.username||''),pass=String(req.body?.password||'');
 if(pass.length>256||user!==env.ADMIN_USERNAME||!await bcrypt.compare(pass,adminPasswordHash))err(401,'Invalid credentials.');
 const token=crypto.randomBytes(32).toString('hex'),xsrf=crypto.randomBytes(32).toString('hex');
 await sql('DELETE FROM admin_sessions WHERE expires_at<UTC_TIMESTAMP()');
 await sql('INSERT INTO admin_sessions(token_hash,csrf_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR))',[hash(token),hash(xsrf)]);
 setCookie(res,token,43200);res.json({authenticated:true,csrf:xsrf});
}));
r.get('/api/admin/session',admin,(req,res)=>res.json({authenticated:true}));
r.get('/api/admin/csrf',admin,wrap(async(req,res)=>{const xsrf=crypto.randomBytes(32).toString('hex');await sql('UPDATE admin_sessions SET csrf_hash=? WHERE token_hash=?',[hash(xsrf),hash(req.adminToken)]);res.json({csrf:xsrf});}));
r.post('/api/admin/logout',checkOrigin,admin,csrf,wrap(async(req,res)=>{await sql('DELETE FROM admin_sessions WHERE token_hash=?',[hash(req.adminToken)]);setCookie(res,'',0);res.json({ok:true});}));
r.use('/api/admin',admin);
r.use('/api/admin',(req,res,next)=>{if(req.method==='GET')return next();return checkOrigin(req,res,()=>csrf(req,res,next));});
r.get('/api/admin/titles',wrap(async(req,res)=>res.json({data:await sql('SELECT id,slug,title,kind,status,tmdb_id FROM titles ORDER BY id DESC LIMIT 200')})));
r.get('/api/admin/titles/:id',wrap(async(req,res)=>{
 const x=await sql('SELECT slug FROM titles WHERE id=?',[num(req.params.id)]);if(!x.length)err(404,'Title not found.');
 const t=await details(x[0].slug,true);
 t.assets=await sql('SELECT id,title_id,episode_id,role,format,provider,source_url,r2_key FROM media_assets WHERE title_id=? OR episode_id IN (SELECT e.id FROM episodes e JOIN seasons s ON s.id=e.season_id WHERE s.title_id=?)',[t.id,t.id]);
 res.json(t);
}));
r.post('/api/admin/titles',wrap(async(req,res)=>{
 const b=req.body||{};if(!['movie','series'].includes(b.kind))err(400,'Choose Movie or Series.');
 const name=str(b.title),key=slug(b.slug||name);if(!key)err(400,'Invalid slug.');
 const result=await sql("INSERT INTO titles(slug,kind,title,synopsis,release_year,genres,poster_url,backdrop_url,runtime_minutes,status) VALUES(?,?,?,?,?,?,?,?,?,'draft')",
 [key,b.kind,name,opt(b.synopsis),b.release_year?num(b.release_year,2200):null,list(b.genres),url(b.poster_url),url(b.backdrop_url),b.runtime_minutes?num(b.runtime_minutes,10000):null]);
 res.status(201).json({id:result.insertId,slug:key});
}));
r.patch('/api/admin/titles/:id',wrap(async(req,res)=>{
 const b=req.body||{},allowed={
 title:str,synopsis:opt,release_year:v=>v==null?null:num(v,2200),
 genres:list,poster_url:url,backdrop_url:url,runtime_minutes:v=>v==null?null:num(v,10000),
 status:v=>['draft','published','archived'].includes(v)?v:err(400,'Invalid status.')
 };
 const updates=[],values=[];
 for(const [k,validate] of Object.entries(allowed))if(Object.hasOwn(b,k)){updates.push(k+'=?');values.push(validate(b[k]));}
 if(!updates.length)err(400,'No supported changes.');
 if(b.status==='published'){
  const rows=await sql("SELECT COUNT(*) AS cnt FROM media_assets a LEFT JOIN titles t ON t.id=a.title_id LEFT JOIN episodes e ON e.id=a.episode_id LEFT JOIN seasons s ON s.id=e.season_id WHERE (t.id=? OR s.title_id=?) AND a.role IN ('feature','episode')",[num(req.params.id),num(req.params.id)]);
  if(!rows[0].cnt)err(400,'Add a video asset before publishing.');
 }
 values.push(num(req.params.id));
 const result=await sql('UPDATE titles SET '+updates.join(',')+' WHERE id=?',values);
 if(!result.affectedRows)err(404,'Title not found.');res.json({ok:true});
}));
r.delete('/api/admin/titles/:id',wrap(async(req,res)=>{
 const result=await sql("UPDATE titles SET status='archived' WHERE id=?",[num(req.params.id)]);if(!result.affectedRows)err(404,'Title not found.');res.json({ok:true,archived:true});
}));
r.post('/api/admin/seasons',wrap(async(req,res)=>{
 const b=req.body||{},titleId=num(b.title_id);
 const rows=await sql("SELECT id FROM titles WHERE id=? AND kind='series'",[titleId]);if(!rows.length)err(400,'Series not found.');
 const result=await sql('INSERT INTO seasons(title_id,season_number,name,synopsis) VALUES(?,?,?,?)',[titleId,num(b.season_number,1000),str(b.name),opt(b.synopsis)]);
 res.status(201).json({id:result.insertId});
}));
r.post('/api/admin/episodes',wrap(async(req,res)=>{
 const b=req.body||{};const result=await sql('INSERT INTO episodes(season_id,episode_number,title,synopsis,still_url,runtime_minutes) VALUES(?,?,?,?,?,?)',
 [num(b.season_id),num(b.episode_number,1000),str(b.title),opt(b.synopsis),url(b.still_url),b.runtime_minutes?num(b.runtime_minutes,10000):null]);
 res.status(201).json({id:result.insertId});
}));
function mediaKey(v){const key=str(v,1000);if(key.startsWith('/')||key.includes('..')||key.includes('\\')||key.includes('?')||key.includes('://'))err(400,'Use an R2 object key, not a URL.');return key;}
const providers=['r2','internet_archive','wikimedia_commons','nasa_library','authorized_https'];
function mediaURL(value,provider){
 if(!providers.includes(provider)||provider==='r2')err(400,'Invalid external provider.');
 let u;try{u=new URL(str(value,2000));}catch{err(400,'Provide a valid HTTPS video URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)err(400,'Only standard HTTPS video URLs are allowed.');
 const host=u.hostname.toLowerCase();
 const checks={
  internet_archive:host==='archive.org'||host.endsWith('.archive.org'),
  wikimedia_commons:host==='upload.wikimedia.org',
  nasa_library:host==='images-assets.nasa.gov',
  authorized_https:(env.MEDIA_ALLOWED_HOSTS||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean).includes(host)
 };
 if(!checks[provider])err(400,'Video host is not approved for the selected provider.');
 if(!/\.(mp4|m3u8)(?:$)/i.test(u.pathname))err(400,'A direct MP4 or HLS manifest URL is required.');
 return u.href;
}
function tmdbId(value,kind){
 const text=str(value,350);
 if(/^\d+$/.test(text))return num(text);
 let u;try{u=new URL(text);}catch{err(400,'Paste a TMDB movie or TV URL.');}
 if(u.protocol!=='https:'||!['www.themoviedb.org','themoviedb.org'].includes(u.hostname.toLowerCase()))err(400,'Only themoviedb.org links are accepted.');
 const m=u.pathname.match(/^\/(movie|tv)\/(\d+)(?:[\/-]|$)/);
 if(!m||m[1] !== (kind==='series'?'tv':'movie'))err(400,'TMDB link does not match Movie / Series selection.');
 return num(m[2]);
}
r.post('/api/admin/assets',wrap(async(req,res)=>{
 const b=req.body||{};if(!['feature','episode','trailer'].includes(b.role)||!['mp4','hls'].includes(b.format))err(400,'Invalid role/format.');
 const tid=b.title_id?num(b.title_id):null,eid=b.episode_id?num(b.episode_id):null;
 if(Number(!!tid)+Number(!!eid)!==1)err(400,'Select exactly one title or episode.');
 if((b.role==='feature'&&!tid)||(b.role==='episode'&&!eid))err(400,'Media owner mismatch.');
 const provider=b.provider||'r2';if(!providers.includes(provider))err(400,'Unsupported video provider.');
 if(provider!=='r2'&&b.rights_confirmed!==true)err(400,'Confirm that you are authorized to stream this video.');
 if(provider==='r2'&&b.format!=='mp4')err(400,'Private R2 HLS is not ready without a segment proxy.');
 const objectKey=provider==='r2'?mediaKey(b.r2_key):null;
 const sourceURL=provider==='r2'?null:mediaURL(b.source_url,provider);
 if(sourceURL&&((b.format==='hls')!==new URL(sourceURL).pathname.toLowerCase().endsWith('.m3u8')))err(400,'Selected format does not match the video URL.');
 const result=await sql('INSERT INTO media_assets(title_id,episode_id,role,format,provider,r2_key,source_url,content_type) VALUES(?,?,?,?,?,?,?,?)',
 [tid,eid,b.role,b.format,provider,objectKey,sourceURL,b.format==='mp4'?'video/mp4':'application/vnd.apple.mpegurl']);
 res.status(201).json({id:result.insertId});
}));
r.post('/api/admin/assets/verify',wrap(async(req,res)=>{
 if(!s3)err(503,'R2 not configured.');const head=await s3.send(new HeadObjectCommand({Bucket:env.R2_BUCKET,Key:mediaKey(req.body?.r2_key)}));
 res.json({exists:true,bytes:head.ContentLength,contentType:head.ContentType});
}));
async function tmdb(endpoint,params={}){
 if(!env.TMDB_TOKEN)err(503,'TMDB not configured.');
 const u=new URL('https://api.themoviedb.org/3/'+endpoint);
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
 const resp=await fetch(u,{headers:{Authorization:'Bearer '+env.TMDB_TOKEN,Accept:'application/json'},signal:AbortSignal.timeout(9000)});
 if(!resp.ok)err(502,'TMDB is unavailable.');return resp.json();
}
r.get('/api/admin/tmdb/search',wrap(async(req,res)=>{
 const type=req.query.type==='series'?'tv':req.query.type==='movie'?'movie':null;if(!type)err(400,'Choose Movie or Series.');
 const data=await tmdb('search/'+type,{query:str(req.query.q,100),language:'en-US'});
 res.json({results:(data.results||[]).slice(0,20).map(x=>({id:x.id,title:x.title||x.name,year:(x.release_date||x.first_air_date||'').slice(0,4),poster_url:x.poster_path?'https://image.tmdb.org/t/p/w500'+x.poster_path:null}))});
}));
r.post('/api/admin/tmdb/import',wrap(async(req,res)=>{
 const kind=req.body?.kind;if(!['movie','series'].includes(kind))err(400,'Invalid kind.');
 const tid=req.body?.tmdb_url?tmdbId(req.body.tmdb_url,kind):num(req.body?.tmdb_id);
 const d=await tmdb((kind==='series'?'tv':'movie')+'/'+tid,{language:'en-US'});
 const name=str(d.title||d.name),key=slug(name)+'-'+tid;
 const year=Number((d.release_date||d.first_air_date||'').slice(0,4))||null;
 const genres=JSON.stringify((d.genres||[]).map(x=>x.name));
 const poster=d.poster_path?'https://image.tmdb.org/t/p/w780'+d.poster_path:null;
 const backdrop=d.backdrop_path?'https://image.tmdb.org/t/p/w1280'+d.backdrop_path:null;
 const runtime=d.runtime||d.episode_run_time?.[0]||null;
 const targetId=req.body?.target_title_id?num(req.body.target_title_id):null;
 let existing=[];
 if(targetId){
  existing=await sql('SELECT id,slug,kind,tmdb_id,status FROM titles WHERE id=? LIMIT 1',[targetId]);
  if(!existing.length)err(404,'Selected draft no longer exists. Refresh the catalog.');
  const row=existing[0];
  if(row.kind!==kind||row.status!=='draft')err(409,'Choose a draft of the same Movie/Series type.');
  if(row.tmdb_id&&Number(row.tmdb_id)!==tid)err(409,'Selected draft is already linked to another TMDB title.');
  const duplicate=await sql('SELECT id FROM titles WHERE kind=? AND tmdb_id=? AND id<>? LIMIT 1',[kind,tid,row.id]);
  if(duplicate.length)err(409,'This TMDB title is already imported. Select its existing catalog entry.');
 }else{
  existing=await sql('SELECT id,slug,kind,tmdb_id,status FROM titles WHERE kind=? AND tmdb_id=? LIMIT 1',[kind,tid]);
  if(!existing.length){
   // Reuse a single exact-name legacy draft even if its year was omitted.
   const candidates=await sql('SELECT id,slug,kind,tmdb_id,status FROM titles WHERE kind=? AND tmdb_id IS NULL AND LOWER(title)=LOWER(?) AND (release_year=? OR release_year IS NULL) AND status=? LIMIT 2',[kind,name,year,'draft']);
   if(candidates.length===1)existing=candidates;
  }
 }
 let id,created=false;
 if(existing.length){
  id=existing[0].id;
  // Preserve its slug, publication status, linked media and existing season/episode rows.
  await sql('UPDATE titles SET tmdb_id=?,title=?,synopsis=?,release_year=?,genres=?,poster_url=?,backdrop_url=?,runtime_minutes=? WHERE id=?',
   [tid,name,d.overview||null,year,genres,poster,backdrop,runtime,id]);
 }else{
  const result=await sql("INSERT INTO titles(slug,kind,tmdb_id,title,synopsis,release_year,genres,poster_url,backdrop_url,runtime_minutes,status) VALUES(?,?,?,?,?,?,?,?,?,?,'draft')",
   [key,kind,tid,name,d.overview||null,year,genres,poster,backdrop,runtime]);
  id=result.insertId;created=true;
 }
 if(kind==='series'){
  const seasons=await sql('SELECT season_number FROM seasons WHERE title_id=?',[id]);
  const known=new Set(seasons.map(x=>Number(x.season_number)));
  for(const season of (d.seasons||[]).filter(x=>x.season_number>0).slice(0,30)){
   if(known.has(season.season_number))continue;
   await sql('INSERT INTO seasons(title_id,season_number,name,synopsis) VALUES(?,?,?,?)',[id,season.season_number,season.name||'Season '+season.season_number,season.overview||null]);
  }
 }
 res.status(created?201:200).json({id,slug:existing[0]?.slug||key,created,updated:!created});
}));
r.post('/api/admin/tmdb/import-episodes',wrap(async(req,res)=>{
 const sid=num(req.body?.season_id),rows=await sql("SELECT s.season_number,t.tmdb_id FROM seasons s JOIN titles t ON t.id=s.title_id WHERE s.id=? AND t.kind='series'",[sid]);
 if(!rows.length||!rows[0].tmdb_id)err(400,'TMDB-linked season required.');
 const d=await tmdb('tv/'+rows[0].tmdb_id+'/season/'+rows[0].season_number,{language:'en-US'});
 let count=0;for(const e of (d.episodes||[]).slice(0,100)){
 await sql('INSERT INTO episodes(season_id,episode_number,title,synopsis,still_url,runtime_minutes) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),synopsis=VALUES(synopsis),still_url=VALUES(still_url),runtime_minutes=VALUES(runtime_minutes)',
 [sid,e.episode_number,e.name||'Episode '+e.episode_number,e.overview||null,e.still_path?'https://image.tmdb.org/t/p/w500'+e.still_path:null,e.runtime||null]);count++;}
 res.json({imported:count});
}));
// Public catalog metadata is separate from source discovery. Discovery is admin-only.
async function sourceJSON(address){
 const response=await fetch(address,{headers:{Accept:'application/json','User-Agent':'SCREENROOM/1.0 (authorized media discovery)'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)err(502,'Provider search is currently unavailable.');
 return response.json();
}
r.get('/api/admin/sources/search',wrap(async(req,res)=>{
 const provider=str(req.query.provider,45),q=str(req.query.q,100);
 let results=[];
 if(provider==='internet_archive'){
  const u=new URL('https://archive.org/advancedsearch.php');
  u.searchParams.set('q','mediatype:movies AND title:('+q.replace(/[^\p{L}\p{N}\s-]/gu,' ').trim()+')');
  for(const field of ['identifier','title','licenseurl'])u.searchParams.append('fl[]',field);u.searchParams.set('rows','12');u.searchParams.set('output','json');
  const d=await sourceJSON(u);
  results=(d.response?.docs||[]).map(x=>({id:x.identifier,title:x.title,license:x.licenseurl||'Check item rights',page:'https://archive.org/details/'+encodeURIComponent(x.identifier)}));
 }else if(provider==='wikimedia_commons'){
  const u=new URL('https://commons.wikimedia.org/w/api.php');
  for(const [k,v] of Object.entries({action:'query',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|mime|extmetadata',format:'json',formatversion:'2'}))u.searchParams.set(k,v);
  const d=await sourceJSON(u);
  results=(d.query?.pages||[]).filter(x=>x.imageinfo?.[0]?.mime==='video/mp4').map(x=>({id:x.title,title:x.title.replace(/^File:/,''),license:x.imageinfo[0].extmetadata?.LicenseShortName?.value||'Review license',page:x.imageinfo[0].descriptionurl,url:x.imageinfo[0].url,format:'mp4'}));
 }else if(provider==='nasa_library'){
  const u=new URL('https://images-api.nasa.gov/search');u.searchParams.set('q',q);u.searchParams.set('media_type','video');u.searchParams.set('page_size','12');
  const d=await sourceJSON(u);
  results=(d.collection?.items||[]).map(x=>({id:x.data?.[0]?.nasa_id,title:x.data?.[0]?.title,license:'Review NASA usage guidelines and third-party rights',page:'https://images.nasa.gov/details-'+encodeURIComponent(x.data?.[0]?.nasa_id||'')}));
 }else err(400,'This provider does not offer automatic catalog search.');
 res.json({results:results.filter(x=>x.id&&x.title).slice(0,12)});
}));
r.get('/api/admin/sources/resolve',wrap(async(req,res)=>{
 const provider=str(req.query.provider,45),id=str(req.query.id,250);
 if(provider==='internet_archive'){
  if(!/^[a-zA-Z0-9_.-]{1,150}$/.test(id))err(400,'Invalid Internet Archive item ID.');
  const d=await sourceJSON('https://archive.org/metadata/'+encodeURIComponent(id));
  const file=(d.files||[]).find(x=>/\.mp4$/i.test(x.name||'')&&x.source==='original')||(d.files||[]).find(x=>/\.mp4$/i.test(x.name||''));
  if(!file)err(404,'No direct MP4 file found for this item.');
  const url='https://archive.org/download/'+encodeURIComponent(id)+'/'+file.name.split('/').map(encodeURIComponent).join('/');
  return res.json({url:mediaURL(url,provider),format:'mp4',license:d.metadata?.licenseurl||'Check item details and usage rights',page:'https://archive.org/details/'+encodeURIComponent(id)});
 }
 if(provider==='nasa_library'){
  if(!/^[a-zA-Z0-9_.-]{1,150}$/.test(id))err(400,'Invalid NASA media ID.');
  const d=await sourceJSON('https://images-api.nasa.gov/asset/'+encodeURIComponent(id));
  const file=(d.collection?.items||[]).map(x=>x.href).find(x=>/\.mp4(?:\?|$)/i.test(x||''));
  if(!file)err(404,'No direct MP4 available for this NASA item.');
  return res.json({url:mediaURL(file,provider),format:'mp4',license:'Review NASA usage guidelines'});
 }
 err(400,'Select a Wikimedia result directly or use a searchable provider.');
}));
app.use(base,r);app.use(r);
app.use((req,res)=>res.status(404).json({error:'Not found.'}));
app.use((e,req,res,next)=>{
 if(e.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Entry already exists.'});
 if(e.code==='ER_NO_REFERENCED_ROW_2')return res.status(400).json({error:'Parent record not found.'});
 const status=e.status||500;
 if(status>=500)console.error('SCREENROOM:',e.code||e.message);
 res.status(status).json({error:status>=500?'Service temporarily unavailable.':e.message});
});
if(require.main===module)app.listen(Number(env.PORT||3000),()=>console.log('SCREENROOM API ready'));
module.exports={app,slug,tmdbId,mediaURL};
