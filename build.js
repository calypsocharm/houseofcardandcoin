const fs=require("fs");const path=require("path");
const ROOT="C:/Users/Calyp/OneDrive/Documents/New project/houseofcardandcoin-site";
const I="/assets/img/";
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const SITE={name:"House of Card and Coin",motto:"Where Fortunes Shift, Destinies Unfurl, and Every Bargain Has Its Price.",tag:"Whispers, Wagers, and Well-Kept Secrets",faire:"31st Annual Age of Chivalry Renaissance Festival",dates:"October 9 � 11, 2026",email:"houseofcardandcoin@gmail.com",loc:"Sunset Park � 2601 E Sunset Rd � Las Vegas, NV 89120"};
const NAV=[["Home","/index.html"],["Guild","/guild.html"],["Sellsword","/sellsword.html"],["Ranks","/ranks.html"],["Scroll of Events","/events.html"],["Ren Faire Camp","/camp.html"],["Tavern","/board"],["Carrier Pigeon","/pigeon.html"]];
const head=(active)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(SITE.name)} � ${esc(SITE.tag)} | Age of Chivalry Renaissance Festival</title>
<meta name="description" content="The House of Card and Coin � a Renaissance Faire guild of skilled traders, dealers, readers, brokers and sellswords. Join us at the 31st Annual Age of Chivalry Renaissance Festival, ${SITE.dates}, Sunset Park, Las Vegas.">
<link rel="icon" href="${I}019.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css"></head><body>
<header><div class="nav"><a class="brand" href="/index.html"><img class="crest" src="${I}019.png" alt="House of Card and Coin crest"><span>${SITE.name}<small>${SITE.tag}</small></span></a>
<button class="menu-toggle" aria-label="Menu" onclick="document.getElementById('nl').classList.toggle('open')"><span></span><span></span><span></span></button>
<nav class="nav-links" id="nl">${NAV.map(([l,h])=>`<a href="${h}"${h===active?' class="active"':''}>${l}</a>`).join("")}</nav></div></header>`;
const footer=`<footer><div class="container"><div class="footer-grid">
<div class="footer-brand"><a class="brand" href="/index.html" style="color:#f5e9c8"><img class="crest" src="${I}019.png" alt="House of Card and Coin crest"><span style="font-family:var(--display);font-weight:700;font-size:1.1rem">${SITE.name}<small style="display:block;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-l)">${SITE.tag}</small></span></a><p>A guild of dealers, readers, brokers and sellswords � weavers of fate at the Age of Chivalry Renaissance Festival, ${SITE.dates}, Sunset Park, Las Vegas.</p></div>
<div><h4>The Guild</h4><ul>${NAV.slice(0,5).map(([l,h])=>`<li><a href="${h}">${l}</a></li>`).join("")}</ul></div>
<div><h4>Faire</h4><ul><li><a href="/camp.html">Ren Faire Camp</a></li><li><a href="/events.html">Scroll of Events</a></li></ul></div>
<div><h4>Send a Pigeon</h4><ul><li><a href="mailto:${SITE.email}">${SITE.email}</a></li><li>${SITE.loc}</li><li>${SITE.dates}</li></ul></div></div>
<div class="footer-bottom"><span>&copy; 2024 � 2026 ${SITE.name}. All rights reserved.</span><span>${SITE.motto}</span></div></div></footer><script defer src="/assets/js/auth-signal.js?v=20260807d"></script><script defer src="/assets/js/countdown.js?v=20260807d"></script><script>(function(){var r=new URLSearchParams(location.search).get("reason");if(!r)return;var s=document.querySelector('select[name="Reason"]');if(!s)return;for(var i=0;i<s.options.length;i++){if(s.options[i].value===r){s.selectedIndex=i;break;}}var m=document.querySelector('textarea[name="Message"]');if(m&&r==="Locked out of my account"&&!m.value){m.value="I cannot sign in to the Guild Hall. My login is: ";m.focus();}})();</script><script defer src="/assets/js/hero-video.js?v=20260807d"></script></body></html>`;
const CTA=`<section class="section section--dark"><div class="container cta"><div><span class="eyebrow">Join the House</span><h2>Put me on the list!</h2><p>Quests, trading, tales, and a seat by the campfire await. Send your pigeon and claim your place in the House of Card and Coin.</p></div><div class="cta__actions"><a class="btn btn--gold" href="/pigeon.html">Send a Pigeon</a><a class="btn btn--ghost" href="/events.html">View the Scroll of Events</a></div></div></section>`;
const fig=(local,aspect,cap,sub)=>`<figure class="fig fig--${aspect}"><img src="${I}${local}" alt="${esc(cap||"House of Card and Coin")}" loading="lazy">${cap?`<figcaption>${esc(cap)}${sub?`<span style="display:block;font-size:.74rem;letter-spacing:.1em;color:var(--gold-l);text-transform:uppercase">${esc(sub)}</span>`:""}</figcaption>`:""}</figure>`;

// ---------- HOME ----------
const home=`${head("/index.html")}
<section class="hero"><video class="hero__bg" muted loop playsinline poster="${I}000.jpg" preload="none" data-src="/assets/vid.mp4"><img src="${I}000.jpg" alt=""></video>
<div class="container hero__inner"><span class="eyebrow">31st Annual � Age of Chivalry � Las Vegas</span>
<h1>House of Card &amp; Coin</h1>
<p class="sub">Whispers, wagers, and well-kept secrets. Hark, traveler � step into a curious world beyond the pale of your comfort zone, where fortunes shift, destinies unfurl, and every bargain has its price.</p>
<div class="hero__cta"><a class="btn btn--gold" href="/guild.html">Enter the Guild</a><a class="btn btn--ghost" href="/events.html">Scroll of Events</a></div>
<div class="hero__meta"><span class="chip chip--count" id="gatesCountdown" hidden></span><span class="chip"><b>${SITE.dates}</b></span><span class="chip">Gates 10AM�10PM</span><span class="chip">Sunset Park, Las Vegas</span></div></div></section>

