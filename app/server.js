const express=require('express'),session=require('express-session'),bcrypt=require('bcryptjs'),multer=require('multer'),path=require('path'),fs=require('fs');
const app=express();
app.disable('x-powered-by'); // stop advertising the stack
const PORT=process.env.PORT||3000;
/* The code that lets somebody make an account.

   It used to be a constant here, with an environment override that was never
   set — so the only way to change it was a deploy, and a code that has been
   passed around beyond the guild is exactly the moment you cannot wait for
   one. It lives in the data now and there is a field for it in the admin
   panel; this is only the starting value for a House that has never set one.

   Letters and numbers, no punctuation. A code gets read down a phone and
   written on a hand — dashes get dropped, guessed at, or turned into spaces,
   and every one of those is somebody locked out for nothing. */
const INVITE_FALLBACK=process.env.GUILD_INVITE_CODE===undefined?'COIN2026':process.env.GUILD_INVITE_CODE;
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
// Sunday night is not offered. The faire closes at 5 on Sunday and camp comes
// down that evening — nobody sleeps in the rig that night.
const NIGHTS=['Friday, Oct 9','Saturday, Oct 10'];
// The three that can be claimed. The House's rig sleeps more than this — the
// main bunk is the Guild Elder's and another is the Guild Leader's, both theirs
// for the whole weekend rather than booked a night at a time. Those are held on
// the member record as `berth` and shown beside the board, so the page tells the
// truth about where everyone sleeps without offering the pair to anybody else.
const BUNKS=[1,2,3];

/* The bunk arithmetic, in words as well as figures, so the pages that talk
   about it read off the same two lists the board is built from.

   This exists because of Sunday. The night came out of NIGHTS, the board
   dropped to two columns as it should — and the prose around it went on saying
   "three nights" and "nine across the weekend" in three separate places,
   because those were typed out by hand. Anything that counts nights or beds
   asks here now, and the next change to either list carries the sentences with
   it. */
const NUMWORD=['no','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve'];
function bunkFacts(){
  var nights=NIGHTS.length, per=BUNKS.length, total=nights*per;
  return {
    nights:nights, perNight:per, total:total,
    nightsWord:NUMWORD[nights]||String(nights),
    perNightWord:NUMWORD[per]||String(per),
    totalWord:NUMWORD[total]||String(total)
  };
}
/* A word beside a bunk where one is wanted.

   Bunk 3 used to carry "likely a cot", which was true when nobody had
   looked properly. It is a bed — the couch or the dinette made up — so the
   warning is gone rather than softened. There is nothing to say about any
   of the three now, and an empty table is the honest way to say so.

   It still feeds all three boards, so putting a note back is one line here. */
const BUNK_NOTES={};
function heldBerths(){
  return db.users.filter(function(u){return u.berth;})
    .map(function(u){return {who:u.name,berth:u.berth,avatar:u.avatar||'',slug:slugById()[u.id]||''};});
}
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
/* The rendered pages need it too. The block below rewrites the static .html
   files as they are read; everything served through a template goes out of
   res.render instead, so that is wrapped here rather than leaving half the
   site unstamped. */
app.use(function(req,res,next){
  const render=res.render.bind(res);
  res.render=function(view,opts,cb){
    if(typeof opts==='function'){ cb=opts; opts=undefined; }
    render(view,opts,function(err,html){
      if(err)return cb?cb(err):next(err);
      const out=stampMedia(html);
      if(cb)return cb(null,out);
      res.send(out);
    });
  };
  next();
});
/* Is there a card waiting tonight? Asked of a member or a tavern regular —
   they play the same game, so the menu answers the same way for both. */
