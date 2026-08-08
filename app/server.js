const express=require('express'),session=require('express-session'),bcrypt=require('bcryptjs'),multer=require('multer'),path=require('path'),fs=require('fs');
const app=express();
app.disable('x-powered-by'); // stop advertising the stack
const PORT=process.env.PORT||3000;
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
// cssv is set further down, from assetVersion(), once ASSET_FILES exists.
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
// ── CSRF ──────────────────────────────────────────────────────────────────
// The session cookie is already SameSite=lax, which stops a cross-site form
// post carrying it at all. This is the second lock: every state-changing
// request must say it came from here. Checking the origin rather than issuing
// tokens means all 46 existing forms keep working untouched — a token scheme
// silently breaks whichever form you forget, and that is a worse failure than
// the one it prevents.
app.use(function(req,res,next){
  if(req.method!=='POST')return next();
  const host=req.headers.host;
  const from=req.headers.origin||req.headers.referer;
  if(!from)return next();          // some privacy tools strip both; do not lock those people out
  let sameHost=false;
  try{ sameHost=new URL(from).host===host; }catch(e){ sameHost=false; }
  if(sameHost)return next();
  console.log('blocked cross-site POST to '+req.path+' from '+from);
  res.status(403).send('That request did not come from the House. Go back and try again.');
});
// The header decides whether you are signed in from res.locals.u — but only the
// Guild Hall was passing it, so every other page (tavern, guild, threads…) drew
// "Guild Login" even while you were signed in. Set it once, for everyone.
app.use(function(req,res,next){
  res.locals.u = req.session.uid ? (db.users.find(function(x){return x.id===req.session.uid;})||null) : null;
  res.locals.patron = (!res.locals.u && req.session.pid) ? (db.patrons.find(function(x){return x.id===req.session.pid;})||null) : null;
  // Unread notices drive the header badge, so news reaches someone wherever
  // they land — there is no email, so the site itself has to carry the word.
  var me = res.locals.u ? {t:'member',id:res.locals.u.id} : (res.locals.patron ? {t:'patron',id:res.locals.patron.id} : null);
  res.locals.unread = me ? (db.notices||[]).filter(function(n){return n.toT===me.t&&n.toId===me.id&&!n.read;}).length : 0;
  // The nav panel is built from this — on the EJS pages inline, so the menu is
  // right on the first paint, and on the generated static pages via /api/me,
  // which hands back exactly this object. Nothing in it is private; it is your
  // own name read back to you.
  var u=res.locals.u, p=res.locals.patron;
  res.locals.me = u
    ? {signedIn:true,kind:'member',name:u.name,avatar:u.avatar||'',rank:rank(u),pledge:!!u.pledge,leader:u.role==='leader',unread:res.locals.unread}
    : (p&&!p.banned)
      ? {signedIn:true,kind:'patron',name:p.name,avatar:p.avatar||'',rank:'Tavern guest',pledge:false,leader:false,unread:res.locals.unread}
      : {signedIn:false};
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
app.get('/guild.html',(req,res)=>{const slugs=slugById();const members=db.users.map(function(m){const bunks=db.bunks.filter(function(b){return b.userId===m.id;}).sort(function(a,b){return a.night<b.night?-1:1;}).map(function(b){return b.night+' \u00b7 Bunk '+b.bunk;});return{slug:slugs[m.id],name:m.name,avatar:m.avatar,class:m.class,rank:rank(m),pledge:!!m.pledge,faires:m.faires||0,title:m.title||'',role:m.role||'',rsvp:!!m.rsvp,bunks:bunks};}).sort(function(a,b){const k=function(x){if(x.title==='Guild Leader')return 0;if(x.role==='leader'||x.title==='Guild Elder')return 1;if(x.pledge)return 3;return 2;};const ka=k(a),kb=k(b);if(ka!==kb)return ka-kb;return (b.faires||0)-(a.faires||0);});const bunkBoard=NIGHTS.map(function(n){return{night:n,bunks:BUNKS.map(function(b){const o=db.bunks.find(function(x){return x.night===n&&x.bunk===b;});return{bunk:b,taken:!!o,who:o?db.users.find(function(y){return y.id===o.userId;}):null};})};});res.render('guild',{members:members,bunkBoard:bunkBoard,comingCount:db.users.filter(function(x){return x.rsvp;}).length});});
app.post('/pigeon',async(req,res)=>{const{Name,Email,Reason,Message}=req.body||{};const ep=process.env.FORMSPREE_ENDPOINT;if(!ep){console.log('FORMSPREE_ENDPOINT not set; pigeon dropped');return res.redirect('/pigeon.html?e=1');}try{const r=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({Name:Name||'',Email:Email||'',Reason:Reason||'',Message:Message||'',_subject:'New pigeon — House of Card and Coin',_replyto:Email||''})});if(!r.ok)throw new Error('formspree '+r.status);res.redirect('/pigeon.html?sent=1');}catch(e){console.log('pigeon forward error',e.message);res.redirect('/pigeon.html?e=1');}});
// The static mount below is rooted at /var/www/hocc, which also contains app/ and
// content/. Without this guard, /app/data/guild.json (every member's record and
// bcrypt hash), /app/server.js, /app/seed.js, and the build scripts are all
// publicly downloadable. Block them before static gets a chance to serve them.
const BLOCKED=/^\/(app|content)(\/|$)|^\/(build|serve)\.js$|^\/\./i;
app.use((req,res,next)=>BLOCKED.test(req.path)?res.status(404).send('Not found'):next());
// The generated pages carry a hand-written ?v= stamp on their stylesheet and
// scripts. Twice now a CSS change shipped and nobody saw it, because the stamp
// had not been bumped by hand — most recently leaving a signed-in member unable
// to reach their own profile. So the stamp is rewritten here at serve time from
// the real file mtimes, and never has to be remembered again.
const ASSET_FILES=['assets/css/style.css','assets/css/tavern.css','assets/css/profile.css',
  'assets/js/nav.js','assets/js/countdown.js','assets/js/hero-video.js','assets/js/avatar-crop.js','assets/js/page-preview.js','assets/js/charms.js'];
