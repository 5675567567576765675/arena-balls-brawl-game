const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const menu = document.querySelector("#menu");
const banner = document.querySelector("#match-banner");
const W = canvas.width;
const H = canvas.height;
const ARENA = { left: 105, right: 895, top: 82, bottom: 550 };
const MAX_SPEED = 450;

const fighters = [
  { name: "COMET", color: "#32e5d0", light: "#c2fff5", design: "star", weapon: "spear", ability: "dash", abilityName: "Comet Dash" },
  { name: "FROST", color: "#5faaff", light: "#d8efff", design: "crystal", weapon: "axe", ability: "freeze", abilityName: "Deep Freeze" },
  { name: "BLAZE", color: "#ff713e", light: "#ffe083", design: "flame", weapon: "greatsword", ability: "pulse", abilityName: "Solar Burst" },
  { name: "THORN", color: "#a2e954", light: "#e5ff9f", design: "flower", weapon: "scythe", ability: "shield", abilityName: "Bramble Guard" },
  { name: "VOLT", color: "#ffe34a", light: "#fff8bf", design: "gear", weapon: "mace", ability: "heal", abilityName: "Recharge" },
  { name: "SHADE", color: "#b873ff", light: "#f0d7ff", design: "eye", weapon: "claw", ability: "blink", abilityName: "Shadow Step" },
  { name: "ORBIT", color: "#ff65b5", light: "#ffd6ec", design: "ring", weapon: "chakram", ability: "gravity", abilityName: "Gravity Well" },
  { name: "TITAN", color: "#ff5267", light: "#ffd0a6", design: "hex", weapon: "hammer", ability: "meteor", abilityName: "Meteor Smash" },
  { name: "HEX", color: "#9b83ff", light: "#d8d0ff", design: "rune", weapon: "wand", ability: "summon", abilityName: "Summon Wisps", summoner: true },
  { name: "VENOM", color: "#7af06b", light: "#dcffc6", design: "fang", weapon: "twinblades", ability: "poison", abilityName: "Venom Strike" },
  { name: "RIPTIDE", color: "#31d6ff", light: "#d2f8ff", design: "wave", weapon: "trident", ability: "surge", abilityName: "Tidal Surge" },
  { name: "EMBER", color: "#ffb23f", light: "#fff0bd", design: "sun", weapon: "flail", ability: "flare", abilityName: "Flare Up" }
];

const state = { mode: "", playing: false, players: [], minions: [], effects: [], particles: [], lastTime: 0, shake: 0, bannerTimer: 0 };
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const shuffle = list => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};

function createBall(fighter, team, x, y, angle) {
  const speed = rand(235, 315);
  return {
    ...fighter, team, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    radius: 22, health: 100, angle: rand(0, Math.PI * 2), spin: rand(3.8, 5.5) * (Math.random() < .5 ? -1 : 1),
    cooldown: rand(1.1, 2.8), hitCooldown: 0, shield: 0, freeze: 0, poison: 0, poisonTick: 0,
    flash: 0, trail: [], eliminated: false
  };
}

function getLayout(mode, count) {
  if (mode === "2v2") return [
    { x: ARENA.left + 115, y: ARENA.top + 115, team: 0 },
    { x: ARENA.right - 115, y: ARENA.top + 115, team: 1 },
    { x: ARENA.left + 115, y: ARENA.bottom - 115, team: 1 },
    { x: ARENA.right - 115, y: ARENA.bottom - 115, team: 0 }
  ];
  const center = { x: W / 2, y: (ARENA.top + ARENA.bottom) / 2 };
  const radius = count === 3 ? 210 : 250;
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / count;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, team: i };
  });
}