function handWaiting(rec){
  return !!rec && (rec.hand||[]).length<5 && rec.lastRation!==dayKey();
}
app.use(function(req,res,next){
  res.locals.u = req.session.uid ? (db.users.find(function(x){return x.id===req.session.uid;})||null) : null;
  res.locals.patron = (!res.locals.u && req.session.pid) ? (db.patrons.find(function(x){return x.id===req.session.pid;})||null) : null;
  // Unread notices drive the header badge, so news reaches someone wherever
  // they land — there is no email, so the site itself has to carry the word.
  var me = res.locals.u ? {t:'member',id:res.locals.u.id} : (res.locals.patron ? {t:'patron',id:res.locals.patron.id} : null);
  /* What is waiting for you, counted as one number, because it reaches you as
     one mark on one button. It used to count only the House’s own notices, so
     an unopened letter from a guildmate showed nothing at all until they
     happened to look in a room they had no reason to open. */
  res.locals.letters = me
    ? (db.whispers||[]).filter(function(w){return w.toT===me.t&&w.toId===me.id&&!w.read;}).length : 0;
  res.locals.notes = me
    ? (db.notices||[]).filter(function(n){return n.toT===me.t&&n.toId===me.id&&!n.read;}).length : 0;
  res.locals.unread = res.locals.letters + res.locals.notes;
  // The nav panel is built from this — on the EJS pages inline, so the menu is
  // right on the first paint, and on the generated static pages via /api/me,
  // which hands back exactly this object. Nothing in it is private; it is your
  // own name read back to you.
  var u=res.locals.u, p=res.locals.patron;
  res.locals.me = u
    ? {signedIn:true,kind:'member',name:u.name,avatar:u.avatar||'',rank:rank(u),pledge:!!u.pledge,leader:u.role==='leader',slug:slugById()[u.id]||'',unread:res.locals.unread,letters:res.locals.letters,card:handWaiting(u)}
    : (p&&!p.banned)
      ? {signedIn:true,kind:'patron',name:p.name,avatar:p.avatar||'',rank:'Tavern guest',pledge:false,leader:false,unread:res.locals.unread,letters:res.locals.letters,card:handWaiting(p)}
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
/* The high hand of the whole run — every round already played plus the round
   in play — which is the contest that actually stands until the faire. Not the
   leader of the current table: a round is a heat, and the best hand anybody has
   held since the game began is the thing worth wearing.

   Level rather than "whoever sorted first" — a genuine dead heat happens with a
   small guild and short hands, and a closed round is already credited to
   everybody level.

   handRank returns nothing under two cards, so nobody holds this while the best
   anyone has shown is a single card. Leading on one card is not leading. */
function highHand(){
  var best=null, held=[];
  function offer(kind,id,name,rank,when){
    if(!rank)return;
    var c=best?cmpHand(rank,best):-1;
    if(c<0){ best=rank; held=[]; }
    else if(c>0){ return; }
    // Somebody who made the same hand twice should appear once.
    var k=(kind||'member')+':'+(id!=null?id:name);
    if(!held.some(function(h){return h.k===k;}))held.push({k:k,kind:kind||'member',id:id,name:name,when:when});
  }
  (db.rounds||[]).forEach(function(r){
    (r.hands||[]).forEach(function(h){ offer(h.kind,h.id,h.name,h.rank,'Round '+r.n); });
  });
  allHands().forEach(function(h){ offer(h.kind,h.id,h.name,h.rank,'the round in play'); });

  var by={};
  held.forEach(function(h){ if(h.kind==='member'&&h.id!=null)by[h.id]=h.when; });
  return {by:by, shared:held.length>1, rank:best?best.name:'',
          names:held.map(function(h){return h.name;}), when:held.length?held[0].when:''};
}


/* The Scroll of Events, drawn from the live schedule.

   The page is still the hand-made one — its hero, its video, everything under
   the columns. Only the three day-columns are replaced, with exactly the markup
   the build script writes, so the page cannot drift from what a rebuild would
   have produced. Registered before the static-HTML middleware, because that one
   would happily serve the file with last month's times baked into it. */
// The schedule is typed by a person into a form and printed into a page, so it
// is escaped on the way out — the same guard the build script had.
function esc(x){
  return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function scheduleColumns(){
  const cfg=guildEvents();
  return (cfg.days||[]).map(function(d){
    const rows=(cfg.events||[]).filter(function(e){return e.date===d.date;})
      .sort(function(a,b){return String(a.at||'').localeCompare(String(b.at||''));})
      .map(function(e){
        return '<div class="event"><span class="t">'+esc(e.when)+'</span>'+
               '<span class="b"><b>'+esc(e.title)+'</b><br>'+esc(e.body)+'</span></div>';
      }).join('');
    return '<div class="day"><div class="day__hd"><span class="d">'+esc(d.name)+'</span>'+
           '<span class="h">'+esc(d.gates||'')+'</span></div><div class="day__bd">'+
           (rows||'<p class="muted" style="padding:10px 0">Nothing set for this day yet.</p>')+
           '</div></div>';
  }).join('');
}
app.get('/events.html',(req,res,next)=>{
  const file=path.join(__dirname,'..','events.html');
  let html; try{ html=fs.readFileSync(file,'utf8'); }catch(e){ return next(); }
  const a=html.indexOf('<!-- EVENTS:START'), tag='<!-- EVENTS:END -->', b=html.indexOf(tag);
  if(a>-1&&b>-1){
    html=html.slice(0,a)+
      '<!-- The three columns below come from the live schedule, not from this file. -->'+
      '<div class="grid grid--3">'+scheduleColumns()+'</div>'+
      html.slice(b+tag.length);
  }
  const v=assetVersion();
  html=html.replace(/(\/assets\/(?:css|js)\/[a-z0-9._-]+)(\?v=[^"']*)?/gi,'$1?v='+v);
  html=stampMedia(html);
  res.set('Content-Type','text/html; charset=utf-8');
  res.set('Cache-Control','public, max-age=0');
  res.send(html);
});
app.get('/guild.html',(req,res)=>{
  // The badge below reads off the round in play as well as the closed ones,
  // so the round has to be current before it is drawn.
  maybeCloseRound();
  const slugs=slugById();
  const ace=highHand();
  // The four specialists were described in the abstract while the people who
  // are them sat in a separate list further up. Same page, never joined.
  const byClass={};
  CLASSES.forEach(function(c){ byClass[c]=[]; });
  db.users.forEach(function(m){
    if(m.class&&byClass[m.class]) byClass[m.class].push({name:m.name,slug:slugs[m.id]||'',avatar:m.avatar||''});
  });const members=db.users.map(function(m){const bunks=db.bunks.filter(function(b){return b.userId===m.id;}).sort(function(a,b){return a.night<b.night?-1:1;}).map(function(b){return b.night+' \u00b7 Bunk '+b.bunk;});return{slug:slugs[m.id],name:m.name,avatar:m.avatar,class:m.class,rank:rank(m),pledge:!!m.pledge,faires:m.faires||0,title:m.title||'',role:m.role||'',rsvp:!!m.rsvp,bunks:bunks,ace:ace.by[m.id]||"",aceShared:ace.shared,aceRank:ace.rank};}).sort(function(a,b){const k=function(x){if(x.title==='Guild Leader')return 0;if(x.role==='leader'||x.title==='Guild Elder')return 1;if(x.pledge)return 3;return 2;};const ka=k(a),kb=k(b);if(ka!==kb)return ka-kb;return (b.faires||0)-(a.faires||0);});const bunkBoard=NIGHTS.map(function(n){return{night:n,bunks:BUNKS.map(function(b){const o=db.bunks.find(function(x){return x.night===n&&x.bunk===b;});return{bunk:b,note:BUNK_NOTES[b]||"",taken:!!o,who:o?db.users.find(function(y){return y.id===o.userId;}):null};})};});res.render('guild',{members:members,bunkBoard:bunkBoard,berths:heldBerths(),byClass:byClass,comingCount:db.users.filter(function(x){return x.rsvp;}).length});});
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
const ASSET_FILES=['assets/css/style.css','assets/css/tavern.css','assets/css/profile.css','assets/css/gallery.css','assets/css/weekend.css','assets/css/pigeon.css','assets/css/map.css','assets/css/card.css',
  'assets/js/nav.js','assets/js/keepplace.js','assets/js/countdown.js','assets/js/hero-video.js','assets/js/avatar-crop.js','assets/js/dress.js','assets/js/gallery.js','assets/js/player.js','assets/js/pigeon.js','assets/js/map-live.js','assets/js/map-sound.js','assets/js/forecast.js','assets/js/pwa.js'];
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

/* Pictures and video get the same treatment, and it took a live bug to see
   they needed it. The ✕ marking our camp on the parking map shipped and stayed
   invisible for everyone who had loaded that page before — the file had
   changed, its address had not, so browsers went on serving the copy they
   already had. It had to be stamped by hand, one file, which is not a fix.

   Not the shared version the stylesheets use, though. That one is the newest
   mtime across a fixed list, so replacing a single photograph would not move
   it and the stale copy would be served anyway — the same bug wearing a
   different hat. Every picture carries its own modified time instead, so
   changing one busts exactly one.

   Read once at boot, which is enough: a deploy restarts the app, so the stamps
   move whenever the files do. */
const MEDIA_STAMPS={};
(function readMedia(){
  const root=path.join(__dirname,'..');
  function walk(dir,web){
    let entries; try{ entries=fs.readdirSync(dir,{withFileTypes:true}); }catch(e){ return; }
    entries.forEach(function(e){
      const full=path.join(dir,e.name), url=web+'/'+e.name;
      if(e.isDirectory())return walk(full,url);
      if(!/\.(jpe?g|png|gif|webp|svg|avif|mp4|webm|ico)$/i.test(e.name))return;
      try{ MEDIA_STAMPS[url]=String(Math.floor(fs.statSync(full).mtimeMs)); }catch(e){}
    });
  }
  walk(path.join(root,'assets','img'),'/assets/img');
  walk(path.join(root,'assets','audio'),'/assets/audio');
  // the videos sit loose in assets/
  try{ fs.readdirSync(path.join(root,'assets')).forEach(function(f){
    if(!/\.(mp4|webm)$/i.test(f))return;
    MEDIA_STAMPS['/assets/'+f]=String(Math.floor(fs.statSync(path.join(root,'assets',f)).mtimeMs));
  }); }catch(e){}
})();

/* Stamps every media address in a page. The lookbehind is what keeps it to our
   own paths: a match has to start right after a quote, a bracket or an equals,
   so the /assets/ sitting inside an absolute og:image URL is left alone — a
   social scraper should be handed the address it was given, unadorned.
   Anything not in the map is left exactly as written. */
const MEDIA_RE=/(?<=["'(=\s])(\/assets\/(?:img|audio)\/[\w./-]+|\/assets\/[\w.-]+\.(?:mp4|webm))(\?v=[^"'\s)]*)?/gi;
function stampMedia(html){
  return String(html).replace(MEDIA_RE,function(whole,url){
    const v=MEDIA_STAMPS[url];
    return v?(url+'?v='+v):whole;
  });
}
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
    body=stampMedia(body);          // and the pictures, each by its own mtime
    htmlCache.clear();               // one page's change means the stamp moved for all
    htmlCache.set(key,body);
  }
  res.set('Content-Type','text/html; charset=utf-8');
  res.set('Cache-Control','public, max-age=0');
  res.send(body);
});
/* The service worker and the manifest are asked for by name, from the root,
   and both have to be served from there for the browser to accept them. */
app.get('/sw.js',(req,res)=>{
  res.set('Content-Type','application/javascript; charset=utf-8');
  res.set('Cache-Control','no-cache');   // so a new worker is always noticed
  res.sendFile(path.join(__dirname,'..','sw.js'));
});
app.get('/manifest.webmanifest',(req,res)=>{
  res.set('Content-Type','application/manifest+json; charset=utf-8');
  res.sendFile(path.join(__dirname,'..','manifest.webmanifest'));
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

/* ── Bringing a face out of the shade ───────────────────────────────
   Guild portraits are taken outdoors, in costume, half of them under a hat
   brim — and they come back with the face in shadow. Drawn as an 84px circle
   on a cream card that reads as a dark smudge, which is what the site has
   been doing to people.

   So the House lifts them, and only the ones that need it: a picture already
   well lit is handed back untouched, byte for byte. A dark one gets its
   levels pulled out to the ends first — which is what actually rescues an
   underexposed photograph — and then, if it is still gloomy, a hue-preserving
   brightening on top, capped, so a photograph taken at night comes out
   readable rather than grey and blown out. */
const FACE_FLOOR  = 104;   // below this mean brightness, and only below, we act
const FACE_TARGET = 118;   // roughly where a well-lit portrait sits
const FACE_MOST   = 30;    // the most lightness we will ever add

/* Mean brightness, measured off the pixels rather than off a histogram — the
   number that decides whether a picture is in shadow. */
async function faceLuma(buf){
  try{
    const d=await sharp(buf).removeAlpha().raw().toBuffer();
    if(!d.length) return null;
    let s=0;
    for(let n=0;n<d.length;n+=3) s+=d[n]*0.299+d[n+1]*0.587+d[n+2]*0.114;
    return s/(d.length/3);
  }catch(e){ return null; }
}

/* Takes a finished avatar, gives one back. Never throws — a picture we cannot
   read is a picture we leave alone.

   The lift is added lightness, not multiplied brightness. Multiplying scales
   the highlights along with everything else and turns a bright sky behind a
   dark face into a white one; adding lightness in LCh raises the shadows and
   leaves what is already bright roughly where it was. On the darkest portrait
   on file that is the difference between 2% of the picture blown out and 24%.

   The amount is found by bisection rather than by a formula, because how much
   a photograph brightens per unit of lightness depends on the photograph.
   Six trials, each starting from the original so nothing compounds, and the
   smallest lift that reaches a normal exposure wins. */
async function liftShade(buf){
  const dark=await faceLuma(buf);
  if(dark===null || dark>=FACE_FLOOR) return buf;
  let lo=0, hi=FACE_MOST, best=buf;
  try{
    for(let n=0;n<6;n++){
      const mid=(lo+hi)/2;
      // A little colour back with the light: shade flattens a costume as well
      // as darkening it. Gently — nobody should come out lurid.
      const out=await sharp(buf)
        .modulate({lightness:mid, saturation:1+Math.min(mid/FACE_MOST,1)*0.12})
        .jpeg({quality:82,mozjpeg:true}).toBuffer();
      const got=await faceLuma(out);
      if(got===null) return best;
      best=out;
      if(got<FACE_TARGET) lo=mid; else hi=mid;
    }
  }catch(e){ return buf; }
  return best;
}
async function shrinkAvatar(req,res,next){
  if(!req.file)return next();
  var p=req.file.path, input;
  // Read through fs rather than handing sharp the path: multer has only just
  // finished writing it, and opening it again directly fails on Windows.
  try{ input=fs.readFileSync(p); }
  catch(e){ console.log('avatar read failed, keeping original:',e.message); return next(); }
  try{
    var buf=await sharp(input).rotate()
      .resize(512,512,{fit:'cover',position:sharp.strategy.attention})
      .jpeg({quality:82,mozjpeg:true})
      .toBuffer();
    buf=await liftShade(buf);   // and out of the shade, if it was in it
    fs.writeFileSync(p,buf);
    req.file.size=buf.length;
  }catch(e){ console.log('avatar resize failed, keeping original:',e.message); }
  next();
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
const CHARM_COLOURS=['gold','seal','pale','dark'];
const CHARM_MAX=14;
function charmSvg(k){
  var art=CHARM_ART[k]; if(!art)return '';
  // currentColor rather than a baked hex: the colour then comes from CSS,
  // which is the only way a stroke-drawn charm (the key) recolours along with
  // a filled one, and the only way a wax charm can follow the wax colour you
  // actually picked instead of a default written into a stylesheet.
  return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    art.replace(/"F"/g,'"currentColor"')+'</svg>';
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
      c:CHARM_COLOURS.indexOf(c.c)>=0?c.c:'gold',
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
/* Anything that is not a letter or a number is thrown away before comparing,
   so a code written with a dash, a space or in lower case still lets somebody
   in. The House stores it tidily; the door is forgiving about how it arrives. */
const normCode=s=>String(s||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
// Read from the data every time rather than held in a constant, because it can
// now be changed from the admin panel while the app is running.
function inviteCode(){
  return typeof db.invite==='string' ? db.invite : normCode(INVITE_FALLBACK);
}
function inviteRequired(){ return inviteCode()!==''; }
/* Caps and numbers only, and none of the pairs that get misread when a code is
   said down a phone or written on the back of a hand: no O against 0, no I or
   L against 1, no S against 5, no Z against 2. */
const CODE_CHARS='ABCDEFGHJKMNPQRTUVWXY346789';
function freshCode(){
  var out='';
  for(var i=0;i<8;i++)out+=CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return out;
}
// The static marketing pages (index.html, camp.html…) have a header baked in at
// build time, so they cannot know who you are. They ask here instead.
app.get('/api/me',(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json(res.locals.me);
});
// ── The weekend, in one place ───────────────────────────────────────────────
// Who is coming, who sleeps where, what is still wanted and when the gates
// open were spread across three pages. Sixty days out this is the page people
// actually want, so it gathers them rather than adding anything new.
// A face for each thing on the bring list. Matched on words rather than kept
// against item ids, so anything the Guild Leader adds later gets one too
// without a code change. First match wins, so the specific entries sit above
// the general ones — firewood before fire, breakfast before meat.
const BRING_ICONS=[
  [/beer|ale|cider|wine|drink|booze/,'\u{1F37A}'],
  [/water|gallon/,'\u{1F4A7}'],
  [/coffee|tea|cocoa/,'☕'],
  [/breakfast|egg|bacon|pancake/,'\u{1F373}'],
  [/dessert|desert|cake|pie|sweet|cookie/,'\u{1F370}'],
  [/marshmallow|s.?more|chocolate/,'\u{1F36B}'],
  [/dish|potluck|share|casserole|chili/,'\u{1F958}'],
  [/bbq|grill|charcoal|barbec/,'\u{1F356}'],
  [/meat|steak|burger|sausage/,'\u{1F969}'],
  [/snack|chip|popcorn|pretzel/,'\u{1F37F}'],
  [/fruit|veg|salad/,'\u{1F34E}'],
  [/cooler|ice\b|icebox/,'\u{1F9CA}'],
  [/firewood|\bwood\b|\blogs?\b|kindling/,'\u{1FAB5}'],
  [/propane|gas\b|fuel|tank/,'\u{1F6E2}️'],
  [/fire|flame/,'\u{1F525}'],
  [/light|lantern|lamp|torch|candle/,'\u{1F3EE}'],
  [/decor|banner|flag|bunting|pennant/,'\u{1F56F}️'],
  [/trash|rubbish|garbage|bin/,'\u{1F5D1}️'],
  [/paper|utensil|plate|napkin|cup|cutlery|fork/,'\u{1F37D}️'],
  [/tent|canopy|shade|awning|tarp/,'⛺'],
  [/chair|seat|stool|bench/,'\u{1FA91}'],
  [/table/,'\u{1F9FA}'],
  [/blanket|bedding|pillow|sleeping|cot/,'\u{1F6CF}️'],
  [/rope|stake|hammer|mallet|tool/,'\u{1F528}'],
  [/first aid|bandage|medicine|sunscreen|bug spray/,'\u{1FA79}'],
  [/costume|garb|hat|cloak/,'\u{1F3AD}'],
  [/card|game|dice/,'\u{1F0CF}']
];
function bringIcon(name){
  var s=String(name||'').toLowerCase();
  for(var i=0;i<BRING_ICONS.length;i++) if(BRING_ICONS[i][0].test(s)) return BRING_ICONS[i][1];
  return '\u{1F4E6}';
}
function bringList(){
  return db.items.map(function(it){
    var claimed=(db.claims||[]).filter(function(c){return c.itemId===it.id;})
      .reduce(function(s,c){return s+c.qty;},0);
    return {id:it.id,name:it.name,need:it.need,claimed:claimed,icon:bringIcon(it.name),
            remaining:Math.max(0,it.need-claimed)};
  });
}
app.get('/weekend',(req,res)=>{
  const i=ident(req);
  const coming=db.users.filter(function(u){return u.rsvp;})
    .map(function(u){return {name:u.name,avatar:u.avatar||'',slug:slugById()[u.id]||'',rank:rank(u)};});
  const board=NIGHTS.map(function(n){
    return {night:n,bunks:BUNKS.map(function(b){
      const o=db.bunks.find(function(x){return x.night===n&&x.bunk===b;});
      const who=o?db.users.find(function(y){return y.id===o.userId;}):null;
      return {bunk:b,note:BUNK_NOTES[b]||'',taken:!!o,
              who:who?{name:who.name,avatar:who.avatar||'',slug:slugById()[who.id]||''}:null};
    })};
  });
  const list=bringList();
  res.render('weekend',{over:countdown().ended===true,finest:highHand(),
    i:i, gates:countdown(), coming:coming, board:board, berths:heldBerths(), day:dayContact(i),
    wanted:list.filter(function(x){return x.remaining>0;}).sort(function(a,b){return b.remaining-a.remaining;}),
    covered:list.filter(function(x){return x.remaining===0;}).length,
    items:list.length, bunksLeft:board.reduce(function(s,d){return s+d.bunks.filter(function(b){return !b.taken;}).length;},0)
  });
});

// ── The gallery ─────────────────────────────────────────────────────────────
// Faire pictures, put up by whoever took them. Two copies are kept: a full one
// no larger than 1600px for looking at, and a square thumb for the grid, so a
// wall of forty pictures does not cost forty full photographs to open.
//
// Everything is re-encoded through sharp on the way in rather than stored as
// sent. That resizes it, and it also drops the metadata a phone attaches —
// including where the picture was taken, which has no business on a public
// page.
if(!Array.isArray(db.photos))db.photos=[];
const PHOTO_MAX=300;
/* Every uploaded picture is re-encoded before it is kept: turned the right way
   up, capped at 1600px, and given a 500px square thumbnail. It handles a whole
   batch now rather than a single file.

   One bad picture in a batch of twenty must not lose the other nineteen, so
   each is dealt with on its own and the failures are counted rather than
   thrown. And they go through one after another, not all at once: forty phone
   photographs through sharp in parallel is a memory spike on a small box, and
   nobody minds waiting a moment for forty pictures. */
async function shrinkPhoto(req,res,next){
  var files=req.files ? req.files.slice() : (req.file ? [req.file] : []);
  req.shots=[]; req.photoDropped=0;
  for(var n=0;n<files.length;n++){
    var f=files[n], input;
    try{ input=fs.readFileSync(f.path); }
    catch(e){ req.photoDropped++; continue; }
    try{
      var full=await sharp(input).rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true})
        .jpeg({quality:78,mozjpeg:true}).toBuffer();
      fs.writeFileSync(f.path,full);
      var thumb=await sharp(input).rotate().resize(500,500,{fit:"cover",position:sharp.strategy.attention})
        .jpeg({quality:72,mozjpeg:true}).toBuffer();
      fs.writeFileSync(f.path+"t",thumb);
      req.shots.push({file:f.filename,thumb:f.filename+"t"});
    }catch(e){
      // Not something sharp could open, whatever it claimed to be. Thrown away
      // rather than left sitting unprocessed in uploads.
      try{ fs.unlinkSync(f.path); }catch(x){}
      req.photoDropped++;
    }
  }
  // The single-file uploads elsewhere — an avatar, a picture for your own page
  // — still read req.file and req.thumbName, so those keep working unchanged.
  if(req.shots.length) req.thumbName=req.shots[0].thumb;
  else if(req.file){ req.file=null; req.photoBad="was not a picture we could read"; }
  next();
}
function galleryWall(){
  return (db.photos||[]).slice().sort(function(a,b){return b.ts-a.ts;}).map(function(ph){
    var f=faceNow(ph.byT,ph.byId,ph.byAvatar,ph.byName);
    return {id:ph.id,file:ph.file,thumb:ph.thumb||ph.file,caption:ph.caption||'',ts:ph.ts,
            who:f.name,avatar:f.avatar,byT:ph.byT,byId:ph.byId,
            slug:ph.byT==='member'?(slugById()[ph.byId]||''):''};
  });
}
app.get('/gallery',(req,res)=>{
  const i=ident(req);
  res.render('gallery',{i:i,photos:galleryWall(),q:req.query,
    leader:!!(i&&i.leader),canAdd:!!i,max:PHOTO_MAX});
});
/* Up to twenty at a press. Twenty because it is an evening's worth from a
   phone, and because the whole batch is one request that has to finish before
   the page comes back — forty at a time on a bad connection is a form that
   looks broken while it is working.

   The caption goes on all of them, which is what a batch from one moment
   actually wants: "Saturday by the fire" written once across the nine
   pictures of it. */
app.post('/gallery/add',canPost,up.array('photo',20),shrinkPhoto,(req,res)=>{
  const i=ident(req);
  const room=PHOTO_MAX-(db.photos||[]).length;
  if(room<=0)return res.redirect('/gallery?e='+encodeURIComponent('The wall is full. Ask the Guild Leader to clear some space.'));
  if(!req.shots.length)
    return res.redirect('/gallery?e='+encodeURIComponent(req.photoDropped
      ? 'Nothing there was a picture we could read. Try another.'
      : 'Nothing came through. Pick a picture and try again.'));

  // If more were picked than the wall can hold, the ones that fit still go up
  // and the rest are said out loud rather than silently dropped.
  const going=req.shots.slice(0,room), noRoom=req.shots.slice(room);
  const caption=String(req.body.caption||'').trim().slice(0,140);
  going.forEach(function(sh){
    db.photos.push({id:nid(),byT:i.t,byId:i.id,byName:i.name,byAvatar:i.avatar||'',
      file:'/uploads/'+sh.file, thumb:'/uploads/'+sh.thumb,
      caption:caption, ts:Date.now()});
  });
  // Anything that could not be hung does not get left lying in uploads.
  noRoom.forEach(function(sh){
    try{ fs.unlinkSync(path.join(__dirname,"uploads",sh.file)); }catch(e){}
    try{ fs.unlinkSync(path.join(__dirname,"uploads",sh.thumb)); }catch(e){}
  });
  save();
  res.redirect('/gallery?added='+going.length+
    (req.photoDropped?'&skipped='+req.photoDropped:'')+
    (noRoom.length?'&full='+noRoom.length:''));
});
/* Add a picture from your own page rather than trekking to the photo wall.
   Same store and the same path through shrinkPhoto, so it is shrunk and has
   its EXIF stripped exactly as a wall upload is — one pipeline, not two. It
   lands on the wall as well, which the panel says out loud so nobody posts a
   picture expecting it to be private. */
app.post("/members/page/picture",au,up.single("photo"),shrinkPhoto,(req,res)=>{
  const u=cur(req); if(!u) return res.redirect("/members/login");
  const back="/guild/"+(slugById()[u.id]||"")+"#pics";
  if(req.photoBad||!req.file) return res.redirect(back);
  if((db.photos||[]).length>=PHOTO_MAX) return res.redirect(back);
  db.photos.push({id:nid(),byT:"member",byId:u.id,byName:u.name,byAvatar:u.avatar||"",
    file:"/uploads/"+req.file.filename, thumb:"/uploads/"+(req.thumbName||req.file.filename),
    caption:String(req.body.caption||"").trim().slice(0,140), ts:Date.now()});
  save();res.redirect(back);
});
/* Take one down again, from your own page. */
app.post("/members/page/picture/:id/remove",au,(req,res)=>{
  const u=cur(req); if(!u) return res.redirect("/members/login");
  const ph=(db.photos||[]).find(function(x){return x.id==req.params.id;});
  const back="/guild/"+(slugById()[u.id]||"")+"#pics";
  if(!ph) return res.redirect(back);
  if(!(ph.byT==="member"&&ph.byId===u.id) && u.role!=="leader") return res.status(403).send("Not yours");
  db.photos=db.photos.filter(function(x){return x.id!==ph.id;});
  save();res.redirect(back);
});
app.post('/gallery/:id/remove',canPost,(req,res)=>{
  const i=ident(req);
  const ph=(db.photos||[]).find(function(x){return x.id==req.params.id;});
  if(!ph)return res.redirect('/gallery');
  if(!(ph.byT===i.t&&ph.byId===i.id)&&!i.leader)return res.status(403).send('Not yours to take down');
  // take the files with it, or uploads fills up with pictures nobody can see
  [ph.file,ph.thumb].forEach(function(u){
    if(u&&u.indexOf('/uploads/')===0){
      try{ fs.unlinkSync(path.join(__dirname,u.replace('/uploads/','uploads/'))); }catch(e){}
    }
  });
  db.photos=db.photos.filter(function(x){return x.id!=req.params.id;});
  save();res.redirect('/gallery?removed=1');
});

// ── Vouching for a pledge ───────────────────────────────────────────────────
// Better that people are brought in by somebody than that strangers wander in.
// A sworn guildmate can speak for a pledge; the Guild Leader still decides, by
// hand, as she always has. A vouch informs that, it does not perform it.
//
// Only sworn guildmates may vouch — a pledge vouching for a pledge is two
// strangers agreeing with each other, which is worth nothing. Nobody may vouch
// for themselves.
if(!Array.isArray(db.vouches))db.vouches=[];
function isSworn(u){ return !!u && !u.pledge; }
function vouchesFor(userId){
  return (db.vouches||[]).filter(function(v){return v.forId===userId;})
    .sort(function(a,b){return a.ts-b.ts;})
    .map(function(v){
      var by=db.users.find(function(x){return x.id===v.byId;});
      return {id:v.id, byId:v.byId, word:v.word||'', ts:v.ts,
              who:by?by.name:(v.byName||'a guildmate'),
              avatar:by?(by.avatar||''):'',
              slug:by?(slugById()[by.id]||''):''};
    });
}
app.post('/guild/:slug/vouch',au,(req,res)=>{
  const me=cur(req);
  const hit=slugMap().find(function(x){return x.slug===req.params.slug;});
  if(!hit)return res.redirect('/guild.html');
  const them=hit.u, page='/guild/'+hit.slug, back=page+'#vouch';
  // The query has to come before the fragment or it is simply part of it,
  // which is how these messages were being lost.
  const nope=function(msg){ return page+'?e='+encodeURIComponent(msg)+'#vouch'; };
  if(!isSworn(me))   return res.redirect(nope('Only sworn guildmates may speak for a pledge.'));
  if(me.id===them.id)return res.redirect(nope('You cannot speak for yourself.'));
  if(!them.pledge)   return res.redirect(nope(them.name+' is already sworn to the House.'));
  if((db.vouches||[]).some(function(v){return v.forId===them.id&&v.byId===me.id;}))
    return res.redirect(nope('You have already spoken for them.'));
  db.vouches.push({id:nid(),forId:them.id,byId:me.id,byName:me.name,
    word:String(req.body.word||'').trim().slice(0,300),ts:Date.now()});
  notify('member',them.id,me.name+' has spoken for you to the House.');
  const leader=db.users.find(function(x){return x.role==='leader';});
  if(leader&&leader.id!==me.id)notify('member',leader.id,me.name+' vouched for '+them.name+' — a pledge awaiting your word.');
  tellHer(me.name+' spoke for '+them.name+', a pledge waiting on your word.');
  save();res.redirect(back);
});
app.post('/guild/vouch/:id/withdraw',au,(req,res)=>{
  const me=cur(req);
  const v=(db.vouches||[]).find(function(x){return x.id==req.params.id;});
  if(!v)return res.redirect('/guild.html');
  if(v.byId!==me.id&&me.role!=='leader')return res.status(403).send('Not yours to withdraw');
  const them=db.users.find(function(u){return u.id===v.forId;});
  db.vouches=db.vouches.filter(function(x){return x.id!=req.params.id;});
  save();
  res.redirect('/guild/'+(them?slugById()[them.id]:'')+'#vouch');
});
/* ── The purse ──────────────────────────────────────────────────────────────
   Coins were a single running number, so "you have 34" was the whole story and
   there was no way to answer where they came from or why the total dropped
   after buying a card. This keeps a ledger beside the number.

   Two running totals rather than counting the log, because the log is trimmed
   and the totals must stay true for someone who has been drawing cards for
   months. The log is the recent story; earned and spent are the accounts. */
const PURSE_KEEP = 40;                 // entries held; the totals outlive them

/* Everybody who already had coins predates the ledger. Rather than pretend
   their balance came from nowhere, their history is folded into one opening
   line that makes the arithmetic add up: what they hold now, plus what the
   cards they bought early cost them. */
function ensurePurse(rec) {
  if (typeof rec.earned === 'number') return false;
  var spent = (rec.bought || 0) * CARD_PRICE;
  rec.spent  = spent;
  rec.earned = (rec.coins || 0) + spent;
  rec.purse  = [];
  if (rec.earned) rec.purse.push({ ts: 0, n: rec.earned, why: 'Earned before the House kept a ledger' });
  if (spent) rec.purse.push({ ts: 0, n: -spent,
    why: rec.bought + ' card' + (rec.bought === 1 ? '' : 's') + ' bought early' });
  return true;
}

function purseAdd(rec, n, why) {
  ensurePurse(rec);
  // ensurePurse only writes the log when it writes the totals, so a record that
  // has totals and no log slips past it and the next line would throw. Drawing
  // a card should never 500 over its own bookkeeping.
  if (!Array.isArray(rec.purse)) rec.purse = [];
  if (!n) return;
  if (n > 0) rec.earned += n; else rec.spent += -n;
  rec.purse.push({ ts: Date.now(), n: n, why: why });
  if (rec.purse.length > PURSE_KEEP) rec.purse = rec.purse.slice(-PURSE_KEEP);
}

// Newest first for reading. Kept out of the public page — the balance is
// already on the sheet for anyone, but where a person's coin came from is
// their own business.
function purseFor(u) {
  // The opening line is written once, the first time anybody looks. Reading a
  // page should not normally write to the file, but leaving it unsaved means
  // recomputing it on every view and losing it at the next restart.
  if (ensurePurse(u)) save();
  return {
    coins:  u.coins || 0,
    earned: u.earned || 0,
    spent:  u.spent || 0,
    log:    (u.purse || []).slice().reverse()
  };
}

/* Where more coin comes from — read off the rules as they actually are, and
   off this person's own state, so it is advice rather than a rulebook. There
   is one tap and one drain in this economy; saying so plainly beats inventing
   errands nobody is really being paid for. */
function coinWays(u) {
  var out = [];
  var held    = (u.hand || []).length;
  var drewToday = u.lastRation === dayKey();
  var onAChain  = u.lastRation === dayKey() || u.lastRation === yesterdayKey();
  // The bonus the next draw will pay, whenever it happens. One expression
  // covers both cases: if tonight is still owed, the streak has not been
  // incremented yet and this is tonight's; if tonight is already drawn, it
  // has been, and this is tomorrow's. Either way it is the run they are on
  // plus the night they are about to add, capped where the rule caps it.
  var nextBonus = onAChain ? Math.min((u.streak || 0) + 1, 7) : 1;

  if (held >= 5) {
    out.push({ pay: 'done', say: 'Your hand is full. Five cards is the whole hand and there is no sixth night, so the nightly coin has run its course for you.' });
  } else if (!drewToday) {
    out.push({ pay: (1 + nextBonus) + '–' + (3 + nextBonus),
      say: 'Tonight’s card is still waiting. The card itself pays 1 to 3 by its rank, and turning up pays ' + nextBonus + ' on top.',
      act: 'Take tonight’s card', go: '/card' });
  } else {
    out.push({ pay: (1 + nextBonus) + '–' + (3 + nextBonus),
      say: 'Tonight’s card is drawn. Come back tomorrow and the next one pays ' + nextBonus + ' for turning up, on top of the card.' });
  }

  if (held < 5) {
    // Only claim a run they are actually on. A streak of three that ended a
    // week ago is not "you are three nights in" — it is a broken chain, and
    // the warning below is the honest thing to say about it.
    out.push({ pay: '+1 a night',
      say: 'The bonus for turning up grows by one each night in a row, up to seven. ' +
           (onAChain && u.streak > 1 ? 'You are ' + u.streak + ' nights in.'
                                     : 'Two nights running is where it starts to tell.') });
    out.push({ pay: '1 → 3',
      say: 'Cards are not worth the same. A low card pays 1, a ten or a face card pays 3. That part is luck and nothing else.' });
  }

  if (!onAChain && u.lastRation) {
    out.push({ pay: 'careful', warn: true,
      say: 'You have missed a night, so the next card starts the count again at one. The chain is the part worth guarding.' });
  }

  // Nothing to spend it on once the hand is full — the route refuses a sixth
  // card, so offering the purchase there would be an advert for a locked door.
  if (held < 5) out.push({ pay: '−' + CARD_PRICE,
    // The old copy said "four in a lifetime", inherited from when a hand was
    // dealt once and never again. Rounds reset the table, and somebody who
    // never takes the free card could buy all five, so both halves were wrong.
    say: 'The only thing to spend on: ' + CARD_PRICE + ' coins buys the next card now instead of tomorrow. It never buys a better card — the deal is still random — and a hand is five, so five is the most anyone can buy in a round.' });

  return out;
}

// What your own page is still missing. Only you ever see these, only while the
// thing is missing, and never more than three at once — the point is a nudge,
// not a list of everything you have failed to do. Ordered by what actually
// makes a page look like a person: a face first, then whether you are coming,
// then your own words.
function nudgesFor(u){
  var all=[
    { k:'face',   when:!u.avatar,
      say:'Your circle is empty. Put a face to the name.',
      act:'Add a face', go:'/members#profile' },
    { k:'coming', when:!u.rsvp,
      say:'Are you coming in October? The House would like to know.',
      act:'Say yes', go:'/members#rsvp' },
    { k:'word',   when:!u.motto&&!u.about,
      say:'Nothing here says who you are yet. A line will do it.',
      act:'Write one', dress:'pgMotto' },
    { k:'class',  when:!u.class,
      say:'Dealer, reader, broker or sellsword? Say which you are.',
      act:'Pick one', go:'/members#profile' },
    { k:'card',   when:!(u.hand||[]).length,
      say:'The House deals a card a night and you are holding none.',
      act:'Take tonight’s', go:'/board' }
  ];
  return all.filter(function(n){return n.when;}).slice(0,3);
}
// Marks on a page: what somebody has actually done, counted from what the site
// already holds rather than by anybody awarding anything. Only earned marks are
// shown — a page full of zeroes says nothing, and a new pledge should not open
// their own page to a list of things they have not done.
function marksFor(u){
  var out=[];
  var said=0;
  db.threads.forEach(function(t){
    if(t.authorType==='member'&&t.authorId===u.id)said++;
    (t.replies||[]).forEach(function(r){ if(r.authorType==='member'&&r.authorId===u.id)said++; });
  });
  var shot=(db.photos||[]).filter(function(p){return p.byT==='member'&&p.byId===u.id;}).length;
  var signed=(db.wall||[]).filter(function(w){return w.toId===u.id;}).length;
  var took=champions().filter(function(c){return c.kind==='member'&&c.name===u.name;})[0];
  var bunks=(db.bunks||[]).filter(function(b){return b.userId===u.id;}).length;

  if(u.faires)  out.push({n:u.faires, w:'faire'+(u.faires===1?'':'s')+' camped'});
  if(took&&took.taken) out.push({n:took.taken, w:'round'+(took.taken===1?'':'s')+' taken', gold:true});
  if(u.streak>1) out.push({n:u.streak, w:'nights in a row'});
  if(said)      out.push({n:said,     w:'line'+(said===1?'':'s')+' by the fire'});
  if(shot)      out.push({n:shot,     w:'picture'+(shot===1?'':'s')+' on the wall'});
  if(signed)    out.push({n:signed,   w:'signature'+(signed===1?'':'s')+' on their scroll'});
  if(bunks)     out.push({n:bunks,    w:'night'+(bunks===1?'':'s')+' bunked'});
  if(u.coins)   out.push({n:u.coins,  w:'coins'});
  return out;
}
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
    page:pageOf(u), marks:marksFor(u), vouches:vouchesFor(u.id),
    photos:(db.photos||[]).filter(function(ph){return ph.byT==="member"&&ph.byId===u.id;})
      .sort(function(a,b){return b.ts-a.ts;})
      .map(function(ph){return {id:ph.id,file:ph.file,thumb:ph.thumb||ph.file,caption:ph.caption||""};}),
    // The balance is on the sheet for anyone to see; where it came from and
    // what to do about it is only ever shown to its owner.
    purse:(i&&i.t==='member'&&i.id===u.id)?purseFor(u):null,
    ways:(i&&i.t==='member'&&i.id===u.id)?coinWays(u):[],
    canVouch:!!(i&&i.t==='member'&&i.id!==u.id&&u.pledge&&isSworn(db.users.find(function(x){return x.id===i.id;}))),
    vouchedAlready:!!(i&&i.t==='member'&&(db.vouches||[]).some(function(v){return v.forId===u.id&&v.byId===i.id;})), nudges:(i&&i.t==='member'&&i.id===u.id)?nudgesFor(u):[], charmSvg:charmSvg, charmKeys:CHARM_KEYS, charmMax:CHARM_MAX,
    fonts:FONTS, fontKeys:FONT_KEYS, sizeKeys:SIZE_KEYS, sizes:SIZES,
    backdrops:BACKDROPS, layouts:LAYOUTS,
    wall:wallFor(u.id), canSign:!!i, i:i, leader:!!(i&&i.leader), q:req.query,
    isMe:!!(i&&i.t==='member'&&i.id===u.id), slug:hit.slug,
    // Whispering used to hide behind the little figures in the tavern room.
    // Those now lead here, so the door has to be on this page instead.
    canWhisper:!!(i&&!(i.t==='member'&&i.id===u.id)), whisperTo:'/board/whisper/member/'+u.id
  });
});
// ── Signing someone's scroll ────────────────────────────────────────────────
// Anyone with a seat may leave a line on a guildmate's page; anyone at all may
// read it. Like the Tavern, the note remembers who wrote it rather than what
// they looked like, so a face is looked up fresh every time it is drawn.
if(!Array.isArray(db.wall))db.wall=[];
function wallFor(userId){
  return (db.wall||[]).filter(function(w){return w.toId===userId;})
    .sort(function(a,b){return b.ts-a.ts;})
    .map(function(w){
      var f=faceNow(w.fromT,w.fromId,w.fromAvatar,w.fromName);
      return {id:w.id,body:w.body,ts:w.ts,who:f.name,avatar:f.avatar,
              fromT:w.fromT,fromId:w.fromId,
              slug:w.fromT==='member'?(slugById()[w.fromId]||''):''};
    });
}
app.post('/guild/:slug/sign',canPost,(req,res)=>{
  const hit=slugMap().find(function(x){return x.slug===req.params.slug;});
  if(!hit)return res.redirect('/guild.html');
  const i=ident(req);
  const body=String(req.body.body||'').trim().slice(0,400);
  const back='/guild/'+hit.slug+'#wall';
  // Same trap as the vouch route: a query after the fragment is part of the
  // fragment, so this message was never reaching the page.
  if(!body)return res.redirect('/guild/'+hit.slug+'?e='+encodeURIComponent('Say something first')+'#wall');
  db.wall.push({id:nid(),toId:hit.u.id,fromT:i.t,fromId:i.id,fromName:i.name,fromAvatar:i.avatar||'',body:body,ts:Date.now()});
  // Tell them, unless they are signing their own — the House does not need to
  // notify anybody that they have spoken to themselves.
  if(!(i.t==='member'&&i.id===hit.u.id)){
    notify('member',hit.u.id,i.name+' signed your scroll — “'+(body.length>90?body.slice(0,90)+'…':body)+'”');
  }
  save();res.redirect(back);
});
app.post('/guild/wall/:id/remove',canPost,(req,res)=>{
  const i=ident(req);
  const w=(db.wall||[]).find(function(x){return x.id==req.params.id;});
  if(!w)return res.redirect('/guild.html');
  // Whoever wrote it, whoever's page it is on, or the Guild Leader.
  const mine=w.fromT===i.t&&w.fromId===i.id;
  const myPage=i.t==='member'&&i.id===w.toId;
  if(!mine&&!myPage&&!i.leader)return res.status(403).send('Not yours to strike');
  db.wall=db.wall.filter(function(x){return x.id!=req.params.id;});
  save();
  const owner=db.users.find(function(u){return u.id===w.toId;});
  res.redirect('/guild/'+(owner?slugById()[owner.id]:'')+'#wall');
});
/* What the House is giving away. Kept sealed on purpose — half the pull of
   the game is not knowing. The Guild Leader writes them from Administration
   and can unseal them whenever she likes, so revealing at the faire needs no
   code change. Stored on db so they survive a restart. */

/* ── The card, at its own door ─────────────────────────────────────
   The nightly card has always lived halfway down the Tavern, under the room
   and the evening’s talk. That is right for somebody who has come in for the
   evening and wrong for somebody who has one thing to do — and one thing to
   do is what most people have, most nights.

   Same card, same hand, same buttons. What is different is that this address
   can be said out loud, opens on the card rather than scrolling to it, and
   carries none of the talk with it.

   Everything that can act from here posts back to the Tavern’s own routes and
   is sent home again by backTo — there is one card game, not two. */
app.get('/card',(req,res)=>{
  maybeCloseRound();   // before the hand is read, as everywhere else
  const i=identRich(req);
  if(!i)return res.redirect('/members/login?next='+encodeURIComponent('/card'));
  // Your hand, your purse, your streak. Never kept on a phone.
  keepOffThePhone(res);
  const high=highHand();
  res.render('card',{
    i:i,
    err:String(req.query.e||''),
    hand:(i.hand||[]).map(cardInfo),
    handRank:handRank(i.hand||[]),
    ration:{canDraw:i.lastRation!==dayKey(), card:i.lastCard||null},
    handPrizes:HAND_PRIZES, cardPrice:CARD_PRICE, redealPrice:REDEAL_PRICE,
    roundEnds:roundEnds(), roundNo:db.rounds.length+1,
    // The card taken tonight, already named — so the page can say what just
    // happened without going looking for it.
    drew:(i.lastRation===dayKey() && i.lastCard && i.lastCard.code!=null)
      ? Object.assign({},cardInfo(i.lastCard.code),{bonus:i.lastCard.bonus||0,streak:i.lastCard.streak||0})
      : null,
    high:high
  });
});

/* Where a card button sends you back to.

   The draw, the buy and the re-deal are the Tavern’s routes, and they used to
   end by dropping you at /board#hand whoever had pressed them. Now that the
   card has a door of its own, a button pressed there has to come home there.

   An allowlist rather than trusting the field: a form value that becomes a
   redirect is an open redirect, and there are only ever two places this can
   mean. */
function backTo(req,fallback){
  return String(req.body&&req.body.back||'')==='/card' ? '/card' : (fallback||'/board#hand');
}
/* And the same for a refusal — "you cannot afford that" has to be said on the
   page you said it from. */
function backErr(req,msg){
  const to=backTo(req);
  return to==='/card' ? '/card?e='+encodeURIComponent(msg)
                      : '/board?e='+encodeURIComponent(msg)+'#hand';
}

app.get("/board/roll",(req,res)=>{maybeCloseRound();const i=ident(req);
  /* How many hands are level at the front. The table is sorted, so they are
     the first N. Only one tile used to be marked "leading", which disagreed
     with both the roster badge and the way a closed round credits a dead heat
     to everybody level. Nothing is marked while the top hand is unranked —
     under two cards there is no hand to lead with. */
  const _t=allHands(), _top=_t[0];
  const atTop=(_top&&_top.rank)?_t.filter(function(h){return cmpHand(h.rank,_top.rank)===0;}).length:0;
  res.render("roll",{i:i,rounds:roll(),champions:champions(),table:_t,atTop:atTop,high:highHand(),roundEnds:roundEnds(),roundDays:ROUND_DAYS,roundNo:db.rounds.length+1,slugs:slugById(),q:req.query,leader:!!(i&&i.leader),gates:countdown(),prizes:db.prizes||{first:"",second:"",shown:false}});});
app.post("/members/admin/prizes",al,(req,res)=>{
  // Keeps whatever pictures are already attached — this form only carries the
  // words and the seal, and rebuilding the record from scratch used to throw
  // the rest of it away.
  var keep=db.prizes||{};
  db.prizes={first:String(req.body.first||"").trim().slice(0,140),
             second:String(req.body.second||"").trim().slice(0,140),
             firstImg:keep.firstImg, secondImg:keep.secondImg,
             shown:!!req.body.shown};
  if(!db.prizes.firstImg)delete db.prizes.firstImg;
  if(!db.prizes.secondImg)delete db.prizes.secondImg;
  save();res.redirect("/members?prizes=1#prizes");
});
/* A picture of the prize itself.

   The Roll promised "something worth the walk" and showed a wax seal, which
   is the right amount of mystery for a thing nobody had chosen yet. Now that
   there is an actual object to win, a photograph of it does the persuading —
   and it stays behind the seal with the words until the seal is broken, so
   nothing is given away early.

   Kept square and small: it sits in a card beside its own name, not on a wall
   of its own. */
function shrinkPrize(req,res,next){
  if(!req.file)return next();
  var f=req.file, input;
  try{ input=fs.readFileSync(f.path); }
  catch(e){ req.file=null; return next(); }
  sharp(input).rotate().resize(760,760,{fit:"cover",position:sharp.strategy.attention})
    .jpeg({quality:80,mozjpeg:true}).toBuffer()
    .then(function(out){ fs.writeFileSync(f.path,out); next(); })
    .catch(function(){ try{ fs.unlinkSync(f.path); }catch(x){} req.file=null; next(); });
}
app.post('/members/admin/prize-pic',al,up.single('pic'),shrinkPrize,(req,res)=>{
  var which=req.body.which==='first'?'first':'second';
  if(!db.prizes)db.prizes={first:"",second:"",shown:false};
  var key=which+"Img";

  // Taking one down. The file goes with it rather than lingering in uploads.
  if(req.body.remove){
    var had=db.prizes[key];
    if(had)try{ fs.unlinkSync(path.join(__dirname,"uploads",had.replace("/uploads/",""))); }catch(e){}
    delete db.prizes[key];
    save();
    return res.redirect('/members?prizes=1#prizes');
  }
  if(!req.file)
    return res.redirect('/members?e='+encodeURIComponent('That was not a picture we could read. Try another.')+'#prizes');

  // The one it replaces is deleted, so swapping the prize does not leave the
  // old one on disk forever.
  var old=db.prizes[key];
  if(old)try{ fs.unlinkSync(path.join(__dirname,"uploads",old.replace("/uploads/",""))); }catch(e){}
  db.prizes[key]="/uploads/"+req.file.filename;
  save();
  res.redirect('/members?prizes=1#prizes');
});
/* One source of truth for the map hotspots — tools/map-spots.json. This page
   reads it live; the homepage gets the same spots written into it by
   tools/build-map.js, because it is static HTML with no template behind it.
   Read per request rather than at boot so editing the JSON shows up on a
   refresh without a restart. */
app.get("/map",(req,res)=>{
  var cfg={spots:[],art:"/assets/img/shire-map.jpg"};
  try{ cfg=JSON.parse(fs.readFileSync(path.join(__dirname,"..","tools","map-spots.json"),"utf8")); }catch(e){}
  var art=path.join(__dirname,"..",String(cfg.art).replace(/^\//,""));
  var stamp="";
  try{ stamp="?v="+Math.floor(fs.statSync(art).mtimeMs); }catch(e){}
  res.render("map",{hasArt:fs.existsSync(art),cfg:cfg,spots:cfg.spots,art:cfg.art+stamp});
});
// The card game's rules are explained on the FAQ from the constants that run
// it, so the page cannot quietly disagree with the game.

/* ── The weekend itself ─────────────────────────────────────────────────────
   The FAQ answers thirty-one questions in seven groups, which is right for
   somebody deciding in September whether to come and wrong for somebody stood
   in a car park at seven on the Friday. They want five things and none of them
   are pictures.

   So the same page grows a short block at the top, for the weekend only. No
   second page to keep in step, and no extra weight — it is words, and the FAQ
   is already the lightest page on the site.

   It opens the evening before the gates, because camp goes up on the Thursday,
   and closes when the faire does. */
const CAMP_AT={lat:36.067409,lon:-115.116975};   // the middle of our lot, off the park map
function onTheDay(){
  const open=Date.UTC(2026,9,9,17,0,0), close=Date.UTC(2026,9,12,0,0,0), now=Date.now();
  if(now<open-24*3600*1000 || now>=close)return null;

  // What is on next, and anything else still to come today.
  const cfg=guildEvents();
  const soon=(cfg.events||[]).map(function(e){
      return {when:e.when,title:e.title,body:e.body,
              ts:Date.parse(e.date+"T"+(e.at||"12:00")+":00-07:00")};
    }).filter(function(e){ return e.ts && e.ts>now; })
    .sort(function(a,b){ return a.ts-b.ts; }).slice(0,3);

  // What the camp is still short of.
  const wanted=bringList().filter(function(x){ return x.remaining>0; })
    .sort(function(a,b){ return b.remaining-a.remaining; }).slice(0,6);

  return {
    open: now>=open,
    maps: "https://maps.google.com/?q="+CAMP_AT.lat+","+CAMP_AT.lon,
    next: soon,
    wanted: wanted,
    stillWanted: bringList().filter(function(x){ return x.remaining>0; }).length
  };
}

/* ── Kept on a phone ────────────────────────────────────────────────────────
   The site can be installed now, and the worker that comes with it keeps a
   copy of a few public pages so the camp page and the answers still open in a
   park with no signal.

   Which is only safe because of this: any page the House has written
   something personal into says so on the way out, and the phone throws those
   away rather than keeping them. The FAQ is the one that matters — signed in
   it carries the Elder's emergency number, and a copy of that sitting on a
   phone after somebody signs out is exactly the thing not to do. */
function keepOffThePhone(res){ res.set('X-Private','1'); res.set('Cache-Control','private, no-store'); }

/* What the phone shows when it has the House but not the tower. */
app.get('/offline',(req,res)=>res.render('offline'));
app.get('/faq',(req,res)=>{
  const day=dayContact(ident(req));
  // Signed in as a sworn guildmate, this page carries her number. That copy
  // must never be kept.
  if(day && day.phone) keepOffThePhone(res);
  res.render('faq',{day:day,bunkFacts:bunkFacts(),today:onTheDay(),
    game:{price:CARD_PRICE,redeal:REDEAL_PRICE,days:ROUND_DAYS,tiers:coinTiers(),ladder:coinLadder(),first:coinFirstRound(),
          titles:COIN_TITLES}});
});
/* Coming in through a door you were sent to.

   Tapping "Tonight’s card" on a phone that has been signed out lands here.
   Without this you sign in, arrive at the Guild Hall, and have to go and find
   the card again — which is the whole thing this was meant to stop.

   One allowed destination, matched literally. A redirect built out of a form
   field is an open redirect, and there is exactly one place this ever needs
   to mean. */
function wasHeadedFor(v){ return String(v||'')==='/card' ? '/card' : ''; }
app.get('/members/login',(req,res)=>res.render('login',{err:req.query.e||'',code:req.query.code||'',
  needCode:inviteRequired(),next:wasHeadedFor(req.query.next)}));
// /join is the share link. If an invite code is required, ?code=XXXX pre-fills it.
app.get('/join',(req,res)=>res.render('login',{err:req.query.e||'',code:req.query.code||'',needCode:inviteRequired()}));
/* A pledge used to appear in silence — the only person who knew was the
   Guild Leader, and only if she went looking. Vouching cannot happen if the
   people who might know the newcomer are never told there is one. So every
   sworn guildmate hears about it, with the ask attached. */
function tellTheHouse(newcomer){
  /* And a word to the Guild Leader, because a pledge is hers to accept or
     not and nothing else on the site would ever tell her they had arrived. */
  tellHer(newcomer.name+' made an account and stands as a pledge. Accept them, or leave them be.');
  db.users.forEach(function(u){
    if(u.id===newcomer.id||u.pledge) return;
    notify("member",u.id,newcomer.name+" has pledged to the House. If you know them, speak for them on their page.");
  });
}
app.post("/members/register",up.single("avatar"),shrinkAvatar,(req,res)=>{const{name,email,password,invite}=req.body;
  // honeypot: real people never fill this hidden field, bots do
  if(req.body.website)return res.redirect('/members/login');
  // keep a valid code in the URL on failure so they don't have to re-enter it
  const keep=inviteRequired()&&normCode(invite)===inviteCode()?'&code='+encodeURIComponent(invite):'';
  if(inviteRequired()&&normCode(invite)!==inviteCode())return res.redirect('/members/login?e='+encodeURIComponent('That invite code was not recognised — ask the Guild Leader'));
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
  db.users.push(u);
  if(!first) tellTheHouse(u);
  save();req.session.uid=u.id;// A new pledge lands on a page that explains what a pledge is and what
  // happens next, rather than being dropped into the Hall unexplained.
  res.redirect(first?'/members':'/members?new=1');});
app.post('/members/login',throttleLogin,(req,res)=>{const{email,password}=req.body;const u=db.users.find(x=>x.email===String(email||'').toLowerCase());
  if(!u||!bcrypt.compareSync(password||'',u.passhash)){noteBadLogin(req);const on=wasHeadedFor(req.body.next);
    return res.redirect('/members/login?e='+encodeURIComponent('Bad email or password')+(on?'&next='+encodeURIComponent(on):''));}
  clearLoginTries(req);req.session.uid=u.id;res.redirect(wasHeadedFor(req.body.next)||'/members');});
app.post('/members/logout',(req,res)=>{req.session.destroy(()=>res.redirect('/'));});

/* The welcome owed to somebody just taken into the House.

   Shown once, where "once" has to mean something kinder than once: pressing
   refresh while you are still reading it must not take it away. So the first
   drawing is stamped, and it keeps being drawn for a quarter of an hour after
   that. Come back tomorrow and it is gone, having been read.

   Nothing here expires on its own. Accepted on the Tuesday and not signing in
   until the Friday, you still get it — the clock starts when you arrive, not
   when the Guild Leader pressed the button. */
const WELCOME_FOR = 15*60*1000;
function swornWelcome(u){
  if(!u || u.pledge || !u.sworn) return null;
  if(!u.swornShown){ u.swornShown=Date.now(); save(); }
  if(Date.now()-u.swornShown > WELCOME_FOR) return null;
  return {at:u.sworn, first:(u.faires||0)===0};
}
app.get('/members',au,(req,res)=>{
  const u=cur(req);

  /* The anchor for "since you were last here".

     Held in the session as well as on the record, because the mark has to
     survive a refresh. Reading the page moves the record forward, so without
     this the summary would be complete on the first load and empty on the
     second — which reads as a page that lost something rather than one that
     told you. The session keeps the same anchor for a quarter of an hour, so
     coming back to the tab shows the same news; after that it re-anchors to
     the real last visit. */
  const now=Date.now();
  if(!req.session.hallSince || now-(req.session.hallSinceAt||0) > 15*60*1000){
    req.session.hallSince=u.lastSeen||0;
    req.session.hallSinceAt=now;
  }
  /* Nothing is claimed on somebody's first visit. With no mark to measure from
     the summary would reach back to the beginning of the House and greet a
     newcomer with every notice ever written — which is not news, it is an
     archive, and it is a poor welcome. The mark is set instead, and the line
     starts telling them things the next time they come. */
  const firstEver=!u.lastSeen;
  const since=firstEver ? [] : sinceYouWere(u, req.session.hallSince);
  const away=(!firstEver && req.session.hallSince) ? now-req.session.hallSince : 0;
  u.lastSeen=now; save();
  const bunkBoard=NIGHTS.map(n=>{
    const bunks=BUNKS.map(b=>{const o=db.bunks.find(x=>x.night===n&&x.bunk===b);return{bunk:b,note:BUNK_NOTES[b]||"",taken:!!o,who:o?db.users.find(y=>y.id===o.userId):null,mine:o&&o.userId===u.id};});
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
  res.render('hall',{u,welcome:swornWelcome(u),pack:packFor(u),chores:u.role==='leader'?choresFor(u):null,schedule:guildEvents(),backups:backupHealth(),page:pageOf(u),mySlug:slugById()[u.id]||'',backdrops:BACKDROPS,layouts:LAYOUTS,fonts:FONTS,fontKeys:FONT_KEYS,sizeKeys:SIZE_KEYS,sizes:SIZES,charmKeys:CHARM_KEYS,charmSvg:charmSvg,charmMax:CHARM_MAX,rank:rank(u),classes:CLASSES,bunkBoard,bunksLeft,bunkFacts:bunkFacts(),since:since,away:away,cardWaiting:cardWaiting(u),over:countdown().ended===true,finest:highHand(),items,bringers,leader:u.role==='leader',users:u.role==='leader'?db.users.map(function(m){return{slug:slugById()[m.id]||'',berth:m.berth||'',vouches:vouchesFor(m.id),sworn:m.sworn||0,swornSeen:!!m.swornShown,name:m.name,class:m.class,faires:m.faires,rank:rank(m),pledge:!!m.pledge,leader:m.role==='leader',dayContact:!!m.dayContact,title:m.title||'',avatar:m.avatar,id:m.id,contactEmail:m.contactEmail||'',phone:m.phone||'',bunks:db.bunks.filter(function(b){return b.userId===m.id}).map(function(b){return b.night+' \u00b7 Bunk '+b.bunk;})};}):[],announcements:db.announcements,mine:myWeekend(u),prizes:db.prizes||{first:"",second:"",shown:false},outreach:{emails:db.users.filter(function(x){return x.contactEmail;}).map(function(x){return x.contactEmail;}),phones:db.users.filter(function(x){return x.phone;}).map(function(x){return x.phone;})},invite:inviteCode(),err:req.query.e||"",q:req.query});
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
  if(countdown().ended)return res.redirect('/members?e='+encodeURIComponent('The faire is over — camp is closed until next year.')+'#bunks');
  if(!NIGHTS.includes(night)||!BUNKS.includes(b))return res.redirect('/members#bunks');
  if(db.bunks.find(x=>x.night===night&&x.bunk===b))return res.redirect('/members?e=taken#bunks');
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
  /* Worth knowing at any time and worth knowing badly in the last fortnight,
     when a freed bed is somebody else's weekend. Said either way; the count
     of days does the explaining. */
  if(had){
    var _g=countdown();
    tellHer(u.name+' gave back '+night+', bunk '+bunk+'.'+
      (_g.days!=null?' '+_g.days+' days to go.':''));
  }
  save();res.redirect('/members#bunks');
});
// Waiting for a bunk is only worth anything if you could hold one.
app.post('/members/waitlist',au,sworn,(req,res)=>{
  const u=cur(req);const night=req.body.night;
  if(countdown().ended)return res.redirect('/members?e='+encodeURIComponent('The faire is over — camp is closed until next year.')+'#bunks');
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
app.post('/members/bring/claim',au,(req,res)=>{
  if(countdown().ended)return res.redirect('/members?e='+encodeURIComponent('The faire is over — camp is closed until next year.')+'#bring');
  const u=cur(req);const itemId=parseInt(req.body.itemId);const it=db.items.find(x=>x.id===itemId);if(!it)return res.redirect('/members#bring');
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
/* Being taken in was, until now, almost entirely silent. The pledge line
   vanished, the bunks stopped refusing them, and a small dot appeared on the
   menu button — and that was the whole of it. Somebody could be accepted on
   the Tuesday and not realise until the Friday.

   So the moment is written down. It is what the Guild Hall reads to know it
   owes somebody a welcome the next time they walk in, and it is cleared again
   on the way out so that being put back to Pledge and taken in a second time
   is greeted just as warmly as the first. */
app.post('/members/admin/promote',al,(req,res)=>{
  const u=db.users.find(x=>x.id===parseInt(req.body.id));
  if(!u||!u.pledge)return res.redirect('/members#admin');
  u.pledge=false;
  u.sworn=Date.now();
  delete u.swornShown;              // the welcome has not been drawn yet
  notify('member',u.id,'You have been accepted into the House of Card and Coin. You are a Guildmate now — the camp bunks are yours to claim.');
  save();
  // Straight back to the panel with the welcome note ready to send, so it is
  // one press rather than something to remember to do later.
  res.redirect('/members?welcomed='+u.id+'#admin');
});
app.post('/members/admin/demote',al,(req,res)=>{const u=db.users.find(x=>x.id===parseInt(req.body.id));if(u&&u.role!=='leader'){u.pledge=true;delete u.sworn;delete u.swornShown;save();}res.redirect('/members#admin');});

/* Handing somebody the keys.

   Every other thing about a member could be set from this panel — title,
   faires, berth, password, whether they are a pledge — except the one field
   that actually grants administration. Doing it meant stopping the app and
   editing the data file by hand, which is no way to run a guild.

   Two guards, and they are the ones that matter. Nobody may change their own
   role, which removes the whole class of accident where somebody clicks the
   wrong button and locks themselves out of their own House. And the last
   leader can never be taken off, so there is always somebody holding a key. */
app.post('/members/admin/role',al,(req,res)=>{
  const me=cur(req);
  const u=db.users.find(x=>x.id===parseInt(req.body.id,10));
  const make=req.body.make==='leader'?'leader':'member';
  const bounce=m=>res.redirect('/members?e='+encodeURIComponent(m)+'#admin');
  if(!u)return res.redirect('/members#admin');
  if(u.id===me.id)return bounce('Change somebody else’s role, not your own.');
  if(make==='leader'&&u.pledge)return bounce('Accept them into the guild first — a pledge cannot hold the keys.');
  if(make==='member'&&db.users.filter(x=>x.role==='leader').length<=1)
    return bounce('That is the only leader left. Give somebody else the keys before taking these.');
  if(u.role===make)return res.redirect('/members#admin');
  u.role=make;
  notify('member',u.id,make==='leader'
    ? 'You have been given the keys to the House. Administration now appears in your Guild Hall.'
    : 'Your administrator access has been withdrawn. Nothing else about your account has changed.');
  save();
  res.redirect('/members?role='+encodeURIComponent(u.name+(make==='leader'?' now holds the keys':' no longer holds the keys'))+'#admin');
});

/* ── Word to the Guild Leader ───────────────────────────────────────────────
   The House tells the guild what they missed. It told her nothing: somebody
   made an account, a guildmate whispered her, a bunk came free two days before
   the faire — and she found out by happening to look.

   It goes by the pigeon's own road. The contact form already posts to Formspree
   and Formspree already emails her, so there is no new service, no new address
   and nothing for her to set up. If that endpoint is ever unset, everything
   below quietly queues and nothing is sent.

   Not one email per event, though. Formspree's free tier counts submissions by
   the month and the pigeon shares it, so lines are gathered and go out together
   at most once an hour. A quiet week costs one message; a busy evening costs
   one message. The queue is kept in the data, so a restart cannot lose it. */
const TELL_GAP=60*60*1000;         // no more than one message an hour
function tellHer(line){
  if(!Array.isArray(db.outbox))db.outbox=[];
  db.outbox.push({ts:Date.now(),line:String(line||'').slice(0,300)});
  if(db.outbox.length>60)db.outbox=db.outbox.slice(-60);
  save();
  flushOutbox();
}
async function flushOutbox(){
  if(!Array.isArray(db.outbox)||!db.outbox.length)return;
  const ep=process.env.FORMSPREE_ENDPOINT;
  if(!ep)return;                                   // nothing to send it down
  if(Date.now()-(db.lastTold||0)<TELL_GAP)return;  // not yet
  const lines=db.outbox.slice();
  const when=function(t){ return new Date(t).toLocaleString('en-US',{timeZone:'America/Los_Angeles',
    month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); };
  const body=lines.map(function(x){ return when(x.ts)+' — '+x.line; }).join('\n');
  try{
    const r=await fetch(ep,{method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({
        _subject:'House of Card and Coin — '+lines.length+' thing'+(lines.length===1?'':'s')+' for you',
        What:body,
        Where:'https://houseofcardandcoin.com/members#admin'
      })});
    if(!r.ok)throw new Error('formspree '+r.status);
    db.outbox=[]; db.lastTold=Date.now(); save();
  }catch(e){
    // Left in the queue to go with the next one rather than thrown away.
    console.log('could not send word to the Guild Leader:',e.message);
  }
}
/* The last line of a quiet spell would otherwise sit in the queue until the
   next thing happened, which could be days. A quarter-hour check sends it.
   Nothing here restarts or touches anything — it looks at a queue. */
setInterval(function(){
  flushOutbox();
  // And the backup, which she would otherwise only see by opening the panel.
  const b=backupHealth();
  const today=dayKey();
  if(b.known && !b.good && db.toldBackup!==today){
    db.toldBackup=today;
    tellHer(b.stale
      ? 'The nightly backup has not run for '+b.hours+' hours. The job has stopped.'
      : 'Last night’s backup failed: '+b.note+'. Nothing old was deleted, so the last good copy is still there.');
  }
},15*60*1000);

/* Whether last night's backup happened, and whether it was any good.

   The nightly script writes a small status file; this reads it. It exists
   because a backup nobody checks is a backup nobody knows is broken — the
   thing would have gone on failing into a log file for months and the first
   anybody heard of it would have been the day it was needed.

   Stale is its own kind of failure and is reported as one: a status saying
   everything went well, written nine days ago, means the job has stopped
   running. */
function backupHealth(){
  let s;
  try{ s=JSON.parse(fs.readFileSync('/var/www/hocc-backups/status.json','utf8')); }
  catch(e){ return {known:false}; }
  const hrs=(Date.now()-(s.at||0))/3600000;
  return {
    known:true, ok:!!s.ok, kept:s.kept||0, note:s.note||'', at:s.at||0,
    hours:Math.floor(hrs),
    stale:hrs>36,
    good:!!s.ok && hrs<=36
  };
}

/* Which number the FAQ hands out on the day. Exactly one person carries it, so
   setting it on somebody takes it off whoever had it. A number nobody chose is
   how you end up giving out the wrong one. */

/* Changing the code that lets people in.

   Punctuation is stripped and the rest folded to caps before it is stored, so
   whatever gets typed here ends up as the letters and numbers the door will
   actually compare. Blank is a real answer and means the door is open to
   anyone, which is why it is spelled out rather than treated as a mistake. */

/* Changing the schedule from the Hall.

   The Scroll reads whatever is here on the next page load, so a fire that
   moves an hour on the Saturday is an edit on a phone rather than a deploy.

   `when` is what people read — "At dusk", "High noon" — and `at` is only a
   rough hour used to work out which event is next. Both are kept: the words
   are the point, the hour is the machinery. */
app.post('/members/admin/event',al,(req,res)=>{
  const cfg=guildEvents();
  const id=req.body.id, date=String(req.body.date||'').trim();
  const title=String(req.body.title||'').trim().slice(0,80);
  const when=String(req.body.when||'').trim().slice(0,40);
  const body=String(req.body.body||'').trim().slice(0,240);
  const at=/^\d{1,2}:\d{2}$/.test(String(req.body.at||'').trim()) ? String(req.body.at).trim() : '';
  const bounce=m=>res.redirect('/members?e='+encodeURIComponent(m)+'#schedule');

  if(req.body.remove){
    cfg.events=(cfg.events||[]).filter(function(e){return String(e.id)!==String(id);});
    db.schedule=cfg; save();
    return res.redirect('/members?role='+encodeURIComponent('Taken off the Scroll')+'#schedule');
  }
  if(!title) return bounce('An event wants a name at least.');
  if(!(cfg.days||[]).some(function(d){return d.date===date;})) return bounce('Pick one of the three days.');

  const found=id?(cfg.events||[]).find(function(e){return String(e.id)===String(id);}):null;
  if(found){ Object.assign(found,{date:date,at:at,when:when||found.when,title:title,body:body}); }
  else{ cfg.events.push({id:nid(),date:date,at:at,when:when||'',title:title,body:body}); }
  db.schedule=cfg; save();
  res.redirect('/members?role='+encodeURIComponent(found?'\u201c'+title+'\u201d changed on the Scroll':'\u201c'+title+'\u201d added to the Scroll')+'#schedule');
});

/* ── What to pack ───────────────────────────────────────────────────────────
   The bring-list is the guild's: firewood, ice, a dish for the potluck. It has
   never said a word about what a person needs for themselves, and the one
   thing people actually forget is bedding — which is mentioned once, in the
   FAQ, where you only find it if you go looking.

   The list starts as the House's advice and becomes yours the moment you touch
   it: tick what is packed, strike what does not apply, add what is only yours. */
const PACK_START=[
  {what:'Sleeping bag or bedding', why:'None is provided, whichever bunk you hold'},
  {what:'Your pillow', why:''},
  {what:'Garb for each day', why:''},
  {what:'Shade — canopy, tarp, rope', why:'Our spot is pavement with none of its own'},
  {what:'More water than you think', why:''},
  {what:'Sunscreen and a hat', why:''},
  {what:'A torch for after dark', why:''},
  {what:'Something warm for the night', why:'The desert drops once the sun is off it'},
  {what:'Shower at home before you come', why:'There is no water on site'},
  {what:'Your own drink', why:''},
  {what:'A dish for the potluck', why:''}
];
function packFor(u){
  if(!Array.isArray(u.pack)){
    u.pack=PACK_START.map(function(x){ return {id:nid(),what:x.what,why:x.why,done:false,house:true}; });
    save();
  }
  return u.pack;
}
app.post('/members/pack',au,(req,res)=>{
  const u=cur(req); if(!u)return res.redirect('/members/login');
  const list=packFor(u);
  const id=String(req.body.id||'');

  if(req.body.add){
    const what=String(req.body.add).trim().slice(0,80);
    if(what) u.pack.push({id:nid(),what:what,why:'',done:false,house:false});
  } else if(req.body.remove){
    u.pack=list.filter(function(x){return String(x.id)!==id;});
  } else if(req.body.reset){
    delete u.pack; packFor(u);
  } else {
    const it=list.find(function(x){return String(x.id)===id;});
    if(it) it.done=!it.done;
  }
  save();
  res.redirect('/members#pack');
});

/* ── Still to sort ──────────────────────────────────────────────────────────
   The packing list is what every guildmate needs. This is the other kind: the
   half-dozen things that are the Guild Leader's alone, and most of them are
   questions rather than tasks — who is meeting the trailer, whether anyone has
   booked the room, whether we are driving.

   So each line takes an answer as well as a tick. "Who meets the trailer at
   six on the Thursday?" is not done when it is ticked; it is done when it says
   a name. The tick is for afterwards.

   Leader-only, and each leader keeps their own. Nobody else sees it. */
const CHORES_START=[
  {what:'The camper comes with FULL water', why:'Confirm it before it leaves — a dry camp means what is in the tank is all there is'},
  {what:'Who meets the trailer at 6pm Thursday?', why:'To park it and take the keys'},
  {what:'Who is there Sunday night when they collect it?', why:''},
  {what:'Hotel for Sunday night — booked?', why:'After camp comes down'},
  {what:'Flying or driving?', why:'And who is riding with whom'}
];
function choresFor(u){
  if(!Array.isArray(u.chores)){
    u.chores=CHORES_START.map(function(x){
      return {id:nid(),what:x.what,why:x.why,answer:"",done:false,house:true};
    });
    save();
  }
  return u.chores;
}
app.post('/members/chores',au,al,(req,res)=>{
  const u=cur(req); if(!u)return res.redirect('/members/login');
  const list=choresFor(u);
  const id=String(req.body.id||'');

  if(req.body.add){
    const what=String(req.body.add).trim().slice(0,120);
    if(what) u.chores.push({id:nid(),what:what,why:"",answer:"",done:false,house:false});
  } else if(req.body.remove){
    u.chores=list.filter(function(x){return String(x.id)!==id;});
  } else if(req.body.reset){
    delete u.chores; choresFor(u);
  } else if(req.body.answer!==undefined){
    const it=list.find(function(x){return String(x.id)===id;});
    if(it) it.answer=String(req.body.answer).trim().slice(0,160);
  } else {
    const it=list.find(function(x){return String(x.id)===id;});
    if(it) it.done=!it.done;
  }
  save();
  res.redirect('/members#sort');
});
app.post('/members/admin/invite',al,(req,res)=>{
  var want=req.body.roll ? freshCode() : normCode(req.body.code);
  if(want.length && want.length<4)
    return res.redirect('/members?e='+encodeURIComponent('An invite code wants at least four letters or numbers.')+'#admin');
  db.invite=want;
  save();
  res.redirect('/members?role='+encodeURIComponent(want
    ? 'The invite code is now '+want
    : 'The invite code is off — anybody can make an account')+'#admin');
});
app.post('/members/admin/daycontact',al,(req,res)=>{
  const u=db.users.find(x=>x.id===parseInt(req.body.id,10));
  if(!u)return res.redirect('/members#admin');
  if(!u.phone)
    return res.redirect('/members?e='+encodeURIComponent(u.name+' has no phone number on file, so there would be nothing to hand out.')+'#admin');
  db.users.forEach(function(x){ delete x.dayContact; });
  u.dayContact=true;
  save();
  res.redirect('/members?role='+encodeURIComponent('Guildmates asking for a number on the day now get '+u.name+'’s')+'#admin');
});

/* Folding two accounts into one.

   It happens when somebody cannot get into their account and simply signs up
   again: two records, one holding the history and one holding the password
   they actually know. Done by hand twice now, and it will happen again.

   The shape is always the same, and this is it. The record you keep holds who
   they are to the guild — their name, their faires, their berth, their title.
   The record being retired gives up its login, so afterwards they sign in with
   the password that already works for them.

   The role is never inherited. A merge cannot hand out administration by
   accident, whichever account was which.

   Everything either of them ever did is repointed at the survivor before the
   other record goes: bunks, bring-list claims, notes and replies and the
   reactions on them, poll votes, photographs, signatures on scrolls, vouches,
   whispers, notices, and the hands written into rounds already closed. Where
   repointing would leave a person doing something twice — two claims on one
   bunk, two places in one queue, the same reaction twice — it collapses to
   one. */
function mergeMembers(keepId,retireId){
  const keep=db.users.find(x=>x.id===keepId), gone=db.users.find(x=>x.id===retireId);
  if(!keep||!gone||keep.id===gone.id)return null;
  const report={kept:keep.name,retired:gone.name,moved:[],repointed:0,collapsed:0};

  keep.email=gone.email; keep.passhash=gone.passhash;
  report.moved.push('the login');

  // Purses add up — nobody loses coin they turned up for.
  const coins=(keep.coins||0)+(gone.coins||0);
  if(coins||gone.earned){
    keep.coins=coins;
    keep.earned=(keep.earned||0)+(gone.earned||0);
    keep.spent=(keep.spent||0)+(gone.spent||0);
    keep.purse=[].concat(keep.purse||[],gone.purse||[])
      .sort(function(a,b){return (a.ts||0)-(b.ts||0);}).slice(-PURSE_KEEP);
    report.moved.push(coins+' coins');
  }
  // Two hands cannot be shuffled into one, so the fuller hand wins outright
  // and brings its deck and its streak with it.
  if((gone.hand||[]).length>(keep.hand||[]).length){
    ['hand','deck','lastCard','lastRation','streak','pending','bought'].forEach(function(k){ keep[k]=gone[k]; });
    report.moved.push((gone.hand||[]).length+'-card hand');
  }
  // Blanks filled in from the retired record; nothing already set is overwritten.
  ['avatar','class','berth','contactEmail','phone','motto','about','title'].forEach(function(k){
    if(!keep[k]&&gone[k]){ keep[k]=gone[k]; report.moved.push(k); }
  });
  keep.faires=Math.max(keep.faires||0,gone.faires||0);
  keep.rsvp=!!(keep.rsvp||gone.rsvp);
  if(keep.pledge&&!gone.pledge)keep.pledge=false;   // accepted under either name is accepted

  const swap=function(id){ if(id===retireId){ report.repointed++; return keepId; } return id; };
  (db.bunks||[]).forEach(function(b){ b.userId=swap(b.userId); });
  (db.waitlist||[]).forEach(function(w){ w.userId=swap(w.userId); });
  (db.claims||[]).forEach(function(c){ c.userId=swap(c.userId); });
  (db.photos||[]).forEach(function(p){ if(p.byT==='member')p.byId=swap(p.byId); });
  (db.wall||[]).forEach(function(w){ w.toId=swap(w.toId); if(w.fromT==='member')w.fromId=swap(w.fromId); });
  (db.vouches||[]).forEach(function(v){ v.forId=swap(v.forId); v.byId=swap(v.byId); });
  (db.notices||[]).forEach(function(n){ if(n.toT==='member')n.toId=swap(n.toId); });
  (db.whispers||[]).forEach(function(w){
    if(w.fromT==='member')w.fromId=swap(w.fromId);
    if(w.toT==='member')w.toId=swap(w.toId);
  });
  (db.rounds||[]).forEach(function(r){ (r.hands||[]).forEach(function(h){ if(h.kind==='member')h.id=swap(h.id); }); });

  function once(list){
    const seen={};
    return (list||[]).filter(function(v){
      const k=(v&&v.t)+':'+(v&&v.id);
      if(seen[k]){ report.collapsed++; return false; }
      seen[k]=1; return true;
    });
  }
  function fixReacts(o){
    Object.keys(o.reacts||{}).forEach(function(e){
      o.reacts[e]=once((o.reacts[e]||[]).map(function(v){
        return (v&&v.t==='member'&&v.id===retireId)?(report.repointed++,{t:'member',id:keepId}):v;
      }));
    });
  }
  function fixVotes(host){
    (host.options||[]).forEach(function(o){
      o.votes=once((o.votes||[]).map(function(v){
        return (v&&v.t==='member'&&v.id===retireId)?(report.repointed++,{t:'member',id:keepId}):v;
      }));
    });
  }
  (db.threads||[]).forEach(function(t){
    if(t.authorType==='member')t.authorId=swap(t.authorId);
    fixReacts(t); fixVotes(t);
    (t.replies||[]).forEach(function(r){
      if(r.authorType==='member')r.authorId=swap(r.authorId);
      fixReacts(r);
    });
  });
  (db.polls||[]).forEach(fixVotes);

  function dedupe(list,key){
    const seen={};
    return (list||[]).filter(function(x){
      const k=key(x);
      if(seen[k]){ report.collapsed++; return false; }
      seen[k]=1; return true;
    });
  }
  // One bed per person per night, one place in a queue, one claim per item,
  // and nobody vouching for themselves.
  db.bunks=dedupe(db.bunks,function(b){return b.night+'|'+b.userId;});
  db.waitlist=dedupe(db.waitlist,function(w){return w.night+'|'+w.userId;});
  db.claims=dedupe(db.claims,function(c){return c.itemId+'|'+c.userId;});
  db.vouches=dedupe((db.vouches||[]).filter(function(v){
    if(v.forId===v.byId){ report.collapsed++; return false; }
    return true;
  }),function(v){return v.forId+'|'+v.byId;});

  db.users=db.users.filter(function(x){ return x.id!==retireId; });
  save();
  return report;
}

app.post('/members/admin/merge',al,(req,res)=>{
  const keepId=parseInt(req.body.keep,10), retireId=parseInt(req.body.retire,10);
  const bounce=m=>res.redirect('/members?e='+encodeURIComponent(m)+'#admin');
  if(!keepId||!retireId)return bounce('Pick both accounts.');
  if(keepId===retireId)return bounce('Those are the same account.');
  const keep=db.users.find(x=>x.id===keepId), gone=db.users.find(x=>x.id===retireId);
  if(!keep||!gone)return res.redirect('/members#admin');
  if(gone.role==='leader')
    return bounce('Take the keys off '+gone.name+' before retiring that account.');
  if(gone.id===cur(req).id)
    return bounce('That is the account you are signed in with. Sign in as the other one first.');
  const r=mergeMembers(keepId,retireId);
  if(!r)return res.redirect('/members#admin');
  res.redirect('/members?merged='+encodeURIComponent(
    r.retired+' folded into '+r.kept+' — '+r.moved.join(', ')+' carried across, '+
    r.repointed+' record'+(r.repointed===1?'':'s')+' repointed'+
    (r.collapsed?', '+r.collapsed+' duplicate'+(r.collapsed===1?'':'s')+' collapsed':'')
  )+'#admin');
});
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
app.post('/members/admin/fares',al,(req,res)=>{const id=parseInt(req.body.id);const u=db.users.find(x=>x.id===id);if(!u)return res.redirect('/members#admin');u.faires=Math.max(0,parseInt(req.body.faires||0));save();res.redirect('/members#admin');});app.post('/members/admin/round/close',al,(req,res)=>{const r=closeRound();return res.redirect('/board/roll'+(r?'?closed='+r.n:'?e=empty'));});app.post('/members/admin/berth',al,(req,res)=>{const u=db.users.find(x=>x.id===parseInt(req.body.id));if(!u)return res.redirect('/members#admin');u.berth=(req.body.berth||'').trim().slice(0,40);save();res.redirect('/members#admin');});app.post('/members/admin/title',al,(req,res)=>{const id=parseInt(req.body.id);const u=db.users.find(x=>x.id===id);if(!u)return res.redirect('/members#admin');u.title=(req.body.title||'').trim();save();res.redirect('/members#admin');});app.post('/members/admin/resetpw',al,(req,res)=>{const id=parseInt(req.body.id);const u=db.users.find(x=>x.id===id);if(!u)return res.redirect('/members#admin');const np=(req.body.password||'').trim();if(np.length<4)return res.redirect('/members?e=pwshort#admin');u.passhash=bcrypt.hashSync(np,10);save();res.redirect('/members?pwreset=1#admin');});app.post('/members/admin/add',al,(req,res)=>{const{name,email,password,faires,title}=req.body;const e=(email||'').toLowerCase().trim();if(!name||!e||!(password||'').trim())return res.redirect('/members?e=addreq#admin');if(db.users.find(x=>x.email===e))return res.redirect('/members?e=dup#admin');db.users.push({id:nid(),name:name.trim(),email:e,passhash:bcrypt.hashSync(password,10),avatar:'',class:'',faires:Math.max(0,parseInt(faires||0)),role:'member',title:(title||'').trim(),contactEmail:'',phone:''});save();res.redirect('/members?added=1#admin');});app.post('/members/admin/remove',al,(req,res)=>{const id=parseInt(req.body.id);const me=db.users.find(x=>x.id===req.session.uid);if(me&&me.id===id)return res.redirect('/members?e=self#admin');const u=db.users.find(x=>x.id===id);if(!u||u.role==='leader')return res.redirect('/members?e=nodel#admin');db.users=db.users.filter(x=>x.id!==id);db.bunks=db.bunks.filter(b=>b.userId!==id);db.claims=db.claims.filter(c=>c.userId!==id);save();res.redirect('/members?removed=1#admin');});app.get('/api/announcements',(req,res)=>res.json((db.announcements||[]).slice().reverse()));app.post('/members/admin/announce',al,(req,res)=>{const t=(req.body.text||'').trim();if(!t)return res.redirect('/members?e=notext#admin');db.announcements.push({id:nid(),text:t,ts:Date.now()});save();res.redirect('/members?ann=1#admin');});app.post('/members/admin/announce/remove',al,(req,res)=>{const id=parseInt(req.body.id);db.announcements=db.announcements.filter(function(a){return a.id!==id;});save();res.redirect('/members#admin');});app.post('/members/rsvp',au,(req,res)=>{const u=cur(req);if(!u)return res.redirect('/members/login');u.rsvp=!u.rsvp;save();res.redirect('/members#rsvp');});// ===== The Tavern: public notice board + polls =====
const BOARDCATS=['General','Rides & Lodging','Trade & Barter',"Reader's Circle",'Camp Talk',
  'Wanted','Lost & Found','Notice'];
/* The number to ring when you are stood in the car park on the Friday with a
   boot full of gear. Every route to a person on this site was email, which is
   no use at all on the day.

   Read live off the Guild Leader's own tabard, so the number lives in one
   place she controls and appears in no file in this repo. Signed-in members
   only — tavern patrons are strangers off the internet and do not get it. */
function dayContact(i){
  if(!i||i.t!=='member') return null;
  const me=db.users.find(function(x){return x.id===i.id;});
  if(!me) return null;
  /* Whose number this is, decided rather than stumbled upon.
     It used to be "the first leader in the list", which was unambiguous while
     there was one leader and became an accident of array order the moment
     there were two. Somebody now carries the mark, and the old behaviour is
     only the fallback for a House that has never set one. */
  const L=db.users.find(function(x){return x.dayContact===true;})
       || db.users.find(function(x){return x.role==='leader';});
  if(!L) return null;
  // Sworn guildmates get the number. Pledges are not turned away — they are
  // pointed at the pigeon instead, which is her call: the number goes to
  // people the House has taken in, not to anyone who made an account.
  const sworn=!me.pledge;
  return {name:L.name, sworn:sworn, mine:i.id===L.id,
          phone:sworn?(L.phone||''):'', tel:sworn?(L.phone||'').replace(/[^0-9+]/g,''):''};
}
function mayPin(u){
  return !!u && (u.role==="leader" || u.title==="Guild Leader" || u.title==="Guild Elder");
}

/* The schedule lives in the data now, not in a file in the repo.

   It was read from tools/events.json, and the Scroll of Events was generated
   from the same file by a build script. Which meant that if the Saturday fire
   moved an hour, changing what the site said took an edit, a build and a
   deploy — on the Saturday, from me. An announcement could be posted over the
   top, but the Scroll went on saying the old time underneath it.

   The file is still where the schedule starts: it is read once, the first time
   a House has no schedule of its own, and copied in. After that the file is
   only history and the Guild Leader edits the real thing from the Hall. */
function guildEvents(){
  if(!(db.schedule && Array.isArray(db.schedule.days) && Array.isArray(db.schedule.events))){
    const seed=guildEventsFile();
    if(!(seed && seed.days))return seed;
    db.schedule={tz:seed.tz,days:seed.days,events:seed.events};
  }
  /* Every event needs a name the forms can refer to. The file never had ids —
     it was only ever read, never edited — so without this the first press of
     Save on a seeded event would find nothing to change and add a second copy
     of it instead. Stamped once, here, on whatever has none. */
  let stamped=false;
  db.schedule.events.forEach(function(e){ if(e.id===undefined){ e.id=nid(); stamped=true; } });
  if(stamped)save();
  return db.schedule;
}
function guildEventsFile(){
  try{ return JSON.parse(fs.readFileSync(path.join(__dirname,"..","tools","events.json"),"utf8")); }
  catch(e){ return {days:[],events:[]}; }
}
/* What is on next. The times in the file are Las Vegas local; October is PDT,
   seven hours behind UTC, which is the same offset the countdown is pinned to.
   Returns null once the last one has passed. */
function nextEvent(){
  const cfg=guildEvents(), now=Date.now();
  const upcoming=(cfg.events||[])
    .map(function(e){
      const t=Date.parse(e.date+"T"+e.at+":00-07:00");
      return {when:e.when,title:e.title,body:e.body,day:e.date,ts:t};
    })
    .filter(function(e){ return e.ts && e.ts>now; })
    .sort(function(a,b){ return a.ts-b.ts; });
  return upcoming.length?upcoming[0]:null;
}
/* Your weekend at a glance. Nothing here is new information — it is the same
   record the rest of the site already keeps, in one place. */
function myWeekend(u){
  const nights=db.bunks.filter(function(b){return b.userId===u.id;})
    .sort(function(a,b){return a.night<b.night?-1:1;})
    .map(function(b){return {night:b.night,bunk:b.bunk,note:BUNK_NOTES[b.bunk]||""};});
  const bringing=(db.claims||[]).filter(function(c){return c.userId===u.id;}).map(function(c){
    const it=db.items.find(function(x){return x.id===c.itemId;});
    return {name:it?it.name:"something",qty:c.qty,icon:it?bringIcon(it.name):"\u{1F4E6}"};
  });
  const gaps=bringList().filter(function(x){return x.remaining>0;}).length;
  return {
    rsvp:!!u.rsvp, pledge:!!u.pledge,
    nights:nights, bringing:bringing, gaps:gaps,
    hand:(u.hand||[]).map(cardInfo), handRank:handRank(u.hand||[]),
    coins:u.coins||0, cardTonight:u.lastRation!==dayKey(),
    // The purse gets its own square beside the hand. Only the headline here —
    // the ledger and the advice live on your own page, and this tile is the
    // door to them.
    purse:(function(){
      var p=purseFor(u);
      return {coins:p.coins,earned:p.earned,spent:p.spent,last:p.log[0]||null};
    })(),
    purseHref:'/guild/'+(slugById()[u.id]||'')+'#purse',
    next:nextEvent(), gates:countdown()
  };
}

/* ── What happened while you were away ──────────────────────────────────────
   Everything this House does is silent. A round closes, somebody makes a
   better hand, a card is waiting, a photograph goes up, somebody signs your
   scroll — and none of it reaches anybody who does not happen to open the
   right page on the right day. There are no emails to send and no addresses to
   send them to, so the fix is not a notification: it is making the visit worth
   making the moment you arrive.

   Nothing here is new data. It is the same threads, notices, rounds and
   photographs the rest of the site already keeps, asked one question they were
   never asked before: what of this is newer than the last time this person
   stood here.

   Says nothing at all when nothing has happened. A line reading "nothing new"
   every day teaches people to stop reading the line. */
function sinceYouWere(u,anchor){
  if(!u)return [];
  var out=[];
  var mine=function(t,id){ return t==='member'&&id===u.id; };

  var said=0;
  (db.threads||[]).forEach(function(t){
    if(t.ts>anchor&&!mine(t.authorType,t.authorId))said++;
    (t.replies||[]).forEach(function(r){ if(r.ts>anchor&&!mine(r.authorType,r.authorId))said++; });
  });
  if(said)out.push({n:said,say:said===1?'new line by the fire':'new lines by the fire',go:'/board'});

  var closed=(db.rounds||[]).filter(function(r){return r.ended>anchor;});
  if(closed.length)out.push({
    n:closed.length,
    say:closed.length===1?'round closed':'rounds closed',
    go:'/board/roll', gold:true});

  var notices=(db.notices||[]).filter(function(n){return n.toT==='member'&&n.toId===u.id&&n.ts>anchor;}).length;
  if(notices)out.push({n:notices,say:notices===1?'notice for you':'notices for you',go:'/post',gold:true});

  var whispers=(db.whispers||[]).filter(function(w){
    return w.toT==='member'&&w.toId===u.id&&!w.read;}).length;
  if(whispers)out.push({n:whispers,say:whispers===1?'letter waiting':'letters waiting',go:'/post',gold:true});

  var shots=(db.photos||[]).filter(function(p){return p.ts>anchor&&!mine(p.byT,p.byId);}).length;
  if(shots)out.push({n:shots,say:shots===1?'new picture':'new pictures',go:'/gallery'});

  var signed=(db.wall||[]).filter(function(w){return w.toId===u.id&&w.ts>anchor;}).length;
  if(signed)out.push({n:signed,say:signed===1?'signature on your scroll':'signatures on your scroll',
    go:'/guild/'+(slugById()[u.id]||'')+'#wall',gold:true});

  if(u.pledge){
    var spoke=(db.vouches||[]).filter(function(v){return v.forId===u.id;}).length;
    if(spoke)out.push({n:spoke,say:spoke===1?'guildmate has spoken for you':'guildmates have spoken for you',
      go:'/guild/'+(slugById()[u.id]||'')+'#vouch',gold:true});
  }
  return out;
}
// Not a thing that happened, but the thing most worth doing — said in the same
// breath so the line is useful even on a quiet day.
function cardWaiting(u){
  if(!u||u.pledge===undefined)return false;
  return (u.hand||[]).length<5 && u.lastRation!==dayKey();
}

function mapLive(){
  const g = countdown();
  const sworn = db.users.filter(function(u){ return !u.pledge; }).length;
  const coming = db.users.filter(function(u){ return u.rsvp; }).length;
  const bunksOpen = NIGHTS.reduce(function(n,night){
    return n + BUNKS.filter(function(b){
      return !db.bunks.find(function(x){ return x.night===night && x.bunk===b; });
    }).length;
  }, 0);
  const notes = (db.threads||[]).length;
  const said = (db.threads||[]).reduce(function(n,t){ return n + 1 + ((t.replies||[]).length); }, 0);
  const photos = (db.photos||[]).length;
  const champs = champions();
  const wanted = bringList().filter(function(x){ return x.remaining>0; }).length;
  const next = nextEvent();

  const out = {};
  out['/guild.html'] = sworn + ' guildmate' + (sworn===1?'':'s') +
                       (coming ? ' · ' + coming + ' coming' : '');
  out['/weekend']    = g.ended ? 'The faire has been and gone'
                     : g.open  ? 'The gates are open'
                     : g.days + ' day' + (g.days===1?'':'s') + ' to go' +
                       (wanted ? ' · ' + wanted + ' still wanted' : '');
  out['/camp.html']  = bunksOpen ? bunksOpen + ' bunk' + (bunksOpen===1?'':'s') + ' open'
                                 : 'Every bunk taken';
  out['/board']      = said ? said + ' said, over ' + notes + ' note' + (notes===1?'':'s')
                            : 'Nobody has spoken yet';
  out['/board/roll'] = champs.length ? champs[0].name + ' leads'
                                     : 'No rounds taken yet';
  out['/gallery']    = photos ? photos + ' picture' + (photos===1?'':'s') + ' on the wall'
                              : 'The wall is bare';
  if (next) out['/events.html'] = 'Next: ' + next.title + ', ' + next.when.toLowerCase();
  return out;
}
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
  /* A guildmate who also claims a seat becomes two people to this site: two
     identities, two hands, two piles of coin, and their name twice on the Roll
     of Hands. That happened once and had to be merged by hand. A guild login
     already does everything a seat does and more, so send them to it. */
  if(db.users.find(u=>String(u.email||'').toLowerCase()===email))
    return res.redirect('/members/login?e='+encodeURIComponent('That email already has a guild login — sign in there instead, and your hand stays in one place.'));
  if(req.session.uid)
    return res.redirect('/board?e='+encodeURIComponent('You are already signed in as a guildmate — you do not need a seat as well.'));
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
  rows.sort(function(a,b){ return cmpHand(a.rank,b.rank); });
  return rows;
}
// ── Rounds ──────────────────────────────────────────────────────────────────
// One hand of five cards used to be the whole game, and once you had five there
// was nothing left to do until October. The Guild Leader can close a round
// instead: every hand on the table is written into the roll, everyone's deck is
// shuffled fresh, and the dealing starts again. Coins are earned by turning up
// rather than won, so they carry over.
if(!Array.isArray(db.rounds))db.rounds=[];

/* A round used to end only when the Guild Leader remembered to end it, which
   meant a table of finished hands could sit there for weeks with nothing to
   draw and nothing to win. It closes itself now, on whichever comes first:

     · ten days from the round starting, or
     · every hand at the table holding its five.

   Nothing runs on a timer. The check happens when somebody actually looks —
   drawing a card, opening the Tavern or the Roll — which is the only time the
   answer matters, and keeps the app free of background work. */
const ROUND_DAYS = 10;

// The clock has to start somewhere. Rounds only ever recorded when they ended,
// so the open one is dated from the last close, or from the first time the app
// runs with this rule in place.
if (typeof db.roundStarted !== 'number') {
  db.roundStarted = db.rounds.length ? db.rounds[db.rounds.length - 1].ended : Date.now();
  save();
}
function roundEnds(){ return (db.roundStarted || Date.now()) + ROUND_DAYS * 86400000; }

// Why the round is over, or '' while it is not.
function roundOver(){
  var table = allHands();
  if (!table.length) return '';                       // an empty table is not a round
  if (Date.now() >= roundEnds()) return 'time';
  // Everybody at the table holding five: no card can be drawn or bought, so
  // the round has genuinely run out. Two hands at least — one player finishing
  // alone is not a contest, and closing on them would shut the rest of the
  // House out of a round they had not started yet. The ten days catch that.
  if (table.length > 1 && table.every(function(h){ return h.cards.length >= 5; })) return 'full';
  return '';
}
// Call before showing anything that depends on the round. Returns the round it
// closed, or null.
function maybeCloseRound(){
  var why = roundOver();
  return why ? closeRound(why) : null;
}

function closeRound(why){
  var table=allHands();
  if(!table.length)return null;
  var round={
    id:nid(),
    n:(db.rounds.length+1),
    ended:Date.now(),
    why:why||'called',
    hands:table.map(function(h){
      return {id:h.id!=null?h.id:null,name:h.name,avatar:h.avatar||'',kind:h.kind,
              slug:h.kind==='member'&&h.id?(slugById()[h.id]||''):'',
              cards:h.cards.map(function(c){return c.code;}),
              rank:h.rank?{name:h.rank.name,tier:h.rank.tier,cards:h.rank.cards,key:h.rank.key}:null};
    })
  };
  db.rounds.push(round);
  db.roundStarted=Date.now();          // the next round's ten days start here

  /* Tell the people who were holding cards, before the table is wiped. A hand
     that disappears without a word reads as a bug — especially when it was the
     House that ended it rather than the Guild Leader. */
  var top=table[0];
  var winners=table.filter(function(h){return cmpHand(h.rank,top.rank)===0;}).map(function(h){return h.name;});
  var said='Round '+round.n+' is closed'+
    (why==='time' ? ' — its ten days were up.'
     : why==='full' ? ' — every hand at the table was full.'
     : '.')+' '+
    (winners.length===1
      ? winners[0]+' took it with '+((top.rank&&top.rank.name)||'the best hand')+'.'
      : winners.join(' and ')+' shared it.')+
    ' Your cards are on the Roll and every deck is shuffled again.';
  (db.users||[]).forEach(function(u){ if((u.hand||[]).length)notify('member',u.id,said); });
  (db.patrons||[]).forEach(function(p){ if((p.hand||[]).length&&!p.banned)notify('patron',p.id,said); });

  /* Wipe the table, but not the chain.

     The cards go; the run of nights does not. Clearing lastRation outright used
     to reset everybody to night one, which meant the bonus could never climb
     past five — a hand fills at five cards and you cannot draw on a full hand,
     so five draws was a whole round and the rule's cap of seven was a rung
     nobody could reach. Somebody who turns up every single evening should get
     there.

     Dating the last draw to yesterday rather than clearing it does both jobs at
     once: the first card of the new round can still be taken the same evening,
     and the chain reads as unbroken. Only for somebody whose chain was live —
     a person who last drew a week ago has already broken it, and this must not
     quietly mend it for them. */
  function clear(x){
    var live = x.lastRation===dayKey() || x.lastRation===yesterdayKey();
    x.hand=[]; x.deck=null; x.pending=null; x.lastCard=null;
    x.lastRation = live ? yesterdayKey() : null;
    if(!live) x.streak = 0;
  }
  (db.users||[]).forEach(clear);
  (db.patrons||[]).forEach(clear);
  save();
  return round;
}
// Who has taken the most rounds. This is what makes a run of rounds a contest
// rather than a series of unrelated evenings.
//
// A round is credited to everyone level with the top hand: with a small guild
// and short hands a genuine dead heat happens, and handing it to whoever sorted
// first would be a lie. Counted by id where a round recorded one, falling back
// to the name for rounds closed before ids were stored — a rename loses a
// little history rather than the whole tally.
function champions(){
  var by={};
  (db.rounds||[]).forEach(function(r){
    var hands=r.hands||[];
    if(!hands.length)return;
    var top=hands[0];
    hands.forEach(function(h){
      var k=(h.kind||'member')+':'+(h.id!=null?h.id:h.name);
      if(!by[k])by[k]={name:h.name,avatar:h.avatar||'',slug:h.slug||'',kind:h.kind||'member',taken:0,played:0,best:null};
      var e=by[k];
      e.played++;
      e.name=h.name; e.avatar=h.avatar||e.avatar; e.slug=h.slug||e.slug;
      if(cmpHand(h.rank,top.rank)===0)e.taken++;
      if(!e.best||cmpHand(h.rank,e.best)<0)e.best=h.rank;
    });
  });
  return Object.keys(by).map(function(k){return by[k];})
    .sort(function(a,b){ return b.taken-a.taken || b.played-a.played || a.name.localeCompare(b.name); });
}
// Newest first, and each round's winner is simply the top of its own table,
// which was already sorted when the round was closed.
function roll(){
  return (db.rounds||[]).slice().sort(function(a,b){return b.ended-a.ended;})
    .map(function(r){
      var top=(r.hands||[])[0];
      return {n:r.n,ended:r.ended,hands:r.hands.map(function(h){
        return {name:h.name,avatar:h.avatar,slug:h.slug,rank:h.rank,won:cmpHand(h.rank,top&&top.rank)===0,
                cards:(h.cards||[]).map(cardInfo)};
      })};
    });
}
app.get('/board',(req,res)=>{
  // Before anything is read off the table — identRich copies the hand out of
  // the record, so a close has to happen first or the page would draw a hand
  // that no longer exists.
  maybeCloseRound();
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
  // Coming back to a long evening, you could not tell where you had left off.
  // The mark is set from the last visit, then moved forward — so this page
  // still shows what was new when you arrived, and the next one is measured
  // from now. Read before it is written, or you would never see anything.
  const seenBefore=(i&&holder(i))?(holder(i).lastBoard||0):0;
  if(i){ const rec=holder(i); if(rec){ rec.lastBoard=Date.now(); save(); } }

  // Searching the talk. Matches the words and the name that said them, so
  // "bunk" and "Mama Bear" both find something.
  const find=String(req.query.find||'').trim().slice(0,60);
  const needle=find.toLowerCase();
  function hits(p){
    if(!needle)return true;
    return String(p.body||'').toLowerCase().indexOf(needle)>=0
        || String(p.authorName||'').toLowerCase().indexOf(needle)>=0;
  }
  let threads=db.threads.slice().sort(function(a,b){
    // A pinned note stays at the top however old it gets; below that the
    // board reads newest-touched first, as it always has.
    if(!!a.pinned!==!!b.pinned) return a.pinned?-1:1;
    return lastTouch(b)-lastTouch(a);
  }).map(freshenPost);
  if(needle){
    threads=threads.filter(function(t){
      return hits(t)||(t.replies||[]).some(hits);
    });
  }
  const polls=db.polls.slice().sort((a,b)=>b.ts-a.ts).map(freshenPost).map(function(p){const total=p.options.reduce((s,o)=>s+o.votes.length,0);const voted=i?!!p.options.find(o=>o.votes.find(v=>v.t===i.t&&v.id===i.id)):false;return Object.assign({},p,{total:total,voted:voted});});
  res.render('board',{i:i,threads:threads,canPin:mayPin(cur(req)),polls:polls,cats:BOARDCATS,q:req.query,leader:!!(i&&i.leader),ration:{canDraw:!!(i&&i.lastRation!==today),card:i?i.lastCard:null},hand:i?(i.hand||[]).map(cardInfo):[],pending:i&&i.pending?cardInfo(i.pending):null,handRank:i?handRank(i.hand||[]):null,handPrizes:HAND_PRIZES,tableHands:allHands(),cardPrice:CARD_PRICE,redealPrice:REDEAL_PRICE,roundEnds:roundEnds(),roundDays:ROUND_DAYS,roundNo:db.rounds.length+1,special:SPECIALS[dayOfYear()%SPECIALS.length],gates:countdown(),near:nearness(countdown()),notices:i?(db.notices||[]).filter(function(n){return n.toT===i.t&&n.toId===i.id&&!n.read;}).length:0,folk:pres.folk,quietHrs:quietHrs,editMs:EDIT_WINDOW,editDays:EDIT_DAYS,slugs:slugById(),reacts:REACTS,seenBefore:seenBefore,find:find,found:threads.length});
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
/* The town board. A wooden board in the middle of town with paper nailed to
   it: pledges standing at the gate, wanted notices, lost dogs.

   The pledges are pinned by the site rather than by anyone — a newcomer is
   news, and the point of the board is that the people who might know them see
   them. Sworn guildmates can speak for one straight from the board, so nobody
   has to go hunting for the profile page first. */
/* The Town Board is not built.

   There was a route here rendering a 'town' template that has never existed,
   in this repo or on the server, so anyone reaching /town got a 500. Nothing
   linked to it and nothing used it.

   Its three categories are real and unaffected — Wanted, Lost & Found and
   Notice are in BOARDCATS and still postable from the Tavern. What was missing
   was only the separate wall to nail them to. If that wall is ever wanted, the
   shape of it was: pledges awaiting a word, plus every thread in those three
   categories. */
app.get('/board/thread/:id',(req,res)=>{
  const t=db.threads.find(x=>x.id==req.params.id);if(!t)return res.redirect('/board');
  const i=ident(req);res.render('thread',{t:freshenPost(t),i:i,q:req.query,leader:!!(i&&i.leader),slugs:slugById()});
});
app.post('/board/thread/:id/reply',canPost,(req,res)=>{
  const t=db.threads.find(x=>x.id==req.params.id);if(!t)return res.redirect('/board');
  const i=ident(req);const body=(req.body.body||'').trim();if(!body)return res.redirect('/board/thread/'+t.id+'?e='+encodeURIComponent("Reply can't be empty"));
  const rid=nid();
  t.replies.push({id:rid,body:body,authorType:i.t,authorId:i.id,authorName:i.name,authorAvatar:i.avatar,ts:Date.now()});
  if(t.authorType!==i.t||t.authorId!==i.id)notify(t.authorType,t.authorId,i.name+' replied to your note \u201c'+t.title+'\u201d');
  save();
  // Replying is the one action that really does move you to another page, so
  // there is no place to be put back to. Land on the reply you just wrote,
  // rather than at the top of somebody else’s note.
  res.redirect('/board/thread/'+t.id+'#r'+rid);
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
/* Nail a note to the top, or take it down again. Guild Leader and Guild Elder
   only — the two who run the House. Any number can be up at once; they hold
   their own order among themselves by when they were last touched. */
app.post("/board/thread/:id/pin",canPost,(req,res)=>{
  const u=cur(req);
  if(!mayPin(u)) return res.status(403).send("Only the Guild Leader and the Guild Elder may pin a note");
  const t=db.threads.find(function(x){return x.id==req.params.id;});
  if(!t) return res.redirect("/board");
  t.pinned=!t.pinned;
  t.pinnedBy=t.pinned?u.name:"";
  save();
  res.redirect((req.get("Referrer")||"/board").split("#")[0]+"#m"+t.id);
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

/* The same rule, read backwards, for explaining it on the FAQ. Generated
   rather than written out, so the page cannot drift from the payout: change
   cardCoins and the table changes with it. */
function coinTiers(){
  var by={};
  RANKS.forEach(function(r){
    var pays=1+Math.floor(r[1]/5);
    (by[pays]=by[pays]||[]).push(r[0]==='T'?'10':r[0]);
  });
  return Object.keys(by).map(Number).sort(function(a,b){return a-b;})
    .map(function(n){ return {pays:n, cards:by[n].join(', ')}; });
}
/* The bonus ladder as it can actually be climbed. The rule caps at seven, but
   a hand fills at five and you cannot draw on a full hand — so the last two
   rungs are unreachable and printing them would be a lie. */
/* The bonus ladder, all of it. It used to stop at five and say so, because a
   hand fills at five cards and a round reset the count — the last two rungs
   existed in the rule and nowhere else. The chain survives a round closing
   now, so the whole ladder is climbable and the page can print it honestly.
   Five nights gets you to five; the sixth and seventh come in the round
   after. */
function coinLadder(){
  var out=[];
  for(var n=1;n<=7;n++)out.push(n);
  return out;
}
// What a round is worth from a standing start, which is still five nights.
function coinFirstRound(){
  var low=0, high=0;
  for(var n=1;n<=5;n++){ low+=1+n; high+=3+n; }
  return {low:low, high:high};
}

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
  // A key to settle two hands of the same kind, since "A Pair" against "A Pair"
  // used to be a tie broken by whoever happened to sort first — which is no way
  // to decide who took a round. Tier first, then the cards in the order a card
  // player would read them: the paired ranks before the loose ones, each from
  // the top. A straight is decided by its high card alone, so the wheel (where
  // the ace counts low) does not beat a six-high.
  var key;
  if(straight){ key=[tier,high]; }
  else {
    key=[tier];
    Object.keys(counts).map(Number)
      .sort(function(a,b){ return counts[b]-counts[a] || b-a; })
      .forEach(function(v){ for(var k=0;k<counts[v];k++) key.push(v); });
  }
  return {tier:tier,name:name,cards:n,short:n<5,key:key};
}
// Bigger key wins. A shorter hand runs out first and loses the tie, which is
// the point of turning up all five nights.
function cmpHand(a,b){
  var ka=(a&&a.key)||[a&&a.tier||0], kb=(b&&b.key)||[b&&b.tier||0];
  for(var i=0;i<Math.max(ka.length,kb.length);i++){
    var x=ka[i]||0, y=kb[i]||0;
    if(x!==y)return y-x;
  }
  return 0;
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
/* What your purse calls you in the Tavern. A table rather than a ladder of ifs
   so the FAQ can print the same thresholds the game uses — two copies of these
   numbers would disagree the first time one of them moved. Highest first. */
const COIN_TITLES=[{at:120,name:'Captain'},{at:70,name:'Quartermaster'},
  {at:40,name:'Bosun'},{at:18,name:'Deckhand'},{at:5,name:'Sailor'},{at:0,name:'Landlubber'}];
function tavernTitle(coins){coins=coins||0;
  var hit=COIN_TITLES.find(function(t){return coins>=t.at;});
  return hit?hit.name:'Landlubber';}
function dayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dayOfYear(){const now=new Date();const start=new Date(now.getFullYear(),0,0);return Math.floor((now-start)/86400000);}
function identRich(req){const i=ident(req);if(!i)return null;const rec=i.t==='member'?db.users.find(function(x){return x.id===i.id;}):db.patrons.find(function(x){return x.id===i.id;});if(!rec)return i;return Object.assign({},i,{coins:rec.coins||0,lastRation:rec.lastRation||'',lastCard:rec.lastCard||null,streak:rec.streak||0,hand:rec.hand||[],pending:rec.pending||null});}
const REACTS=['\uD83C\uDF7A','\uD83E\uDE99','\uD83D\uDD25','\u2694\uFE0F'];
function doReact(req,res,host){var i=ident(req);var e=(req.body.emoji||'').trim();if(REACTS.indexOf(e)<0)return res.redirect(req.get('Referrer')||'/board');if(!host.reacts)host.reacts={};var arr=host.reacts[e]=host.reacts[e]||[];var idx=arr.findIndex(function(v){return v.t===i.t&&v.id===i.id;});if(idx>=0){arr.splice(idx,1);}else{arr.push({t:i.t,id:i.id});if(host.authorType!==i.t||host.authorId!==i.id)notify(host.authorType,host.authorId,i.name+' raised a '+e+' to '+(host.title?('your note \u201c'+host.title+'\u201d'):'your reply'));}save();res.redirect((req.get('Referrer')||'/board').split('#')[0]+'#m'+host.id);}
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

/* The second thing to spend on, because one sink is not an economy.

   Buying a card early only buys it *sooner* — it never buys a better one. This
   buys a different one: throw a card back and take the next off your deck. The
   card you threw does not go back in, so nobody cycles the same deck forever
   looking for an ace; each re-deal costs you a card as well as the coins.

   Dearer than a card, deliberately. A card off the House is patience you did
   not have; this is a hand you did not like, and it should cost more than a
   night of turning up is worth. */
const REDEAL_PRICE=25;
app.post('/board/hand/buy',canPost,(req,res)=>{
  var i=ident(req);var rec=holder(i);
  if(!rec)return res.redirect('/board');
  if(!Array.isArray(rec.hand))rec.hand=[];
  if(rec.hand.length>=5)return res.redirect(backTo(req));
  if((rec.coins||0)<CARD_PRICE)
    return res.redirect(backErr(req,'That costs '+CARD_PRICE+' coins and you have '+(rec.coins||0)+'. Come back tomorrow for a free one.'));
  ensurePurse(rec);
  rec.coins=(rec.coins||0)-CARD_PRICE;
  var card=dealOne(rec);
  rec.hand.push(card);
  rec.bought=(rec.bought||0)+1;
  purseAdd(rec,-CARD_PRICE,'Bought the '+cardInfo(card).label+' of '+cardInfo(card).suitName+' early');
  // deliberately does NOT touch lastRation or streak — the streak is for
  // turning up, and buying a card is not turning up.
  save();
  var done=maybeCloseRound();      // a bought card can fill the table too
  res.redirect(done?('/board/roll?closed='+done.n):backTo(req));
});
app.post('/board/hand/redeal',canPost,(req,res)=>{
  var i=ident(req);var rec=holder(i);
  if(!rec)return res.redirect('/board');
  var code=String(req.body.card||'');
  var at=(rec.hand||[]).indexOf(code);
  if(at<0)return res.redirect(backTo(req));
  if((rec.coins||0)<REDEAL_PRICE)
    return res.redirect(backErr(req,'A re-deal costs '+REDEAL_PRICE+' coins and you have '+(rec.coins||0)+'.'));
  // Nothing left to draw from would make this a way to pay for the same card
  // back, so it is refused rather than fudged.
  if(!Array.isArray(rec.deck)||!rec.deck.length){
    var held=(rec.hand||[]).concat(rec.pending?[rec.pending]:[]);
    rec.deck=shuffle(freshDeck().filter(function(c){return held.indexOf(c)<0;}));
  }
  ensurePurse(rec);
  rec.coins=(rec.coins||0)-REDEAL_PRICE;
  var out=cardInfo(code);
  var card=dealOne(rec);                       // the discard does not go back
  rec.hand[at]=card;
  var got=cardInfo(card);
  purseAdd(rec,-REDEAL_PRICE,'Threw back the '+out.label+' of '+out.suitName+' for the '+got.label+' of '+got.suitName);
  // deliberately does NOT touch lastRation or streak, for the same reason
  // buying a card does not: the streak is for turning up.
  save();
  var done=maybeCloseRound();
  res.redirect(done?('/board/roll?closed='+done.n):backTo(req));
});
app.post('/board/ration',canPost,(req,res)=>{
  var i=ident(req);var rec=holder(i);
  if(!rec)return res.redirect('/board');
  if(!Array.isArray(rec.hand))rec.hand=[];
  // Five-card stud: five is the whole hand, and there is no sixth night.
  if(rec.hand.length>=5)return res.redirect(backTo(req));
  var today=dayKey();
  if(rec.lastRation===today)return res.redirect(backTo(req));
  var yest=yesterdayKey();
  var streak=(rec.lastRation===yest)?(rec.streak||0)+1:1;
  rec.streak=streak;
  var card=dealOne(rec);
  var bonus=Math.min(streak,7);
  ensurePurse(rec);
  rec.coins=(rec.coins||0)+cardCoins(card)+bonus;
  // Two lines, not one. "The Queen of Hearts, 3" and "Night 4 in a row, 4" is
  // the story; a single total of 7 is just a number going up.
  purseAdd(rec,cardCoins(card),'The '+cardInfo(card).label+' of '+cardInfo(card).suitName);
  if(bonus)purseAdd(rec,bonus,'Night '+streak+' in a row');
  rec.lastRation=today;
  rec.hand.push(card);
  rec.pending=null;
  rec.lastCard={code:card,ts:Date.now(),streak:streak,bonus:bonus};
  save();
  // That card may have been the one that filled the last empty seat. If so the
  // round ends here rather than on somebody's next page load — and they are
  // sent to the Roll, where the hand they just finished is waiting, instead of
  // back to a table that has silently emptied.
  var done=maybeCloseRound();
  res.redirect(done?('/board/roll?closed='+done.n):backTo(req));
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
// A word for how close the faire is, so the Tavern can warm up as it nears
// rather than the date being a number nobody feels.
function nearness(g){
  if(g.ended)return "ended";
  if(g.open)return "open";
  if(g.days<=1)return "eve";
  if(g.days<=7)return "week";
  if(g.days<=30)return "month";
  return "far";
}
function countdown(){
  var open=new Date(Date.UTC(2026,9,9,17,0,0)),close=new Date(Date.UTC(2026,9,12,0,0,0)),now=new Date();
  if(now>=close)return{ended:true};
  if(now>=open)return{open:true};
  return{days:Math.floor((open-now)/86400000)};
}

/* ── The Pigeon Post ────────────────────────────────────────────────────────
   The House could already carry a private word from one person to another —
   whispers have worked for months. The trouble was that nobody could find
   them: one link buried in the Tavern, no way to begin one except by
   stumbling across somebody in the Rogues gallery, and a second separate pile
   of House notices sitting somewhere else entirely. Two inboxes, neither of
   them on the menu.

   This is one room for both, with a door of its own, and the one thing that
   genuinely could not be done before: writing to several people at once, or
   to the whole guild, without composing the same letter nine times.

   Underneath it is still whispers. A letter to nine people is nine private
   letters, so a reply comes back to you alone rather than to a crowd — which
   is what anybody answering a letter expects. */

// Everyone a letter can be addressed to: the guild, not counting yourself.
function guildFolk(i){
  return (db.users||[]).filter(function(u){
    return !(i && i.t==="member" && i.id===u.id);
  }).map(function(u){
    return {t:"member", id:u.id, name:u.name, avatar:u.avatar||"", rank:rank(u),
            pledge:!!u.pledge, leader:u.role==="leader"};
  }).sort(function(a,b){
    if(a.pledge!==b.pledge) return a.pledge?1:-1;      // pledges last, not hidden
    return a.name.localeCompare(b.name);
  });
}

/* Everything addressed to you, in the two shapes it comes in: letters from
   people, which are conversations and can be answered, and word from the
   House, which is one-way. Kept apart on the page, because answering a notice
   is not a thing anybody can do. */
function postFor(i){
  const mine=(db.whispers||[]).filter(function(w){
    return (w.fromT===i.t&&w.fromId===i.id)||(w.toT===i.t&&w.toId===i.id); });
  const conv={};
  mine.forEach(function(w){
    const other=(w.fromT===i.t&&w.fromId===i.id)?{t:w.toT,id:w.toId}:{t:w.fromT,id:w.fromId};
    const k=other.t+":"+other.id;
    if(!conv[k]||w.ts>conv[k].last.ts)conv[k]={other:other,last:w};
  });
  const letters=Object.keys(conv).map(function(k){
    const c=conv[k];
    const who=party(c.other.t,c.other.id)||{name:"A stranger",avatar:""};
    const unread=mine.filter(function(w){
      return w.toT===i.t&&w.toId===i.id&&w.fromT===c.other.t&&w.fromId===c.other.id&&!w.read; }).length;
    return {other:c.other,last:c.last,name:who.name,avatar:who.avatar,unread:unread,
            mine:(c.last.fromT===i.t&&c.last.fromId===i.id)};
  }).sort(function(a,b){ return b.last.ts-a.last.ts; });

  const notices=(db.notices||[]).filter(function(n){
    return n.toT===i.t&&n.toId===i.id; }).sort(function(a,b){ return b.ts-a.ts; });

  return {letters:letters, notices:notices,
          unreadLetters:letters.reduce(function(n,c){return n+c.unread;},0),
          unreadNotices:notices.filter(function(n){return !n.read;}).length};
}

app.get('/post',canPost,(req,res)=>{
  const i=ident(req);
  const post=postFor(i);
  /* Opening the room is reading the House’s word, so the notices are marked
     here. The letters are not — a letter is read by opening it, which is what
     opening a letter means. */
  let touched=false;
  (db.notices||[]).forEach(function(n){
    if(n.toT===i.t&&n.toId===i.id&&!n.read){ n.read=true; touched=true; } });
  if(touched){
    save();
    /* The counts were worked out by the middleware before this route read the
       notices, so leaving them alone would draw this very page with a mark
       claiming there is unread word from the House sitting on it. */
    res.locals.notes=0;
    res.locals.unread=res.locals.letters;
    if(res.locals.me&&res.locals.me.signedIn)res.locals.me.unread=res.locals.letters;
  }
  res.render('post',{i:i,post:post,q:req.query,leader:!!(i&&i.leader)});
});

app.get('/post/write',canPost,(req,res)=>{
  const i=ident(req);
  res.render("write",{i:i,folk:guildFolk(i),to:String(req.query.to||""),
    leader:!!(i&&i.leader),err:String(req.query.e||"")});
});

app.post('/post/write',canPost,(req,res)=>{
  const i=ident(req);
  const body=String(req.body.body||"").trim().slice(0,2000);
  if(!body)return res.redirect("/post/write?e="+encodeURIComponent("There is nothing written on it."));

  /* Who it goes to. "The whole guild" is a checkbox rather than a second
     button, so it still works with scripting off, and it belongs to the Guild
     Leader alone — not because anybody else would abuse it, but because a
     letter to every soul in the House should read as coming from the House. */
  let to=[];
  if(req.body.everyone && i.leader){
    to=guildFolk(i);
  } else {
    const picked=[].concat(req.body.to||[]).filter(function(x){return typeof x==="string";});
    const folk=guildFolk(i);
    to=picked.map(function(k){
      const bits=k.split(":");
      return folk.find(function(f){ return f.t===bits[0] && String(f.id)===bits[1]; });
    }).filter(Boolean);
  }
  if(!to.length)return res.redirect("/post/write?e="+encodeURIComponent("Nobody was chosen to receive it."));

  if(!Array.isArray(db.whispers))db.whispers=[];
  to.forEach(function(f){
    db.whispers.push({id:nid(),fromT:i.t,fromId:i.id,toT:f.t,toId:f.id,
                      body:body,ts:Date.now(),read:false});
  });

  /* The Guild Leader is told when somebody writes to her, the same as with a
     whisper — unless she is the one doing the writing. */
  const toHer=to.find(function(f){ return f.leader; });
  if(toHer && !i.leader)
    tellHer(i.name+" wrote to "+toHer.name+": “"+body.slice(0,120)+(body.length>120?"…":"")+"”");
  save();

  /* Straight into the letter if it went to one person, because you will want
     to see it sitting there. Back to the room if it went to several, where all
     of them now are. */
  if(to.length===1)return res.redirect("/board/whisper/"+to[0].t+"/"+to[0].id);
  res.redirect("/post?sent="+to.length);
});

/* The two old doors still open — they are linked from the FAQ and the Tavern,
   and from every notice anybody has ever been sent. */
app.get('/board/notices',canPost,(req,res)=>res.redirect('/post#house'));
app.get('/board/whispers',canPost,(req,res)=>res.redirect('/post'));
app.get('/board/whisper/:t/:id',canPost,(req,res)=>{var i=ident(req);var ot=req.params.t,oid=parseInt(req.params.id);if(ot===i.t&&oid===i.id)return res.redirect('/board/whispers');if(ot!=='member'&&ot!=='patron')return res.redirect('/board/whispers');var p=party(ot,oid);if(!p)return res.redirect('/board/whispers');var msgs=(db.whispers||[]).filter(function(w){return ((w.fromT===i.t&&w.fromId===i.id&&w.toT===ot&&w.toId===oid)||(w.fromT===ot&&w.fromId===oid&&w.toT===i.t&&w.toId===i.id));}).sort(function(a,b){return a.ts-b.ts;});db.whispers.forEach(function(w){if(w.fromT===ot&&w.fromId===oid&&w.toT===i.t&&w.toId===i.id)w.read=true;});save();res.render('whisper',{i:i,other:{t:ot,id:oid,name:p.name,avatar:p.avatar},msgs:msgs});});
app.post('/board/whisper/:t/:id',canPost,(req,res)=>{var i=ident(req);var ot=req.params.t,oid=parseInt(req.params.id);if(ot===i.t&&oid===i.id)return res.redirect('/board/whispers');var body=(req.body.body||'').trim();if(!body)return res.redirect('/board/whisper/'+ot+'/'+oid);if(!Array.isArray(db.whispers))db.whispers=[];db.whispers.push({id:nid(),fromT:i.t,fromId:i.id,toT:ot,toId:oid,body:body,ts:Date.now(),read:false});var _to=ot==='member'?db.users.find(function(x){return x.id===oid;}):null;if(_to&&_to.role==='leader'&&!(i.t==='member'&&i.id===_to.id))tellHer(i.name+' whispered '+_to.name+': \u201c'+body.slice(0,120)+(body.length>120?'\u2026':'')+'\u201d');save();res.redirect('/board/whisper/'+ot+'/'+oid);});

/* ── The forecast, once there is one ────────────────────────────────────────
   The camp page has twenty-six years of history on it — that weekend has run
   78°F to 97°F — which is the honest answer in August and the wrong one on the
   6th of October, when there is a real forecast to be had and everybody is
   deciding what to pack.

   Same source as the history: Open-Meteo, no key, over the middle of Sunset
   Park. It only looks sixteen days ahead, so this says nothing at all until
   late September and the history stands alone until then. Nothing is ever
   asked of it more than once every three hours, and if it cannot be reached
   the page simply carries on without it — a forecast is a nicety and must
   never be a reason a page fails to draw. */
const PARK={lat:36.070,lon:-115.110};
const FAIRE_DAYS=['2026-10-09','2026-10-10','2026-10-11'];
const SKY={0:'clear',1:'mostly clear',2:'partly cloudy',3:'overcast',
  45:'fog',48:'freezing fog',51:'light drizzle',53:'drizzle',55:'heavy drizzle',
  61:'light rain',63:'rain',65:'heavy rain',66:'freezing rain',67:'freezing rain',
  71:'light snow',73:'snow',75:'heavy snow',77:'snow grains',
  80:'light showers',81:'showers',82:'heavy showers',
  95:'thunderstorms',96:'thunderstorms with hail',99:'thunderstorms with hail'};
let skyCache={at:0,data:null};
async function faireForecast(){
  if(skyCache.data&&Date.now()-skyCache.at<3*3600*1000)return skyCache.data;
  const url='https://api.open-meteo.com/v1/forecast'+
    '?latitude='+PARK.lat+'&longitude='+PARK.lon+
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'+
    '&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=16';
  let out={ok:true,inRange:false,days:[]};
  try{
    const r=await fetch(url,{headers:{'User-Agent':'houseofcardandcoin.com camp page'}});
    if(!r.ok)throw new Error('open-meteo '+r.status);
    const j=await r.json();
    const t=(j.daily&&j.daily.time)||[];
    FAIRE_DAYS.forEach(function(d){
      const n=t.indexOf(d);
      if(n<0)return;
      out.days.push({
        date:d,
        high:Math.round(j.daily.temperature_2m_max[n]),
        low:Math.round(j.daily.temperature_2m_min[n]),
        rain:j.daily.precipitation_probability_max?j.daily.precipitation_probability_max[n]:null,
        sky:SKY[j.daily.weather_code[n]]||''
      });
    });
    out.inRange=out.days.length>0;
  }catch(e){
    console.log('forecast unavailable:',e.message);
    out={ok:false,inRange:false,days:[]};
  }
  // A failure is cached too, briefly, so a source that is down is not hammered
  // by every visitor who opens the camp page.
  skyCache={at:Date.now(),data:out};
  return out;
}
app.get('/api/weather',async(req,res)=>{
  res.set('Cache-Control','public, max-age=1800');
  res.json(await faireForecast());
});

app.get('/api/map',(req,res)=>{res.set('Cache-Control','no-store');res.json(mapLive());});
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
