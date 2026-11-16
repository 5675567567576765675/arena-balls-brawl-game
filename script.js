const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playButton = document.getElementById("playButton");
const menu = document.getElementById("menu");
const hud = document.getElementById("hud");

// The combat area is inset from the canvas, giving the arena a tighter feel.
const ARENA = { left: 125, right: 875, top: 100, bottom: 520 };
const MAX_SPEED = 520;

const roster = [
  { name: "Comet", color: "#5eead4", accent: "#b1fff4", design: "star", weapon: "spear", ability: "dash", abilityName: "Dash" },
  { name: "Frost", color: "#8ab4ff", accent: "#d8efff", design: "crystal", weapon: "axe", ability: "freeze", abilityName: "Freeze" },
  { name: "Blaze", color: "#ff773e", accent: "#ffe083", design: "flame", weapon: "greatsword", ability: "pulse", abilityName: "Solar Burst" },
  { name: "Thorn", color: "#a7ed62", accent: "#e5ff9f", design: "flower", weapon: "scythe", ability: "shield", abilityName: "Bramble Guard" },
  { name: "Volt", color: "#ffe34a", accent: "#fff8bf", design: "gear", weapon: "mace", ability: "heal", abilityName: "Recharge" },
  { name: "Shade", color: "#bd78ff", accent: "#f0d7ff", design: "eye", weapon: "claw", ability: "blink", abilityName: "Shadow Step" },
  { name: "Orbit", color: "#ff65b5", accent: "#ffd6ec", design: "ring", weapon: "orb", ability: "gravity", abilityName: "Gravity Well" },
  { name: "Titan", color: "#ff5267", accent: "#ffd0a6", design: "hex", weapon: "hammer", ability: "meteor", abilityName: "Meteor Smash" }
];

const state = {
  running: false,
  players: [],
  effects: [],
  particles: [],
  lastTime: 0
};

const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeBall(fighter, x, y, direction) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(280, 370);
  return {
    ...fighter,
    x, y,
    vx: Math.cos(angle) * speed * direction,
    vy: Math.sin(angle) * speed,
    radius: 24,
    health: 100,
    angle: rand(0, Math.PI * 2),
    spin: rand(4.2, 6) * (Math.random() < 0.5 ? -1 : 1),
    attackCooldown: 0,
    abilityCooldown: rand(1.8, 3.2),
    shieldTimer: 0,
    freezeTimer: 0,
    hitFlash: 0,
    trail: []
  };
}

function startMatch() {
  const chosen = shuffle(roster).slice(0, 2);
  state.players = [
    makeBall(chosen[0], ARENA.left + 115, (ARENA.top + ARENA.bottom) / 2, 1),
    makeBall(chosen[1], ARENA.right - 115, (ARENA.top + ARENA.bottom) / 2, -1)
  ];
  state.players[0].vx = 330;
  state.players[0].vy = -140;
  state.players[1].vx = -330;
  state.players[1].vy = 140;
  state.effects = [];
  state.particles = [];
  state.running = true;
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  playButton.textContent = "Play Again";
  updateHUD();
}

function updateHUD() {
  const [a, b] = state.players;
  if (!a || !b) return;
  document.querySelector(".health.left .health-fill").style.width = `${a.health}%`;
  document.querySelector(".health.right .health-fill").style.width = `${b.health}%`;
}

function endMatch(winner) {
  if (!state.running) return;
  state.running = false;
  playButton.textContent = `${winner.name} Wins! — Play Again`;
  menu.classList.remove("hidden");
  hud.classList.add("hidden");
}

function addEffect(x, y, color, size, kind = "ring") {
  state.effects.push({ x, y, color, size, kind, life: 0.65, maxLife: 0.65 });
}

function burst(x, y, color, count = 14, force = 150) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(force * 0.3, force);
    state.particles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      color, life: rand(0.25, 0.65), maxLife: 0.65, size: rand(2, 5)
    });
  }
}

function applyDamage(target, amount) {
  if (!state.running) return;
  if (target.shieldTimer > 0) amount *= 0.3;
  target.health = clamp(target.health - amount, 0, 100);
  target.hitFlash = 0.22;
  burst(target.x, target.y, target.accent, 9, 110);
  if (target.health <= 0) endMatch(state.players.find(ball => ball !== target));
}