function startMatch(mode) {
  state.mode = mode;
  const count = mode === "2v2" ? 4 : mode === "ffa3" ? 3 : 4;
  const chosen = shuffle(fighters).slice(0, count);
  const positions = getLayout(mode, count);
  state.players = chosen.map((fighter, i) => {
    const p = positions[i];
    const target = positions[(i + 1) % positions.length];
    return createBall(fighter, p.team, p.x, p.y, Math.atan2(target.y - p.y, target.x - p.x));
  });
  // Ensure the summoner can appear in the larger, busier game modes.
  if (!state.players.some(p => p.summoner) && Math.random() < .48) {
    const summoner = fighters.find(f => f.summoner);
    const replaceIndex = Math.floor(Math.random() * state.players.length);
    const old = state.players[replaceIndex];
    state.players[replaceIndex] = createBall(summoner, old.team, old.x, old.y, rand(0, Math.PI * 2));
  }
  state.minions = [];
  state.effects = [];
  state.particles = [];
  state.shake = 0;
  state.playing = true;
  menu.classList.add("hidden");
  banner.textContent = mode === "2v2" ? "2 VS 2 · TEAM BATTLE" : `${count} BALL FREE-FOR-ALL`;
  banner.classList.add("show");
  state.bannerTimer = 1.15;
  setTimeout(() => banner.classList.remove("show"), 1150);
}

function activeTeams() { return new Set(state.players.filter(p => !p.eliminated).map(p => p.team)); }
function enemiesOf(ball) { return state.players.filter(p => !p.eliminated && p.team !== ball.team); }
function nearestEnemy(ball) {
  return enemiesOf(ball).sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y))[0];
}
function addRing(x, y, color, size = 100, life = .5) { state.effects.push({ x, y, color, size, life, maxLife: life, kind: "ring" }); }
function burst(x, y, color, amount = 14, power = 150) {
  for (let i = 0; i < amount; i++) {
    const a = rand(0, Math.PI * 2), speed = rand(power * .25, power);
    state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, life: rand(.25, .65), maxLife: .65, size: rand(2, 5) });
  }
}
function hitStopAndShake(power = 5) { state.shake = Math.max(state.shake, power); }

function damage(target, amount, source = null) {
  if (!state.playing || target.eliminated) return;
  if (target.shield > 0) amount *= .28;
  target.health = clamp(target.health - amount, 0, 100);
  target.flash = .25;
  burst(target.x, target.y, target.light, 10, 125);
  addRing(target.x, target.y, target.color, 38, .2);
  hitStopAndShake(4);
  if (target.health <= 0) {
    target.eliminated = true;
    burst(target.x, target.y, target.color, 34, 260);
    addRing(target.x, target.y, "#ffffff", 150, .55);
    if (source) addRing(source.x, source.y, source.color, 90, .35);
    const teams = activeTeams();
    if (teams.size <= 1) finishMatch(state.players.find(p => !p.eliminated));
  }
}