<section class="section"><div class="container"><div class="bannerhead"><span class="eyebrow">The Specialists of the House</span><h2>Dealers � Readers � Brokers</h2><div class="rule"></div></div>
<div class="grid grid--3">
<div class="rolecard"><img class="rolecard__img" src="${I}024.jpg" alt="The Dealer of Dares & Delights"><div class="rolecard__body"><h3>?? Dealers</h3><p>The Dealer of Dares &amp; Delights � step up to the table of our resident card maestro. Games of chance, tests of strategy, and merry diversions. The house doesn't always win, but it certainly enjoys the attempt.</p></div></div>
<div class="rolecard"><img class="rolecard__img" src="${I}013.jpg" alt="The Interpreter of Inner Trails"><div class="rolecard__body"><h3>?? Readers</h3><p>The Interpreter of Inner Trails � our gifted tarot reader illuminates your path, explores your questions, and offers fresh perspectives. Let the ancient wisdom of the cards spark inspiration.</p></div></div>
<div class="rolecard"><img class="rolecard__img" src="${I}005.jpg" alt="The Broker of Balanced Bargains"><div class="rolecard__body"><h3>?? Brokers</h3><p>The Broker of Balanced Bargains � our astute accountant and broker navigates the nuances of exchange, facilitates discreet transactions, and keeps all ledgers � visible and invisible � meticulously kept.</p></div></div>
</div></div></section>

<section class="section section--parch2"><div class="container"><div class="grid grid--2" style="align-items:center">
<div>${fig("002.jpg","43","Parchment &amp; the Rogue's Watermark","A guild secret, sealed")}</div>
<div><span class="eyebrow">Foresee the Future</span><h2>The Life of a Beggar Ends with a Coin</h2><p class="lead">We are weavers of fate, dealers of chance, and discreet facilitators of� interesting opportunities. If you tire of the mundane and seek a sprinkle of magic � or a carefully calculated risk � you've stumbled upon the right path.</p>
<p style="margin-top:14px;color:var(--muted)">Experience the Renaissance Faire with our skilled Dealers, Readers, and Brokers at your service � and, should the need arise, a sellsword or two.</p>
<a class="btn btn--outline" href="/sellsword.html" style="margin-top:22px">Hire a Sellsword</a></div>
</div></div></section>

