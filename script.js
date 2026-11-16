const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playButton = document.getElementById("playButton");
const menu = document.getElementById("menu");
const hud = document.getElementById("hud");

const roster = [
  { name: "Comet", color: "#5eead4", accent: "#7cf7ef", ability: "dash", abilityName: "Dash" },
  { name: "Frost", color: "#8ab4ff", accent: "#c9d8ff", ability: "freeze", abilityName: "Freeze" },
  { name: "Blaze", color: "#fbbf24", accent: "#ffd97f", ability: "pulse", abilityName: "Pulse" },
  { name: "Thorn", color: "#fb7185", accent: "#ffc3d1", ability: "shield", abilityName: "Shield" }
];

const state = {
  running: false,
  players: [],
  lastTime: 0,
  winner: null,
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeBall(fighter, x, y) {
  return {
    ...fighter,
    x,
    y,
    vx: rand(-150, 150),
    vy: rand(-120, 125),
    radius: 23,
    health: 100,
    attackCooldown: 0,
    abilityCooldown: rand(1.8, 3.2),
    orbitAngle: rand(0, Math.PI * 2),
    orbitSpeed: rand(2.6, 4.4),
    orbitDir: Math.random() < 0.5 ? -1 : 1,
    shieldTimer: 0,
    freezeTimer: 0,
    hitFlash: 0,
    trail: [],
  };
}

function resizeArenaPreview() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function getArenaCenter() {
  return { x: canvas.width / 2, y: canvas.height / 2 };
}

function applyDamage(target, amount) {
  if (target.shieldTimer > 0) {
    amount *= 0.35;
  }

  target.health = clamp(target.health - amount, 0, 100);
  target.hitFlash = 1;

  if (target.health <= 0) {
    endMatch();
  }
}

function triggerAbility(ball, target) {
  const dx = target.x - ball.x;
  const dy = target.y - ball.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  switch (ball.ability) {
    case "dash":
      ball.vx += nx * 260;
      ball.vy += ny * 260;
      break;
    case "freeze":
      if (dist < 240) {
        target.freezeTimer = 1.5;
        target.vx *= 0.7;
        target.vy *= 0.7;
      }
      break;
    case "pulse":
      if (dist < 210) {
        applyDamage(target, 18);
        target.vx += nx * 160;
        target.vy += ny * 160;
      }
      break;
    case "shield":
      ball.shieldTimer = 2.3;
      break;
    default:
      break;
  }
}

function endMatch() {
  state.running = false;
  state.winner = state.players[0]?.health > state.players[1]?.health ? state.players[0] : state.players[1];
  playButton.textContent = "Play Again";
  menu.classList.remove("hidden");
  menu.classList.add("visible");
}

function startMatch() {
  const chosen = shuffle(roster).slice(0, 2);
  const spawnLeft = { x: canvas.width * 0.32, y: canvas.height * 0.54 };
  const spawnRight = { x: canvas.width * 0.68, y: canvas.height * 0.46 };

  state.players = [
    makeBall(chosen[0], spawnLeft.x, spawnLeft.y),
    makeBall(chosen[1], spawnRight.x, spawnRight.y),
  ];

  state.players[0].vx = 160;
  state.players[0].vy = -40;
  state.players[1].vx = -160;
  state.players[1].vy = 50;

  state.running = true;
  state.winner = null;
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  updateHUD();
}

function updateHUD() {
  const [p1, p2] = state.players;
  const leftBar = document.querySelector(".health.left .health-fill");
  const rightBar = document.querySelector(".health.right .health-fill");

  if (!p1 || !p2) return;

  leftBar.style.width = `${p1.health}%`;
  rightBar.style.width = `${p2.health}%`;
}

function updatePlayers(dt) {
  if (!state.running || state.players.length < 2) return;

  const [a, b] = state.players;

  for (const ball of state.players) {
    ball.attackCooldown = Math.max(0, ball.attackCooldown - dt * 1000);
    ball.abilityCooldown -= dt;
    ball.hitFlash = Math.max(0, ball.hitFlash - dt * 3);
    ball.shieldTimer = Math.max(0, ball.shieldTimer - dt);
    ball.freezeTimer = Math.max(0, ball.freezeTimer - dt);

    const speedMod = ball.freezeTimer > 0 ? 0.25 : 1;
    ball.x += ball.vx * speedMod * dt;
    ball.y += ball.vy * speedMod * dt;

    const margin = ball.radius + 12;
    if (ball.x < margin) {
      ball.x = margin;
      ball.vx *= -1;
    }
    if (ball.x > canvas.width - margin) {
      ball.x = canvas.width - margin;
      ball.vx *= -1;
    }
    if (ball.y < margin) {
      ball.y = margin;
      ball.vy *= -1;
    }
    if (ball.y > canvas.height - margin) {
      ball.y = canvas.height - margin;
      ball.vy *= -1;
    }

    ball.orbitAngle += ball.orbitSpeed * ball.orbitDir * dt * 1.8;

    ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
    if (ball.trail.length > 12) ball.trail.shift();
    ball.trail.forEach((p) => {
      p.alpha -= 0.08;
    });

    ball.trail = ball.trail.filter((p) => p.alpha > 0.05);
  }

  if (a.abilityCooldown <= 0) {
    triggerAbility(a, b);
    a.abilityCooldown = rand(4.2, 6.4);
  }

  if (b.abilityCooldown <= 0) {
    triggerAbility(b, a);
    b.abilityCooldown = rand(4.2, 6.4);
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = a.radius + b.radius + 6;

  if (dist < minDist) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    a.x -= nx * (overlap * 0.5);
    a.y -= ny * (overlap * 0.5);
    b.x += nx * (overlap * 0.5);
    b.y += ny * (overlap * 0.5);

    const relVX = b.vx - a.vx;
    const relVY = b.vy - a.vy;
    const velAlongNormal = relVX * nx + relVY * ny;

    if (velAlongNormal < 0) {
      const impulse = -velAlongNormal * 0.18;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }

  for (const ball of state.players) {
    const other = ball === a ? b : a;
    const dx2 = other.x - ball.x;
    const dy2 = other.y - ball.y;
    const dist2 = Math.hypot(dx2, dy2) || 1;
    const angleToTarget = Math.atan2(dy2, dx2);
    const weaponRadius = ball.radius + 28;
    const ox = ball.x + Math.cos(ball.orbitAngle) * weaponRadius;
    const oy = ball.y + Math.sin(ball.orbitAngle) * weaponRadius;
    const targetAngle = Math.atan2(other.y - ball.y, other.x - ball.x);

    const diff = Math.abs(((angleToTarget - ball.orbitAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
    const readyToHit = dist2 < 140 && diff < 0.45 && ball.attackCooldown <= 0;

    if (readyToHit) {
      applyDamage(other, 12);
      ball.attackCooldown = 700;
      other.vx += (other.x < ball.x ? 1 : -1) * 110;
      other.vy += (other.y < ball.y ? 1 : -1) * 90;
    }
  }

  updateHUD();
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    90,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.75
  );
  glow.addColorStop(0, "rgba(118, 151, 255, 0.16)");
  glow.addColorStop(1, "rgba(10, 15, 22, 0.02)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.strokeStyle = "rgba(110, 231, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 150, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBall(ball) {
  for (const p of ball.trail) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${p.alpha * 0.14})`;
    ctx.arc(p.x, p.y, ball.radius * (0.35 + p.alpha * 0.9), 0, Math.PI * 2);
    ctx.fill();
  }

  const weaponRadius = ball.radius + 30;
  const ox = ball.x + Math.cos(ball.orbitAngle) * weaponRadius;
  const oy = ball.y + Math.sin(ball.orbitAngle) * weaponRadius;

  ctx.beginPath();
  ctx.strokeStyle = ball.hitFlash > 0 ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.moveTo(ball.x, ball.y);
  ctx.lineTo(ox, oy);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = ball.accent;
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + Math.cos(ball.orbitAngle + 0.28) * 14, oy + Math.sin(ball.orbitAngle + 0.28) * 14);
  ctx.lineTo(ox + Math.cos(ball.orbitAngle - 0.28) * 14, oy + Math.sin(ball.orbitAngle - 0.28) * 14);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = ball.color;
  ctx.shadowColor = ball.color;
  ctx.shadowBlur = 20;
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (ball.shieldTimer > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(133, 210, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.arc(ball.x, ball.y, ball.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.arc(ball.x, ball.y, ball.radius + 10, -Math.PI / 2, (Math.PI * 2 * ball.health) / 100 - Math.PI / 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(ball.name, ball.x, ball.y + ball.radius + 18);
}

function drawIdleRoster() {
  const preview = shuffle(roster);
  for (let i = 0; i < preview.length; i++) {
    const fighter = preview[i];
    const x = canvas.width * (0.2 + (i % 2) * 0.26);
    const y = canvas.height * (0.28 + Math.floor(i / 2) * 0.33);
    const orb = makeBall(fighter, x, y);
    orb.radius = 18;
    orb.orbitAngle = i * 1.3;
    drawBall(orb);
  }
}

function render() {
  drawArena();

  if (!state.running) {
    drawIdleRoster();
    return;
  }

  for (const ball of state.players) {
    drawBall(ball);
  }
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.033);
  state.lastTime = timestamp;

  updatePlayers(dt);
  render();
  requestAnimationFrame(gameLoop);
}

playButton.addEventListener("click", () => {
  startMatch();
});

window.addEventListener("resize", () => {
  // Keep match visible and centered on resize.
  if (!state.running) {
    render();
  }
});

render();
requestAnimationFrame(gameLoop);

