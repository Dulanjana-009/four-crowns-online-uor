'use strict';

const HOUSES = [
  { id: 'mayrath', name: 'House Mayrath', realm: 'The Veiled Dominion', motto: 'From Shadow, We Rise', color: '#a485dd', icon: '☾', capital: 'Nilavur', summary: 'Masters of shadows and intrigue.' },
  { id: 'anurath', name: 'House Anurath', realm: 'The Sunlion Dynasty', motto: 'Eternal as the Sun', color: '#e7ba65', icon: '☀', capital: 'Arunvale', summary: 'Keepers of ancient wealth and royal roads.' },
  { id: 'kandor', name: 'House Kandor', realm: 'The Highland Guard', motto: 'Unbroken in the Highlands', color: '#71b58f', icon: '♜', capital: 'Elephanthold', summary: 'Unyielding guardians of mountain passes.' },
  { id: 'ruhanor', name: 'House Ruhanor', realm: 'The Tidebound Throne', motto: 'Born of Tide and Flame', color: '#df7757', icon: '♛', capital: 'Sundara', summary: 'Fierce warriors forged on the southern coast.' },
];

const TERRITORIES = [
  { id: 'velan', name: 'Velan Crest', house: 'mayrath', x: 34.0, y: 28.2, trait: 'Mountain citadel' },
  { id: 'nilavur', name: 'Nilavur', house: 'mayrath', x: 47.4, y: 31.8, trait: 'Moonlit capital' },
  { id: 'moonshore', name: 'Moonshore', house: 'mayrath', x: 60.7, y: 31.2, trait: 'Northern port' },
  { id: 'thalabar', name: 'Thalabar', house: 'anurath', x: 27.2, y: 44.7, trait: 'Golden farms' },
  { id: 'arunvale', name: 'Arunvale', house: 'anurath', x: 47.3, y: 45.0, trait: 'Sunlion capital' },
  { id: 'vayalor', name: 'Vayalor', house: 'anurath', x: 37.0, y: 59.3, trait: 'Sacred reservoirs' },
  { id: 'mistywood', name: 'Mistywood', house: 'kandor', x: 68.9, y: 47.0, trait: 'Ancient forest' },
  { id: 'elephanthold', name: 'Elephanthold', house: 'kandor', x: 58.4, y: 63.3, trait: 'Royal stronghold' },
  { id: 'stonevale', name: 'Stonevale', house: 'kandor', x: 72.6, y: 70.4, trait: 'Highland mines' },
  { id: 'redreach', name: 'Redreach', house: 'ruhanor', x: 30.5, y: 79.0, trait: 'Scarlet cliffs' },
  { id: 'sundara', name: 'Sundara', house: 'ruhanor', x: 48.9, y: 84.5, trait: 'Southern capital' },
  { id: 'flamecoast', name: 'Flamecoast', house: 'ruhanor', x: 70.5, y: 82.3, trait: 'Volcanic coast' },
];

const RESOURCES = [
  { id: 'water', name: 'Water', icon: '◈', description: 'Keeps the cities and armies supplied.' },
  { id: 'gold', name: 'Gold Mines', icon: '✦', description: 'Ore traded for the crown’s prosperity.' },
  { id: 'gems', name: 'Gems', icon: '◆', description: 'Precious stones fuel diplomacy and intrigue.' },
  { id: 'timber', name: 'Timber', icon: '♠', description: 'The foundation of houses and fortresses.' },
  { id: 'iron', name: 'Iron', icon: '⚒', description: 'Metal for armor, weapons and siege engines.' },
];

const UNITS = [
  { id: 'infantry', name: 'Infantry', icon: '⚔', quantity: 6, strength: 1, description: 'Six foot soldiers. Strength 1 each.' },
  { id: 'archers', name: 'Archers', icon: '➶', quantity: 4, strength: 2, description: 'Four archers. Strength 2 each.' },
  { id: 'knights', name: 'Knights', icon: '♞', quantity: 3, strength: 3, description: 'Three mounted knights. Strength 3 each.' },
  { id: 'elephants', name: 'War Elephants', icon: '♜', quantity: 2, strength: 5, description: 'Two mighty war elephants. Strength 5 each.' },
];

const DEFENSES = [
  { id: 'royal_shield', name: 'Royal Shield', icon: '♜', description: 'Cancel an incoming battle completely. Our answer to “Just Say No”.' },
  { id: 'shield_wall', name: 'Shield Wall', icon: '⬡', description: 'Add +6 to the defending province for one battle.' },
  { id: 'ambush', name: 'Ambush', icon: '✣', description: 'Add +4 to the defending province for one battle.' },
];

