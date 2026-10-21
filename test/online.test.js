'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { server } = require('../server');

test('online edition is fully silent with no audio scripts, sound controls, or audio assets', () => {
  const pub=path.join(__dirname,'..','public');
  const html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
  const js=fs.readFileSync(path.join(pub,'app.js'),'utf8');
  assert.doesNotMatch(html,/soundtrack|music-dock|<audio|autoplay/i);
  assert.doesNotMatch(js,/FourCrownsMusic|new Audio\(/);
  assert.equal(fs.existsSync(path.join(pub,'assets','audio')),false);
});

test('manifest, touch icons, mobile viewport, and cloud deploy configurations are present',()=>{
  const root=path.join(__dirname,'..');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public','manifest.webmanifest'),'utf8'));
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));
  assert.match(fs.readFileSync(path.join(root,'public','index.html'),'utf8'),/name="viewport"/);
  assert.match(fs.readFileSync(path.join(root,'public','styles.css'),'utf8'),/@media\(max-width:600px\)/);
  assert.match(fs.readFileSync(path.join(root,'render.yaml'),'utf8'),/healthCheckPath: \/api\/health/);
  assert.match(fs.readFileSync(path.join(root,'railway.json'),'utf8'),/"numReplicas": 1/);
});

test('host serves health JSON, mobile manifest and icon over HTTP',async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const health=await fetch(base+'/api/health');
    assert.equal(health.status,200);
    assert.equal((await health.json()).ok,true);
    const manifest=await fetch(base+'/manifest.webmanifest');
    assert.equal(manifest.status,200);
    assert.match(manifest.headers.get('content-type'),/manifest\+json/);
    const icon=await fetch(base+'/icons/icon-192.png');
    assert.equal(icon.status,200);
    assert.match(icon.headers.get('content-type'),/image\/png/);
    assert.equal(icon.headers.get('referrer-policy'),'no-referrer');
  }finally{await new Promise(ok=>server.close(ok));}
});