<section class="section section--dark"><div class="container"><div class="grid grid--2" style="align-items:center"><div><figure class="fig fig--43"><img src="/assets/img/010.jpg" alt="The marketplace at Sunset Park" loading="lazy"><figcaption>The marketplace at Sunset Park</figcaption></figure></div><div><span class="eyebrow">Ren Faire Camp</span><h2 style="color:#f5e9c8">A Camp Under the Stars</h2><p class="lead">We claim the spot Thursday, October 8 and camp from Friday night � a dry camp beside the campground, with private entertainment and the option of the Saturday Dinner Feast Show.</p><a class="btn btn--gold" href="/camp.html" style="margin-top:22px">Camp Details</a></div></div></div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"index.html"),home);

// ---------- GUILD ----------
const guild=`${head("/guild.html")}
<section class="pagehero"><div class="pagehero__bg" style="background-image:url('${I}010.jpg')"></div><div class="container pagehero__inner"><span class="eyebrow">The Guild</span><h1>Welcome to the House of Card and Coin</h1><p>Where chance, destiny, and deals align. A gathering of specialists dedicated to life's more artful pursuits.</p></div></section>
<section class="section"><div class="container"><div class="bannerhead"><span class="eyebrow">A Consortium of Specialists</span><h2>Where Chance, Destiny &amp; Deals Align</h2><div class="rule"></div></div>
<p class="lead center" style="margin-bottom:40px">Greetings, discerning Faire-goer! If you find yourself drawn to the more intriguing corners of the marketplace � where wit is as valuable as coin and opportunity often wears a disguise � you've found your way to us.</p>
<div class="grid grid--3">
<div class="scroll"><h3>?? The Dealer of Dares &amp; Delights</h3><p>Step up to the table of our resident card maestro. Whether you crave the thrill of a game of chance, a test of your strategic mind, or simply an amusing diversion, you'll find it here. Expect lively play and sharp wits.</p></div>
<div class="scroll"><h3>?? The Interpreter of Inner Trails</h3><p>Curious about what the threads of fate may hold? Our gifted tarot reader offers consultations to illuminate your path, explore your questions, and offer fresh perspectives from the ancient wisdom of the cards.</p></div>
<div class="scroll"><h3>?? The Broker of Balanced Bargains</h3><p>In a world of grand gestures, the most valuable things are found in carefully crafted agreements. Our astute broker facilitates unique transactions and keeps all ledgers � visible and invisible � meticulously kept.</p></div>
</div></div></section>
<section class="section section--parch2"><div class="container"><div class="grid grid--2" style="align-items:center">
<div><span class="eyebrow">The Gambits &amp; Games Arena</span><h2>Memorable Encounters &amp; Unique Discoveries</h2><p class="lead">We believe an unparalleled Renaissance Faire experience is built on memorable encounters and unique discoveries � a chance to engage, to be intrigued, and perhaps to walk away with more than you bargained for.</p><a class="btn btn--wine" href="/events.html" style="margin-top:22px">See the Schedule</a></div>
<div>${fig("014.jpg","43","Guildmates in the marketplace","At the faire")}</div>
</div></div></section><section class="section"><div class="container"><div class="bannerhead"><span class="eyebrow">? Guild Roster ?</span><h2>The House, Assembled</h2><div class="rule"></div></div><div class="roster">
<div class="member member--lead"><div class="avatar">SC</div><h3>Sir Captain Caberk</h3><span class="role">Guild Leader</span></div>
<div class="member member--lead"><div class="avatar">MB</div><h3>Mama Bear</h3><span class="role">Guild Elder</span></div>
<div class="member"><div class="avatar">N</div><h3>Sir Nate</h3><span class="role">Guildmate</span></div>
<div class="member"><div class="avatar">E</div><h3>Eric</h3><span class="role">Guildmate</span></div>
<div class="member"><div class="avatar">D</div><h3>Dave</h3><span class="role">Guildmate</span></div>
<div class="member"><div class="avatar">Et</div><h3>Ethan</h3><span class="role">Guildmate</span></div>
<div class="member"><div class="avatar">L</div><h3>Liz</h3><span class="role">Guildmate</span></div>
<div class="member"><div class="avatar">Ed</div><h3>Eddie</h3><span class="role">Guildmate</span></div>
<div class="member member--tba"><div class="avatar">+</div><h3>More to Come</h3><span class="role">Guildmates pending</span></div>
</div><p class="muted center" style="margin-top:24px">Guild portraits coming soon � check back for the full roster.</p></div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"guild.html"),guild);

// ---------- SELLSWORD ----------
const sellsword=`${head("/sellsword.html")}
<section class="pagehero"><video class="pagehero__bg" muted loop playsinline poster="${I}011.jpg" preload="none" data-src="/assets/vid-armor.mp4"></video><div class="container pagehero__inner"><span class="eyebrow">Sellsword</span><h1>Discreet Removal &amp; Tailored Guard Services</h1><p>We thrive on the unexpected, celebrate cleverness, and meet adversity with unwavering composure.</p></div></section>
<section class="section"><div class="container"><div class="bannerhead"><span class="eyebrow">For Hire</span><h2>Comprehensive Security Solutions</h2><div class="rule"></div></div>
<div class="grid grid--3">
<div class="scroll"><h3>??? Tailored Guard Services</h3><p><b>Adaptable Force:</b> From disciplined shield walls to swift flanking maneuvers, our company shapes itself to your need. Contractual integrity: when a bargain is struck, we honor it � your objectives become our objectives.</p></div>
<div class="scroll"><h3>?? Discreet Removal Services</h3><p><b>Unwavering Composure:</b> Panic has no place in our ranks. We meet adversity with steady hands and quiet resolve, attending to� delicate matters with the utmost discretion.</p></div>
<div class="scroll"><h3>?? Reinforcement for Holdings</h3><p><b>Battle-Hardened Skill:</b> Each member of our company carries the wisdom of campaigns past. We reinforce your holdings and shore up what is yours � for coin and a worthy cause.</p></div>
</div></div></section>
<section class="section section--dark"><div class="container"><div class="grid grid--2" style="align-items:center"><div>${fig("018.png","43")}</div><div><span class="eyebrow">A Company of Mercenaries</span><h2 style="color:#f5e9c8">Honor the Bargain</h2><p class="lead">We are mercenaries of the House � adaptable, discreet, and bound by the bargain. When the unexpected comes knocking, send for the sellsword.</p><a class="btn btn--gold" href="/treaty.html" style="margin-top:22px">Treaty &amp; Terms</a></div></div></div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"sellsword.html"),sellsword);

