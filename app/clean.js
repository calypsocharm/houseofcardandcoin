const fs=require('fs');
const DATA='C:/Users/Calyp/OneDrive/Documents/New project/houseofcardandcoin-site/app/data/guild.json';
let db=JSON.parse(fs.readFileSync(DATA,'utf8'));
const mama=db.users.find(u=>u.email==='mamabear');
if(mama){mama.class='';mama.faires=0;mama.avatar='';}
db.users=db.users.filter(u=>u.email==='mamabear');
db.bunks=[];db.claims=[];
fs.writeFileSync(DATA,JSON.stringify(db,null,2));
console.log('cleaned: users='+db.users.length+', Mama Bear class/fares reset, test members removed');
