'use strict';
const crypto = require('node:crypto');
const { HOUSES, TERRITORIES, RESOURCES, UNITS, DEFENSES, ACTIONS, createDeck, shuffle, unitStrength, EMPTY_RESOURCES, EMPTY_ARMY } = require('./cards');

const rooms = new Map();
const ACTIONS_PER_TURN = 3;
const RESPONSE_TIME_MS = 25000;
const MAX_HAND = 15;
const MAX_LOG = 65;
const safeInt = value => Number.isSafeInteger(value) && value >= 0;
const actionError = (reason) => { throw new Error(reason); };
const newId = () => crypto.randomBytes(10).toString('hex');
const capName = (v) => typeof v === 'string' ? v.trim().replace(/\s+/g,' ').slice(0, 22) : '';

function makeRoom(name) {
  if (rooms.size >= 500) actionError('The royal server is at room capacity. Please try again later.');
  name = capName(name);
  if (name.length < 2) actionError('Enter a player name (at least two characters).');
  let code; do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
  const player = makePlayer(name, true);
  const room = { code, phase: 'lobby', hostId: player.id, players: [player], territories: [], deck: [], discard: [], turnIndex: 0, turnNumber: 0, actionsLeft: 0, pending: null, pendingTimer: null, winnerId: null, log: [], createdAt: Date.now(), updatedAt: Date.now(), listeners: new Map() };
  rooms.set(code, room);
  log(room, `${name} opened the council of crowns.`);
  return { room, player };
}
function makePlayer(name, host = false) {
  return { id: newId(), token: crypto.randomBytes(24).toString('hex'), name, house: null, ready: false, host, connected: false, hand: [], bank: 0, resources: EMPTY_RESOURCES(), army: EMPTY_ARMY(), siegeBonus: 0, victories: 0, lastSeen: Date.now() };
}
function joinRoom(code, name) {
  code = String(code || '').trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) actionError('Council code not found. Ask the host for an invite.');
  if (room.phase !== 'lobby') actionError('The match has already begun.');
  if (room.players.length >= 4) actionError('The council already has four players.');
  name = capName(name);
  if (name.length < 2) actionError('Enter a player name (at least two characters).');
  const player = makePlayer(name);
  room.players.push(player);
  log(room, `${name} joined the royal council.`);
  broadcast(room);
  return { room, player };
}
function authenticate(code, token) {
  const room = rooms.get(String(code || '').trim().toUpperCase());
  const player = room?.players.find(p => p.token === token);
  if (!room || !player) actionError('Session expired or room not found. Return to the title screen.');
  player.lastSeen = Date.now();
  return { room, player };
}
function log(room, message, type = 'system') {
  room.log.unshift({ id: newId(), at: Date.now(), message, type });
  room.log.length = Math.min(MAX_LOG, room.log.length);
  room.updatedAt = Date.now();
}
function sendTo(room, player) {
  const stream = room.listeners.get(player.id);
  if (!stream || stream.destroyed || stream.writableEnded) return;
  try { stream.write(`event: state\ndata: ${JSON.stringify(serialize(room, player))}\n\n`); }
  catch { room.listeners.delete(player.id); player.connected = false; }
}
function broadcast(room) { for (const player of room.players) sendTo(room, player); }
function attachStream(room, player, response) {
  const previous = room.listeners.get(player.id);
  if (previous && previous !== response) previous.end();
  room.listeners.set(player.id, response);
  player.connected = true;
  broadcast(room);
  response.on('close', () => { if (room.listeners.get(player.id) === response) { room.listeners.delete(player.id); player.connected = false; broadcast(room); } });
}
function serialize(room, viewer) {
  return {
    code: room.code, phase: room.phase, hostId: room.hostId, selfId: viewer.id, house: viewer.house,
    players: room.players.map(p => ({ id: p.id, name: p.name, house: p.house, host: p.id === room.hostId, ready: p.ready, connected: p.connected, bank: p.bank, resources: p.resources, army: p.army, siegeBonus: p.siegeBonus, handCount: p.hand.length, territories: room.territories.filter(t => t.owner === p.id).length, victories: p.victories })),
    hand: viewer.hand, territories: room.territories, turnPlayerId: room.players[room.turnIndex]?.id || null,
    turnNumber: room.turnNumber, actionsLeft: room.actionsLeft, pending: room.pending ? { ...room.pending, defenseCardIds: undefined } : null,
    winnerId: room.winnerId, log: room.log.slice(0, 40), deckCount: room.deck.length, discardCount: room.discard.length,
    constants: { HOUSES, TERRITORIES, RESOURCES, UNITS, DEFENSES, ACTIONS, actionsPerTurn: ACTIONS_PER_TURN, responseTimeMs: RESPONSE_TIME_MS },
  };
}
function findCard(player, cardId) { const c = player.hand.find(c => c.id === cardId); if (!c) actionError('That card is no longer in your hand.'); return c; }
function useCard(room, player, card) { const index = player.hand.indexOf(card); if (index >= 0) { player.hand.splice(index, 1); room.discard.push(card); } }
function trimHand(room, player) { while (player.hand.length > MAX_HAND) room.discard.push(player.hand.shift()); }
function cardDraw(room, player, count) {
  for (let i = 0; i < count; i++) {
    if (!room.deck.length) { room.deck = shuffle(room.discard.splice(0)); if (!room.deck.length) return; log(room, 'The royal deck has been reshuffled.'); }
    const card = room.deck.pop(); player.hand.push(card);
  }
  trimHand(room, player);
}
function initGame(room) {
  if (room.phase !== 'lobby') actionError('The game has already started.');
  if (room.players.length !== 4 || room.players.some(p => !p.ready || !p.house)) actionError('All four players must choose different houses and be ready.');
  if (new Set(room.players.map(p => p.house)).size !== 4) actionError('Each house must have one sovereign.');
  room.deck = shuffle(createDeck()); room.discard = [];
  room.territories = TERRITORIES.map(t => ({ ...t, owner: room.players.find(p => p.house === t.house).id, garrison: 5, fort: 0 }));
  room.turnIndex = 0; room.turnNumber = 1; room.actionsLeft = ACTIONS_PER_TURN; room.phase = 'playing';
  for (const p of room.players) { p.bank = 5; p.resources = EMPTY_RESOURCES(); p.army = { infantry: 6, archers: 2, knights: 1, elephants: 0 }; p.siegeBonus = 0; p.victories = 0; p.hand = []; cardDraw(room, p, 5); }
  cardDraw(room, room.players[0], 2);
  room.players[0].bank += 1;
  log(room, `The Four Crowns war has begun! ${room.players[0].name} commands the opening turn.`, 'battle');
}
function currentPlayer(room) { return room.players[room.turnIndex]; }
function getProvince(room, id) { const t = room.territories.find(t => t.id === id); if (!t) actionError('Choose a valid province.'); return t; }
function getPlayer(room, id) { const p = room.players.find(p => p.id === id); if (!p) actionError('Choose a valid player.'); return p; }
function requireRival(room, actor, targetId) { const target = getPlayer(room,targetId); if (actor.id === target.id) actionError('Choose another house.'); return target; }
function requireResource(v) { if (!RESOURCES.some(r => r.id === v)) actionError('Choose a valid resource.'); return v; }
function requireOwned(room, player, provinceId) { const t = getProvince(room, provinceId); if (t.owner !== player.id) actionError('You do not control this province.'); return t; }
function requireCost(player, costs) { for (const [r, n] of Object.entries(costs)) if (player.resources[r] < n) actionError(`You need ${n} ${r} to perform this action.`); }
function charge(player, costs) { requireCost(player, costs); for (const [r,n] of Object.entries(costs)) player.resources[r] -= n; }
function nextTurn(room) {
  if (room.pending || room.phase !== 'playing') return;
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  room.turnNumber += 1; room.actionsLeft = ACTIONS_PER_TURN;
  const next = currentPlayer(room);
  cardDraw(room, next, 2);
  const income = Math.max(1, Math.floor(room.territories.filter(t => t.owner === next.id).length / 3));
  next.bank += income;
  log(room, `${next.name} begins turn ${room.turnNumber} (+${income} crown income).`);
}
function checkVictory(room) {
  const winner = room.players.find(p => room.territories.every(t => t.owner === p.id));
  if (!winner) return false;
  room.phase = 'finished'; room.winnerId = winner.id;
  log(room, `♛ ${winner.name} of ${HOUSES.find(h => h.id === winner.house).name} conquered all 12 provinces and claimed the Four Crowns!`, 'victory');
  if (room.pendingTimer) clearTimeout(room.pendingTimer);
  room.pending = null;
  return true;
}
function clearPending(room) { if (room.pendingTimer) { clearTimeout(room.pendingTimer); room.pendingTimer = null; } room.pending = null; }
function wrapUp(room) { if (room.phase !== 'finished' && !room.pending && room.actionsLeft <= 0) nextTurn(room); broadcast(room); }
function resolveBattle(room, defenseEffect = null) {
  const b = room.pending;
  if (!b || b.type !== 'battle') return;
  const attacker = getPlayer(room, b.from), defender = getPlayer(room, b.to);
  const t = getProvince(room, b.territoryId);
  const defenseBonus = defenseEffect === 'shield_wall' ? 6 : defenseEffect === 'ambush' ? 4 : 0;
  const defenseTotal = b.defense + defenseBonus;
  const cancelled = defenseEffect === 'royal_shield';
  const success = !cancelled && b.attack > defenseTotal;
  clearPending(room);
  if (cancelled) log(room, `${defender.name} played Royal Shield and cancelled the assault on ${t.name}.`, 'defend');
  else if (success) {
    t.owner = attacker.id; t.garrison = 4; t.fort = 0;
    attacker.bank += 2; attacker.victories += 1;
    log(room, `${attacker.name} captured ${t.name} from ${defender.name}! Attack ${b.attack} vs defense ${defenseTotal}. +2 crowns.`, 'battle');
    checkVictory(room);
  } else log(room, `${defender.name} held ${t.name}! Attack ${b.attack} vs defense ${defenseTotal}.`, 'defend');
  wrapUp(room);
}
function resolveTrade(room, accept) {
  const b = room.pending;
  if (!b || b.type !== 'trade') return;
  const from = getPlayer(room, b.from), to = getPlayer(room, b.to);
  if (accept && from.resources[b.give] > 0 && to.resources[b.take] > 0) {
    from.resources[b.give]--; from.resources[b.take]++; to.resources[b.take]--; to.resources[b.give]++;
    log(room, `${to.name} accepted ${from.name}'s treaty: 1 ${b.give} for 1 ${b.take}.`, 'trade');
  } else log(room, `${to.name} declined ${from.name}'s proposed resource treaty.`, 'trade');
  clearPending(room); wrapUp(room);
}
function startPending(room, data) {
  room.pending = { ...data, expiresAt: Date.now() + RESPONSE_TIME_MS };
  room.pendingTimer = setTimeout(() => {
    if (!room.pending) return;
    if (room.pending.type === 'battle') resolveBattle(room);
    else resolveTrade(room, false);
  }, RESPONSE_TIME_MS);
  if (room.pendingTimer.unref) room.pendingTimer.unref();
}
function play(room, player, args) {
  const card = findCard(player, args.cardId);
  if (room.actionsLeft < 1) actionError('You have no actions remaining this turn.');
  let t, rival;
  switch (card.kind) {
    case 'coin': player.bank += card.value; log(room, `${player.name} banked ${card.value} crown${card.value === 1?'':'s'}.`); break;
    case 'resource': player.resources[card.resource] += card.quantity; if (card.resource === 'gold') player.bank += 1; log(room, `${player.name} collected ${card.quantity} ${card.name}${card.resource === 'gold'?' and mined +1 crown':''}.`); break;
    case 'army':
      if (card.unit === 'stronghold') { t = requireOwned(room, player, args.territoryId); t.fort += card.quantity; log(room, `${player.name} built ${card.quantity} fortified houses in ${t.name} (+${card.quantity} defense).`); }
      else { player.army[card.unit] += card.quantity; log(room, `${player.name} recruited ${card.quantity} ${card.name}.`); }
      break;
    case 'defense': actionError('Defense cards are played during an enemy assault, not during your turn.');
    case 'battle': {
      t = getProvince(room, args.territoryId || card.target);
      if (t.owner === player.id) actionError('You already rule this province. Attack a rival-owned province.');
      if (player.bank < 2) actionError('An assault requires 2 crowns in your treasury.');
      const committed = {};
      let power = 0;
      for (const unit of UNITS) {
        const qty = args.units?.[unit.id] ?? 0;
        if (!safeInt(qty) || qty > player.army[unit.id]) actionError(`Invalid deployment of ${unit.name}.`);
        committed[unit.id] = qty; power += qty * unit.strength;
      }
      if (power <= 0) actionError('Deploy at least one army unit to attack.');
      const defender = getPlayer(room, t.owner);
      player.bank -= 2;
      for (const u of UNITS) player.army[u.id] -= committed[u.id];
      const targetBonus = t.id === card.target ? card.bonus : 0;
      const attack = power + targetBonus + player.siegeBonus;
      player.siegeBonus = 0;
      useCard(room,player,card); room.actionsLeft--;
      log(room, `${player.name} launched an assault on ${t.name} against ${defender.name}! ${power} deployed power${targetBonus ? ' +3 home-field battle card bonus' : ''}.`, 'battle');
      startPending(room, { type: 'battle', from: player.id, to: defender.id, territoryId: t.id, attack, defense: t.garrison + t.fort, committed, cardName: card.name });
      broadcast(room); return;
    }
    case 'action': {
      switch (card.effect) {
        case 'royal_decree': cardDraw(room, player, 3); log(room, `${player.name} issued a Royal Decree and drew three cards.`); break;
        case 'tax_collect': { let collected = 0; for (const p of room.players) if (p.id !== player.id && p.bank > 0) { p.bank--; player.bank++; collected++; } log(room, `${player.name} levied tribute and collected ${collected} crowns from rival houses.`); break; }
        case 'raid_caravan': rival = requireRival(room, player, args.targetPlayerId); { const amount = Math.min(3,rival.bank); rival.bank -= amount; player.bank += amount; log(room, `${player.name} raided ${rival.name}'s caravan for ${amount} crowns.`, 'battle'); } break;
        case 'forced_swap': {
          rival = requireRival(room,player,args.targetPlayerId);
          const give = requireResource(args.give), take = requireResource(args.take);
          if (give === take) actionError('Choose two different resources for the exchange.');
          if (!player.resources[give] || !rival.resources[take]) actionError('Both houses need the selected resources to exchange.');
          player.resources[give]--; player.resources[take]++; rival.resources[take]--; rival.resources[give]++;
          log(room, `${player.name} forced an exchange with ${rival.name}: ${give} for ${take}.`, 'trade'); break;
        }
        case 'trade_pact': {
          rival = requireRival(room,player,args.targetPlayerId);
          const give = requireResource(args.give), take = requireResource(args.take);
          if (give === take || !player.resources[give] || !rival.resources[take]) actionError('A treaty requires two different resources, one from each house.');
          useCard(room,player,card); room.actionsLeft--;
          log(room, `${player.name} offered ${rival.name} a trade pact: ${give} for ${take}.`, 'trade');
          startPending(room,{ type: 'trade', from:player.id, to:rival.id, give, take }); broadcast(room); return;
        }
        case 'reinforce': t=requireOwned(room,player,args.territoryId); charge(player,{timber:1,iron:1}); t.fort += 3; log(room, `${player.name} fortified ${t.name} with +3 permanent defense.`); break;
        case 'sabotage': t=getProvince(room,args.territoryId); if(t.owner===player.id)actionError('Choose an enemy province.'); if (t.fort===0)actionError('That province has no walls to sabotage.'); charge(player,{gems:1}); t.fort=Math.max(0,t.fort-3); log(room,`${player.name} sabotaged the defenses of ${t.name}.`,'battle'); break;
        case 'siege_engines': charge(player,{iron:1}); player.siegeBonus += 5; log(room, `${player.name} prepared siege engines (+5 to next battle).`); break;
        case 'harvest': { const r=requireResource(args.resource);player.resources[r]+=2;log(room,`${player.name} harvested 2 ${r}.`);break; }
        case 'spy_network': rival=requireRival(room,player,args.targetPlayerId); if(!rival.hand.length)actionError('The rival has no cards to take.'); {const i=crypto.randomInt(0,rival.hand.length);const stolen=rival.hand.splice(i,1)[0];player.hand.push(stolen); trimHand(room, player); log(room,`${player.name}'s spies stole a card from ${rival.name}.`,'trade');}break;
        default: actionError('Unknown action.');
      } break;
    }
    default: actionError('Unknown card type.');
  }
  useCard(room,player,card); room.actionsLeft--; wrapUp(room);
}
function action(room, player, args) {
  if (!args || typeof args.type !== 'string') actionError('Invalid action.');
  if (args.type === 'select_house') {
    if (room.phase !== 'lobby') actionError('House selection has ended.');
    if (!HOUSES.some(h => h.id === args.house)) actionError('Choose a valid house.');
    if (room.players.some(p => p.id !== player.id && p.house === args.house)) actionError('Another sovereign already claimed that house.');
    player.house = args.house; player.ready = false;
    log(room, `${player.name} pledged loyalty to ${HOUSES.find(h=>h.id===player.house).name}.`); broadcast(room); return;
  }
  if (args.type === 'ready') { if(room.phase!=='lobby')actionError('The game has already started.');if(!player.house)actionError('Select a house before readying.');player.ready=!!args.ready;log(room,`${player.name} is ${player.ready?'ready':'not ready'}.`);broadcast(room);return; }
  if (args.type === 'start') { if(player.id!==room.hostId)actionError('Only the host may start a match.');initGame(room);broadcast(room);return; }
  if (room.phase !== 'playing') actionError(room.phase==='finished'?'The war has ended.':'The council has not begun the match.');
  if (room.pending) {
    const pending=room.pending;
    if(args.type !== 'respond')actionError('The court is waiting for a battle defense or treaty response.');
    if (player.id !== pending.to) actionError('Only the challenged house can respond.');
    if (pending.type === 'trade') { resolveTrade(room, args.accept === true); return; }
    if (args.cardId) {
      const card = findCard(player,args.cardId);
      if (card.kind !== 'defense') actionError('Select a defense card from your hand.');
      useCard(room,player,card);resolveBattle(room,card.effect);
    } else resolveBattle(room);
    return;
  }
  if (player.id !== currentPlayer(room).id) actionError('Wait for your turn. You may play defense cards when attacked.');
  if (args.type === 'end_turn') { log(room,`${player.name} ended their turn.`);nextTurn(room);broadcast(room);return; }
  if (args.type === 'play') { play(room,player,args);return; }
  actionError('Unknown game action.');
}
function pruneRooms() { const now=Date.now();for(const [code,room] of rooms)if(now-room.updatedAt>8*3600*1000){ if(room.pendingTimer)clearTimeout(room.pendingTimer);for(const res of room.listeners.values())res.end();rooms.delete(code);} }
module.exports = { rooms, makeRoom, joinRoom, authenticate, attachStream, serialize, action, pruneRooms, constants: { ACTIONS_PER_TURN, RESPONSE_TIME_MS }, _test: { nextTurn, initGame, resolveBattle, getProvince, checkVictory, cardDraw, log } };