// ---------- RANKS ----------
const ranks=`${head("/ranks.html")}
<section class="pagehero"><div class="pagehero__bg" style="background-image:url('${I}007.jpg')"></div><div class="container pagehero__inner"><span class="eyebrow">Guild Rank Paths</span><h1>From Pledge to Elder</h1><p>All hail the Guild Leader, Sir Caberk, and the Guild Elder, Mama Bear. Your rank rises with the faires you've camped with the House.</p></div></section>
<section class="section"><div class="container"><div class="bannerhead"><span class="eyebrow">? Guild Rank Paths ?</span><h2>From Pledge to Elder</h2><div class="rule"></div></div>
<p class="lead center" style="margin-bottom:40px">All hail the Guild Leader, <b>Sir Caberk</b>, and the Guild Elder, <b>Mama Bear</b>. Your rank rises with the number of faires you've camped with the House. Anyone may sign up as a <b>Pledge</b>; the Guild Leader welcomes pledges into the House.</p>
<div class="grid grid--4">
<div class="rank"><h4>1 � Pledge</h4><p>Signed up, awaiting the Guild Leader’s welcome into the House.</p></div>
<div class="rank"><h4>2 � Guildmate</h4><p>Accepted and sworn to the House � a Sir or Lady of the guild.</p></div>
<div class="rank"><h4>3 � Veteran</h4><p>3+ faires � a seasoned hand around the campfire.</p></div>
<div class="rank"><h4>4 � Elder</h4><p>6+ faires � a keeper of the House's tales and traditions.</p></div>
</div></div></section>
<section class="section section--parch2"><div class="container"><div class="bannerhead"><span class="eyebrow">The Quartermaster</span><h2>Keeper of the Bring-List &amp; Bunk Board</h2></div>
<div class="scroll" style="max-width:760px;margin:0 auto;text-align:center"><p style="font-size:1.16rem;font-style:italic">The Quartermaster keeps the bring-list and the bunk board in the Guild Hall � sign in to claim a bunk, volunteer to bring firewood or chairs, and mark your faires attended to rise in rank.</p></div></div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"ranks.html"),ranks);

// ---------- EVENTS (Scroll of Events) ----------
const days=[
["Friday","October 9","10:00AM � 10:00PM",[
["Evening","<b>Campfire &amp; S'mores</b><br>The fire is lit and the marshmallows are toasted � the weekend begins."],
["Evening","<b>Guild Potluck &amp; Drinks</b><br>Bring a dish to share; drinks by the firelight as the night comes on."],
["Late Night","<b>After-Party Faire Stroll</b><br>A rough jaunt through the faire grounds after closing time to seek out new members and adventures."],
]],
["Saturday","October 10","10:00AM � 10:00PM",[
["Evening","<b>Guild Dinner</b><br>The big camp meal, cooked up proper."],
["Late Night","<b>Drinks &amp; Tales</b><br>The long night of drinking and stories by the camp."],
["Late Night","<b>After-Party Faire Stroll</b><br>Round two through the grounds � recruiting and revelling after the gates shut."],
]],
["Sunday","October 11","10:00AM � 5:00PM",[
["Morning","<b>Camp Breakfast</b><br>Meat and eggs cooked up at camp (no campfire tonight) � fuel for the final day."],
["Midday","<b>Last Call</b><br>One last round together before the gates close. Raise a cup to the weekend."],
["5:00 PM","<b>The Gates Close</b><br>Pack the camp, take the tales home."],
]]
];
const events=`${head("/events.html")}
<section class="pagehero"><video class="pagehero__bg" muted loop playsinline poster="${I}016.jpg" preload="none" data-src="/assets/vid-events.mp4"></video><div class="container pagehero__inner"><span class="eyebrow">Scroll of Events</span><h1>The Guild Event Schedule</h1><p>Three days of campfires, dinners, s'mores, and late nights of drinks and tales � the guild's true rhythm at the faire. ${SITE.faire}, ${SITE.dates}.</p></div></section>
<section class="section"><div class="container">
<div class="callout" style="margin-bottom:44px">
<div class="fact"><div class="ic">??</div><h4>The Faire</h4><p>${SITE.faire}</p></div>
<div class="fact"><div class="ic">??</div><h4>Dates &amp; Hours</h4><p>${SITE.dates}<br>Fri/Sat 10AM�10PM � Sun 10AM�5PM</p></div>
<div class="fact"><div class="ic">??</div><h4>Location</h4><p>${SITE.loc}</p></div>
</div>
<div class="grid grid--3">
${days.map(d=>`<div class="day"><div class="day__hd"><span class="d">${d[0]}, ${d[1]}</span><span class="h">Gates: ${d[2]}</span></div><div class="day__bd">${d[3].map(e=>`<div class="event"><span class="t">${e[0]}</span><span class="b">${e[1]}</span></div>`).join("")}</div></div>`).join("")}
</div>
<div class="triple" style="margin-top:34px"><figure class="fig fig--43"><img src="/assets/img/015.jpg" alt="From last year's faire" loading="lazy"><figcaption>From last year's faire</figcaption></figure><figure class="fig fig--43"><img src="/assets/img/020.jpg" alt="From last year's faire" loading="lazy"><figcaption>From last year's faire</figcaption></figure><figure class="fig fig--43"><img src="/assets/img/021.jpg" alt="From last year's faire" loading="lazy"><figcaption>From last year's faire</figcaption></figure></div>
<p class="eventlist-note">Box office: Fri &amp; Sat 9:00AM�9:00PM � Sun 9:00AM�4:00PM. The camp is where the real guild happens � fire, food, and stories told late into the night.</p>
</div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"events.html"),events);