function triggerAbility(ball, target) {
  const dx = target.x - ball.x;
  const dy = target.y - ball.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;

  switch (ball.ability) {
    case "dash":
      ball.vx += nx * 340;
      ball.vy += ny * 340;
      addEffect(ball.x, ball.y, ball.color, 95);
      burst(ball.x, ball.y, ball.color, 18, 180);
      break;
    case "freeze":
      if (distance < 320) {
        target.freezeTimer = 1.5;
        addEffect(target.x, target.y, "#bdeeff", 135, "snow");
        burst(target.x, target.y, "#c9f3ff", 20, 130);
      }
      break;
    case "pulse":
      if (distance < 270) {
        applyDamage(target, 16);
        target.vx += nx * 230;
        target.vy += ny * 230;
      }
      addEffect(ball.x, ball.y, ball.color, 190);
      burst(ball.x, ball.y, ball.accent, 24, 200);
      break;
    case "shield":
      ball.shieldTimer = 2.8;
      addEffect(ball.x, ball.y, ball.color, 100);
      burst(ball.x, ball.y, ball.accent, 16, 120);
      break;
    case "heal":
      ball.health = clamp(ball.health + 17, 0, 100);
      addEffect(ball.x, ball.y, ball.color, 100, "plus");
      burst(ball.x, ball.y, ball.accent, 18, 120);
      break;
    case "blink": {
      const oldX = ball.x;
      const oldY = ball.y;
      ball.x = clamp(target.x - nx * 105, ARENA.left + ball.radius, ARENA.right - ball.radius);
      ball.y = clamp(target.y - ny * 105, ARENA.top + ball.radius, ARENA.bottom - ball.radius);
      addEffect(oldX, oldY, ball.color, 85);
      addEffect(ball.x, ball.y, ball.color, 85);
      burst(oldX, oldY, ball.color, 14, 130);
      burst(ball.x, ball.y, ball.color, 14, 130);
      break;
    }
    case "gravity":
      if (distance < 420) {
        target.vx -= nx * 300;
        target.vy -= ny * 300;
        addEffect(target.x, target.y, ball.color, 120);
      }
      addEffect(ball.x, ball.y, ball.color, 165);
      break;
    case "meteor":
      if (distance < 315) {
        applyDamage(target, 20);
        target.vx += nx * 300;
        target.vy += ny * 300;
      }
      addEffect(ball.x, ball.y, ball.color, 220);
      burst(ball.x, ball.y, ball.accent, 26, 220);
      break;
  }
}

function keepSpeed(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    ball.vx = ball.vx / speed * MAX_SPEED;
    ball.vy = ball.vy / speed * MAX_SPEED;
  } else if (speed < 230) {
    const angle = Math.atan2(ball.vy, ball.vx);
    ball.vx = Math.cos(angle) * 230;
    ball.vy = Math.sin(angle) * 230;
  }
}