function useAbility(ball) {
  const target = nearestEnemy(ball);
  if (!target) return;
  const dx = target.x - ball.x, dy = target.y - ball.y;
  const distance = Math.hypot(dx, dy) || 1, nx = dx / distance, ny = dy / distance;
  switch (ball.ability) {
    case "dash":
      ball.vx += nx * 280; ball.vy += ny * 280; addRing(ball.x, ball.y, ball.color, 105); burst(ball.x, ball.y, ball.color, 20, 190); break;
    case "freeze":
      if (distance < 320) { target.freeze = 1.35; addRing(target.x, target.y, "#b9efff", 130); burst(target.x, target.y, "#d7f6ff", 22, 125); } break;
    case "pulse":
      if (distance < 260) { damage(target, 15, ball); target.vx += nx * 180; target.vy += ny * 180; }
      addRing(ball.x, ball.y, "#ffcc6d", 205); burst(ball.x, ball.y, ball.light, 25, 210); break;
    case "shield":
      ball.shield = 2.7; addRing(ball.x, ball.y, ball.light, 82); burst(ball.x, ball.y, ball.color, 16, 125); break;
    case "heal":
      ball.health = clamp(ball.health + 16, 0, 100); addRing(ball.x, ball.y, "#fff08a", 100); burst(ball.x, ball.y, "#fff08a", 20, 125); break;
    case "blink": {
      const ox = ball.x, oy = ball.y;
      ball.x = clamp(target.x - nx * 95, ARENA.left + 40, ARENA.right - 40);
      ball.y = clamp(target.y - ny * 95, ARENA.top + 40, ARENA.bottom - 40);
      addRing(ox, oy, ball.color, 90); addRing(ball.x, ball.y, ball.light, 90); burst(ox, oy, ball.color, 18, 140); burst(ball.x, ball.y, ball.color, 18, 140); break;
    }
    case "gravity":
      if (distance < 430) { target.vx -= nx * 245; target.vy -= ny * 245; addRing(target.x, target.y, ball.color, 100); }
      addRing(ball.x, ball.y, ball.color, 160); break;
    case "meteor":
      if (distance < 300) { damage(target, 19, ball); target.vx += nx * 240; target.vy += ny * 240; }
      addRing(ball.x, ball.y, "#ffb56b", 230); burst(ball.x, ball.y, ball.light, 30, 230); break;
    case "summon":
      // Hex summons up to three orbiting wisps that hunt enemy fighters.
      for (let i = 0; i < 3 && state.minions.filter(m => m.owner === ball).length < 3; i++) {
        const angle = rand(0, Math.PI * 2);
        state.minions.push({ owner: ball, x: ball.x + Math.cos(angle) * 32, y: ball.y + Math.sin(angle) * 32, vx: 0, vy: 0, radius: 9, life: 8, cooldown: rand(.2, .65), angle, color: ball.light });
      }
      addRing(ball.x, ball.y, ball.color, 140); burst(ball.x, ball.y, ball.light, 26, 160); break;
    case "poison":
      if (distance < 260) { target.poison = 3.2; target.poisonTick = 0; damage(target, 6, ball); burst(target.x, target.y, "#83ff68", 20, 110); }
      addRing(ball.x, ball.y, "#8dff65", 115); break;
    case "surge":
      ball.vx += nx * 220; ball.vy += ny * 220;
      if (distance < 230) { damage(target, 10, ball); target.vx += nx * 150; target.vy += ny * 150; }
      addRing(ball.x, ball.y, "#7eeeff", 190); burst(ball.x, ball.y, "#60ddff", 24, 190); break;
    case "flare":
      if (distance < 220) damage(target, 13, ball);
      ball.vx -= nx * 100; ball.vy -= ny * 100;
      addRing(ball.x, ball.y, "#ffe08a", 180); burst(ball.x, ball.y, "#ff8b38", 28, 210); break;
  }
}

function updateMinions(dt) {
  for (const m of state.minions) {
    m.life -= dt; m.angle += dt * 5;
    const enemy = nearestEnemy(m.owner);
    if (!enemy) { m.life = 0; continue; }
    const dx = enemy.x - m.x, dy = enemy.y - m.y, d = Math.hypot(dx, dy) || 1;
    m.vx += dx / d * 700 * dt; m.vy += dy / d * 700 * dt;
    const speed = Math.hypot(m.vx, m.vy);
    if (speed > 260) { m.vx = m.vx / speed * 260; m.vy = m.vy / speed * 260; }
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.cooldown -= dt;
    if (d < enemy.radius + 13 && m.cooldown <= 0) {
      damage(enemy, 5, m.owner); m.cooldown = .65; burst(m.x, m.y, m.color, 8, 90);
    }
  }
  state.minions = state.minions.filter(m => m.life > 0 && !m.owner.eliminated);
}