// ---------- CAMP ----------
const camp=`${head("/camp.html")}
<section class="pagehero"><div class="pagehero__bg" style="background-image:url('${I}008.jpg')"></div><div class="container pagehero__inner"><span class="eyebrow">Ren Faire Camp</span><h1>Our Camp at Sunset Park</h1><p>We claim the camp spot Thursday, October 8 � but guildies won't camp until Friday, October 9. A dry camp under the stars of the Renaissance.</p></div></section>
<section class="section"><div class="container"><div class="grid grid--2" style="align-items:start">
<div><span class="eyebrow">RV Camping</span><h2>A Weekend Oasis Under the Stars</h2><p class="lead">RV camping (Fifth Wheel, Bumper Pull, or Pop-Up Trailers) lets you park your rig beside the campground and build your own weekend oasis. RV camping days are Thursday, Friday, Saturday, and Sunday.</p>
<ul class="camp-list" style="margin-top:18px">
<li><b>Four-night stay</b> � your own RV in a designated space beside the campground.</li>
<li><b>Six 3-day passes</b> � plus six festival T-shirt vouchers and six festival poster vouchers.</li>
<li><b>Earliest access</b> � we claim the spot Thursday, October 8; guildies camp from Friday, October 9.</li>
<li><b>Private campground</b> � designated potties and private entertainment.</li>
</ul>
<p class="muted" style="margin-top:16px">? <b>Dry camping space</b> � no water service, dump station, or servicing is provided by Clark County (contact Las Vegas Toilet Rentals to arrange). RV trailers must unhook from the tow vehicle; no vehicles may remain hitched during the event. Camp spots are very limited and first-come, first-served. <b>No showers on site.</b></p></div>
<div>
<div class="scroll" style="margin-bottom:18px"><h3>?? Facilities &amp; Bathrooms</h3><p><b style="color:var(--wine)">No showers on site.</b> We have no water service or dump service � shower at home before you come. (There were public showers in the faire grounds last year; that may be an option.) <b>Bathrooms:</b> a potty in the RV, plus porta-potties close by in our camp area. You're welcome to use the refrigerator and sleep in the designated area.</p></div>
<div class="scroll" style="margin-bottom:18px"><h3>??? Claiming a Bunk?</h3><p>Bring your own bedding � <b>none is provided</b>. A sleeping bag and your pillow are the way (and yes, maybe a teddy bear). Bunks are limited � release yours if your plans change so a guildmate can take it.</p></div>
<div class="scroll" style="margin-bottom:18px"><h3>?? Food &amp; Drink</h3><p>We'll have some food at camp and a few beers in the refrigerator, plus a <b>potluck</b> � feel free to eat as you will, in the faire or by the fire. Bring a dish to share if you can.</p></div>
<div class="scroll"><h3>?? Passes</h3><p>Passes for only <b>six people</b> � and you know who you are. Camp spots are very limited, first-come, first-served.</p></div>
<div class="scroll" style="margin-top:18px"><h3>?? Questions?</h3><p>Send word to <b>Mama Bear</b> for any other questions or concerns: <a href="/pigeon.html" style="color:var(--wine)">houseofcardandcoin@gmail.com</a> � or <a href="/pigeon.html" style="color:var(--wine)">send a pigeon</a>.</p></div>
</div>
</div></div></section>
<section class="section section--parch2"><div class="container"><div class="bannerhead"><span class="eyebrow">?? Task Assignment List</span><h2>Six People � Example Split</h2></div>
<div class="grid grid--3">
<div class="task"><h4>Person 1 � Camp Captain</h4><p>Setup leader. Directs where chairs, mat, and awning go. Ensures the RV is level and power is hooked up. Oversees the tank-management plan.</p></div>
<div class="task"><h4>Person 2 � Firepit &amp; Cooking Boss</h4><p>In charge of grilling, the propane stove, and camp cuisine. Keeps the feast coming and the fire tended.</p></div>
<div class="task"><h4>Person 3 � Quest &amp; Lodging Steward</h4><p>Tends the tent, the bedding, and the guild's resting quarters. Keeps the camp cozy for the company.</p></div>
<div class="task"><h4>Person 4 � Coin &amp; Provisions</h4><p>Manages the guild purse, provisions, and the all-important snack stock. Every bargain flows through here.</p></div>
<div class="task"><h4>Person 5 � Herald &amp; Mischief</h4><p>The voice of the camp � announcements, songs, and organizer of riddles and chaos.</p></div>
<div class="task"><h4>Person 6 � The Tokenmaster</h4><p>Guildmate broker. Hands out quests and rarely explains them. Keeper of the Quest Cards.</p></div>
</div></div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"camp.html"),camp);

// ---------- TOWN CRYER ----------
const cryer=`${head("/cryer.html")}
<section class="pagehero"><div class="pagehero__bg" style="background-image:url('${I}009.jpg')"></div><div class="container pagehero__inner"><span class="eyebrow">Town Cryer</span><h1>Hear Ye, Hear Ye!</h1><p>Proclamations, jests, and the day's news from the House � cried aloud for all the shire to hear.</p></div></section>
<section class="section"><div class="container"><div class="bannerhead"><span class="eyebrow">Proclamations</span><h2>News from the House</h2><div class="rule"></div></div>
<div class="grid grid--2">
<div class="scroll"><h3>?? The Faire Approaches</h3><p>The 31st Annual Age of Chivalry Renaissance Festival draws nigh � ${SITE.dates}, at Sunset Park. Polish your boots, sharpen your wit, and bring coin for the table.</p></div>
<div class="scroll"><h3>?? A Call for Jesters</h3><p>The Roast of the Town Cryer returns on Sunday at 4:00 PM. Bring your barbs and your bravado � the funniest roast wins the Jester's Purse (if they survive).</p></div>
<div class="scroll"><h3>?? Quest Cards Now Being Drawn</h3><p>Friday at 11:00 AM, the Guild Tent opens for the Quest Kickoff. Come draw your card and begin your rise through the ranks of the House.</p></div>
<div class="scroll"><h3>?? Saturday's Campfire Tales</h3><p>By firelight at 7:00 PM � storytelling and fortune card draws. Beware the secret Curse Card lurking in the deck�</p></div>
</div></div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"cryer.html"),cryer);