function updatePlayers(dt) {
  if (!state.running || state.players.length < 2) return;
  const [a, b] = state.players;

  for (const ball of state.players) {
    ball.attackCooldown = Math.max(0, ball.attackCooldown - dt);
    ball.abilityCooldown -= dt;
    ball.hitFlash = Math.max(0, ball.hitFlash - dt);
    ball.shieldTimer = Math.max(0, ball.shieldTimer - dt);
    ball.freezeTimer = Math.max(0, ball.freezeTimer - dt);

    const slowed = ball.freezeTimer > 0 ? 0.28 : 1;
    ball.x += ball.vx * slowed * dt;
    ball.y += ball.vy * slowed * dt;
    ball.angle += ball.spin * dt;

    const padding = ball.radius + 10;
    if (ball.x < ARENA.left + padding) {
      ball.x = ARENA.left + padding;
      ball.vx = Math.abs(ball.vx) * 1.04;
    } else if (ball.x > ARENA.right - padding) {
      ball.x = ARENA.right - padding;
      ball.vx = -Math.abs(ball.vx) * 1.04;
    }
    if (ball.y < ARENA.top + padding) {
      ball.y = ARENA.top + padding;
      ball.vy = Math.abs(ball.vy) * 1.04;
    } else if (ball.y > ARENA.bottom - padding) {
      ball.y = ARENA.bottom - padding;
      ball.vy = -Math.abs(ball.vy) * 1.04;
    }

    keepSpeed(ball);
    ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
    if (ball.trail.length > 10) ball.trail.shift();
    ball.trail.forEach(p => p.alpha -= 0.1);
    ball.trail = ball.trail.filter(p => p.alpha > 0.05);
  }

  if (a.abilityCooldown <= 0) {
    triggerAbility(a, b);
    a.abilityCooldown = rand(4.5, 6.2);
  }
  if (state.running && b.abilityCooldown <= 0) {
    triggerAbility(b, a);
    b.abilityCooldown = rand(4.5, 6.2);
  }
  if (!state.running) return;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const minDistance = a.radius + b.radius;

  if (distance < minDistance) {
    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minDistance - distance;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relative < 0) {
      const impulse = -relative * 0.85;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }

  const weaponDamage = { spear: 13, axe: 15, greatsword: 16, scythe: 12, mace: 14, claw: 11, orb: 12, hammer: 17 };
  for (const ball of state.players) {
    const target = ball === a ? b : a;
    const targetAngle = Math.atan2(target.y - ball.y, target.x - ball.x);
    const difference = Math.atan2(Math.sin(targetAngle - ball.angle), Math.cos(targetAngle - ball.angle));
    const range = Math.hypot(target.x - ball.x, target.y - ball.y);
    if (range < 142 && Math.abs(difference) < 0.48 && ball.attackCooldown <= 0) {
      applyDamage(target, weaponDamage[ball.weapon] || 12);
      ball.attackCooldown = 0.55;
      const nx = (target.x - ball.x) / (range || 1);
      const ny = (target.y - ball.y) / (range || 1);
      target.vx += nx * 160;
      target.vy += ny * 160;
    }
  }
  updateHUD();
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(WIDTH() / 2, HEIGHT() / 2, 20, WIDTH() / 2, HEIGHT() / 2, 500);
  glow.addColorStop(0, "rgba(83, 123, 220, 0.17)");
  glow.addColorStop(1, "rgba(5, 10, 20, 0.03)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Main outer frame and clearly smaller combat boundary.
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.fillStyle = "rgba(20, 35, 65, 0.18)";
  ctx.fillRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top);
  ctx.strokeStyle = "rgba(110, 231, 255, 0.65)";
  ctx.lineWidth = 4;
  ctx.strokeRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top);
  ctx.strokeStyle = "rgba(110, 231, 255, 0.11)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 100, 0, Math.PI * 2);
  ctx.stroke();

  if (state.running) {
    drawHealthBar(35, 35, 300, state.players[0], false);
    drawHealthBar(canvas.width - 335, 35, 300, state.players[1], true);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "900 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VS", canvas.width / 2, 52);
  }
}

function WIDTH() { return canvas.width; }
function HEIGHT() { return canvas.height; }

function drawHealthBar(x, y, width, ball, flip) {
  ctx.textAlign = flip ? "right" : "left";
  ctx.fillStyle = ball.accent;
  ctx.font = "bold 14px Arial";
  ctx.fillText(ball.name, flip ? x + width : x, y - 8);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath(); ctx.roundRect(x, y, width, 14, 7); ctx.fill();
  const fillWidth = width * ball.health / 100;
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, ball.color);
  gradient.addColorStop(1, ball.accent);
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.roundRect(flip ? x + width - fillWidth : x, y, fillWidth, 14, 7); ctx.fill();
}