function update(dt) {
  if (!state.playing) return;
  for (const ball of state.players) {
    if (ball.eliminated) continue;
    ball.cooldown -= dt; ball.hitCooldown -= dt; ball.shield = Math.max(0, ball.shield - dt);
    ball.freeze = Math.max(0, ball.freeze - dt); ball.flash = Math.max(0, ball.flash - dt);
    ball.poison = Math.max(0, ball.poison - dt); ball.poisonTick -= dt;
    if (ball.poison > 0 && ball.poisonTick <= 0) { ball.poisonTick = .8; damage(ball, 2); burst(ball.x, ball.y, "#8dff65", 3, 45); }
    if (ball.cooldown <= 0) { useAbility(ball); ball.cooldown = ball.summoner ? 5.2 : rand(4.5, 6.3); }
    ball.angle += ball.spin * dt;
    const slow = ball.freeze > 0 ? .25 : 1;
    ball.x += ball.vx * slow * dt; ball.y += ball.vy * slow * dt;
    const pad = ball.radius + 13;
    if (ball.x < ARENA.left + pad) { ball.x = ARENA.left + pad; ball.vx = Math.abs(ball.vx) * 1.06; burst(ball.x, ball.y, ball.color, 5, 60); }
    if (ball.x > ARENA.right - pad) { ball.x = ARENA.right - pad; ball.vx = -Math.abs(ball.vx) * 1.06; burst(ball.x, ball.y, ball.color, 5, 60); }
    if (ball.y < ARENA.top + pad) { ball.y = ARENA.top + pad; ball.vy = Math.abs(ball.vy) * 1.06; burst(ball.x, ball.y, ball.color, 5, 60); }
    if (ball.y > ARENA.bottom - pad) { ball.y = ARENA.bottom - pad; ball.vy = -Math.abs(ball.vy) * 1.06; burst(ball.x, ball.y, ball.color, 5, 60); }
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > MAX_SPEED) { ball.vx *= MAX_SPEED / speed; ball.vy *= MAX_SPEED / speed; }
    else if (speed < 190) { ball.vx *= 1.04; ball.vy *= 1.04; }
    ball.trail.push({ x: ball.x, y: ball.y, life: .35 });
    ball.trail.forEach(p => p.life -= dt);
    ball.trail = ball.trail.filter(p => p.life > 0);
  }
  if (!state.playing) return;
  updateMinions(dt);
  const alive = state.players.filter(p => !p.eliminated);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const min = a.radius + b.radius;
    if (d < min) {
      const nx = dx / d, ny = dy / d, overlap = min - d;
      a.x -= nx * overlap * .5; a.y -= ny * overlap * .5; b.x += nx * overlap * .5; b.y += ny * overlap * .5;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) { const impulse = -rel * .75; a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny; }
    }
  }
  for (const ball of alive) {
    if (ball.hitCooldown > 0) continue;
    const target = nearestEnemy(ball);
    if (!target) continue;
    const dx = target.x - ball.x, dy = target.y - ball.y, d = Math.hypot(dx, dy) || 1;
    const toTarget = Math.atan2(dy, dx);
    const diff = Math.atan2(Math.sin(toTarget - ball.angle), Math.cos(toTarget - ball.angle));
    if (d < 122 && Math.abs(diff) < .42) {
      const weaponPower = { spear: 13, axe: 15, greatsword: 16, scythe: 12, mace: 14, claw: 11, chakram: 12, hammer: 17, wand: 10, twinblades: 12, trident: 14, flail: 15 };
      damage(target, weaponPower[ball.weapon] || 12, ball);
      ball.hitCooldown = .52;
      target.vx += dx / d * 145; target.vy += dy / d * 145;
      addRing(target.x, target.y, ball.light, 62, .28);
    }
  }
}

