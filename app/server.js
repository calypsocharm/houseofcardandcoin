const express=require('express'),session=require('express-session'),bcrypt=require('bcryptjs'),multer=require('multer'),path=require('path'),fs=require('fs');
const app=express();const PORT=process.env.PORT||3000;
// Set GUILD_INVITE_CODE='' (blank) to open registration to anyone — that is the
// current setting. Put a code back in the env var to require one again; no code
// change needed either way.
const INVITE=process.env.GUILD_INVITE_CODE===undefined?'COIN-2026':process.env.GUILD_INVITE_CODE;
const DATA=path.join(__dirname,'data','guild.json');
let db={users:[],bunks:[],items:[],claims:[],seq:1};
try{db=JSON.parse(fs.readFileSync(DATA,'utf8'));}catch{}
const save=()=>fs.writeFileSync(DATA,JSON.stringify(db,null,2));
if(!Array.isArray(db.announcements))db.announcements=[];
if(!Array.isArray(db.patrons))db.patrons=[];
if(!Array.isArray(db.threads))db.threads=[];
if(!Array.isArray(db.polls))db.polls=[];
if(!Array.isArray(db.notices))db.notices=[];
if(!Array.isArray(db.whispers))db.whispers=[];
if(!Array.isArray(db.waitlist))db.waitlist=[];
const nid=()=>{db.seq++;save();return db.seq;};
const NIGHTS=['Friday, Oct 9','Saturday, Oct 10','Sunday, Oct 11'];
const BUNKS=[1,2,3];
const CLASSES=['Dealer','Reader','Broker','Sellsword'];
// A Pledge has made an account but has not been accepted into the guild yet.
// Pledge outranks every other label — you are not in the guild, so no title or
// faire count applies until the Guild Leader promotes you.
// "Pledge" now occupies the not-yet-in-the-guild slot that "Pledgeling" used to,
// so an accepted member with no faires yet is a Guildmate, not a Pledgeling —
// otherwise the two near-identical words both mean "new" and nobody can tell
// who is actually in the House.
function rank(u){if(u.pledge)return 'Pledge';if(u.title)return u.title;const n=u.faires||0;if(n>=6)return 'Elder';if(n>=3)return 'Veteran';return 'Guildmate';}
// Grandfather anyone who was already on the roster before pledges existed —
// they are full guildmates, not pledges. Runs once; new users set it explicitly.
(function(){let changed=false;db.users.forEach(u=>{if(u.pledge===undefined){u.pledge=false;changed=true;}});if(changed)save();})();
app.set('view engine','ejs');app.set('views',path.join(__dirname,'views'));
// Cache-buster for the stylesheet. Assets are cached for a day now, so without
// this a CSS change does not reach anyone who has already visited — the page
// renders with stale rules and unstyled images blow up to full size.
try{ app.locals.cssv = String(Math.floor(fs.statSync(path.join(__dirname,'..','assets','css','style.css')).mtimeMs)); }
catch(e){ app.locals.cssv = String(Date.now()); }
app.use(express.urlencoded({extended:true}));app.use(express.json());
// Sessions were held in memory, so every pm2 restart signed everyone out — and
// the watchdog restarts this app on its own. They live on disk now and survive
// a restart, a deploy and a reboot.
const FileStore=require('session-file-store')(session);
app.use(session({
  store:new FileStore({
    path:path.join(__dirname,'sessions'),
    ttl:7*86400,            // a week, matching the cookie
    retries:0,
    reapInterval:3600,      // sweep expired sessions hourly
    logFn:function(){}      // the store is chatty by default
  }),
  secret:process.env.SESSION_SECRET||'guild-faire-secret-change',
  resave:false,
  saveUninitialized:false,
  cookie:{maxAge:7*864e5,httpOnly:true,sameSite:'lax',secure:false} // nginx terminates TLS
}));
// The header decides whether you are signed in from res.locals.u — but only the
// Guild Hall was passing it, so every other page (tavern, guild, threads…) drew
// "Guild Login" even while you were signed in. Set it once, for everyone.
app.use(function(req,res,next){
  res.locals.u = req.session.uid ? (db.users.find(function(x){return x.id===req.session.uid;})||null) : null;
  res.locals.patron = (!res.locals.u && req.session.pid) ? (db.patrons.find(function(x){return x.id===req.session.pid;})||null) : null;
  next();
});
app.use('/assets',express.static(path.join(__dirname,'..','assets')));
// multer stores uploads under random names with no extension, so express.static
// serves them as application/octet-stream — and with X-Content-Type-Options:
// nosniff set at the nginx level, browsers then refuse to draw them at all.
// Every avatar is normalised to JPEG by shrinkAvatar, so say so explicitly.
app.use('/uploads',express.static(path.join(__dirname,'uploads'),{
  setHeaders:function(res){ res.setHeader('Content-Type','image/jpeg'); }
}));
app.get('/guild.html',(req,res)=>{const members=db.users.map(function(m){const bunks=db.bunks.filter(function(b){return b.userId===m.id;}).sort(function(a,b){return a.night<b.night?-1:1;}).map(function(b){return b.night+' \u00b7 Bunk '+b.bunk;});return{name:m.name,avatar:m.avatar,class:m.class,rank:rank(m),pledge:!!m.pledge,faires:m.faires||0,title:m.title||'',role:m.role||'',rsvp:!!m.rsvp,bunks:bunks};}).sort(function(a,b){const k=function(x){if(x.title==='Guild Leader')return 0;if(x.role==='leader'||x.title==='Guild Elder')return 1;if(x.pledge)return 3;return 2;};const ka=k(a),kb=k(b);if(ka!==kb)return ka-kb;return (b.faires||0)-(a.faires||0);});const bunkBoard=NIGHTS.map(function(n){return{night:n,bunks:BUNKS.map(function(b){const o=db.bunks.find(function(x){return x.night===n&&x.bunk===b;});return{bunk:b,taken:!!o,who:o?db.users.find(function(y){return y.id===o.userId;}):null};})};});res.render('guild',{members:members,bunkBoard:bunkBoard,comingCount:db.users.filter(function(x){return x.rsvp;}).length});});
app.post('/pigeon',async(req,res)=>{const{Name,Email,Reason,Message}=req.body||{};const ep=process.env.FORMSPREE_ENDPOINT;if(!ep){console.log('FORMSPREE_ENDPOINT not set; pigeon dropped');return res.redirect('/pigeon.html?e=1');}try{const r=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({Name:Name||'',Email:Email||'',Reason:Reason||'',Message:Message||'',_subject:'New pigeon — House of Card and Coin',_replyto:Email||''})});if(!r.ok)throw new Error('formspree '+r.status);res.redirect('/pigeon.html?sent=1');}catch(e){console.log('pigeon forward error',e.message);res.redirect('/pigeon.html?e=1');}});
// The static mount below is rooted at /var/www/hocc, which also contains app/ and
// content/. Without this guard, /app/data/guild.json (every member's record and
// bcrypt hash), /app/server.js, /app/seed.js, and the build scripts are all
// publicly downloadable. Block them before static gets a chance to serve them.
const BLOCKED=/^\/(app|content)(\/|$)|^\/(build|serve)\.js$|^\/\./i;
app.use((req,res,next)=>BLOCKED.test(req.path)?res.status(404).send('Not found'):next());
app.use(express.static(path.join(__dirname,'..'))); // marketing site (index.html etc.)
const sharp=require('sharp');
// Only images, and only ones we can actually process. Without a filter any file
// type at all could be dropped into /uploads.
const up=multer({
  dest:path.join(__dirname,'uploads'),
  limits:{fileSize:25e6},
  fileFilter:function(req,file,cb){
    if(/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i.test(file.mimetype))return cb(null,true);
    cb(null,false); // silently ignore, the route just sees no req.file
  }
});
// Squash whatever anyone uploads down to a sane avatar. A phone photo arrives at
// several megabytes and gets drawn as a 34px circle; this makes that ~30 KB.
// .rotate() honours EXIF orientation so phone shots aren't sideways.
function shrinkAvatar(req,res,next){
  if(!req.file)return next();
  var p=req.file.path;
  var input;
  // Read through fs rather than handing sharp the path: multer has only just
  // finished writing it, and opening it again directly fails on Windows.
  try{ input=fs.readFileSync(p); }
  catch(e){ console.log('avatar read failed, keeping original:',e.message); return next(); }
  sharp(input).rotate()
    .resize(512,512,{fit:'cover',position:sharp.strategy.attention})
    .jpeg({quality:82,mozjpeg:true})
    .toBuffer()
    .then(function(buf){
      fs.writeFileSync(p,buf);
      req.file.size=buf.length;
      next();
    })
    .catch(function(e){ console.log('avatar resize failed, keeping original:',e.message); next(); });
}
function au(req,res,next){if(req.session.uid)return next();res.redirect('/members/login');}
// Bunks are for sworn guildmates. A Pledge has an account but has not been
// accepted into the House yet, so the camp is not theirs to book.
function sworn(req,res,next){
  const u=cur(req);
  if(!u)return res.redirect('/members/login');
  if(u.pledge)return res.redirect('/members?e='+encodeURIComponent('Bunks are for sworn guildmates. Ask the Guild Leader to accept your pledge, and the camp is yours.')+'#bunks');
  next();
}
function al(req,res,next){const u=db.users.find(x=>x.id===req.session.uid);if(u&&u.role==='leader')return next();res.status(403).send('Leader only');}
function cur(req){return db.users.find(x=>x.id===req.session.uid);}
// seed bring items once
if(!db.items.length){[
['Extra camp chairs',6],['Firewood for the fire pit',8],['Period-accurate decor',4],['Cooler / ice',2],['Propane tanks',3],['String lights / lanterns',4],['Paper goods & utensils',2],['Trash bags',3],['Marshmallows & s\'more fixings',2],['BBQ grill / charcoal',1]
].forEach(x=>db.items.push({id:nid(),name:x[0],need:x[1]}));save();}
// Invite codes are compared loosely — trimmed, spaces stripped, case-insensitive.
// Phone keyboards autocapitalise and add trailing spaces, which silently rejected
// guildies who had typed the right code.
const normCode=s=>String(s||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const INVITE_REQUIRED=normCode(INVITE)!=='';
// The static marketing pages (index.html, camp.html…) have a header baked in at
// build time, so they cannot know who you are. They ask here instead.
app.get('/api/me',(req,res)=>{
  const u=req.session.uid?db.users.find(x=>x.id===req.session.uid):null;
  const p=(!u&&req.session.pid)?db.patrons.find(x=>x.id===req.session.pid):null;
  res.set('Cache-Control','no-store');
  if(u)return res.json({signedIn:true,kind:'member',name:u.name});
  if(p&&!p.banned)return res.json({signedIn:true,kind:'patron',name:p.name});
  res.json({signedIn:false});
});
app.get('/members/login',(req,res)=>res.render('login',{err:req.query.e||'',code:req.query.code||'',needCode:INVITE_REQUIRED}));
// /join is the share link. If an invite code is required, ?code=XXXX pre-fills it.
app.get('/join',(req,res)=>res.render('login',{err:req.query.e||'',code:req.query.code||'',needCode:INVITE_REQUIRED}));
app.post('/members/register',up.single('avatar'),shrinkAvatar,(req,res)=>{const{name,email,password,invite}=req.body;
  // honeypot: real people never fill this hidden field, bots do
  if(req.body.website)return res.redirect('/members/login');
  // keep a valid code in the URL on failure so they don't have to re-enter it
  const keep=INVITE_REQUIRED&&normCode(invite)===normCode(INVITE)?'&code='+encodeURIComponent(invite):'';
  if(INVITE_REQUIRED&&normCode(invite)!==normCode(INVITE))return res.redirect('/members/login?e='+encodeURIComponent('That invite code was not recognised — ask the Guild Leader'));
  if(!email||!password)return res.redirect('/members/login?e='+encodeURIComponent('Email and password are required')+keep);
  if(db.users.find(u=>String(u.email||'').toLowerCase()===String(email).toLowerCase()))return res.redirect('/members/login?e='+encodeURIComponent('That email is already registered')+keep);
  const first=db.users.length===0;
  // Signup asks only for email + password. Everything else — display name,
  // avatar, class — is set afterwards in the Guild Hall, so seed a readable
  // placeholder name from the email rather than leaving the roster blank.
  const display=String(name||'').trim()||String(email).split('@')[0].replace(/[._-]+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase())||'New Guildmate';
  // Signing up does not make you a guildmate — you join as a Pledge until the
  // Guild Leader promotes you. The very first account is the leader, not a pledge.
  const u={id:nid(),name:display,email:String(email).toLowerCase().trim(),passhash:bcrypt.hashSync(password,10),avatar:req.file?('/uploads/'+req.file.filename):'',class:'',faires:0,role:first?'leader':'member',pledge:!first};
  db.users.push(u);save();req.session.uid=u.id;res.redirect('/members');});
app.post('/members/login',(req,res)=>{const{email,password}=req.body;const u=db.users.find(x=>x.email===email.toLowerCase());
  if(!u||!bcrypt.compareSync(password,u.passhash))return res.redirect('/members/login?e='+encodeURIComponent('Bad email or password'));
  req.session.uid=u.id;res.redirect('/members');});
app.post('/members/logout',(req,res)=>{req.session.destroy(()=>res.redirect('/'));});
app.get('/members',au,(req,res)=>{
  const u=cur(req);
  const bunkBoard=NIGHTS.map(n=>{
    const bunks=BUNKS.map(b=>{const o=db.bunks.find(x=>x.night===n&&x.bunk===b);return{bunk:b,taken:!!o,who:o?db.users.find(y=>y.id===o.userId):null,mine:o&&o.userId===u.id};});
    const queue=db.waitlist.filter(w=>w.night===n).sort((a,b)=>a.ts-b.ts);
    const myIdx=queue.findIndex(w=>w.userId===u.id);
    return{
      night:n, bunks:bunks,
      open:bunks.filter(x=>!x.taken).length,
      full:bunks.every(x=>x.taken),
      iHaveOne:bunks.some(x=>x.mine),
      waiting:queue.length,
      myPlace:myIdx<0?0:myIdx+1,
      queueNames:queue.map(w=>{const p=db.users.find(x=>x.id===w.userId);return p?p.name:'?';})
    };
  });
  const bunksLeft=NIGHTS.length*BUNKS.length-db.bunks.length;
  const items=db.items.map(it=>{const cl=db.claims.filter(c=>c.itemId===it.id);const claimed=cl.reduce((s,c)=>s+c.qty,0);return{...it,claimed,remaining:Math.max(0,it.need-claimed),claims:cl.map(c=>({qty:c.qty,who:db.users.find(y=>y.id===c.userId)})),mine:cl.find(c=>c.userId===u.id)};});
  res.render('hall',{u,rank:rank(u),classes:CLASSES,bunkBoard,bunksLeft,items,leader:u.role==='leader',users:u.role==='leader'?db.users.map(function(m){return{name:m.name,class:m.class,faires:m.faires,rank:rank(m),pledge:!!m.pledge,leader:m.role==='leader',title:m.title||'',avatar:m.avatar,id:m.id,contactEmail:m.contactEmail||'',phone:m.phone||'',bunks:db.bunks.filter(function(b){return b.userId===m.id}).map(function(b){return b.night+' \u00b7 Bunk '+b.bunk;})};}):[],announcements:db.announcements,outreach:{emails:db.users.filter(function(x){return x.contactEmail;}).map(function(x){return x.contactEmail;}),phones:db.users.filter(function(x){return x.phone;}).map(function(x){return x.phone;})},invite:INVITE,err:req.query.e||"",q:req.query});
});
app.post('/members/profile',au,up.single('avatar'),shrinkAvatar,(req,res)=>{const u=cur(req);if(!u)return res.redirect('/members/login');
  if(String(req.body.name||'').trim())u.name=String(req.body.name).trim();
  // faires is deliberately NOT editable here — it drives rank, so only the Guild
  // Leader sets it via /members/admin/fares. Otherwise members self-promote.
  if(req.body.class)u.class=req.body.class;
  u.contactEmail=(req.body.contactEmail||'').trim();u.phone=(req.body.phone||'').trim();
  // Replacing an avatar used to strand the old file in /uploads forever.
  if(req.file&&u.avatar&&u.avatar.startsWith('/uploads/')){
    try{ fs.unlinkSync(path.join(__dirname,u.avatar.replace('/uploads/','uploads/'))); }catch(e){}
  }
  if(req.file)u.avatar='/uploads/'+req.file.filename;save();res.redirect('/members#profile');});
app.post('/members/bunk',au,sworn,(req,res)=>{const u=cur(req);const{night,bunk}=req.body;b=parseInt(bunk);
  if(!NIGHTS.includes(night)||!BUNKS.includes(b))return res.redirect('/members#bunks');
  if(db.bunks.find(x=>x.night===night&&x.bunk===b))return res.redirect('/members#bunks?e=taken');
  // limit a member to one bunk per night
  db.bunks=db.bunks.filter(x=>!(x.night===night&&x.userId===u.id));
  db.bunks.push({id:nid(),night,bunk:b,userId:u.id});save();res.redirect('/members#bunks');});
// Nine bunks for a growing roster, so a freed bunk should not sit idle waiting
// for someone to notice. Hand it straight to whoever has waited longest.
function fillFromWaitlist(night,bunk,exceptUserId){
  const queue=db.waitlist.filter(w=>w.night===night).sort((a,b)=>a.ts-b.ts);
  for(const w of queue){
    if(w.userId===exceptUserId)continue;              // don't hand it back to the releaser
    const cand=db.users.find(x=>x.id===w.userId);
    if(!cand||cand.pledge){                            // no longer eligible
      db.waitlist=db.waitlist.filter(x=>x.id!==w.id); continue;
    }
    if(db.bunks.find(x=>x.night===night&&x.userId===cand.id)){ // already bunked that night
      db.waitlist=db.waitlist.filter(x=>x.id!==w.id); continue;
    }
    db.bunks.push({id:nid(),night:night,bunk:bunk,userId:cand.id});
    db.waitlist=db.waitlist.filter(x=>x.id!==w.id);
    notify('member',cand.id,'A bunk opened up — '+night+', bunk '+bunk+' is yours. Release it in the Guild Hall if your plans have changed.');
    return cand;
  }
  return null;
}
// Deliberately NOT behind `sworn`: releasing gives a bunk back. A pledge who
// claimed one before the rule existed must still be able to let it go, or the
// bunk is stuck forever.
app.post('/members/bunk/release',au,(req,res)=>{
  const u=cur(req);
  const night=req.body.night, bunk=parseInt(req.body.bunk);
  const had=db.bunks.find(x=>x.night===night&&x.bunk===bunk&&x.userId===u.id);
  db.bunks=db.bunks.filter(x=>!(x.night===night&&x.bunk===bunk&&x.userId===u.id));
  if(had)fillFromWaitlist(night,bunk,u.id);
  save();res.redirect('/members#bunks');
});
// Waiting for a bunk is only worth anything if you could hold one.
app.post('/members/waitlist',au,sworn,(req,res)=>{
  const u=cur(req);const night=req.body.night;
  if(!NIGHTS.includes(night))return res.redirect('/members#bunks');
  if(db.bunks.find(x=>x.night===night&&x.userId===u.id))return res.redirect('/members#bunks');
  if(!db.waitlist.find(w=>w.night===night&&w.userId===u.id))
    db.waitlist.push({id:nid(),night:night,userId:u.id,ts:Date.now()});
  save();res.redirect('/members#bunks');
});
app.post('/members/waitlist/leave',au,(req,res)=>{
  const u=cur(req);
  db.waitlist=db.waitlist.filter(w=>!(w.night===req.body.night&&w.userId===u.id));
  save();res.redirect('/members#bunks');
});
app.post('/members/bring/claim',au,(req,res)=>{const u=cur(req);const itemId=parseInt(req.body.itemId);const it=db.items.find(x=>x.id===itemId);if(!it)return res.redirect('/members#bring');
  const qty=Math.max(1,parseInt(req.body.qty||1));const existing=db.claims.find(c=>c.itemId===itemId&&c.userId===u.id);
  if(existing)existing.qty=qty;else db.claims.push({id:nid(),itemId,userId:u.id,qty});save();res.redirect('/members#bring');});
app.post('/members/bring/unclaim',au,(req,res)=>{const u=cur(req);const itemId=parseInt(req.body.itemId);db.claims=db.claims.filter(c=>!(c.itemId===itemId&&c.userId===u.id));save();res.redirect('/members#bring');});
app.post('/members/bring/add',au,al,(req,res)=>{const{name,need}=req.body;if(!name)return res.redirect('/members#bring');db.items.push({id:nid(),name,need:Math.max(1,parseInt(need||1))});save();res.redirect('/members#bring');});
app.post('/members/bring/remove',au,al,(req,res)=>{const id=parseInt(req.body.itemId);db.items=db.items.filter(x=>x.id!==id);db.claims=db.claims.filter(c=>c.itemId!==id);save();res.redirect('/members#bring');});
app.post('/members/password',au,(req,res)=>{const u=cur(req);if(!u)return res.redirect('/members/login');const curp=req.body.current||'',np=(req.body.new||'').trim();if(!bcrypt.compareSync(curp,u.passhash))return res.redirect('/members?pw=bad#profile');if(np.length<6)return res.redirect('/members?pw=short#profile');u.passhash=bcrypt.hashSync(np,10);save();res.redirect('/members?pw=ok#profile');});// Accept a Pledge into the guild (or put someone back to Pledge by mistake-fix).
app.post('/members/admin/promote',al,(req,res)=>{const u=db.users.find(x=>x.id===parseInt(req.body.id));if(u){u.pledge=false;save();}res.redirect('/members#admin');});
app.post('/members/admin/demote',al,(req,res)=>{const u=db.users.find(x=>x.id===parseInt(req.body.id));if(u&&u.role!=='leader'){u.pledge=true;save();}res.redirect('/members#admin');});
app.post('/members/admin/fares',al,(req,res)=>{const id=parseInt(req.body.id);const u=db.users.find(x=>x.id===id);if(!u)return res.redirect('/members#admin');u.faires=Math.max(0,parseInt(req.body.faires||0));save();res.redirect('/members#admin');});app.post('/members/admin/title',al,(req,res)=>{const id=parseInt(req.body.id);const u=db.users.find(x=>x.id===id);if(!u)return res.redirect('/members#admin');u.title=(req.body.title||'').trim();save();res.redirect('/members#admin');});app.post('/members/admin/resetpw',al,(req,res)=>{const id=parseInt(req.body.id);const u=db.users.find(x=>x.id===id);if(!u)return res.redirect('/members#admin');const np=(req.body.password||'').trim();if(np.length<4)return res.redirect('/members?e=pwshort#admin');u.passhash=bcrypt.hashSync(np,10);save();res.redirect('/members?pwreset=1#admin');});app.post('/members/admin/add',al,(req,res)=>{const{name,email,password,faires,title}=req.body;const e=(email||'').toLowerCase().trim();if(!name||!e||!(password||'').trim())return res.redirect('/members?e=addreq#admin');if(db.users.find(x=>x.email===e))return res.redirect('/members?e=dup#admin');db.users.push({id:nid(),name:name.trim(),email:e,passhash:bcrypt.hashSync(password,10),avatar:'',class:'',faires:Math.max(0,parseInt(faires||0)),role:'member',title:(title||'').trim(),contactEmail:'',phone:''});save();res.redirect('/members?added=1#admin');});app.post('/members/admin/remove',al,(req,res)=>{const id=parseInt(req.body.id);const me=db.users.find(x=>x.id===req.session.uid);if(me&&me.id===id)return res.redirect('/members?e=self#admin');const u=db.users.find(x=>x.id===id);if(!u||u.role==='leader')return res.redirect('/members?e=nodel#admin');db.users=db.users.filter(x=>x.id!==id);db.bunks=db.bunks.filter(b=>b.userId!==id);db.claims=db.claims.filter(c=>c.userId!==id);save();res.redirect('/members?removed=1#admin');});app.get('/api/announcements',(req,res)=>res.json((db.announcements||[]).slice().reverse()));app.post('/members/admin/announce',al,(req,res)=>{const t=(req.body.text||'').trim();if(!t)return res.redirect('/members?e=notext#admin');db.announcements.push({id:nid(),text:t,ts:Date.now()});save();res.redirect('/members?ann=1#admin');});app.post('/members/admin/announce/remove',al,(req,res)=>{const id=parseInt(req.body.id);db.announcements=db.announcements.filter(function(a){return a.id!==id;});save();res.redirect('/members#admin');});app.post('/members/rsvp',au,(req,res)=>{const u=cur(req);if(!u)return res.redirect('/members/login');u.rsvp=!u.rsvp;save();res.redirect('/members#rsvp');});// ===== The Tavern: public notice board + polls =====
const BOARDCATS=['General','Rides & Lodging','Trade & Barter',"Reader's Circle",'Camp Talk'];
function ident(req){
  if(req.session.uid){const u=db.users.find(x=>x.id===req.session.uid);if(u)return{t:'member',id:u.id,name:u.name,avatar:u.avatar,leader:u.role==='leader'};}
  if(req.session.pid){const p=db.patrons.find(x=>x.id===req.session.pid);if(p&&!p.banned)return{t:'patron',id:p.id,name:p.name,avatar:p.avatar,leader:false};}
  return null;
}
function canPost(req,res,next){if(ident(req))return next();res.redirect('/tavern?e='+encodeURIComponent('Claim a seat to post'));}
function leaderOnly(req,res,next){const i=ident(req);if(i&&i.leader)return next();res.status(403).send('Leader only');}
app.get('/tavern',(req,res)=>res.render('tavern',{i:ident(req),err:req.query.e||'',q:req.query}));
app.post('/tavern/register',up.single('avatar'),shrinkAvatar,(req,res)=>{
  const name=(req.body.name||'').trim(),email=(req.body.email||'').toLowerCase().trim(),password=(req.body.password||'').trim();
  if(!name||!email||password.length<6)return res.redirect('/tavern?e='+encodeURIComponent('Name, email, and a 6+ char password are required'));
  if(db.patrons.find(p=>p.email===email))return res.redirect('/tavern?e='+encodeURIComponent('That email already has a seat'));
  const p={id:nid(),name,email,passhash:bcrypt.hashSync(password,10),avatar:req.file?('/uploads/'+req.file.filename):'',banned:false,created:Date.now()};
  db.patrons.push(p);save();req.session.pid=p.id;res.redirect('/board');
});
app.post('/tavern/login',(req,res)=>{
  const email=(req.body.email||'').toLowerCase().trim();const p=db.patrons.find(x=>x.email===email);
  if(!p||!bcrypt.compareSync(req.body.password||'',p.passhash))return res.redirect('/tavern?e='+encodeURIComponent('Bad email or password'));
  if(p.banned)return res.redirect('/tavern?e='+encodeURIComponent("You've been 86'd from the tavern"));
  req.session.pid=p.id;res.redirect('/board');
});
app.post('/tavern/logout',(req,res)=>{delete req.session.pid;res.redirect('/board');});
// Who has been in the tavern lately, and how recently anyone spoke. The room
// shows presence over time rather than pretending to be a live chat — with a
// guild this size it would usually be empty, and an empty "live" room reads
// worse than a quiet one.
function tavernFolk(){
  var acts=[];
  db.threads.forEach(function(t){
    acts.push({t:t.authorType,id:t.authorId,name:t.authorName,avatar:t.authorAvatar,ts:t.ts});
    (t.replies||[]).forEach(function(r){
      acts.push({t:r.authorType,id:r.authorId,name:r.authorName,avatar:r.authorAvatar,ts:r.ts});
    });
  });
  acts.sort(function(a,b){return b.ts-a.ts;});
  var seen={}, folk=[];
  acts.forEach(function(a){
    var k=a.t+':'+a.id;
    if(seen[k]||folk.length>=5)return;
    seen[k]=1; folk.push(a);
  });
  return {folk:folk, last:acts.length?acts[0].ts:0};
}
app.get('/board',(req,res)=>{
  const i=identRich(req);
  const today=dayKey();
  const pres=tavernFolk();
  // hours since anyone spoke — the hearth burns down as the room goes quiet
  const quietHrs=pres.last?Math.floor((Date.now()-pres.last)/3600000):999;
  // Most recently active conversation first, so opening the tavern shows what
  // just happened. Inside a conversation the opener still leads its replies.
  const lastTouch=function(t){
    return (t.replies&&t.replies.length)?Math.max(t.ts,t.replies[t.replies.length-1].ts):t.ts;
  };
  const threads=db.threads.slice().sort(function(a,b){return lastTouch(b)-lastTouch(a);});
  const polls=db.polls.slice().sort((a,b)=>b.ts-a.ts).map(function(p){const total=p.options.reduce((s,o)=>s+o.votes.length,0);const voted=i?!!p.options.find(o=>o.votes.find(v=>v.t===i.t&&v.id===i.id)):false;return Object.assign({},p,{total:total,voted:voted});});
  res.render('board',{i:i,threads:threads,polls:polls,cats:BOARDCATS,q:req.query,leader:!!(i&&i.leader),ration:{canDraw:!!(i&&i.lastRation!==today),card:i?i.lastCard:null},special:SPECIALS[dayOfYear()%SPECIALS.length],gates:countdown(),notices:i?(db.notices||[]).filter(function(n){return n.toT===i.t&&n.toId===i.id&&!n.read;}).length:0,folk:pres.folk,quietHrs:quietHrs});
});
app.post('/board/thread',canPost,(req,res)=>{
  const i=ident(req);const body=(req.body.body||'').trim();let category=(req.body.category||'General').trim();
  // The tavern is a conversation, not a forum — you type a message, nothing else.
  // A title is still stored so the thread page and notices keep working; if none
  // was given, take the opening words of the message.
  let title=(req.body.title||'').trim();
  if(!title&&body) title=body.length>52?body.slice(0,52).replace(/\s+\S*$/,'')+'…':body;
  if(!body)return res.redirect('/board?e='+encodeURIComponent('Say something first'));
  if(BOARDCATS.indexOf(category)<0)category='General';
  db.threads.push({id:nid(),category:category,title:title,body:body,authorType:i.t,authorId:i.id,authorName:i.name,authorAvatar:i.avatar,ts:Date.now(),replies:[]});
  save();res.redirect('/board');
});
app.get('/board/thread/:id',(req,res)=>{
  const t=db.threads.find(x=>x.id==req.params.id);if(!t)return res.redirect('/board');
  const i=ident(req);res.render('thread',{t:t,i:i,q:req.query,leader:!!(i&&i.leader)});
});
app.post('/board/thread/:id/reply',canPost,(req,res)=>{
  const t=db.threads.find(x=>x.id==req.params.id);if(!t)return res.redirect('/board');
  const i=ident(req);const body=(req.body.body||'').trim();if(!body)return res.redirect('/board/thread/'+t.id+'?e='+encodeURIComponent("Reply can't be empty"));
  t.replies.push({id:nid(),body:body,authorType:i.t,authorId:i.id,authorName:i.name,authorAvatar:i.avatar,ts:Date.now()});
  if(t.authorType!==i.t||t.authorId!==i.id)notify(t.authorType,t.authorId,i.name+' replied to your note \u201c'+t.title+'\u201d');
  save();res.redirect('/board/thread/'+t.id);
});
app.post('/board/poll',canPost,(req,res)=>{
  const i=ident(req);const question=(req.body.question||'').trim();
  const opts=(Array.isArray(req.body.options)?req.body.options:[]).map(o=>(o||'').trim()).filter(Boolean);
  if(!question||opts.length<2)return res.redirect('/board?e='+encodeURIComponent('A question and at least 2 options are required'));
  db.polls.push({id:nid(),question:question,authorType:i.t,authorId:i.id,authorName:i.name,authorAvatar:i.avatar,ts:Date.now(),options:opts.map((o,idx)=>({id:idx,text:o,votes:[]}))});
  save();res.redirect('/board#polls');
});
app.post('/board/poll/:id/vote',canPost,(req,res)=>{
  const p=db.polls.find(x=>x.id==req.params.id);if(!p)return res.redirect('/board');
  const i=ident(req);const optId=parseInt(req.body.option);
  p.options.forEach(o=>{o.votes=o.votes.filter(v=>!(v.t===i.t&&v.id===i.id));});
  const opt=p.options.find(o=>o.id===optId);if(opt)opt.votes.push({t:i.t,id:i.id});
  save();res.redirect('/board#polls');
});
app.post('/board/thread/:id/delete',leaderOnly,(req,res)=>{db.threads=db.threads.filter(x=>x.id!=req.params.id);save();res.redirect('/board');});
app.post('/board/reply/:id/delete',leaderOnly,(req,res)=>{db.threads.forEach(t=>{t.replies=t.replies.filter(r=>r.id!=req.params.id);});save();res.redirect('/board');});
app.post('/board/poll/:id/delete',leaderOnly,(req,res)=>{db.polls=db.polls.filter(x=>x.id!=req.params.id);save();res.redirect('/board');});
app.post('/board/patron/:id/ban',leaderOnly,(req,res)=>{const p=db.patrons.find(x=>x.id==req.params.id);if(p)p.banned=true;save();res.redirect('/board');});

// ===== Tavern: doubloons, daily ration, reactions, rogues' gallery =====
const RATIONS=[{n:'The Fool',f:'A new road opens at the faire. Pack light, travel bold.',c:2},{n:'The Magician',f:'Your wits are sharp today; a bargain tips your way.',c:3},{n:'The Star',f:'A quiet hope lights the camp tonight.',c:1},{n:'The Tower',f:'Expect a merry upheaval by the fire.',c:4},{n:'Wheel of Fortune',f:'The dice roll your way \u2014 a round of doubloons.',c:5},{n:'The Moon',f:'Whispers after dark prove useful.',c:2},{n:'The Sun',f:'Warm company and a full cup.',c:3},{n:'The Devil',f:'A wager tempts you; the house is watching.',c:1},{n:'The Hermit',f:'Solitude brings a tidy sum.',c:2},{n:'Death',f:'An old plan ends; a richer one begins.',c:3},{n:'The Empress',f:'Generosity returns to you threefold.',c:3},{n:'The Chariot',f:'Momentum is yours \u2014 claim the spot early.',c:2}];
const SPECIALS=['Tonight: Spiced Rum & a Tall Tale \u2014 tell us your first faire memory.','Tonight: Dice & Doubloons \u2014 what is the worst bargain you ever struck at faire?',"Tonight: The Hermit's Hour \u2014 share one piece of advice you would give a first-time camper.",'Tonight: Wheels & Whispers \u2014 who in the guild should be immortalized in a shanty, and why?','Tonight: A Round for the House \u2014 raise a toast to a guildmate in the replies.',"Tonight: The Reader's Lantern \u2014 what did the cards get right last faire?",'Tonight: Campfire Confessions \u2014 your most glorious faire mishap.','Tonight: Coin & Counsel \u2014 what do you still need to borrow or bring to camp?',"Tonight: The Sellsword's Tab \u2014 name the quest you would hire a mercenary for this faire.",'Tonight: Moonlit Wager \u2014 predict one thing that will absolutely go sideways this weekend.'];
function tavernTitle(coins){coins=coins||0;if(coins>=120)return 'Captain';if(coins>=70)return 'Quartermaster';if(coins>=40)return 'Bosun';if(coins>=18)return 'Deckhand';if(coins>=5)return 'Sailor';return 'Landlubber';}
function dayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dayOfYear(){const now=new Date();const start=new Date(now.getFullYear(),0,0);return Math.floor((now-start)/86400000);}
function identRich(req){const i=ident(req);if(!i)return null;const rec=i.t==='member'?db.users.find(function(x){return x.id===i.id;}):db.patrons.find(function(x){return x.id===i.id;});if(!rec)return i;return Object.assign({},i,{coins:rec.coins||0,lastRation:rec.lastRation||'',lastCard:rec.lastCard||null,streak:rec.streak||0});}
const REACTS=['\uD83C\uDF7A','\uD83E\uDE99','\uD83D\uDD25','\u2694\uFE0F'];
function doReact(req,res,host){var i=ident(req);var e=(req.body.emoji||'').trim();if(REACTS.indexOf(e)<0)return res.redirect(req.get('Referrer')||'/board');if(!host.reacts)host.reacts={};var arr=host.reacts[e]=host.reacts[e]||[];var idx=arr.findIndex(function(v){return v.t===i.t&&v.id===i.id;});if(idx>=0){arr.splice(idx,1);}else{arr.push({t:i.t,id:i.id});if(host.authorType!==i.t||host.authorId!==i.id)notify(host.authorType,host.authorId,i.name+' raised a '+e+' to '+(host.title?('your note \u201c'+host.title+'\u201d'):'your reply'));}save();res.redirect(req.get('Referrer')||'/board');}
app.post('/board/ration',canPost,(req,res)=>{var i=ident(req);var rec=i.t==='member'?db.users.find(function(x){return x.id===i.id;}):db.patrons.find(function(x){return x.id===i.id;});if(!rec)return res.redirect('/board');var today=dayKey();if(rec.lastRation===today)return res.redirect('/board#ration');var yest=yesterdayKey();var streak=(rec.lastRation===yest)?(rec.streak||0)+1:1;rec.streak=streak;var card=RATIONS[Math.floor(Math.random()*RATIONS.length)];var bonus=Math.min(streak,7);rec.coins=(rec.coins||0)+card.c+bonus;rec.lastRation=today;rec.lastCard={n:card.n,f:card.f,c:card.c,ts:Date.now(),streak:streak,bonus:bonus};save();res.redirect('/board#ration');});
app.post('/board/thread/:id/react',canPost,(req,res)=>{const t=db.threads.find(function(x){return x.id==req.params.id;});if(!t)return res.redirect('/board');doReact(req,res,t);});
app.post('/board/thread/:tid/reply/:rid/react',canPost,(req,res)=>{const t=db.threads.find(function(x){return x.id==req.params.tid;});if(!t)return res.redirect('/board');const r=t.replies.find(function(x){return x.id==req.params.rid;});if(!r)return res.redirect('/board/thread/'+t.id);doReact(req,res,r);});
app.get('/board/rogues',(req,res)=>{const i=identRich(req);const counts={};function bump(k){counts[k]=(counts[k]||0)+1;}db.threads.forEach(function(t){bump(t.authorType+':'+t.authorId);t.replies.forEach(function(r){bump(r.authorType+':'+r.authorId);});});const rogues=[];db.patrons.forEach(function(p){if(p.banned)return;rogues.push({t:'patron',id:p.id,name:p.name,avatar:p.avatar,coins:p.coins||0,posts:counts['patron:'+p.id]||0,title:tavernTitle(p.coins||0),leader:false,guild:'',streak:p.streak||0});});db.users.forEach(function(u){rogues.push({t:'member',id:u.id,name:u.name,avatar:u.avatar,coins:u.coins||0,posts:counts['member:'+u.id]||0,title:u.title||tavernTitle(u.coins||0),leader:u.role==='leader',guild:u.class||'',streak:u.streak||0});});rogues.sort(function(a,b){return b.coins-a.coins||b.posts-a.posts;});res.render('rogues',{i:i,rogues:rogues});});

// ===== Tavern: streak, whispers, notices =====
function yesterdayKey(){var d=new Date();d.setDate(d.getDate()-1);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function party(t,id){if(t==='member'){var u=db.users.find(function(x){return x.id===id;});return u?{name:u.name,avatar:u.avatar}:null;}var p=db.patrons.find(function(x){return x.id===id;});return p?{name:p.name,avatar:p.avatar}:null;}
function notify(toT,toId,text){if(!Array.isArray(db.notices))db.notices=[];db.notices.push({id:nid(),toT:toT,toId:toId,text:text,ts:Date.now(),read:false});if(db.notices.length>300)db.notices=db.notices.slice(-300);}
function countdown(){var open=new Date(2026,9,9,10,0,0),close=new Date(2026,9,11,22,0,0),now=new Date();if(now>=close)return{ended:true};if(now>=open)return{open:true};return{days:Math.ceil((open-now)/86400000)};}
app.get('/board/notices',canPost,(req,res)=>{var i=ident(req);var mine=(db.notices||[]).filter(function(n){return n.toT===i.t&&n.toId===i.id;}).sort(function(a,b){return b.ts-a.ts;});db.notices.forEach(function(n){if(n.toT===i.t&&n.toId===i.id)n.read=true;});save();res.render('notices',{i:i,notices:mine});});
app.get('/board/whispers',canPost,(req,res)=>{var i=ident(req);var mine=(db.whispers||[]).filter(function(w){return (w.fromT===i.t&&w.fromId===i.id)||(w.toT===i.t&&w.toId===i.id);});var conv={};mine.forEach(function(w){var other=(w.fromT===i.t&&w.fromId===i.id)?{t:w.toT,id:w.toId}:{t:w.fromT,id:w.fromId};var k=other.t+':'+other.id;if(!conv[k]||w.ts>conv[k].last.ts)conv[k]={other:other,last:w};});var list=Object.keys(conv).map(function(k){var c=conv[k];var p=party(c.other.t,c.other.id)||{name:'A stranger',avatar:''};var unread=mine.filter(function(w){return w.toT===i.t&&w.toId===i.id&&w.fromT===c.other.t&&w.fromId===c.other.id&&!w.read;}).length;return {other:c.other,last:c.last,name:p.name,avatar:p.avatar,unread:unread};}).sort(function(a,b){return b.last.ts-a.last.ts;});res.render('whispers',{i:i,conv:list});});
app.get('/board/whisper/:t/:id',canPost,(req,res)=>{var i=ident(req);var ot=req.params.t,oid=parseInt(req.params.id);if(ot===i.t&&oid===i.id)return res.redirect('/board/whispers');if(ot!=='member'&&ot!=='patron')return res.redirect('/board/whispers');var p=party(ot,oid);if(!p)return res.redirect('/board/whispers');var msgs=(db.whispers||[]).filter(function(w){return ((w.fromT===i.t&&w.fromId===i.id&&w.toT===ot&&w.toId===oid)||(w.fromT===ot&&w.fromId===oid&&w.toT===i.t&&w.toId===i.id));}).sort(function(a,b){return a.ts-b.ts;});db.whispers.forEach(function(w){if(w.fromT===ot&&w.fromId===oid&&w.toT===i.t&&w.toId===i.id)w.read=true;});save();res.render('whisper',{i:i,other:{t:ot,id:oid,name:p.name,avatar:p.avatar},msgs:msgs});});
app.post('/board/whisper/:t/:id',canPost,(req,res)=>{var i=ident(req);var ot=req.params.t,oid=parseInt(req.params.id);if(ot===i.t&&oid===i.id)return res.redirect('/board/whispers');var body=(req.body.body||'').trim();if(!body)return res.redirect('/board/whisper/'+ot+'/'+oid);if(!Array.isArray(db.whispers))db.whispers=[];db.whispers.push({id:nid(),fromT:i.t,fromId:i.id,toT:ot,toId:oid,body:body,ts:Date.now(),read:false});notify(ot,oid,i.name+' whispered you');save();res.redirect('/board/whisper/'+ot+'/'+oid);});

app.get('/health',(req,res)=>res.json({ok:true,t:Date.now()}));app.use((err,req,res,next)=>{if(err&&err.code==="LIMIT_FILE_SIZE")return res.redirect("/members?e="+encodeURIComponent("Image too large - max 25MB. Try a smaller photo."));if(err)return res.status(500).send("Error: "+(err.message||err));});
app.listen(PORT,()=>console.log('House of Card and Coin guild app on http://localhost:'+PORT));
