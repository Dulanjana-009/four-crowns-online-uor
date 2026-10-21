'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const engine = require('./game/engine');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.resolve(__dirname, 'public');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.mp3':'audio/mpeg', '.mid':'audio/midi', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8' };
function json(res, status, payload) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(payload)); }
function readJSON(req) { return new Promise((resolve,reject) => { let data=''; req.on('data', chunk => { data+=chunk; if(data.length>16000){reject(Error('Request too large.'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(data||'{}'));}catch{reject(Error('Malformed JSON body.'));}});req.on('error',reject); }); }
function serveFile(req,res,pathname) {
  let decoded;try{decoded=decodeURIComponent(pathname);}catch{return json(res,400,{error:'Bad path.'});}
  const file = path.resolve(PUBLIC,'.'+(decoded==='/'?'/index.html':decoded));
  if (!(file===PUBLIC || file.startsWith(PUBLIC+path.sep))) return json(res,403,{error:'Forbidden.'});
  fs.stat(file,(err,stat)=>{
    if(err || !stat.isFile())return json(res,404,{error:'Not found.'});
    const headers = {'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':pathname.includes('/assets/')||pathname.includes('/icons/')?'public,max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Accept-Ranges':'bytes'};
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416,{...headers,'Content-Range':`bytes */${stat.size}`});return res.end();
      }
      const start = match[1] ? Number(match[1]) : Math.max(0,stat.size-Number(match[2]));
      const end = match[1] ? (match[2] ? Number(match[2]) : stat.size-1) : stat.size-1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start> end || start>=stat.size) {
        res.writeHead(416,{...headers,'Content-Range':`bytes */${stat.size}`});return res.end();
      }
      const safeEnd=Math.min(end,stat.size-1);
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${safeEnd}/${stat.size}`,'Content-Length':safeEnd-start+1});
      return fs.createReadStream(file,{start,end:safeEnd}).pipe(res);
    }
    res.writeHead(200,{...headers,'Content-Length':stat.size});
    fs.createReadStream(file).pipe(res);
  });
}
const server = http.createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    if(req.method==='GET' && url.pathname==='/api/health')return json(res,200,{ok:true,activeRooms:engine.rooms.size,service:'Four Crowns',protocol:'SSE + HTTP'});
    if(req.method==='GET' && url.pathname==='/api/events'){
      const {room,player}=engine.authenticate(url.searchParams.get('code'),url.searchParams.get('token'));
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','Referrer-Policy':'no-referrer'});
      res.write(': connected\n\n');engine.attachStream(room,player,res);
      const heartbeat=setInterval(()=>{if(!res.destroyed){try{res.write(': heartbeat\n\n');}catch{}}},16000);
      req.on('close',()=>clearInterval(heartbeat));return;
    }
    if(req.method==='POST' && url.pathname.startsWith('/api/')) {
      const args=await readJSON(req);
      if(url.pathname==='/api/create'){const {room,player}=engine.makeRoom(args.name);return json(res,200,{code:room.code,token:player.token,selfId:player.id});}
      if(url.pathname==='/api/join'){const {room,player}=engine.joinRoom(args.code,args.name);return json(res,200,{code:room.code,token:player.token,selfId:player.id});}
      const {room,player}=engine.authenticate(args.code,args.token);
      if(url.pathname==='/api/resume')return json(res,200,{state:engine.serialize(room,player)});
      if(url.pathname==='/api/action'){engine.action(room,player,args);return json(res,200,{ok:true,state:engine.serialize(room,player)});}
      return json(res,404,{error:'Unknown endpoint.'});
    }
    if(req.method==='GET')return serveFile(req,res,url.pathname);
    json(res,405,{error:'Method not allowed.'});
  }catch(error){ const isSession=/Session expired/.test(error.message);json(res,isSession?401:400,{error:error.message||'The royal court could not process that request.'}); }
});
setInterval(engine.pruneRooms,20*60*1000).unref();
if(require.main===module)server.listen(PORT,HOST,()=>console.log(`\n♛  FOUR CROWNS · http://localhost:${PORT}\n   For internet play, deploy this single server behind HTTPS.\n   All devices open the same website and join the same room code.\n   Server-authoritative multiplayer using SSE and HTTP.\n`));
module.exports={server};