function drawArena() {
  ctx.fillStyle = "#080e1a"; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,500);
  glow.addColorStop(0,"#334c8033"); glow.addColorStop(1,"#060b1600"); ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#a8d6ff0b";ctx.lineWidth=1;
  for(let x=45;x<W;x+=45){ctx.beginPath();ctx.moveTo(x,24);ctx.lineTo(x,H-24);ctx.stroke();}
  for(let y=45;y<H;y+=45){ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(W-24,y);ctx.stroke();}
  ctx.strokeStyle="#c0e5ff35";ctx.lineWidth=2;ctx.strokeRect(18,18,W-36,H-36);
  ctx.fillStyle="#14274766";ctx.fillRect(ARENA.left,ARENA.top,ARENA.right-ARENA.left,ARENA.bottom-ARENA.top);
  ctx.shadowColor="#43dfff";ctx.shadowBlur=15;ctx.strokeStyle="#70e8ffb8";ctx.lineWidth=4;ctx.strokeRect(ARENA.left,ARENA.top,ARENA.right-ARENA.left,ARENA.bottom-ARENA.top);ctx.shadowBlur=0;
  ctx.strokeStyle="#82dfff20";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2,92,0,Math.PI*2);ctx.stroke();
  if (state.playing) drawHUD();
}

function drawHUD() {
  const groups = state.mode === "2v2" ? [0,1] : state.players.map(p => p.team);
  const unique = [...new Set(groups)];
  unique.forEach((team, idx) => {
    const members = state.players.filter(p => p.team === team);
    const x = state.mode === "2v2" ? (team === 0 ? 32 : W - 252) : 32 + idx * (W - 260) / Math.max(1, unique.length - 1);
    const y = state.mode === "2v2" ? 38 : 32;
    members.forEach((p, m) => {
      const yy = y + m * 23;
      ctx.textAlign = "left";ctx.font="900 11px system-ui";ctx.fillStyle=p.eliminated?"#768096":p.light;ctx.fillText(`${p.name}${p.eliminated?" · OUT":""}`,x,yy);
      ctx.fillStyle="#ffffff24";ctx.fillRect(x,yy+4,205,7);
      ctx.fillStyle=p.color;ctx.fillRect(x,yy+4,205*p.health/100,7);
    });
  });
  ctx.textAlign="center";ctx.font="900 12px system-ui";ctx.fillStyle="#dff7ffad";ctx.fillText(state.mode === "2v2" ? "TEAM BRAWL" : "FREE-FOR-ALL",W/2,39);
}

