const http=require("http");const fs=require("fs");const path=require("path");
const ROOT=__dirname;const PORT=process.env.PORT||4200;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",".svg":"image/svg+xml",".ico":"image/x-icon",".json":"application/json"};
http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split("?")[0]);if(u==="/")u="/index.html";let f=path.join(ROOT,u);
fs.stat(f,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end("Not found");}
const ext=path.extname(f).toLowerCase();res.writeHead(200,{"Content-Type":MIME[ext]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});}).listen(PORT,()=>console.log("House of Card and Coin mock at http://localhost:"+PORT));
