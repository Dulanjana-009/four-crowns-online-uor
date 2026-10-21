'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { HOUSES, TERRITORIES, createDeck, UNITS } = require('../game/cards');
const { makeRoom, joinRoom, authenticate, action, serialize, _test } = require('../game/engine');
const { server } = require('../server');

function setup() {
  const {room,player:host}=makeRoom('Player One');
  const players=[host];
  players.push(joinRoom(room.code,'Player Two').player);
  players.push(joinRoom(room.code,'Player Three').player);
  players.push(joinRoom(room.code,'Player Four').player);
  players.forEach((player,i)=>{action(room,player,{type:'select_house',house:HOUSES[i].id});action(room,player,{type:'ready',ready:true});});
  action(room,host,{type:'start'});
  return {room,players};
}

test('exactly four different houses and twelve three-part regions',()=>{
  assert.equal(HOUSES.length,4);
  assert.equal(TERRITORIES.length,12);
  assert.equal(new Set(TERRITORIES.map(t=>t.id)).size,12);
  for(const h of HOUSES)assert.equal(TERRITORIES.filter(t=>t.house===h.id).length,3);
});

test('all twelve unique province Battle cards exist in the deck',()=>{
  const cards=createDeck();
  const battles=cards.filter(c=>c.kind==='battle');
  assert.equal(new Set(battles.map(c=>c.target)).size,12);
  for(const t of TERRITORIES)assert.equal(battles.filter(b=>b.target===t.id).length,5);
  assert.ok(cards.some(c=>c.kind==='coin'&&c.value===5));
  assert.deepEqual(UNITS.map(u=>u.quantity),[6,4,3,2]);
  assert.ok(cards.some(c=>c.kind==='army'&&c.unit==='stronghold'&&c.quantity===2));
});

test('lobby: exactly four players, unique houses, ready checks and start state',()=>{
  const {room,players}=setup();
  assert.equal(room.phase,'playing');
  assert.equal(room.territories.length,12);
  for(const player of players){assert.equal(room.territories.filter(t=>t.owner===player.id).length,3);assert.ok(player.hand.length>=5);assert.equal(player.bank>=5,true);}
  assert.throws(()=>joinRoom(room.code,'Extra Player'),/already begun/);
  assert.throws(()=>action(room,players[1],{type:'end_turn'}),/Wait for your turn/);
  const otherState=serialize(room,players[1]);
  assert.equal(otherState.hand.length,players[1].hand.length);
  assert.ok(!otherState.players[0].hand);
});

test('battle consumes committed army, allows a live Royal Shield, then captures territory',()=>{
  const {room,players:[attacker,defender]}=setup();
  const target=room.territories.find(t=>t.house===defender.house);
  const template=createDeck().find(c=>c.kind==='battle'&&c.target===target.id);
  attacker.hand.push({...template,id:'test-battle-1'});
  defender.hand.push({id:'test-shield',kind:'defense',name:'Royal Shield',effect:'royal_shield'});
  action(room,attacker,{type:'play',cardId:'test-battle-1',territoryId:target.id,units:{infantry:3,archers:2,knights:1,elephants:0}});
  assert.equal(room.pending.type,'battle');
  assert.equal(room.pending.attack,13);
  assert.equal(attacker.army.infantry,3);
  assert.equal(attacker.bank,4); // initial 5 + opening income 1 - battle 2
  action(room,defender,{type:'respond',cardId:'test-shield'});
  assert.equal(room.pending,null);
  assert.equal(target.owner,defender.id);
  assert.equal(room.actionsLeft,2);
  attacker.hand.push({...template,id:'test-battle-2'});
  action(room,attacker,{type:'play',cardId:'test-battle-2',territoryId:target.id,units:{infantry:3,archers:0,knights:0,elephants:0}});
  assert.equal(room.pending.attack,6);
  action(room,defender,{type:'respond'});
  assert.equal(target.owner,attacker.id);
  assert.equal(room.pending,null);
  assert.equal(attacker.victories,1);
  assert.equal(attacker.bank,4); // 4 - 2 + 2 capture reward
  assert.equal(room.territories.filter(t=>t.owner===attacker.id).length,4);
});

test('voluntary resource trade requires challenged sovereign approval',()=>{
  const {room,players:[a,b]}=setup();
  a.resources.water=2;b.resources.gems=2;
  a.hand.push({id:'test-trade',kind:'action',effect:'trade_pact',name:'Trade Pact'});
  action(room,a,{type:'play',cardId:'test-trade',targetPlayerId:b.id,give:'water',take:'gems'});
  assert.equal(room.pending.type,'trade');
  assert.throws(()=>action(room,a,{type:'respond',accept:true}),/Only the challenged/);
  action(room,b,{type:'respond',accept:true});
  assert.equal(room.pending,null);
  assert.equal(a.resources.water,1);assert.equal(a.resources.gems,1);
  assert.equal(b.resources.water,1);assert.equal(b.resources.gems,1);
});

test('generic battle card works on other provinces without +3 signature bonus',()=>{
  const {room,players:[a,b]}=setup();
  const target=room.territories.find(t=>t.owner===b.id);
  const wrongBattle=createDeck().find(c=>c.kind==='battle'&&c.target==='flamecoast');
  a.hand.push({...wrongBattle,id:'flex-battle'});
  action(room,a,{type:'play',cardId:'flex-battle',territoryId:target.id,units:{infantry:2,archers:0,knights:0,elephants:0}});
  assert.equal(room.pending.attack,2);
  action(room,b,{type:'respond'});
  assert.equal(target.owner,b.id);
});

test('complete conquest of all 12 provinces triggers victory',()=>{
  const {room,players:[a]}=setup();
  room.territories.forEach(t=>{t.owner=a.id;});
  assert.equal(_test.checkVictory(room),true);
  assert.equal(room.phase,'finished');
  assert.equal(room.winnerId,a.id);
});

test('HTTP networking: create, join, resume, house selection and static file',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  async function send(path,payload){const response=await fetch(url+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:response.status,data:await response.json()};}
  try{
    const health=await (await fetch(url+'/api/health')).json();assert.equal(health.ok,true);
    const host=await send('create',{name:'Host'});assert.equal(host.status,200);
    const second=await send('join',{name:'Rival',code:host.data.code});assert.equal(second.status,200);
    const pick=await send('action',{code:second.data.code,token:second.data.token,type:'select_house',house:'kandor'});assert.equal(pick.status,200);
    assert.equal(pick.data.state.players[1].house,'kandor');
    const resume=await send('resume',host.data);assert.equal(resume.status,200);
    assert.equal(resume.data.state.players.length,2);
    assert.equal(resume.data.state.hand.length,0);
    const invalid=await send('resume',{code:host.data.code,token:'badtoken'});assert.equal(invalid.status,401);
    const html=await (await fetch(url+'/')).text();assert.match(html,/Four Crowns/);
    const js=await (await fetch(url+'/app.js')).text();assert.match(js,/new EventSource/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