function polygon(points, color, stroke = null) {
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function starPoints(r1,r2,n=5){const p=[];for(let i=0;i<n*2;i++){const r=i%2?r2:r1,a=-Math.PI/2+i*Math.PI/n;p.push([Math.cos(a)*r,Math.sin(a)*r]);}return p;}

function drawCore(ball, radius = ball.radius) {
  ctx.save();ctx.translate(ball.x,ball.y);ctx.shadowColor=ball.color;ctx.shadowBlur=22;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle=ball.color;ctx.fill();ctx.shadowBlur=0;
  switch(ball.design){
    case "star": polygon(starPoints(radius*.86,radius*.53,5),ball.light);break;
    case "crystal": polygon([[0,-radius*.9],[radius*.65,-radius*.28],[radius*.45,radius*.65],[0,radius*.9],[-radius*.45,radius*.65],[-radius*.65,-radius*.28]],ball.light);polygon([[0,-radius*.5],[radius*.3,-radius*.15],[0,radius*.6],[-radius*.2,0]],"#579cf4");break;
    case "flame": polygon([[0,-radius],[radius*.55,-radius*.25],[radius*.7,radius*.42],[0,radius*.86],[-radius*.68,radius*.4],[-radius*.48,-radius*.26]],ball.light);polygon([[0,-radius*.38],[radius*.25,0],[0,radius*.5],[-radius*.24,0]],"#ff7b26");break;
    case "flower": for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.ellipse(Math.cos(a)*radius*.35,Math.sin(a)*radius*.35,radius*.33,radius*.19,a,0,Math.PI*2);ctx.fillStyle=ball.light;ctx.fill();}ctx.beginPath();ctx.arc(0,0,radius*.23,0,Math.PI*2);ctx.fillStyle="#568631";ctx.fill();break;
    case "gear": polygon(starPoints(radius*.88,radius*.68,8),ball.light);ctx.beginPath();ctx.arc(0,0,radius*.34,0,Math.PI*2);ctx.fillStyle="#c79517";ctx.fill();ctx.beginPath();ctx.arc(0,0,radius*.12,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();break;
    case "eye": ctx.beginPath();ctx.ellipse(0,0,radius*.88,radius*.55,0,0,Math.PI*2);ctx.fillStyle=ball.light;ctx.fill();ctx.beginPath();ctx.arc(0,0,radius*.3,0,Math.PI*2);ctx.fillStyle="#602d99";ctx.fill();ctx.beginPath();ctx.arc(0,0,radius*.12,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();break;
    case "ring": ctx.beginPath();ctx.arc(0,0,radius*.66,0,Math.PI*2);ctx.strokeStyle=ball.light;ctx.lineWidth=radius*.25;ctx.stroke();ctx.beginPath();ctx.arc(0,0,radius*.2,0,Math.PI*2);ctx.fillStyle="#a52b73";ctx.fill();break;
    case "rune": polygon(starPoints(radius*.85,radius*.6,4),ball.light);ctx.strokeStyle="#7861d9";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,radius*.38,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();break;
    case "fang": ctx.beginPath();ctx.ellipse(0,0,radius*.8,radius*.65,0,0,Math.PI*2);ctx.fillStyle=ball.light;ctx.fill();polygon([[-radius*.4,-radius*.15],[-radius*.2,radius*.45],[0,-radius*.1]],"#317b39");polygon([[radius*.4,-radius*.15],[radius*.2,radius*.45],[0,-radius*.1]],"#317b39");break;
    case "wave": ctx.strokeStyle=ball.light;ctx.lineWidth=5;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(i*8,0,radius*.42,Math.PI*.15,Math.PI*.85);ctx.stroke();}break;
    case "sun": ctx.strokeStyle=ball.light;ctx.lineWidth=3;for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(a)*radius*.38,Math.sin(a)*radius*.38);ctx.lineTo(Math.cos(a)*radius*.72,Math.sin(a)*radius*.72);ctx.stroke();}ctx.beginPath();ctx.arc(0,0,radius*.4,0,Math.PI*2);ctx.fillStyle=ball.light;ctx.fill();ctx.beginPath();ctx.arc(0,0,radius*.19,0,Math.PI*2);ctx.fillStyle="#ff9135";ctx.fill();break;
    default: polygon([[0,-radius*.85],[radius*.72,-radius*.38],[radius*.72,radius*.38],[0,radius*.85],[-radius*.72,radius*.38],[-radius*.72,-radius*.38]],ball.light);polygon([[0,-radius*.38],[radius*.34,0],[0,radius*.38],[-radius*.34,0]],"#d83e51");
  }
  ctx.beginPath();ctx.ellipse(-radius*.27,-radius*.34,radius*.2,radius*.09,-.6,0,Math.PI*2);ctx.fillStyle="#ffffff80";ctx.fill();ctx.restore();
}