const ACTIONS = [
  { id: 'royal_decree', name: 'Royal Decree', icon: '♛', description: 'Draw three cards. Inspired by Pass Go.' },
  { id: 'tax_collect', name: 'Collect Tribute', icon: '✣', description: 'Every rival pays you one coin. Inspired by It’s My Birthday.' },
  { id: 'raid_caravan', name: 'Raid Caravan', icon: '⚔', description: 'Take up to three coins from one rival. Inspired by Debt Collector.' },
  { id: 'forced_swap', name: 'Forced Exchange', icon: '⇄', description: 'Swap one of your resources for one rival resource. Inspired by Forced Deal.' },
  { id: 'trade_pact', name: 'Trade Pact', icon: '☷', description: 'Offer a one-for-one resource exchange; rival can accept or decline.' },
  { id: 'reinforce', name: 'Fortify Province', icon: '⬡', description: 'Spend 1 Timber and 1 Iron to add +3 fortification to a province.' },
  { id: 'sabotage', name: 'Sabotage Walls', icon: '✧', description: 'Spend 1 Gems to remove up to 3 enemy fortification.' },
  { id: 'siege_engines', name: 'Siege Engines', icon: '⚒', description: 'Spend 1 Iron. Your next battle gains +5 power.' },
  { id: 'harvest', name: 'Royal Harvest', icon: '❖', description: 'Choose a resource and collect two units.' },
  { id: 'spy_network', name: 'Spy Network', icon: '◉', description: 'Take one random card from an opponent’s hand.' },
];

const CARD_COUNTS = {
  coin: [[1, 16], [2, 14], [3, 10], [5, 7]],
  resource: 9, // per resource type
  army: { infantry: 10, archers: 9, knights: 9, elephants: 7, stronghold: 7 },
  battle: 5, // five copies of each of twelve unique province assaults
  defense: { royal_shield: 9, shield_wall: 9, ambush: 7 },
  action: { royal_decree: 8, tax_collect: 6, raid_caravan: 6, forced_swap: 7, trade_pact: 7, reinforce: 8, sabotage: 6, siege_engines: 6, harvest: 8, spy_network: 6 },
};

let seq = 0;
const make = (kind, data) => ({ id: `c${(++seq).toString(36)}`, kind, ...data });

function createDeck() {
  seq = 0;
  const deck = [];
  const pushN = (count, kind, data) => { for (let i = 0; i < count; i++) deck.push(make(kind, data)); };
  for (const [value, count] of CARD_COUNTS.coin) pushN(count, 'coin', { name: `${value} Crown${value === 1 ? '' : 's'}`, value, icon: '◉', description: `Deposit ${value} coin${value === 1 ? '' : 's'} into your treasury.` });
  for (const res of RESOURCES) for (let i = 0; i < CARD_COUNTS.resource; i++) deck.push(make('resource', { ...res, resource: res.id, quantity: i % 3 === 0 ? 2 : 1 }));
  for (const u of UNITS) pushN(CARD_COUNTS.army[u.id], 'army', { ...u, unit: u.id });
  pushN(CARD_COUNTS.army.stronghold, 'army', { name: 'Fortified Houses', unit: 'stronghold', icon: '♜', quantity: 2, strength: 0, description: 'Build two defensive houses in one of your provinces. +2 permanent fortification.' });
  for (const province of TERRITORIES) pushN(CARD_COUNTS.battle, 'battle', { name: `Battle of ${province.name}`, target: province.id, house: province.house, icon: '⚔', bonus: 3, description: `Attack any rival province. Target ${province.name} gains +3 battle strength. Costs 2 coins.` });
  for (const def of DEFENSES) pushN(CARD_COUNTS.defense[def.id], 'defense', { ...def, effect: def.id });
  for (const action of ACTIONS) pushN(CARD_COUNTS.action[action.id], 'action', { ...action, effect: action.id });
  return deck;
}

function shuffle(array, rand = Math.random) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
const unitStrength = (army) => UNITS.reduce((sum, unit) => sum + (army?.[unit.id] || 0) * unit.strength, 0);
const EMPTY_RESOURCES = () => Object.fromEntries(RESOURCES.map(r => [r.id, 0]));
const EMPTY_ARMY = () => Object.fromEntries(UNITS.map(u => [u.id, 0]));

module.exports = { HOUSES, TERRITORIES, RESOURCES, UNITS, DEFENSES, ACTIONS, CARD_COUNTS, createDeck, shuffle, unitStrength, EMPTY_RESOURCES, EMPTY_ARMY };