// ---------- WANTED ----------
const wanted=`${head("/wanted.html")}
<section class="pagehero"><div class="pagehero__bg" style="background-image:url('${I}014.jpg')"></div><div class="container pagehero__inner"><span class="eyebrow">Wanted Board</span><h1>A Call Goes Forth</h1><p>Hark, good gentles and fair ladies � the House seeks the brave, the clever, and the boldly foolish.</p></div></section>
<section class="section"><div class="container" style="max-width:880px">
<div class="poster"><span class="stamp">Sealed</span><h3>WANTED</h3>
<p style="text-align:center;margin-top:14px;font-style:italic;font-size:1.2rem;color:#e6d4a8">Hark, good gentles and fair ladies! A call goes forth from the House of Card and Coin.</p>
<div class="rule" style="margin:22px auto"></div>
<ul class="camp-list" style="max-width:560px;margin:0 auto">
<li><b>Quest-Seekers</b> � to draw the Quest Card and prove their mettle.</li>
<li><b>Traders of Baubles</b> � to barter at Trick or Trade for the sheer joy of the deal.</li>
<li><b>Fortune's Curious</b> � to sit with the Reader and learn what the cards foretell.</li>
<li><b>Sellswords for Hire</b> � to stand the line and honor the bargain.</li>
<li><b>Jesters &amp; Roasters</b> � to face the Town Cryer's roast on Sunday eve.</li>
</ul>
<div style="text-align:center;margin-top:26px"><a class="btn btn--gold" href="/pigeon.html">Answer the Call</a></div>
</div>
</div></section>
${CTA}${footer}`;