function drawWeapon(ball) {
  const orbit=ball.radius+29, x=ball.x+Math.cos(ball.angle)*orbit, y=ball.y+Math.sin(ball.angle)*orbit;
  ctx.save();ctx.translate(x,y);ctx.rotate(ball.angle+Math.PI/2);const c=ball.light;
  ctx.strokeStyle="#ffffff55";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,ball.radius+5);ctx.lineTo(0,4);ctx.stroke();
  switch(ball.weapon){
    case "spear":ctx.fillStyle="#39485d";ctx.fillRect(-3,-3,6,26);polygon([[-3,-2],[0,-26],[3,-2]],c,"#fff");break;
    case "axe":ctx.fillStyle="#39485d";ctx.fillRect(-3,-4,6,28);polygon([[-3,-9],[-18,-20],[-23,-7],[-12,2],[-3,0]],c,"#fff");break;
    case "greatsword":polygon([[-5,4],[-7,-10],[-4,-27],[0,-36],[4,-27],[7,-10],[5,4]],c,"#fff");ctx.fillStyle="#613822";ctx.fillRect(-8,2,16,5);ctx.fillRect(-3,7,6,12);break;
    case "scythe":ctx.strokeStyle="#345429";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(0,-23);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-18);ctx.quadraticCurveTo(22,-34,22,-9);ctx.quadraticCurveTo(10,-18,2,-10);ctx.closePath();ctx.fillStyle=c;ctx.fill();ctx.strokeStyle="#fff";ctx.stroke();break;
    case "mace":ctx.strokeStyle="#39485d";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(0,-15);ctx.stroke();ctx.beginPath();ctx.arc(0,-20,10,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();break;
    case "claw":for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*7,8);ctx.quadraticCurveTo(i*11,-8,i*8,-25);ctx.strokeStyle=c;ctx.lineWidth=5;ctx.lineCap="round";ctx.stroke();ctx.strokeStyle="#fff";ctx.lineWidth=1;ctx.stroke();}break;
    case "chakram":ctx.beginPath();ctx.arc(0,-12,12,0,Math.PI*2);ctx.strokeStyle=c;ctx.lineWidth=5;ctx.stroke();ctx.beginPath();ctx.arc(0,-12,4,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();break;
    case "hammer":ctx.fillStyle="#39485d";ctx.fillRect(-3,-4,6,27);ctx.fillStyle="#ff5267";ctx.fillRect(-12,-7,24,8);polygon([[-12,-7],[-15,-19],[-6,-15],[-3,-26],[0,-15],[7,-25],[9,-14],[15,-19],[12,-7]],c,"#fff");break;
    case "wand":ctx.strokeStyle="#d7caff";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(0,-20);ctx.stroke();ctx.shadowColor=c;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,-24,7,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.shadowBlur=0;break;
    case "twinblades":for(const side of [-1,1]){polygon([[side*3,5],[side*16,-12],[side*14,-27],[side*7,-19],[side*1,-3]],c,"#fff");}break;
    case "trident":ctx.strokeStyle="#a9efff";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(0,-24);ctx.stroke();for(const d of [-1,0,1]){ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(d*9,-28);ctx.strokeStyle=c;ctx.lineWidth=3;ctx.stroke();}break;
    case "flail":ctx.strokeStyle="#d9c9a7";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(0,-17);ctx.stroke();ctx.beginPath();ctx.arc(0,-23,9,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle="#fff";ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.arc(Math.cos(a)*9,-23+Math.sin(a)*9,2,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();}break;
  }
  ctx.restore();
}

function drawBall(ball, preview = false) {
  if (ball.eliminated) return;
  for (const p of ball.trail || []) { ctx.globalAlpha=Math.max(0,p.life/.35)*.28;ctx.beginPath();ctx.arc(p.x,p.y,ball.radius*.72,0,Math.PI*2);ctx.fillStyle=ball.color;ctx.fill(); }
  ctx.globalAlpha=1;
  if (!preview) drawWeapon(ball);
  drawCore(ball, preview ? 18 : ball.radius);
  if (ball.shield > 0) { ctx.shadowColor=ball.light;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+12,0,Math.PI*2);ctx.strokeStyle="#d7ff9a";ctx.lineWidth=4;ctx.stroke();ctx.shadowBlur=0; }
  if (ball.freeze > 0) { ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+10,0,Math.PI*2);ctx.strokeStyle="#b9efff";ctx.lineWidth=4;ctx.stroke(); }
  if (ball.poison > 0) { ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+7,0,Math.PI*2);ctx.strokeStyle="#8dff65";ctx.lineWidth=3;ctx.stroke(); }
  if (!preview) {
    ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+7,-Math.PI/2,-Math.PI/2+Math.PI*2*ball.health/100);ctx.strokeStyle=ball.health<30?"#ff5267":"#ffffffcc";ctx.lineWidth=3;ctx.stroke();
    ctx.textAlign="center";ctx.font="900 12px system-ui";ctx.fillStyle=ball.light;ctx.shadowColor="#000";ctx.shadowBlur=5;ctx.fillText(`${ball.name}${ball.team !== ball.id && state.mode === "2v2" ? " · TEAM " + (ball.team + 1) : ""}`,ball.x,ball.y+ball.radius+18);ctx.font="800 9px system-ui";ctx.fillStyle="#eaf6ffdd";ctx.fillText(ball.abilityName.toUpperCase(),ball.x,ball.y+ball.radius+30);ctx.shadowBlur=0;
  }
}