function drawPoly(points, fill, stroke = "#ffffffaa", lineWidth = 2) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function drawFighterCore(ball) {
  const r = ball.radius;
  ctx.save();
  ctx.shadowColor = ball.color;
  ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.fillStyle = ball.color; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(ball.x, ball.y);
  const star = (outer, inner, count) => {
    const points = [];
    for (let i = 0; i < count * 2; i++) {
      const rad = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + i * Math.PI / count;
      points.push([Math.cos(angle) * rad, Math.sin(angle) * rad]);
    }
    return points;
  };
  switch (ball.design) {
    case "star": drawPoly(star(r * .85, r * .5, 5), ball.accent, null); break;
    case "crystal": drawPoly([[0,-r*.9],[r*.65,-r*.3],[r*.48,r*.65],[0,r*.9],[-r*.48,r*.65],[-r*.65,-r*.3]], ball.accent, null); break;
    case "flame": drawPoly([[0,-r*.95],[r*.55,-r*.3],[r*.68,r*.42],[0,r*.85],[-r*.65,r*.4],[-r*.45,-r*.3]], ball.accent, null); break;
    case "flower":
      for (let i=0;i<6;i++) { const a=i*Math.PI/3; ctx.beginPath(); ctx.ellipse(Math.cos(a)*r*.35,Math.sin(a)*r*.35,r*.34,r*.19,a,0,Math.PI*2); ctx.fillStyle=ball.accent; ctx.fill(); }
      ctx.beginPath(); ctx.arc(0,0,r*.23,0,Math.PI*2); ctx.fillStyle="#568631"; ctx.fill(); break;
    case "gear": drawPoly(star(r*.88,r*.68,8),ball.accent,null); ctx.beginPath();ctx.arc(0,0,r*.34,0,Math.PI*2);ctx.fillStyle="#d99a18";ctx.fill();ctx.beginPath();ctx.arc(0,0,r*.12,0,Math.PI*2);ctx.fillStyle="#fff4a8";ctx.fill();break;
    case "eye": ctx.beginPath();ctx.ellipse(0,0,r*.87,r*.55,0,0,Math.PI*2);ctx.fillStyle=ball.accent;ctx.fill();ctx.beginPath();ctx.arc(0,0,r*.3,0,Math.PI*2);ctx.fillStyle="#622e99";ctx.fill();ctx.beginPath();ctx.arc(0,0,r*.12,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();break;
    case "ring": ctx.beginPath();ctx.arc(0,0,r*.67,0,Math.PI*2);ctx.strokeStyle=ball.accent;ctx.lineWidth=r*.25;ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.22,0,Math.PI*2);ctx.fillStyle="#a52b73";ctx.fill();break;
    default: drawPoly([[0,-r*.8],[r*.7,-r*.4],[r*.7,r*.4],[0,r*.8],[-r*.7,r*.4],[-r*.7,-r*.4]],ball.accent,null);drawPoly([[0,-r*.4],[r*.35,0],[0,r*.4],[-r*.35,0]],"#d83e51",null);
  }
  ctx.restore();
  ctx.beginPath();ctx.ellipse(ball.x-r*.28,ball.y-r*.35,r*.22,r*.1,-.6,0,Math.PI*2);ctx.fillStyle="#ffffff75";ctx.fill();
}

