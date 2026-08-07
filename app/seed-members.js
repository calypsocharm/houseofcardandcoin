const fs=require('fs'),path=require('path'),bcrypt=require('bcryptjs');
const DATA=path.join(__dirname,'data','guild.json');
// Default member password comes from the environment so it is never committed:
//   SEED_PASSWORD='...' node seed-members.js
const DEF=process.env.SEED_PASSWORD;
if(!DEF){console.error('refusing to seed: set SEED_PASSWORD first, e.g. SEED_PASSWORD=\'...\' node seed-members.js');process.exit(1);}
let db=JSON.parse(fs.readFileSync(DATA,'utf8'));
const members=[
 {name:'Sir Captain Caberk',email:'caberk',title:'Guild Leader',faires:8},
 {name:'Sir Nate',email:'nate',title:'',faires:1},
 {name:'Eric',email:'eric',title:'',faires:0},
 {name:'Dave',email:'dave',title:'',faires:0},
 {name:'Ethan',email:'ethan',title:'',faires:0},
 {name:'Liz',email:'liz',title:'',faires:0},
 {name:'Eddie',email:'eddie',title:'',faires:0},
];
let added=0;
for(const m of members){
  if(!db.users.find(u=>u.email===m.email)){
    db.users.push({id:db.seq++,name:m.name,email:m.email,passhash:bcrypt.hashSync(DEF,10),avatar:'',class:'',faires:m.faires,role:'member',title:m.title});
    added++;
  }
}
fs.writeFileSync(DATA,JSON.stringify(db,null,2));
console.log('seeded '+added+' members; total users='+db.users.length);
console.log(db.users.map(u=>u.email+':'+(u.title||'(no title)')).join(', '));