// ---------- CARRIER PIGEON (contact) ----------
const pigeon=`${head("/pigeon.html")}
<section class="pagehero"><div class="pagehero__bg" style="background-image:url('${I}006.jpg')"></div><div class="container pagehero__inner"><div class="medallion">&#x1F54A;<span class="scroll">&#x1F4DC;</span></div><span class="eyebrow">Carrier Pigeon</span><h1>Send Your Pigeon</h1><p>Send a message to the House � to join the list, hire a sellsword, or strike a bargain.</p></div></section>
<section class="section"><div class="container contact-grid">
<div><span class="eyebrow">Direct to the House</span><h2>By Letter or by Bird</h2><p class="lead">Reach the guild by pigeon for inquiries, the camp list, or to treat with the Broker. We answer in due course.</p>
<ul class="info-list"><li><span class="ic">?</span><div><h4>Carrier Pigeon (Email)</h4><div class="val"><a href="mailto:${SITE.email}">${SITE.email}</a></div></div></li>
<li><span class="ic">??</span><div><h4>The Shire</h4><div class="val">${SITE.loc}</div></div></li>
<li><span class="ic">??</span><div><h4>The Faire</h4><div class="val">${SITE.faire}<br>${SITE.dates}</div></div></li></ul></div>
<div class="form"><h3 style="margin-bottom:6px">Send a Pigeon</h3><p class="muted" style="font-size:.96rem;margin-bottom:22px">Put me on the list � or send word to the House.</p>
<form action="mailto:${SITE.email}" method="post" enctype="text/plain">
<div class="field"><label for="n">Your Name</label><input id="n" name="Name" required placeholder="Good gentles' name"></div>
<div class="field"><label for="e">Email</label><input id="e" type="email" name="Email" required placeholder="your@email.com"></div>
<div class="field"><label for="r">Reason</label><select id="r" name="Reason"><option>Put me on the list!</option><option>Join the guild</option><option>Hire a sellsword</option><option>Camper / camp list</option><option>Strike a bargain</option><option value="Locked out of my account">Locked out of my account</option></select></div>
<div class="field"><label for="m">Your Message</label><textarea id="m" name="Message" placeholder="Your message to the House�"></textarea></div>
<button type="submit" class="btn btn--wine" style="width:100%;justify-content:center">Send Your Pigeon</button>
</form></div></div></section>
${footer}`;
fs.writeFileSync(path.join(ROOT,"pigeon.html"),pigeon);

