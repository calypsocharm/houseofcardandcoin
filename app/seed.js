const fs=require('fs'),path=require('path'),bcrypt=require('bcryptjs');
const DATA=path.join(__dirname,'data','guild.json');
// Password comes from the environment so it is never committed:
//   SEED_PASSWORD='...' node seed.js
const PW=process.env.SEED_PASSWORD;
if(!PW){console.error('refusing to seed: set SEED_PASSWORD first, e.g. SEED_PASSWORD=\'...\' node seed.js');process.exit(1);}
let db={users:[],bunks:[],items:[],claims:[],seq:1};
try{db=JSON.parse(fs.readFileSync(DATA,'utf8'));}catch{}
db.users=[{id:1,name:'Mama Bear',email:'mamabear',passhash:bcrypt.hashSync(PW,10),avatar:'',class:'',faires:0,role:'leader',title:'Guild Elder'}];
db.bunks=[];db.claims=[];
fs.writeFileSync(DATA,JSON.stringify(db,null,2));
console.log('seeded: Mama Bear = Guild Elder (admin)');