function drawWeapon(ball) {
  const orbit = ball.radius + 29;
  const wx = ball.x + Math.cos(ball.angle) * orbit;
  const wy = ball.y + Math.sin(ball.angle) * orbit;
  ctx.save(); ctx.translate(wx, wy); ctx.rotate(ball.angle + Math.PI / 2);
  const metal = "#f2fbff", dark = "#29374d", glow = ball.accent;
  ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ball.radius + 4); ctx.lineTo(0, 4); ctx.stroke();
  if (ball.weapon === "spear") { ctx.fillStyle=dark;ctx.fillRect(-3,-2,6,25);drawPoly([[-3,-2],[0,-25],[3,-2]],glow,metal,1); }
  else if (ball.weapon === "axe") { ctx.fillStyle=dark;ctx.fillRect(-3,-4,6,27);drawPoly([[-3,-7],[-18,-20],[-22,-7],[-12,2],[-3,0]],glow,metal,2); }
  else if (ball.weapon === "greatsword") { drawPoly([[-5,4],[-7,-10],[-4,-27],[0,-35],[4,-27],[7,-10],[5,4]],glow,metal,2);ctx.fillStyle="#63351f";ctx.fillRect(-8,2,16,5);ctx.fillRect(-3,7,6,12); }
  else if (ball.weapon === "scythe") { ctx.strokeStyle=dark;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(0,-23);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-18);ctx.quadraticCurveTo(20,-32,22,-9);ctx.quadraticCurveTo(11,-18,2,-10);ctx.closePath();ctx.fillStyle=glow;ctx.fill();ctx.strokeStyle=metal;ctx.stroke(); }
  else if (ball.weapon === "mace") { ctx.strokeStyle=dark;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(0,-15);ctx.stroke();ctx.beginPath();ctx.arc(0,-20,10,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();ctx.strokeStyle=metal;ctx.lineWidth=2;ctx.stroke(); }
  else if (ball.weapon === "claw") { for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*7,8);ctx.quadraticCurveTo(i*11,-8,i*8,-24);ctx.strokeStyle=glow;ctx.lineWidth=5;ctx.lineCap="round";ctx.stroke();ctx.strokeStyle=metal;ctx.lineWidth=1;ctx.stroke();} }
  else if (ball.weapon === "orb") { ctx.beginPath();ctx.ellipse(0,-13,13,6,-.4,0,Math.PI*2);ctx.strokeStyle=glow;ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(0,-13,7,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();ctx.beginPath();ctx.arc(-2,-16,2,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill(); }
  else { ctx.fillStyle=dark;ctx.fillRect(-3,-5,6,25);ctx.fillStyle="#ff5267";ctx.fillRect(-12,-6,24,7);drawPoly([[-12,-7],[-14,-18],[-7,-15],[-3,-24],[0,-15],[7,-24],[9,-14],[14,-18],[12,-6]],glow,metal,2); }
  ctx.restore();
}

function drawBall(ball, preview = false) {
  for (const p of ball.trail || []) {
    ctx.globalAlpha = p.alpha * 0.24; ctx.beginPath();ctx.arc(p.x,p.y,ball.radius*.65,0,Math.PI*2);ctx.fillStyle=ball.color;ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawWeapon(ball);
  drawFighterCore(ball);
  if (ball.shieldTimer > 0) { ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+12,0,Math.PI*2);ctx.strokeStyle="#caff91dd";ctx.lineWidth=4;ctx.stroke(); }
  if (ball.freezeTimer > 0) { ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+9,0,Math.PI*2);ctx.strokeStyle="#b9edffdd";ctx.lineWidth=4;ctx.stroke(); }
  ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+7,-Math.PI/2,-Math.PI/2+Math.PI*2*ball.health/100);ctx.strokeStyle="#ffffffaa";ctx.lineWidth=3;ctx.stroke();
  if (!preview) {
    ctx.textAlign="center";ctx.font="900 13px Arial";ctx.fillStyle="#fff";ctx.shadowColor="#000";ctx.shadowBlur=5;ctx.fillText(ball.name,ball.x,ball.y+ball.radius+20);ctx.font="bold 10px Arial";ctx.fillStyle=ball.accent;ctx.fillText(ball.abilityName.toUpperCase(),ball.x,ball.y+ball.radius+33);ctx.shadowBlur=0;
  }
}

function drawIdleRoster() {
  roster.forEach((fighter, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 145 + col * 237, y = row === 0 ? 210 : 420;
    const preview = { ...fighter, x, y, radius: 19, angle: performance.now() / 900 + i, health: 100, trail: [], shieldTimer: 0, freezeTimer: 0 };
    drawBall(preview, true);
    ctx.textAlign="center";ctx.font="bold 12px Arial";ctx.fillStyle=fighter.accent;ctx.fillText(`${fighter.name} · ${fighter.abilityName}`,x,y+45);
  });
}

function drawEffects(dt) {
  for (const effect of state.effects) {
    effect.life -= dt;
    const progress = 1 - effect.life / effect.maxLife;
    ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
    ctx.beginPath();ctx.arc(effect.x,effect.y,8+effect.size*progress,0,Math.PI*2);ctx.strokeStyle=effect.color;ctx.lineWidth=4;ctx.stroke();
  }
  ctx.globalAlpha = 1;
  state.effects = state.effects.filter(effect => effect.life > 0);
  for (const p of state.particles) {
    p.life -= dt;p.x += p.vx*dt;p.y += p.vy*dt;p.vx *= .97;p.vy *= .97;
    ctx.globalAlpha = Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha = 1;
  state.particles = state.particles.filter(p => p.life > 0);
}

function render(dt = 0) {
  drawArena();
  if (state.running) state.players.forEach(ball => drawBall(ball));
  else drawIdleRoster();
  drawEffects(dt);
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.033);
  state.lastTime = timestamp;
  updatePlayers(dt);
  render(dt);
  requestAnimationFrame(gameLoop);
}

playButton.addEventListener("click", startMatch);
render();
requestAnimationFrame(gameLoop);