function drawMinions() {
  for (const m of state.minions) {
    ctx.save();ctx.shadowColor=m.color;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(m.x,m.y,m.radius+2,0,Math.PI*2);ctx.fillStyle=m.color;ctx.fill();ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(m.x,m.y,m.radius*.45,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
    ctx.restore();
    ctx.beginPath();ctx.arc(m.x,m.y,m.radius+6,0,Math.PI*2);ctx.strokeStyle="#d5caff88";ctx.lineWidth=2;ctx.stroke();
  }
}

function drawEffects(dt) {
  for (const e of state.effects) {
    e.life-=dt;const progress=1-e.life/e.maxLife;ctx.save();ctx.globalAlpha=Math.max(0,e.life/e.maxLife);ctx.shadowColor=e.color;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(e.x,e.y,8+e.size*progress,0,Math.PI*2);ctx.strokeStyle=e.color;ctx.lineWidth=Math.max(1,5*(1-progress));ctx.stroke();ctx.restore();
  }
  state.effects=state.effects.filter(e=>e.life>0);
  for (const p of state.particles) {p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;ctx.shadowBlur=0;state.particles=state.particles.filter(p=>p.life>0);
}

function drawMenuRoster() {
  fighters.forEach((fighter,i)=>{
    const x=130+(i%6)*148,y=i<6?205:410;
    const sample={...fighter,x,y,radius:18,angle=performance.now()/800+i,health:100,trail:[],shield:0,freeze:0,poison:0};
    drawBall(sample,true);
    if (fighter.summoner) { for(let k=0;k<3;k++){const a=performance.now()/500+k*Math.PI*2/3;ctx.beginPath();ctx.arc(x+Math.cos(a)*31,y+Math.sin(a)*31,4,0,Math.PI*2);ctx.fillStyle="#e1d7ff";ctx.fill();} }
    ctx.textAlign="center";ctx.font="900 10px system-ui";ctx.fillStyle=fighter.light;ctx.fillText(fighter.name,x,y+40);ctx.font="700 8px system-ui";ctx.fillStyle="#bed1ea";ctx.fillText(fighter.abilityName.toUpperCase(),x,y+52);
  });
}

function render(dt) {
  ctx.save();
  if (state.shake > .1 && state.playing) { ctx.translate(rand(-state.shake,state.shake),rand(-state.shake,state.shake));state.shake*=.84; }
  drawArena();
  if (state.playing) { state.players.forEach(p=>drawBall(p));drawMinions(); }
  else drawMenuRoster();
  drawEffects(dt);
  ctx.restore();
}

function finishMatch(winner) {
  if (!state.playing) return;
  state.playing=false;
  const message = winner ? `${winner.name} WINS!` : "DRAW!";
  banner.textContent=message;
  banner.classList.add("show");
  setTimeout(()=>banner.classList.remove("show"),1800);
  setTimeout(()=>menu.classList.remove("hidden"),900);
}

function loop(time) {
  const dt=Math.min((time-state.lastTime)/1000||.016,.033);state.lastTime=time;
  update(dt);render(dt);requestAnimationFrame(loop);
}

document.querySelectorAll(".mode-button").forEach(button=>button.addEventListener("click",()=>startMatch(button.dataset.mode)));
render(0);
requestAnimationFrame(loop);