console.log("built: "+["index","guild","sellsword","ranks","events","camp","cryer","wanted","pigeon"].map(p=>p+".html").join(", "));

// ---------- TREATY & TERMS ----------
const treaty=`${head("/treaty.html")}
<section class="pagehero"><div class="pagehero__bg" style="background-image:url('${I}018.png')"></div><div class="container pagehero__inner"><span class="eyebrow">Sellsword</span><h1>Treaty &amp; Terms</h1><p>When a bargain is struck, we honor it. Your objectives become our objectives. Here lie the terms under which the House of Card and Coin contracts its sellswords.</p></div></section>
<section class="section"><div class="container" style="max-width:860px">
<div class="poster"><span class="stamp">Sealed</span><h3>The Bargain, Sealed</h3><div class="rule" style="margin:18px auto"></div>
<div class="article"><h4>Article I &middot; The Bargain</h4><p>A price is named and a hand is given. Once struck, the bargain holds � neither side may withdraw save by mutual consent.</p></div>
<div class="article"><h4>Article II &middot; Discretion</h4><p>All matters are conducted with the utmost discretion. No word of the affair passes the lips of the company, on pain of forfeit.</p></div>
<div class="article"><h4>Article III &middot; Composure</h4><p>Panic has no place in our ranks. Adversity is met with steady hands and quiet resolve.</p></div>
<div class="article"><h4>Article IV &middot; Adaptable Force</h4><p>Guard service, discreet removal, or reinforcement for holdings � the company shapes itself to the need at hand.</p></div>
<div class="article"><h4>Article V &middot; Honor</h4><p>The sellsword honors the bargain; the House honors the sellsword. Contractual integrity above all.</p></div>
<div class="article"><h4>Article VI &middot; Terms of Coin</h4><p>Payment in coin or agreed trade � half upon the striking of the bargain, half upon completion. The ledger is kept by the Broker.</p></div>
<p style="text-align:center;margin-top:24px;font-style:italic;color:#cdb98f">� Sealed by the House of Card and Coin �</p>
<div style="text-align:center;margin-top:18px"><a class="btn btn--gold" href="/pigeon.html">Treat with the Broker</a></div>
</div></div></section>
${CTA}${footer}`;
fs.writeFileSync(path.join(ROOT,"treaty.html"),treaty);
