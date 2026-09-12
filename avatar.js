// Original layered pixel art. Descriptions select supported traits, not an image AI.
const PALETTES = {
  jade: ['청록', '#1f4f54', '#3d8e88', '#99d3b1'],
  red: ['붉은색', '#591f39', '#ad4550', '#ee9b7d'],
  blue: ['파란색', '#223f65', '#4d79a0', '#aac6d5'],
  green: ['초록', '#294638', '#5b8963', '#a9bc80'],
  purple: ['보라', '#43335f', '#876a9e', '#c9a6cf'],
  black: ['검정', '#18202c', '#3a4858', '#8395a4'],
  white: ['흰색', '#747d90', '#b6c7c9', '#f3e9d4'],
  gold: ['금색', '#685132', '#b39959', '#f4d69a'],
  pink: ['분홍', '#694357', '#b97d95', '#ebbac6']
};
const HAIR = {
  silver: ['은빛', '#515774', '#abb4c9', '#e5e5e0'],
  black: ['흑발', '#141d2b', '#2d3a4f', '#657184'],
  gold: ['금발', '#674632', '#c89958', '#f6da96'],
  red: ['적발', '#4d2638', '#a14b59', '#e1968e'],
  blue: ['청발', '#273a61', '#587ba3', '#a0ccd1'],
  pink: ['분홍', '#683d62', '#b888b2', '#e6bcce'],
  brown: ['갈색', '#352d35', '#6e5150', '#ae8772']
};
const ROLES = {
  sage: ['도사', /도사|신선|선인|healer|sage|taoist/i, 'jade', 'staff'],
  swordsman: ['검객', /검객|검사|무사|전사|기사|warrior|knight|swordsman/i, 'red', 'sword'],
  archer: ['궁수', /궁수|사냥꾼|archer|ranger/i, 'green', 'bow'],
  mage: ['술사', /술사|마법사|법사|wizard|mage|witch/i, 'purple', 'staff'],
  rogue: ['자객', /자객|도적|암살자|닌자|rogue|ninja|assassin/i, 'black', 'sword']
};
const COLORS = [
  ['silver', /은빛|은색|은발|백발|silver/gi], ['white', /흰색|하얀|흰|white/gi],
  ['black', /검은색|검은|검정|흑발|black/gi], ['gold', /금발|금빛|금색|노란|blonde?|gold/gi],
  ['red', /붉은|빨간|적발|빨강|red/gi], ['jade', /청록|민트|옥색|teal|mint|jade/gi],
  ['blue', /파란|파랑|푸른|청발|blue/gi], ['green', /초록|녹색|green/gi],
  ['purple', /보라|자주|purple/gi], ['pink', /분홍|핑크|pink/gi], ['brown', /갈색|갈발|brown/gi]
];
export const DEFAULT_PROMPT = '은빛 긴 머리에 청록색 도포를 입은 도사. 손에는 달빛 지팡이.';
export function parseAvatar(value) {
  const prompt = String(value).trim().slice(0, 300);
  const foundRole = Object.entries(ROLES).find(([, role]) => role[1].test(prompt));
  const role = foundRole?.[0] || 'sage';
  let recognized = !!foundRole;
  let outfit = ROLES[role][2], hair = 'black', hairstyle = 'short', weapon = ROLES[role][3];
  const matched = [];
  for (const [key, pattern] of COLORS) {
    for (const match of prompt.matchAll(pattern)) {
      const after = prompt.slice(match.index + match[0].length, match.index + match[0].length + 22);
      const hairAt = after.search(/머리|포니테일|장발|단발|헤어|hair|ponytail/i);
      const clothAt = after.search(/도포|옷|갑옷|로브|복장|망토|robe|armor|outfit|cloak/i);
      const isHairWord = /발$|blonde/i.test(match[0]);
      if (isHairWord || (hairAt >= 0 && (clothAt < 0 || hairAt < clothAt))) {
        hair = HAIR[key] ? key : key === 'white' ? 'silver' : 'black'; recognized = true;
      } else if (clothAt >= 0) {
        outfit = PALETTES[key] ? key : key === 'silver' ? 'white' : 'gold'; recognized = true;
      } else continue;
      matched.push(key);
    }
  }
  if (/긴\s*머리|장발|long\s*hair/i.test(prompt)) { hairstyle = 'long'; recognized = true; }
  if (/포니테일|묶은|ponytail/i.test(prompt)) { hairstyle = 'ponytail'; recognized = true; }
  if (/짧은\s*머리|단발|short\s*hair/i.test(prompt)) { hairstyle = 'short'; recognized = true; }
  if (/지팡이|staff|wand/i.test(prompt)) { weapon = 'staff'; recognized = true; }
  else if (/활|bow/i.test(prompt)) { weapon = 'bow'; recognized = true; }
  else if (/검을|칼|검객|sword|blade/i.test(prompt)) { weapon = 'sword'; recognized = true; }
  if (/맨손|무기\s*없|unarmed|no weapon/i.test(prompt)) { weapon = 'none'; recognized = true; }
  const hat = /갓|삿갓|gat\b/i.test(prompt);
  if (hat) recognized = true;
  const skin = /짙은\s*피부|어두운\s*피부|dark\s*skin/i.test(prompt) ? 'deep' : /갈색\s*피부|구릿빛|tan\b/i.test(prompt) ? 'tan' : 'light';
  if (skin !== 'light') recognized = true;
  return { version: 1, prompt, role, outfit, hair, hairstyle, weapon, hat, skin, recognized, explicitColor: matched.length > 0 };
}
export function validAvatar(value) {
  return !!value && value.version === 1 && typeof value.prompt === 'string' && value.prompt.length <= 300 &&
    Object.hasOwn(ROLES, value.role) && Object.hasOwn(PALETTES, value.outfit) && Object.hasOwn(HAIR, value.hair) &&
    ['short', 'long', 'ponytail'].includes(value.hairstyle) && ['sword', 'staff', 'bow', 'none'].includes(value.weapon) &&
    ['light', 'tan', 'deep'].includes(value.skin) && typeof value.hat === 'boolean';
}
export function avatarTraits(spec) {
  return [ROLES[spec.role][0], HAIR[spec.hair][0] + ' ' + ({ short:'단발', long:'장발', ponytail:'포니테일' })[spec.hairstyle],
    PALETTES[spec.outfit][0] + ' 도포', ({ staff:'달빛 지팡이', sword:'장검', bow:'활', none:'맨손' })[spec.weapon], ...(spec.hat ? ['갓'] : [])];
}
export function avatarTitle(spec) {
  return ROLES[spec.role][0];
}
export function paintAvatar(canvas, spec, frame = 0, flipped = false) {
  const source = document.createElement('canvas');
  source.width = 80; source.height = 88;
  const c = source.getContext('2d');
  const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const poly = (color, points) => {
    c.fillStyle = color; c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fill();
  };
  const [, dark, cloth, light] = PALETTES[spec.outfit];
  const [, hairDark, hair, hairLight] = HAIR[spec.hair];
  const ink = '#111923', gold = '#c1a267', ivory = '#e4d6b5';
  const [skin, shadow, blush] = ({ light:['#f1cca4','#c4927f','#cf8f87'], tan:['#c08d69','#895854','#a7625b'], deep:['#885a4e','#543b40','#af7863'] })[spec.skin];
  const bob = frame % 4 >= 2 ? -1 : 0;
  c.save(); c.translate(0, bob);
  // Rear hair and robe layers keep the silhouette readable at native pixel size.
  if (spec.hairstyle === 'long') {
    rect(ink, 24, 21, 32, 34); rect(hairDark, 26, 22, 28, 32);
    rect(hair, 27, 28, 4, 26); rect(hairLight, 28, 28, 1, 19); rect(hair, 49, 27, 3, 27);
  }
  if (spec.hairstyle === 'ponytail') {
    poly(ink, [[48,14],[59,18],[61,35],[57,45],[51,43],[55,29],[50,23]]);
    poly(hairDark, [[50,17],[57,19],[59,34],[55,42],[55,28]]);
    rect(hair, 56,22,2,12); rect(gold,49,18,6,3);
  }
  poly(ink, [[28,43],[53,43],[58,67],[55,74],[24,74],[23,69]]);
  poly(dark, [[29,44],[51,44],[56,70],[53,72],[26,71]]);
  rect(ink,30,72,9,6);rect(ink,43,72,9,6);
  rect('#3a3844',31,73,7,3);rect('#3a3844',44,73,7,3);
  rect(gold,31,76,7,1);rect(gold,44,76,7,1);
  poly(cloth, [[30,40],[49,40],[52,54],[51,68],[54,71],[27,71],[30,56]]);
  poly(light, [[32,43],[36,45],[34,66],[31,69],[31,50]]);
  poly(dark, [[44,46],[49,44],[50,70],[44,68]]);
  rect(light,37,61,2,10);rect(light,29,70,23,1);
  poly(ink, [[28,41],[33,44],[28,60],[18,58],[21,48]]);
  poly(cloth, [[28,43],[31,45],[26,58],[20,56],[23,48]]);
  rect(light,21,53,6,2);rect(gold,19,56,8,2);
  poly(ink, [[49,42],[55,44],[61,56],[58,61],[50,58]]);
  poly(cloth, [[50,44],[54,45],[59,56],[56,59],[51,56]]);
  rect(light,52,48,2,7);rect(gold,54,56,6,2);
  rect(shadow,21,58,5,4);rect(skin,22,58,4,3);
  rect(shadow,55,59,5,4);rect(skin,55,59,4,3);
  poly(ivory, [[33,41],[39,42],[45,41],[42,49],[39,51]]);
  poly(dark, [[32,43],[37,44],[42,52],[39,56],[36,51]]);
  rect(ink,29,55,23,5);rect(gold,29,55,23,2);rect(ivory,38,55,5,4);
  rect(gold,41,60,2,8);rect('#add5ca',40,66,4,4);
  // Face, ears, stepped outline, and high-contrast eyes.
  rect(ink,27,17,26,24);rect(ink,30,14,20,30);
  rect(shadow,25,28,4,7);rect(skin,26,28,3,5);
  rect(shadow,51,28,4,7);rect(skin,51,28,3,5);
  rect(skin,29,21,22,18);rect(skin,32,39,16,3);
  rect(shadow,30,37,3,2);rect(shadow,47,37,3,2);
  rect(ink,32,31,5,4);rect(ink,43,31,5,4);
  if (frame % 12 === 11) {rect(skin,32,31,5,2);rect(skin,43,31,5,2);}
  else {rect('#f0eee0',33,31,2,2);rect('#f0eee0',44,31,2,2);rect('#667a85',35,33,1,1);rect('#667a85',46,33,1,1);}
  rect(blush,30,35,3,1);rect(blush,47,35,3,1);rect(shadow,39,38,3,1);
  poly(hairDark, [[26,21],[28,15],[34,11],[45,11],[51,15],[54,22],[51,31],[49,26],[45,23],[42,28],[37,25],[34,29],[29,27],[28,32]]);
  poly(hair, [[28,21],[31,16],[35,13],[44,13],[49,17],[51,22],[49,25],[44,20],[41,25],[36,22],[32,26],[29,25]]);
  rect(hairLight,34,15,10,2);rect(hairLight,31,18,4,2);rect(hairLight,46,18,2,3);
  rect(hair,28,25,2,9);rect(hairDark,50,24,2,10);
  if (spec.role === 'sage' || spec.role === 'mage') {
    rect(ink,35,8,10,6);rect(hairDark,36,8,8,5);rect(gold,34,12,13,2);rect(ivory,39,7,2,3);
    rect(gold,28,26,23,1);rect('#b7e5d9',39,26,3,3);
  }
  if (spec.role === 'rogue') {rect(dark,29,35,22,5);rect(light,32,35,16,1);}
  if (spec.role === 'swordsman') {rect(dark,27,23,25,3);rect(gold,28,24,24,1);rect(cloth,52,24,7,2);rect(cloth,58,26,3,6);}
  if (spec.hat) {
    rect(ink,32,4,16,14);rect('#283746',33,5,14,13);rect('#59616b',35,6,2,10);
    rect(ink,20,17,40,4);rect('#424c57',21,18,38,2);rect(gold,33,15,14,2);
  }
  if (spec.weapon === 'staff') {
    rect(ink,61,24,4,51);rect('#8c7357',62,24,2,49);rect(gold,61,47,4,2);
    poly(gold,[[62,15],[68,19],[68,27],[64,31],[59,27],[59,19]]);
    poly('#4f9f99',[[63,17],[66,20],[66,25],[63,28],[61,24],[61,20]]);
    rect('#d7f2d5',62,20,2,4);rect(ivory,61,29,4,2);
    rect(skin,59,59,4,3);
  } else if (spec.weapon === 'sword') {
    poly(ink,[[61,30],[66,35],[63,60],[62,62],[59,61],[58,59]]);
    poly('#85a7b6',[[62,33],[64,36],[61,59],[60,59]]);
    rect('#e2e0cc',62,36,1,14);rect(gold,55,60,12,3);rect(ink,59,63,4,9);rect(gold,60,63,2,8);rect(skin,56,60,4,3);
  } else if (spec.weapon === 'bow') {
    poly(ink,[[61,26],[66,30],[70,40],[71,50],[68,61],[61,67],[62,61],[67,51],[66,41],[63,33]]);
    poly(gold,[[62,29],[64,31],[68,41],[69,49],[66,60],[62,64],[68,49],[67,41]]);
    rect(ivory,61,29,1,35);rect(skin,58,58,4,3);
  }
  if (frame % 2 === 0) {rect('#b7dccc',15,36,1,1);rect(gold,64,10,1,2);rect('#b7dccc',22,70,1,1);}
  else {rect('#b7dccc',14,35,1,1);rect(gold,65,9,1,1);rect('#b7dccc',23,68,1,1);}
  c.restore();
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  if (flipped) {ctx.translate(canvas.width,0);ctx.scale(-1,1);}
  ctx.drawImage(source,0,0,canvas.width,canvas.height); ctx.restore();
}