function assetVersion(){
  let newest=0;
  ASSET_FILES.forEach(function(f){
    try{ const m=fs.statSync(path.join(__dirname,'..',f)).mtimeMs; if(m>newest)newest=m; }catch(e){}
  });
  return String(Math.floor(newest));
}
// The EJS pages stamp their stylesheets and scripts with this. Read once at
// boot, which is enough — a deploy restarts the app, so the stamp moves when
// the files do.
//
// cssv used to be read from style.css alone, which meant a change to
// tavern.css shipped with an unchanged stamp and never reached anyone who had
// visited before: the file was correct on the server and stale in the browser.
// Both names now come from the newest mtime across every asset, so touching
// any one of them busts the lot. They are kept as two names only because the
// templates already say cssv in one place and assetv in another.
app.locals.assetv=app.locals.cssv=assetVersion();
const htmlCache=new Map();
app.use(function(req,res,next){
  if(req.method!=='GET')return next();
  let rel=req.path==='/'?'index.html':req.path.replace(/^\//,'');
  if(!/^[a-z0-9_-]+\.html$/i.test(rel))return next();
  const file=path.join(__dirname,'..',rel);
  let st; try{ st=fs.statSync(file); }catch(e){ return next(); }
  const v=assetVersion();
  const key=rel+':'+st.mtimeMs+':'+v;
  let body=htmlCache.get(key);
  if(body===undefined){
    try{ body=fs.readFileSync(file,'utf8'); }catch(e){ return next(); }
    body=body.replace(/(\/assets\/(?:css|js)\/[a-z0-9._-]+)(\?v=[^"']*)?/gi,'$1?v='+v);
    htmlCache.clear();               // one page's change means the stamp moved for all
    htmlCache.set(key,body);
  }
  res.set('Content-Type','text/html; charset=utf-8');
  res.set('Cache-Control','public, max-age=0');
  res.send(body);
});
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
// Banners are wide, not square, and they sit behind a name — so a face-finding
// crop is wrong here. Take the middle and let the picture speak.
function shrinkBanner(req,res,next){
  if(!req.file)return next();
  var p=req.file.path, input;
  try{ input=fs.readFileSync(p); }
  catch(e){ console.log('banner read failed, keeping original:',e.message); return next(); }
  sharp(input).rotate()
    .resize(1600,420,{fit:'cover'})
    .jpeg({quality:76,mozjpeg:true})
    .toBuffer()
    .then(function(buf){ fs.writeFileSync(p,buf); req.file.size=buf.length; next(); })
    .catch(function(e){ console.log('banner resize failed, keeping original:',e.message); next(); });
}
// ── What a guildmate may set on their own page ──────────────────────────────
// Only ever chosen from these, or matched against a pattern. Nothing a member
// types is allowed to become markup or a style rule: the colours are checked
// against a six-digit hex and everything else has to be one of these exact
// words, so the worst a bad value can do is fall back to the default.
const BACKDROPS=['plain','weave','timber','damask','stars'];
const LAYOUTS=['sheet','scroll','poster'];
// Faces, chosen from here rather than typed. Only Cinzel and EB Garamond are
// fetched by the site; the rest are already on the machine, so picking one
// costs nothing and cannot fail to a surprise. The stack is looked up by key,
// so nobody supplies a font-family string of their own.
const FONTS={
  garamond:{label:'Garamond',    stack:'"EB Garamond","Palatino Linotype",Palatino,Georgia,serif'},
  cinzel:  {label:'Cinzel',      stack:'"Cinzel",Georgia,serif'},
  georgia: {label:'Georgia',     stack:'Georgia,"Times New Roman",serif'},
  palatino:{label:'Palatino',    stack:'"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif'},
  ledger:  {label:'Ledger hand', stack:'"Courier New",Courier,monospace'},
  plain:   {label:'Plain',       stack:'"Trebuchet MS","Segoe UI",Helvetica,Arial,sans-serif'}
};
const FONT_KEYS=Object.keys(FONTS);
const SIZES={small:'0.94',normal:'1',large:'1.12',huge:'1.26'};
const SIZE_KEYS=Object.keys(SIZES);
// Charms — the glitter. Drawn here, placed by whoever owns the page, which is
// the whole trick: all the fun of a decorated page and not a line of anybody
// else's code. The key is looked up in this map, so a made-up one draws nothing
// rather than reaching the markup.
const CHARM_ART={
  skull:'<path d="M12 2C7 2 4 5.4 4 9.6c0 2.3 1 3.7 2 4.6V18a2 2 0 0 0 2 2h1v-2h2v2h2v-2h2v2h1a2 2 0 0 0 2-2v-3.8c1-.9 2-2.3 2-4.6C20 5.4 17 2 12 2Z" fill="F"/><circle cx="9" cy="10" r="1.9" fill="#1a120b"/><circle cx="15" cy="10" r="1.9" fill="#1a120b"/>',
  tankard:'<path d="M4 6h11v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" fill="F"/><path d="M15 9h3a3 3 0 0 1 0 6h-3" fill="none" stroke="F" stroke-width="2"/><path d="M4 6h11v3H4Z" fill="#fff8e2"/>',
  spade:'<path d="M12 2.5 5 10c-2.2 2.3-1.6 6 1.4 7 1.6.5 3.2-.1 4.1-1.3L10 21h4l-.5-5.3c.9 1.2 2.5 1.8 4.1 1.3 3-1 3.6-4.7 1.4-7Z" fill="F"/>',
  heart:'<path d="M12 21S3.5 14.6 3.5 9.1A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.7C20.5 14.6 12 21 12 21Z" fill="F"/>',
  moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" fill="F"/>',
  blade:'<path d="m19 3-9 9 2 2 9-9V3Z" fill="F"/><path d="m9 13-1.5 1.5L4 18l2 2 3.5-3.5L11 15Z" fill="F"/>',
  coin:'<circle cx="12" cy="12" r="9" fill="F"/><circle cx="12" cy="12" r="6" fill="none" stroke="#1a120b" stroke-width="1.4" opacity=".55"/>',
  key:'<circle cx="8" cy="8" r="4.6" fill="none" stroke="F" stroke-width="2.4"/><path d="m11 11 8 8M16 16l2 2M14 18l2 2" stroke="F" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
};
const CHARM_KEYS=Object.keys(CHARM_ART);
const CHARM_INKS={gold:'#e4c77f',seal:'var(--u-seal)',dark:'#2a1c0e',pale:'#f7e6ba'};
const CHARM_MAX=14;
function charmSvg(k,ink){
  var art=CHARM_ART[k]; if(!art)return '';
  var fill=CHARM_INKS[ink]||CHARM_INKS.gold;
  return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    art.replace(/"F"/g,'"'+fill+'"')+'</svg>';
}
// Comes in as JSON from a hidden field, so every part of it is treated as a
// stranger: unknown keys dropped, coordinates clamped to the banner, and the
// whole lot cut off at CHARM_MAX.
function cleanCharms(raw){
  var list; try{ list=JSON.parse(raw||'[]'); }catch(e){ return []; }
  if(!Array.isArray(list))return [];
  var out=[];
  list.forEach(function(c){
    if(!c||CHARM_KEYS.indexOf(c.k)<0)return;
    var x=Number(c.x), y=Number(c.y);
    if(!isFinite(x)||!isFinite(y))return;
    out.push({
      k:c.k,
      x:Math.round(Math.min(100,Math.max(0,x))*10)/10,
      y:Math.round(Math.min(100,Math.max(0,y))*10)/10,
      c:CHARM_INKS[c.c]?c.c:'gold',
      s:Math.min(2,Math.max(.6,Number(c.s)||1))
    });
  });
  return out.slice(0,CHARM_MAX);
}
const HEX=/^#[0-9a-f]{6}$/i;
function pickHex(v,fallback){ v=String(v||'').trim(); return HEX.test(v)?v.toLowerCase():fallback; }
function pickOne(v,list,fallback){ v=String(v||'').trim(); return list.indexOf(v)>=0?v:fallback; }
function pageOf(u){
  return {
    motto:u.motto||'', about:u.about||'',
    accent:pickHex(u.cAccent,'#6e1a1a'),
    seal:pickHex(u.cSeal,'#8b2a2a'),
    tint:pickHex(u.cTint,'#f4ead2'),
    backdrop:pickOne(u.backdrop,BACKDROPS,'plain'),
    layout:pickOne(u.layout,LAYOUTS,'sheet'),
    font:pickOne(u.font,FONT_KEYS,'garamond'),
    fontStack:FONTS[pickOne(u.font,FONT_KEYS,'garamond')].stack,
    size:pickOne(u.size,SIZE_KEYS,'normal'),
    sizeScale:SIZES[pickOne(u.size,SIZE_KEYS,'normal')],
    ink:pickHex(u.cInk,'#241a12'),
    sparkle:!!u.sparkle,
    charms:Array.isArray(u.charms)?u.charms:[],
    // Only ever written by us as '/uploads/<multer's hex name>'. Checked anyway,
    // because it ends up inside a style attribute on a public page.
    banner:/^\/uploads\/[a-f0-9]+$/i.test(String(u.banner||''))?u.banner:''
  };
}
// Sign-in could be guessed at as fast as a script could post. Five wrong
// answers from one address in fifteen minutes and it stops listening for a
// while. Kept in memory on purpose: a restart forgiving everyone is fine, and
// it means no new dependency.
const loginTries=new Map();
setInterval(function(){
  const now=Date.now();
  loginTries.forEach(function(v,k){ if(now-v.first>15*60000) loginTries.delete(k); });
}, 5*60000).unref();
function throttleLogin(req,res,next){
  const key=(req.headers['x-forwarded-for']||req.ip||'?').split(',')[0].trim();
  const now=Date.now();
  const rec=loginTries.get(key);
  if(rec && now-rec.first < 15*60000 && rec.n >= 5){
    const mins=Math.ceil((15*60000-(now-rec.first))/60000);
    return res.redirect('/members/login?e='+encodeURIComponent('Too many attempts. Try again in '+mins+' minute'+(mins===1?'':'s')+', or send a pigeon to the Guild Leader.'));
  }
  req._loginKey=key;
  next();
}
function noteBadLogin(req){
  const key=req._loginKey; if(!key)return;
  const now=Date.now(); const rec=loginTries.get(key);
  if(!rec || now-rec.first > 15*60000) loginTries.set(key,{first:now,n:1});
  else rec.n++;
}
function clearLoginTries(req){ if(req._loginKey) loginTries.delete(req._loginKey); }
function au(req,res,next){if(req.session.uid)return next();res.redirect('/members/login');}
// Bunks are not a perk of acceptance. Three beds a night, more guildmates
// than that, so the House keeps them for people who have already camped a
// faire — and past that it is first come, first served. One bed per night:
// nobody sleeps in two at once.
function bunkEligible(u){ return !!u && !u.pledge && (u.faires||0) >= 1; }
function sworn(req,res,next){
  const u=cur(req);
  if(!u)return res.redirect('/members/login');
  if(u.pledge)return res.redirect('/members?e='+encodeURIComponent('Bunks are for sworn guildmates. Ask the Guild Leader to accept your pledge first.')+'#bunks');
  if((u.faires||0)<1)return res.redirect('/members?e='+encodeURIComponent('The bunks are kept for guildmates who have camped a faire with the House. Camp one with us and the next is yours to claim.')+'#bunks');
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
  res.set('Cache-Control','no-store');
  res.json(res.locals.me);
});
// ── Guildmates' own pages ───────────────────────────────────────────────────
// Addresses are made from the display name: /guild/mama-bear. Renaming yourself
// moves your page, which is fine at ten people and nobody is bookmarking. Two
// people with the same name get -2 on the second, ordered by id so it is stable.
function slugOf(name){
  return String(name||'').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'guildmate';
}
function slugMap(){
  var used={}, out=[];
  db.users.slice().sort(function(a,b){return a.id-b.id;}).forEach(function(u){
    var s=slugOf(u.name);
    if(used[s]){ used[s]++; s=s+'-'+used[s]; } else { used[s]=1; }
    out.push({u:u,slug:s});
  });
  return out;
}
// {memberId: slug} — the views use this to make a face a link.
function slugById(){
  var m={}; slugMap().forEach(function(x){ m[x.u.id]=x.slug; }); return m;
}
app.get('/guild/:slug',(req,res)=>{
  const hit=slugMap().find(function(x){return x.slug===req.params.slug;});
  if(!hit)return res.status(404).render('notfound',{gates:countdown()});
  const u=hit.u, i=ident(req);
  // Everything on this page is already public somewhere else on the site.
  // Contact email and phone are the leader's business and stay out of it.
  const bunks=db.bunks.filter(function(b){return b.userId===u.id;})
    .sort(function(a,b){return NIGHTS.indexOf(a.night)-NIGHTS.indexOf(b.night);})
    .map(function(b){return b.night+' · Bunk '+b.bunk;});
  const bringing=(db.claims||[]).filter(function(c){return c.userId===u.id;})
    .map(function(c){
      const item=db.items.find(function(x){return x.id===c.itemId;});
      return item?{name:item.name,qty:c.qty}:null;
    }).filter(Boolean);
  const talk=[];
  db.threads.forEach(function(t){
    if(t.authorType==='member'&&t.authorId===u.id)talk.push({body:t.body,ts:t.ts,tid:t.id});
    (t.replies||[]).forEach(function(r){
      if(r.authorType==='member'&&r.authorId===u.id)talk.push({body:r.body,ts:r.ts,tid:t.id});
    });
  });
  talk.sort(function(a,b){return b.ts-a.ts;});
  res.render('profile',{
    who:{name:u.name,avatar:u.avatar||'',rank:rank(u),title:u.title||'',pledge:!!u.pledge,
         leader:u.role==='leader',cls:u.class||'',faires:u.faires||0,rsvp:!!u.rsvp,
         coins:u.coins||0,streak:u.streak||0},
    bunks:bunks, bringing:bringing, talk:talk.slice(0,5),
    hand:(u.hand||[]).map(cardInfo), handRank:handRank(u.hand||[]),
    page:pageOf(u), charmSvg:charmSvg,
    isMe:!!(i&&i.t==='member'&&i.id===u.id), slug:hit.slug,
    // Whispering used to hide behind the little figures in the tavern room.
    // Those now lead here, so the door has to be on this page instead.
    canWhisper:!!(i&&!(i.t==='member'&&i.id===u.id)), whisperTo:'/board/whisper/member/'+u.id
  });
});
app.get('/faq',(req,res)=>res.render('faq'));
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
  db.users.push(u);save();req.session.uid=u.id;// A new pledge lands on a page that explains what a pledge is and what
  // happens next, rather than being dropped into the Hall unexplained.
  res.redirect(first?'/members':'/members?new=1');});
app.post('/members/login',throttleLogin,(req,res)=>{const{email,password}=req.body;const u=db.users.find(x=>x.email===String(email||'').toLowerCase());
  if(!u||!bcrypt.compareSync(password||'',u.passhash)){noteBadLogin(req);return res.redirect('/members/login?e='+encodeURIComponent('Bad email or password'));}
  clearLoginTries(req);req.session.uid=u.id;res.redirect('/members');});
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
      canBunk:bunkEligible(u),
      waiting:queue.length,
      myPlace:myIdx<0?0:myIdx+1,
      queueNames:queue.map(w=>{const p=db.users.find(x=>x.id===w.userId);return p?p.name:'?';})
    };
  });
  // The bring-list reads item-by-item, which does not answer "who is actually
  // bringing something". Group it by person for the Guild Leader.
  const bringers=(function(){
    const by={};
    (db.claims||[]).forEach(function(c){
      const who=db.users.find(function(x){return x.id===c.userId;});
      const item=db.items.find(function(x){return x.id===c.itemId;});
      if(!who||!item)return;
      if(!by[who.id])by[who.id]={name:who.name,avatar:who.avatar,phone:who.phone||'',contactEmail:who.contactEmail||'',items:[],total:0};
      by[who.id].items.push({name:item.name,qty:c.qty});
      by[who.id].total+=c.qty;
    });
    return Object.keys(by).map(function(k){return by[k];})
      .sort(function(a,b){return b.total-a.total;});
  })();
  const bunksLeft=NIGHTS.length*BUNKS.length-db.bunks.length;
  const items=db.items.map(it=>{const cl=db.claims.filter(c=>c.itemId===it.id);const claimed=cl.reduce((s,c)=>s+c.qty,0);return{...it,claimed,remaining:Math.max(0,it.need-claimed),claims:cl.map(c=>({qty:c.qty,who:db.users.find(y=>y.id===c.userId)})),mine:cl.find(c=>c.userId===u.id)};});
  res.render('hall',{u,page:pageOf(u),mySlug:slugById()[u.id]||'',backdrops:BACKDROPS,layouts:LAYOUTS,fonts:FONTS,fontKeys:FONT_KEYS,sizeKeys:SIZE_KEYS,sizes:SIZES,charmKeys:CHARM_KEYS,charmSvg:charmSvg,charmMax:CHARM_MAX,rank:rank(u),classes:CLASSES,bunkBoard,bunksLeft,items,bringers,leader:u.role==='leader',users:u.role==='leader'?db.users.map(function(m){return{name:m.name,class:m.class,faires:m.faires,rank:rank(m),pledge:!!m.pledge,leader:m.role==='leader',title:m.title||'',avatar:m.avatar,id:m.id,contactEmail:m.contactEmail||'',phone:m.phone||'',bunks:db.bunks.filter(function(b){return b.userId===m.id}).map(function(b){return b.night+' \u00b7 Bunk '+b.bunk;})};}):[],announcements:db.announcements,outreach:{emails:db.users.filter(function(x){return x.contactEmail;}).map(function(x){return x.contactEmail;}),phones:db.users.filter(function(x){return x.phone;}).map(function(x){return x.phone;})},invite:INVITE,err:req.query.e||"",q:req.query});
});
// How your page looks. Separate from the details form above because these are
// about presentation and those are about the guild — and because this one
// carries a banner upload, which needs its own handler.
app.post('/members/page',au,up.single('banner'),shrinkBanner,(req,res)=>{
  const u=cur(req);if(!u)return res.redirect('/members/login');
  u.motto=String(req.body.motto||'').trim().slice(0,90);
  u.about=String(req.body.about||'').trim().slice(0,700);
  u.cAccent=pickHex(req.body.accent,'#6e1a1a');
  u.cSeal=pickHex(req.body.seal,'#8b2a2a');
  u.cTint=pickHex(req.body.tint,'#f4ead2');
  u.backdrop=pickOne(req.body.backdrop,BACKDROPS,'plain');
  u.layout=pickOne(req.body.layout,LAYOUTS,'sheet');
  u.font=pickOne(req.body.font,FONT_KEYS,'garamond');
  u.size=pickOne(req.body.size,SIZE_KEYS,'normal');
  u.cInk=pickHex(req.body.ink,'#241a12');
  u.sparkle=!!req.body.sparkle;
  u.charms=cleanCharms(req.body.charms);
  if(req.body.dropBanner&&u.banner&&u.banner.startsWith('/uploads/')){
    try{ fs.unlinkSync(path.join(__dirname,u.banner.replace('/uploads/','uploads/'))); }catch(e){}
    u.banner='';
  }
  if(req.file){
    // same trap as avatars: replacing one used to strand the old file forever
    if(u.banner&&u.banner.startsWith('/uploads/')){
      try{ fs.unlinkSync(path.join(__dirname,u.banner.replace('/uploads/','uploads/'))); }catch(e){}
    }
    u.banner='/uploads/'+req.file.filename;
  }
  save();
  res.redirect('/guild/'+(slugById()[u.id]||''));
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
// Backups live on the same box they protect — lose the VPS and you lose them
// with it. This hands the Guild Leader a copy she can keep on her own machine,
// which is the only off-box copy that actually exists.
app.get('/members/admin/backup',al,(req,res)=>{
  const stamp=new Date().toISOString().slice(0,10);
  let payload;
  try{ payload=fs.readFileSync(DATA,'utf8'); }
  catch(e){ return res.status(500).send('Could not read the roster'); }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="hocc-guild-'+stamp+'.json"');
  res.setHeader('Cache-Control','no-store');
  res.send(payload);
});
app.post('/members/admin/promote',al,(req,res)=>{const u=db.users.find(x=>x.id===parseInt(req.body.id));if(u&&u.pledge){u.pledge=false;notify('member',u.id,'You have been accepted into the House of Card and Coin. You are a Guildmate now — the camp bunks are yours to claim.');save();}res.redirect('/members#admin');});
app.post('/members/admin/demote',al,(req,res)=>{const u=db.users.find(x=>x.id===parseInt(req.body.id));if(u&&u.role!=='leader'){u.pledge=true;save();}res.redirect('/members#admin');});
// Someone taps Claim, realises they don't need the night, and never releases
// it — the bunk then sits dead. The Guild Leader can free any of them, and it
// passes to the waitlist exactly as a voluntary release does.
app.post('/members/admin/bunk/release',al,(req,res)=>{
  const night=req.body.night, bunk=parseInt(req.body.bunk,10);
  const held=db.bunks.find(x=>x.night===night&&x.bunk===bunk);
  if(!held)return res.redirect('/members#bunks');
  const wasWhose=held.userId;
  db.bunks=db.bunks.filter(x=>!(x.night===night&&x.bunk===bunk));
  const gotIt=fillFromWaitlist(night,bunk,null);
  const freed=db.users.find(x=>x.id===wasWhose);
  if(freed)notify('member',freed.id,'The Guild Leader released your bunk on '+night+' (bunk '+bunk+'). Claim another night if you still mean to camp.');
  save();
  res.redirect('/members?e='+encodeURIComponent(
    'Freed '+night+', bunk '+bunk+(gotIt?(' — it passed to '+gotIt.name+' from the waitlist.'):'.')
  )+'#bunks');
});
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
app.post('/tavern/login',throttleLogin,(req,res)=>{
  const email=(req.body.email||'').toLowerCase().trim();const p=db.patrons.find(x=>x.email===email);
  if(!p||!bcrypt.compareSync(req.body.password||'',p.passhash)){noteBadLogin(req);return res.redirect('/tavern?e='+encodeURIComponent('Bad email or password'));}
  clearLoginTries(req);
  if(p.banned)return res.redirect('/tavern?e='+encodeURIComponent("You've been 86'd from the tavern"));
  req.session.pid=p.id;res.redirect('/board');
});
app.post('/tavern/logout',(req,res)=>{delete req.session.pid;res.redirect('/board');});
// Who has been in the tavern lately, and how recently anyone spoke. The room
// shows presence over time rather than pretending to be a live chat — with a
// guild this size it would usually be empty, and an empty "live" room reads
// worse than a quiet one.
// Every post remembers the face its author wore when they wrote it. That goes
// wrong the moment anyone changes their picture: uploading a new avatar deletes
// the old file, so each post they had already made pointed at an image that no
// longer existed and their circles in the Tavern came up empty.
//
// A post should remember who spoke, not what they looked like. It already keeps
// authorType and authorId, so the face is looked up now and the stored copy is
// used only for people who have since left the House and cannot be looked up.
function faceNow(t,id,avatar,name){
  var who = t==='member' ? db.users.find(function(x){return x.id===id;})
          : t==='patron' ? db.patrons.find(function(x){return x.id===id;})
          : null;
  return who ? {name:who.name,avatar:who.avatar||''} : {name:name||'',avatar:avatar||''};
}
function freshenPost(p){
  var f=faceNow(p.authorType,p.authorId,p.authorAvatar,p.authorName);
  var out=Object.assign({},p,{authorName:f.name,authorAvatar:f.avatar});
  if(p.replies)out.replies=p.replies.map(freshenPost);
  return out;
}
function tavernFolk(){
  var acts=[];
  db.threads.forEach(function(t){
    var tf=faceNow(t.authorType,t.authorId,t.authorAvatar,t.authorName);
    acts.push({t:t.authorType,id:t.authorId,name:tf.name,avatar:tf.avatar,ts:t.ts});
    (t.replies||[]).forEach(function(r){
      var rf=faceNow(r.authorType,r.authorId,r.authorAvatar,r.authorName);
      acts.push({t:r.authorType,id:r.authorId,name:rf.name,avatar:rf.avatar,ts:r.ts});
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
// Everyone's hand is on show — it is a faire game, not a secret. Ranked best
// first so the table reads like a showdown.
function allHands(){
  var rows=[];
  (db.users||[]).forEach(function(u){
    if(u.hand&&u.hand.length)rows.push({id:u.id,name:u.name,avatar:u.avatar,kind:'member',cards:u.hand.map(cardInfo),rank:handRank(u.hand)});
  });
  (db.patrons||[]).forEach(function(p){
    if(p.banned)return;
    if(p.hand&&p.hand.length)rows.push({name:p.name,avatar:p.avatar,kind:'patron',cards:p.hand.map(cardInfo),rank:handRank(p.hand)});
  });
  rows.sort(function(a,b){
    var at=a.rank?a.rank.tier:0, bt=b.rank?b.rank.tier:0;
    if(at!==bt)return bt-at;
    return b.cards.length-a.cards.length;
  });
  return rows;
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
  const threads=db.threads.slice().sort(function(a,b){return lastTouch(b)-lastTouch(a);}).map(freshenPost);
  const polls=db.polls.slice().sort((a,b)=>b.ts-a.ts).map(freshenPost).map(function(p){const total=p.options.reduce((s,o)=>s+o.votes.length,0);const voted=i?!!p.options.find(o=>o.votes.find(v=>v.t===i.t&&v.id===i.id)):false;return Object.assign({},p,{total:total,voted:voted});});
  res.render('board',{i:i,threads:threads,polls:polls,cats:BOARDCATS,q:req.query,leader:!!(i&&i.leader),ration:{canDraw:!!(i&&i.lastRation!==today),card:i?i.lastCard:null},hand:i?(i.hand||[]).map(cardInfo):[],pending:i&&i.pending?cardInfo(i.pending):null,handRank:i?handRank(i.hand||[]):null,handPrizes:HAND_PRIZES,tableHands:allHands(),cardPrice:CARD_PRICE,special:SPECIALS[dayOfYear()%SPECIALS.length],gates:countdown(),notices:i?(db.notices||[]).filter(function(n){return n.toT===i.t&&n.toId===i.id&&!n.read;}).length:0,folk:pres.folk,quietHrs:quietHrs,editMs:EDIT_WINDOW,editDays:EDIT_DAYS,slugs:slugById()});
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
  const i=ident(req);res.render('thread',{t:freshenPost(t),i:i,q:req.query,leader:!!(i&&i.leader)});
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
// Your own words are yours. Only the leader could strike anything, so a typo
// was permanent unless you asked her. Edits keep a mark so nothing is silently
// rewritten under a reply.
// A typo should not be permanent, and a conversation should not stay rewritable
// for ever. You get a week to put your own words right; after that the line is
// part of the House's record and stands as it was said. The Guild Leader is not
// bound by the clock — she can mend or strike anything, whenever.
const EDIT_DAYS=7;
const EDIT_WINDOW=EDIT_DAYS*24*60*60*1000;
function stillOpen(post){ return !!post && (Date.now()-post.ts)<EDIT_WINDOW; }
const LOCKED='Said more than '+EDIT_DAYS+' days ago — that one is part of the House’s record now, and stands as it was said.';
function findReply(id){
  var hit=null;
  db.threads.forEach(function(t){
    (t.replies||[]).forEach(function(r){ if(r.id==id) hit={t:t,r:r}; });
  });
  return hit;
}
// Author or leader, and inside the week unless you are the leader.
function mayAmend(post,i){
  if(!post||!i)return false;
  if(i.leader)return true;
  if(!(post.authorType===i.t&&post.authorId===i.id))return false;
  return stillOpen(post);
}
app.post('/board/thread/:id/edit',canPost,(req,res)=>{
  const i=ident(req);
  const t=db.threads.find(x=>x.id==req.params.id);
  if(!t)return res.redirect('/board');
  if(!(t.authorType===i.t&&t.authorId===i.id)&&!i.leader)return res.status(403).send('Not yours to change');
  if(!mayAmend(t,i))return res.redirect('/board?e='+encodeURIComponent(LOCKED));
  const body=(req.body.body||'').trim();
  if(!body)return res.redirect('/board');
  t.body=body; t.edited=Date.now();
  save();res.redirect('/board');
});
// Replies could never be edited at all — only deleted — so a typo in one meant
// removing the line and saying it again, which orphans anything said after it.
app.post('/board/reply/:id/edit',canPost,(req,res)=>{
  const i=ident(req);
  const f=findReply(req.params.id);
  if(!f)return res.redirect('/board');
  if(!(f.r.authorType===i.t&&f.r.authorId===i.id)&&!i.leader)return res.status(403).send('Not yours to change');
  if(!mayAmend(f.r,i))return res.redirect('/board?e='+encodeURIComponent(LOCKED));
  const body=(req.body.body||'').trim();
  if(!body)return res.redirect('/board');
  f.r.body=body; f.r.edited=Date.now();
  save();res.redirect('/board');
});
app.post('/board/thread/:id/mine/delete',canPost,(req,res)=>{
  const i=ident(req);
  const t=db.threads.find(x=>x.id==req.params.id);
  if(!t)return res.redirect('/board');
  if(!(t.authorType===i.t&&t.authorId===i.id))return res.status(403).send('Not yours to remove');
  // Locked means locked: a line you can still delete is not part of any record.
  if(!mayAmend(t,i))return res.redirect('/board?e='+encodeURIComponent(LOCKED));
  db.threads=db.threads.filter(x=>x.id!=req.params.id);
  save();res.redirect('/board');
});
app.post('/board/reply/:id/mine/delete',canPost,(req,res)=>{
  const i=ident(req);
  const found=findReply(req.params.id);
  if(!found)return res.redirect('/board');
  if(!(found.r.authorType===i.t&&found.r.authorId===i.id))return res.status(403).send('Not yours to remove');
  if(!mayAmend(found.r,i))return res.redirect('/board?e='+encodeURIComponent(LOCKED));
  found.t.replies=found.t.replies.filter(function(r){return r.id!=req.params.id;});
  save();res.redirect('/board');
});
app.post('/board/thread/:id/delete',leaderOnly,(req,res)=>{db.threads=db.threads.filter(x=>x.id!=req.params.id);save();res.redirect('/board');});
app.post('/board/reply/:id/delete',leaderOnly,(req,res)=>{db.threads.forEach(t=>{t.replies=t.replies.filter(r=>r.id!=req.params.id);});save();res.redirect('/board');});
app.post('/board/poll/:id/delete',leaderOnly,(req,res)=>{db.polls=db.polls.filter(x=>x.id!=req.params.id);save();res.redirect('/board');});
app.post('/board/patron/:id/ban',leaderOnly,(req,res)=>{const p=db.patrons.find(x=>x.id==req.params.id);if(p)p.banned=true;save();res.redirect('/board');});

// ===== Tavern: doubloons, daily ration, reactions, rogues' gallery =====
// ── The Cardsharp's Hand ───────────────────────────────────────────────────
// One card a night from your own deck, building toward a five-card poker hand
// you show at the faire. Everyone deals from a private shuffled deck, so no
// one ever holds the same card twice.
const SUITS=[{k:'S',g:'♠',n:'Spades'},{k:'H',g:'♥',n:'Hearts'},{k:'D',g:'♦',n:'Diamonds'},{k:'C',g:'♣',n:'Clubs'}];
const RANKS=[['2',2],['3',3],['4',4],['5',5],['6',6],['7',7],['8',8],['9',9],['T',10],['J',11],['Q',12],['K',13],['A',14]];
const RANKNAME={T:'10',J:'Jack',Q:'Queen',K:'King',A:'Ace'};
function freshDeck(){const d=[];SUITS.forEach(function(s){RANKS.forEach(function(r){d.push(r[0]+s.k);});});return d;}
// Hands are public, so the deal has to be defensibly fair: crypto randomness,
// not Math.random, and an unbiased Fisher-Yates.
const crypto=require('crypto');
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=crypto.randomInt(i+1);var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function cardInfo(code){
  var r=code.slice(0,-1), sk=code.slice(-1);
  var s=SUITS.find(function(x){return x.k===sk;})||SUITS[0];
  var rr=RANKS.find(function(x){return x[0]===r;});
  return {code:code,r:r,label:RANKNAME[r]||r,suit:s.k,glyph:s.g,suitName:s.n,red:(sk==='H'||sk==='D'),v:rr?rr[1]:0};
}
// A card is worth a little coin on its own; face cards a little more.
function cardCoins(code){return 1+Math.floor(cardInfo(code).v/5);}

// Five-card stud: you play the cards you were dealt, however many you managed
// to collect. Someone who only turned up four nights ranks on four cards.
// A straight or a flush needs all five, so a short hand cannot make one.
function handRank(codes){
  if(!codes||codes.length<2)return null;
  var n=codes.length;
  var cs=codes.map(cardInfo);
  var vs=cs.map(function(c){return c.v;}).sort(function(a,b){return b-a;});
  var suits=cs.map(function(c){return c.suit;});
  var flush=(n===5)&&suits.every(function(s){return s===suits[0];});
  var uniq=[];vs.forEach(function(v){if(uniq.indexOf(v)<0)uniq.push(v);});
  var straight=false, high=vs[0];
  if(n===5&&uniq.length===5){
    if(uniq[0]-uniq[4]===4){straight=true;}
    else if(uniq[0]===14&&uniq[1]===5&&uniq[4]===2){straight=true;high=5;}
  }
  var counts={};vs.forEach(function(v){counts[v]=(counts[v]||0)+1;});
  var groups=Object.keys(counts).map(function(k){return counts[k];}).sort(function(a,b){return b-a;});
  var tier,name;
  if(straight&&flush){tier=9;name=(high===14?'Royal Flush':'Straight Flush');}
  else if(groups[0]===4){tier=8;name='Four of a Kind';}
  else if(groups[0]===3&&groups[1]===2){tier=7;name='Full House';}
  else if(flush){tier=6;name='Flush';}
  else if(straight){tier=5;name='Straight';}
  else if(groups[0]===3){tier=4;name='Three of a Kind';}
  else if(groups[0]===2&&groups[1]===2){tier=3;name='Two Pair';}
  else if(groups[0]===2){tier=2;name='A Pair';}
  else {var hc=cs.find(function(c){return c.v===vs[0];});tier=1;name='High Card, '+(hc?hc.label:'');}
  return {tier:tier,name:name,cards:n,short:n<5};
}
// What the House pays out at the faire. She has not settled on the prize yet,
// and a guild whose tagline is "Well-Kept Secrets" can happily keep it that
// way — so these escalate in promise without naming anything she might change
// her mind about. Put real wording here once she decides.
const HAND_PRIZES=[
  '',
  'the House tips its hat',
  'a small kindness from the House',
  'a small kindness from the House',
  'something worth the walk',
  'something worth the walk',
  'something worth the walk',
  'one of the better secrets',
  'one of the better secrets',
  'the finest thing the House has to give'
];
const SPECIALS=['Tonight: Spiced Rum & a Tall Tale \u2014 tell us your first faire memory.','Tonight: Dice & Doubloons \u2014 what is the worst bargain you ever struck at faire?',"Tonight: The Hermit's Hour \u2014 share one piece of advice you would give a first-time camper.",'Tonight: Wheels & Whispers \u2014 who in the guild should be immortalized in a shanty, and why?','Tonight: A Round for the House \u2014 raise a toast to a guildmate in the replies.',"Tonight: The Reader's Lantern \u2014 what did the cards get right last faire?",'Tonight: Campfire Confessions \u2014 your most glorious faire mishap.','Tonight: Coin & Counsel \u2014 what do you still need to borrow or bring to camp?',"Tonight: The Sellsword's Tab \u2014 name the quest you would hire a mercenary for this faire.",'Tonight: Moonlit Wager \u2014 predict one thing that will absolutely go sideways this weekend.'];
function tavernTitle(coins){coins=coins||0;if(coins>=120)return 'Captain';if(coins>=70)return 'Quartermaster';if(coins>=40)return 'Bosun';if(coins>=18)return 'Deckhand';if(coins>=5)return 'Sailor';return 'Landlubber';}
function dayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dayOfYear(){const now=new Date();const start=new Date(now.getFullYear(),0,0);return Math.floor((now-start)/86400000);}
function identRich(req){const i=ident(req);if(!i)return null;const rec=i.t==='member'?db.users.find(function(x){return x.id===i.id;}):db.patrons.find(function(x){return x.id===i.id;});if(!rec)return i;return Object.assign({},i,{coins:rec.coins||0,lastRation:rec.lastRation||'',lastCard:rec.lastCard||null,streak:rec.streak||0,hand:rec.hand||[],pending:rec.pending||null});}
const REACTS=['\uD83C\uDF7A','\uD83E\uDE99','\uD83D\uDD25','\u2694\uFE0F'];
function doReact(req,res,host){var i=ident(req);var e=(req.body.emoji||'').trim();if(REACTS.indexOf(e)<0)return res.redirect(req.get('Referrer')||'/board');if(!host.reacts)host.reacts={};var arr=host.reacts[e]=host.reacts[e]||[];var idx=arr.findIndex(function(v){return v.t===i.t&&v.id===i.id;});if(idx>=0){arr.splice(idx,1);}else{arr.push({t:i.t,id:i.id});if(host.authorType!==i.t||host.authorId!==i.id)notify(host.authorType,host.authorId,i.name+' raised a '+e+' to '+(host.title?('your note \u201c'+host.title+'\u201d'):'your reply'));}save();res.redirect(req.get('Referrer')||'/board');}
// Deal tonight's card. Below five cards it joins the hand outright; once the
// hand is full the new card waits while you decide whether it is worth a swap.
function holder(i){
  return i.t==='member'
    ? db.users.find(function(x){return x.id===i.id;})
    : db.patrons.find(function(x){return x.id===i.id;});
}
function dealOne(rec){
  if(!Array.isArray(rec.deck)||!rec.deck.length){
    var held=(rec.hand||[]).concat(rec.pending?[rec.pending]:[]);
    rec.deck=shuffle(freshDeck().filter(function(c){return held.indexOf(c)<0;}));
  }
  return rec.deck.pop();
}
// Coins had nowhere to go. This is the sink: you get one card a night for
// free, and if you cannot wait you buy the next one now. It is naturally
// bounded — a hand is five cards, so nobody can buy more than four ever — and
// buying does not buy a *better* card, only a sooner one, since the deal is
// still random. Patience or coin; either way you end up with five.
const CARD_PRICE=15;
app.post('/board/hand/buy',canPost,(req,res)=>{
  var i=ident(req);var rec=holder(i);
  if(!rec)return res.redirect('/board');
  if(!Array.isArray(rec.hand))rec.hand=[];
  if(rec.hand.length>=5)return res.redirect('/board#hand');
  if((rec.coins||0)<CARD_PRICE)
    return res.redirect('/board?e='+encodeURIComponent('That costs '+CARD_PRICE+' coins and you have '+(rec.coins||0)+'. Come back tomorrow for a free one.')+'#hand');
  rec.coins=(rec.coins||0)-CARD_PRICE;
  var card=dealOne(rec);
  rec.hand.push(card);
  rec.bought=(rec.bought||0)+1;
  // deliberately does NOT touch lastRation or streak — the streak is for
  // turning up, and buying a card is not turning up.
  save();res.redirect('/board#hand');
});
app.post('/board/ration',canPost,(req,res)=>{
  var i=ident(req);var rec=holder(i);
  if(!rec)return res.redirect('/board');
  if(!Array.isArray(rec.hand))rec.hand=[];
  // Five-card stud: five is the whole hand, and there is no sixth night.
  if(rec.hand.length>=5)return res.redirect('/board#hand');
  var today=dayKey();
  if(rec.lastRation===today)return res.redirect('/board#hand');
  var yest=yesterdayKey();
  var streak=(rec.lastRation===yest)?(rec.streak||0)+1:1;
  rec.streak=streak;
  var card=dealOne(rec);
  var bonus=Math.min(streak,7);
  rec.coins=(rec.coins||0)+cardCoins(card)+bonus;
  rec.lastRation=today;
  rec.hand.push(card);
  rec.pending=null;
  rec.lastCard={code:card,ts:Date.now(),streak:streak,bonus:bonus};
  save();res.redirect('/board#hand');
});
app.post('/board/thread/:id/react',canPost,(req,res)=>{const t=db.threads.find(function(x){return x.id==req.params.id;});if(!t)return res.redirect('/board');doReact(req,res,t);});
app.post('/board/thread/:tid/reply/:rid/react',canPost,(req,res)=>{const t=db.threads.find(function(x){return x.id==req.params.tid;});if(!t)return res.redirect('/board');const r=t.replies.find(function(x){return x.id==req.params.rid;});if(!r)return res.redirect('/board/thread/'+t.id);doReact(req,res,r);});
app.get('/board/rogues',(req,res)=>{const i=identRich(req);const counts={};function bump(k){counts[k]=(counts[k]||0)+1;}db.threads.forEach(function(t){bump(t.authorType+':'+t.authorId);t.replies.forEach(function(r){bump(r.authorType+':'+r.authorId);});});const slugs=slugById();const rogues=[];db.patrons.forEach(function(p){if(p.banned)return;rogues.push({t:'patron',id:p.id,name:p.name,avatar:p.avatar,coins:p.coins||0,posts:counts['patron:'+p.id]||0,title:tavernTitle(p.coins||0),leader:false,guild:'',streak:p.streak||0});});db.users.forEach(function(u){rogues.push({t:'member',id:u.id,slug:slugs[u.id],name:u.name,avatar:u.avatar,coins:u.coins||0,posts:counts['member:'+u.id]||0,title:u.title||tavernTitle(u.coins||0),leader:u.role==='leader',guild:u.class||'',streak:u.streak||0});});rogues.sort(function(a,b){return b.coins-a.coins||b.posts-a.posts;});res.render('rogues',{i:i,rogues:rogues});});

// ===== Tavern: streak, whispers, notices =====
function yesterdayKey(){var d=new Date();d.setDate(d.getDate()-1);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function party(t,id){if(t==='member'){var u=db.users.find(function(x){return x.id===id;});return u?{name:u.name,avatar:u.avatar}:null;}var p=db.patrons.find(function(x){return x.id===id;});return p?{name:p.name,avatar:p.avatar}:null;}
function notify(toT,toId,text){if(!Array.isArray(db.notices))db.notices=[];db.notices.push({id:nid(),toT:toT,toId:toId,text:text,ts:Date.now(),read:false});if(db.notices.length>300)db.notices=db.notices.slice(-300);}
// The gates open 10:00 Friday 9 October 2026, Las Vegas time — PDT in October,
// so seven hours behind UTC. Pinned as an absolute instant rather than "10
// o'clock wherever this happens to be running": the VPS keeps Mountain time, so
// the old local-time version counted to an hour before the faire opens, and
// disagreed with the festival's own countdown. Whole days not yet elapsed, to
// match how theirs reads — rounding up showed 62 against their 61 days 23 hours.
function countdown(){
  var open=new Date(Date.UTC(2026,9,9,17,0,0)),close=new Date(Date.UTC(2026,9,12,5,0,0)),now=new Date();
  if(now>=close)return{ended:true};
  if(now>=open)return{open:true};
  return{days:Math.floor((open-now)/86400000)};
}
app.get('/board/notices',canPost,(req,res)=>{var i=ident(req);var mine=(db.notices||[]).filter(function(n){return n.toT===i.t&&n.toId===i.id;}).sort(function(a,b){return b.ts-a.ts;});db.notices.forEach(function(n){if(n.toT===i.t&&n.toId===i.id)n.read=true;});save();res.render('notices',{i:i,notices:mine});});
app.get('/board/whispers',canPost,(req,res)=>{var i=ident(req);var mine=(db.whispers||[]).filter(function(w){return (w.fromT===i.t&&w.fromId===i.id)||(w.toT===i.t&&w.toId===i.id);});var conv={};mine.forEach(function(w){var other=(w.fromT===i.t&&w.fromId===i.id)?{t:w.toT,id:w.toId}:{t:w.fromT,id:w.fromId};var k=other.t+':'+other.id;if(!conv[k]||w.ts>conv[k].last.ts)conv[k]={other:other,last:w};});var list=Object.keys(conv).map(function(k){var c=conv[k];var p=party(c.other.t,c.other.id)||{name:'A stranger',avatar:''};var unread=mine.filter(function(w){return w.toT===i.t&&w.toId===i.id&&w.fromT===c.other.t&&w.fromId===c.other.id&&!w.read;}).length;return {other:c.other,last:c.last,name:p.name,avatar:p.avatar,unread:unread};}).sort(function(a,b){return b.last.ts-a.last.ts;});res.render('whispers',{i:i,conv:list});});
app.get('/board/whisper/:t/:id',canPost,(req,res)=>{var i=ident(req);var ot=req.params.t,oid=parseInt(req.params.id);if(ot===i.t&&oid===i.id)return res.redirect('/board/whispers');if(ot!=='member'&&ot!=='patron')return res.redirect('/board/whispers');var p=party(ot,oid);if(!p)return res.redirect('/board/whispers');var msgs=(db.whispers||[]).filter(function(w){return ((w.fromT===i.t&&w.fromId===i.id&&w.toT===ot&&w.toId===oid)||(w.fromT===ot&&w.fromId===oid&&w.toT===i.t&&w.toId===i.id));}).sort(function(a,b){return a.ts-b.ts;});db.whispers.forEach(function(w){if(w.fromT===ot&&w.fromId===oid&&w.toT===i.t&&w.toId===i.id)w.read=true;});save();res.render('whisper',{i:i,other:{t:ot,id:oid,name:p.name,avatar:p.avatar},msgs:msgs});});
app.post('/board/whisper/:t/:id',canPost,(req,res)=>{var i=ident(req);var ot=req.params.t,oid=parseInt(req.params.id);if(ot===i.t&&oid===i.id)return res.redirect('/board/whispers');var body=(req.body.body||'').trim();if(!body)return res.redirect('/board/whisper/'+ot+'/'+oid);if(!Array.isArray(db.whispers))db.whispers=[];db.whispers.push({id:nid(),fromT:i.t,fromId:i.id,toT:ot,toId:oid,body:body,ts:Date.now(),read:false});notify(ot,oid,i.name+' whispered you');save();res.redirect('/board/whisper/'+ot+'/'+oid);});

app.get('/health',(req,res)=>res.json({ok:true,t:Date.now()}));// A wrong URL used to hit Express's default and print "Cannot GET /whatever"
// on a white page with no way back. Must sit after every route, before the
// error handler.
app.use((req,res)=>{ res.status(404).render('notfound',{gates:countdown()}); });
app.use((err,req,res,next)=>{
  if(!err)return next();
  // Someone who navigates away while the hero video is still downloading aborts
  // a response Express was mid-way through streaming. The reply is already gone,
  // so answering with a 500 on top of it throws ERR_HTTP_HEADERS_SENT and buries
  // the real error under a stack trace. Hand it back to Express, which closes the
  // socket quietly. Behind nginx this rarely surfaces; running the app directly
  // it fills the log.
  if(res.headersSent)return next(err);
  if(err.code==="LIMIT_FILE_SIZE")return res.redirect("/members?e="+encodeURIComponent("Image too large - max 25MB. Try a smaller photo."));
  res.status(500).send("Error: "+(err.message||err));
});
app.listen(PORT,()=>console.log('House of Card and Coin guild app on http://localhost:'+PORT));
