// =============================================================================
//  SPACE FIGHTER — game.js
//  Supports: Single Player & VS Mode (2 players)
// =============================================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W      = canvas.width;
const H      = canvas.height;

// =============================================================================
//  GAME STATE
// =============================================================================
let gameRunning      = false;
let gameMode         = 'single';   // 'single' | 'vs'
let wave             = 1;
let stage            = 1;          // increments every time boss is defeated
let stageClearTimer  = 0;          // countdown for stage clear screen
let waveTimer        = 0;
let lastTime         = 0;
let powerupSpawnTimer = 10;

let bullets      = [];   // all player bullets (carry .owner = p1|p2)
let enemyBullets = [];
let enemies      = [];
let particles    = [];
let stars        = [];
let powerups     = [];
let keys         = {};

// =============================================================================
//  DIFFICULTY SYSTEM
//  All gameplay numbers are driven by this config.
//  Easy   — forgiving, fewer enemies, slow bullets, frequent powerups
//  Medium — balanced (original feel)
//  Hard   — more enemies, tankier, faster bullets, rare powerups
// =============================================================================
let difficulty = 'medium';   // 'easy' | 'medium' | 'hard'

const DIFF = {
  easy: {
    label:           'EASY',
    color:           '#00ff88',
    enemyCount:      (w) => 2 + w * 1,
    enemyHpMult:     0.6,
    enemySpeedMult:  0.7,
    bulletSpeed:     200,
    shootInterval:   2.2,
    powerupInterval: 10,
    bossHpMult:      0.6,
    kamikazeWave:    4,
  },
  medium: {
    label:           'MEDIUM',
    color:           '#ffee00',
    enemyCount:      (w) => 3 + w * 2,
    enemyHpMult:     1.0,
    enemySpeedMult:  1.0,
    bulletSpeed:     280,
    shootInterval:   1.5,
    powerupInterval: 15,
    bossHpMult:      1.0,
    kamikazeWave:    3,
  },
  hard: {
    label:           'HARD',
    color:           '#ff4466',
    enemyCount:      (w) => 5 + w * 3,
    enemyHpMult:     1.5,
    enemySpeedMult:  1.4,
    bulletSpeed:     380,
    shootInterval:   0.9,
    powerupInterval: 25,
    bossHpMult:      1.6,
    kamikazeWave:    2,
  },
};

// Always returns current difficulty config
function D() { return DIFF[difficulty]; }

// =============================================================================
//  PLAYER FACTORY
//  Each player is a self-contained object with its own stats & timers
// =============================================================================
function createPlayer(id) {
  const isP1 = id === 1;
  return {
    id,
    x:    isP1 ? W * 0.25 : W * 0.75,
    y:    H / 2,
    vx: 0, vy: 0,
    speed: 220,
    hp: 100, maxHp: 100,
    radius: 18,
    angle: isP1 ? 0 : Math.PI,
    invincible: 0,
    shootInterval: 0.18,
    shootCooldown: 0,
    thrusterAnim: 0,
    alive: true,
    score: 0,
    // Powerup timers — each player has their own
    shieldTimer: 0,
    speedTimer:  0,
    rapidTimer:  0,
    omniTimer:   0,
    // Visuals
    color:      isP1 ? '#00ffcc' : '#cc44ff',
    glowColor:  isP1 ? '#00ffcc' : '#cc44ff',
    bulletColor:isP1 ? '#00ffcc' : '#cc44ff',
    label:      isP1 ? 'P1' : 'P2',
  };
}

let p1, p2;   // the two player objects (p2 is null in single player)

function getAlivePlayers() {
  const list = [p1];
  if (p2) list.push(p2);
  return list.filter(p => p.alive);
}

// =============================================================================
//  STARS
// =============================================================================
function initStars() {
  stars = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.6 + 0.2,
      speed: Math.random() * 0.6 + 0.1,
      alpha: Math.random() * 0.7 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
}

// =============================================================================
//  BULLETS
// =============================================================================
function spawnPlayerBullet(player, angle) {
  const speed = 500;
  bullets.push({
    x: player.x, y: player.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    owner: player,
    color: player.bulletColor,
    life: 1.5, radius: 4,
  });
  bullets.push({
    x: player.x, y: player.y,
    vx: Math.cos(angle + 0.08) * speed,
    vy: Math.sin(angle + 0.08) * speed,
    owner: player,
    color: player.bulletColor,
    life: 1.5, radius: 4,
  });
  bullets.push({
    x: player.x, y: player.y,
    vx: Math.cos(angle - 0.08) * speed,
    vy: Math.sin(angle - 0.08) * speed,
    owner: player,
    color: player.bulletColor,
    life: 1.5, radius: 4,
  });
}

function spawnEnemyBullet(x, y, angle) {
  const spd = D().bulletSpeed;
  enemyBullets.push({
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    life: 2, radius: 3,
  });
}

// =============================================================================
//  PARTICLES
// =============================================================================
function spawnExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 160 + 30;
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: Math.random() * 0.8 + 0.3, maxLife: 1,
      r: Math.random() * 4 + 1, color,
    });
  }
}

// =============================================================================
//  ENEMIES — spawn wave
//  In VS mode enemies target the NEAREST alive player
// =============================================================================
function spawnWave(waveNum) {
  // Every 5th wave is a BOSS wave — no regular enemies
  if (waveNum % 5 === 0) {
    spawnBoss(waveNum);
    return;
  }

  const d     = D();
  const count = d.enemyCount(waveNum);

  for (let i = 0; i < count; i++) {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if      (side === 0) { x = Math.random() * W; y = -40; }
    else if (side === 1) { x = W + 40;             y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H + 40; }
    else                 { x = -40;                y = Math.random() * H; }

    const type = (waveNum >= d.kamikazeWave && Math.random() < 0.3)
      ? 'kamikaze'
      : (Math.random() < 0.5 ? 'patrol' : 'chaser');

    const baseHp = type === 'kamikaze' ? 30 : (type === 'chaser' ? 50 : 40);
    const hp     = Math.round(baseHp * d.enemyHpMult);

    enemies.push({
      x, y, vx: 0, vy: 0,
      hp, maxHp: hp,
      radius: type === 'kamikaze' ? 14 : 18,
      type, state: 'patrol',
      angle: Math.random() * Math.PI * 2,
      shootTimer:   Math.random() * 2,
      patrolAngle:  Math.random() * Math.PI * 2,
      patrolRadius: 60 + Math.random() * 80,
      patrolCenter: { x: Math.random() * W, y: Math.random() * H },
      alertRadius: 200,
      anim: Math.random() * Math.PI * 2,
    });
  }
}

// =============================================================================
//  BOSS — spawns every wave divisible by 5
//
//  Boss FSM has 3 PHASES based on remaining HP:
//  ┌─────────┬───────────────────────────────────────────────────────────────┐
//  │ Phase 1 │ HP > 66%  — slow orbit + single aimed shots                  │
//  │ Phase 2 │ HP 33-66% — faster orbit + spread shots (3 bullets)          │
//  │ Phase 3 │ HP < 33%  — charges player + rapid spread shots (5 bullets)  │
//  └─────────┴───────────────────────────────────────────────────────────────┘
// =============================================================================
let boss = null;

function spawnBoss(waveNum) {
  const hp = Math.round((400 + waveNum * 80) * D().bossHpMult);
  boss = {
    x: W / 2, y: -60,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    radius: 38,
    angle: 0,
    anim: 0,
    shootTimer: 0,
    phase: 1,          // 1 | 2 | 3
    orbitAngle: 0,
    orbitSpeed: 0.6,
    type: 'boss',
  };
  showAnnounce('⚠ BOSS INCOMING ⚠');
  document.getElementById('bossBar').style.display = 'block';
}

function updateBoss(dt) {
  if (!boss) return;
  const target = getNearestPlayer(boss.x, boss.y);
  if (!target) return;

  boss.anim += dt * 2;

  // ── Phase transition based on HP ──────────────────────────────────────────
  const hpPct = boss.hp / boss.maxHp;
  const prevPhase = boss.phase;
  if      (hpPct > 0.66) boss.phase = 1;
  else if (hpPct > 0.33) boss.phase = 2;
  else                   boss.phase = 3;

  if (boss.phase !== prevPhase) {
    showAnnounce(`BOSS PHASE ${boss.phase}!`);
    sfxBossPhase();
    spawnExplosion(boss.x, boss.y, '#ff0044', 30);
  }

  // ── Movement per phase ────────────────────────────────────────────────────
  if (boss.phase === 1) {
    // Orbit center of screen slowly
    boss.orbitAngle += dt * boss.orbitSpeed;
    const tx = W / 2 + Math.cos(boss.orbitAngle) * 180;
    const ty = H / 2 + Math.sin(boss.orbitAngle) * 120;
    boss.vx += (tx - boss.x) * dt * 2;
    boss.vy += (ty - boss.y) * dt * 2;
    boss.vx *= 0.92; boss.vy *= 0.92;

  } else if (boss.phase === 2) {
    // Faster orbit, tighter
    boss.orbitAngle += dt * 1.2;
    const tx = W / 2 + Math.cos(boss.orbitAngle) * 220;
    const ty = H / 2 + Math.sin(boss.orbitAngle) * 150;
    boss.vx += (tx - boss.x) * dt * 3;
    boss.vy += (ty - boss.y) * dt * 3;
    boss.vx *= 0.88; boss.vy *= 0.88;

  } else {
    // Phase 3: charge directly at player
    const atp = Math.atan2(target.y - boss.y, target.x - boss.x);
    boss.vx += Math.cos(atp) * 280 * dt;
    boss.vy += Math.sin(atp) * 280 * dt;
    boss.vx *= 0.94; boss.vy *= 0.94;
  }

  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  boss.x = Math.max(boss.radius, Math.min(W - boss.radius, boss.x));
  boss.y = Math.max(boss.radius, Math.min(H - boss.radius, boss.y));

  boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x);

  // ── Shooting per phase ────────────────────────────────────────────────────
  boss.shootTimer -= dt;
  const shootInterval = boss.phase === 1 ? 1.4 : boss.phase === 2 ? 0.9 : 0.5;

  if (boss.shootTimer <= 0) {
    const atp = Math.atan2(target.y - boss.y, target.x - boss.x);
    const spread = boss.phase === 1 ? [0]
                 : boss.phase === 2 ? [-0.25, 0, 0.25]
                 : [-0.4, -0.2, 0, 0.2, 0.4];
    for (const offset of spread) {
      spawnEnemyBullet(boss.x, boss.y, atp + offset);
    }
    boss.shootTimer = shootInterval;
  }

  // ── Collision: boss body vs players ───────────────────────────────────────
  for (const p of getAlivePlayers()) {
    if (p.invincible <= 0 && p.shieldTimer <= 0) {
      const d = Math.hypot(boss.x - p.x, boss.y - p.y);
      if (d < boss.radius + p.radius) {
        p.hp -= 40; p.invincible = 1.8;
        spawnExplosion(p.x, p.y, '#ff0044', 15);
        if (p.hp <= 0) killPlayer(p);
        updateHUD();
      }
    }
  }

  // ── Update boss HP bar ────────────────────────────────────────────────────
  const fill = document.getElementById('bossFill');
  const phaseLbl = document.getElementById('bossPhase');
  fill.style.width = (boss.hp / boss.maxHp * 100) + '%';
  fill.style.background =
    boss.phase === 1 ? 'linear-gradient(90deg,#ff4400,#ff2200)' :
    boss.phase === 2 ? 'linear-gradient(90deg,#ff0066,#cc0044)' :
                       'linear-gradient(90deg,#ff00ff,#cc00cc)';
  phaseLbl.textContent = `PHASE ${boss.phase}`;
}

function drawBoss() {
  if (!boss) return;
  ctx.save();
  ctx.translate(boss.x, boss.y);

  const pulse = 1 + 0.06 * Math.sin(boss.anim * 4);
  const col   = boss.phase === 1 ? '#ff4400'
              : boss.phase === 2 ? '#ff0066'
              : '#ff00ff';

  ctx.shadowColor = col;
  ctx.shadowBlur  = 30;

  // Outer rotating ring
  ctx.save();
  ctx.rotate(boss.anim * 0.4);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = boss.radius * pulse + 14;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4, 0, Math.PI * 2);
    ctx.fillStyle = col + 'cc';
    ctx.fill();
  }
  ctx.restore();

  // Inner ring
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth   = 3;
  ctx.stroke();

  // Body — 8-point star
  ctx.rotate(boss.anim * 0.2);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? boss.radius * pulse : boss.radius * pulse * 0.5;
    i === 0
      ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle   = '#0a0011';
  ctx.strokeStyle = col;
  ctx.lineWidth   = 2;
  ctx.fill();
  ctx.stroke();

  // Core glow
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, boss.radius * 0.5);
  cg.addColorStop(0, col + 'aa');
  cg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();

  ctx.restore();
}

// =============================================================================
//  ENEMY AI — FSM
//  Targets the nearest alive player (works for both 1P and 2P)
// =============================================================================
function getNearestPlayer(ex, ey) {
  let best = null, bestDist = Infinity;
  for (const p of getAlivePlayers()) {
    const d = Math.hypot(p.x - ex, p.y - ey);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

function updateEnemy(e, dt) {
  const target = getNearestPlayer(e.x, e.y);
  if (!target) return;

  const dx   = target.x - e.x;
  const dy   = target.y - e.y;
  const dist = Math.hypot(dx, dy);
  const atp  = Math.atan2(dy, dx);
  e.anim += dt * 2;

  // ── KAMIKAZE ────────────────────────────────────────────────────────────────
  if (e.type === 'kamikaze') {
    const spd = (160 + wave * 10) * D().enemySpeedMult;
    e.vx += (Math.cos(atp) * spd - e.vx) * dt * 4;
    e.vy += (Math.sin(atp) * spd - e.vy) * dt * 4;
    e.angle = atp;

  // ── PATROL ──────────────────────────────────────────────────────────────────
  } else if (e.type === 'patrol') {
    if (dist < e.alertRadius)       e.state = 'attack';
    if (dist > e.alertRadius * 1.5) e.state = 'patrol';

    if (e.state === 'patrol') {
      e.patrolAngle += dt * 0.8;
      const tx = e.patrolCenter.x + Math.cos(e.patrolAngle) * e.patrolRadius;
      const ty = e.patrolCenter.y + Math.sin(e.patrolAngle) * e.patrolRadius;
      const pa = Math.atan2(ty - e.y, tx - e.x);
      e.vx += (Math.cos(pa) * 90 * D().enemySpeedMult - e.vx) * dt * 3;
      e.vy += (Math.sin(pa) * 90 * D().enemySpeedMult - e.vy) * dt * 3;
      e.angle = pa;
    } else {
      const spd = (dist < 200 ? -80 : 100) * D().enemySpeedMult;
      e.vx += (Math.cos(atp) * spd - e.vx) * dt * 2;
      e.vy += (Math.sin(atp) * spd - e.vy) * dt * 2;
      e.angle = atp;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        spawnEnemyBullet(e.x, e.y, atp + (Math.random() - 0.5) * 0.25);
        e.shootTimer = D().shootInterval + Math.random() * 0.5;
      }
    }

  // ── CHASER ──────────────────────────────────────────────────────────────────
  } else if (e.type === 'chaser') {
    const spd = (dist < 120 ? 40 : 150 + wave * 8) * D().enemySpeedMult;
    e.vx += (Math.cos(atp) * spd - e.vx) * dt * 3;
    e.vy += (Math.sin(atp) * spd - e.vy) * dt * 3;
    e.angle = atp;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 350) {
      spawnEnemyBullet(e.x, e.y, atp + (Math.random() - 0.5) * 0.15);
      e.shootTimer = D().shootInterval * 0.6 + Math.random() * 0.4;
    }
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

// =============================================================================
//  SOUND ENGINE — Web Audio API (no external files needed)
//  All sounds are synthesized procedurally
// =============================================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let musicGain = null;
let sfxGain   = null;
let musicNodes = [];
let soundEnabled = true;

function initAudio() {
  if (audioCtx) return;
  audioCtx  = new AudioCtx();
  // Master SFX gain
  sfxGain   = audioCtx.createGain(); sfxGain.gain.value = 0.35;
  sfxGain.connect(audioCtx.destination);
  // Master music gain
  musicGain = audioCtx.createGain(); musicGain.gain.value = 0.18;
  musicGain.connect(audioCtx.destination);
}

function playTone(freq, type, duration, gainVal, startTime) {
  if (!audioCtx || !soundEnabled) return;
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(sfxGain);
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(gainVal, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Shoot SFX — short high blip
function sfxShoot() {
  if (!audioCtx || !soundEnabled) return;
  const t = audioCtx.currentTime;
  playTone(880, 'square', 0.08, 0.3, t);
  playTone(660, 'square', 0.06, 0.2, t + 0.02);
}

// Omni shoot SFX — wider, fuller sound
function sfxOmniShoot() {
  if (!audioCtx || !soundEnabled) return;
  const t = audioCtx.currentTime;
  playTone(440, 'sawtooth', 0.12, 0.4, t);
  playTone(880, 'square',   0.10, 0.3, t);
  playTone(220, 'sawtooth', 0.10, 0.3, t + 0.03);
}

// Explosion SFX — noise burst
function sfxExplosion(big) {
  if (!audioCtx || !soundEnabled) return;
  const t    = audioCtx.currentTime;
  const buf  = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
  const src  = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  src.buffer  = buf;
  filt.type   = 'lowpass';
  filt.frequency.value = big ? 600 : 300;
  src.connect(filt); filt.connect(gain); gain.connect(sfxGain);
  gain.gain.setValueAtTime(big ? 1.0 : 0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.6 : 0.25));
  src.start(t); src.stop(t + 0.6);
}

// Powerup collect SFX — ascending arpeggio
function sfxPowerup() {
  if (!audioCtx || !soundEnabled) return;
  const t = audioCtx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'sine', 0.15, 0.4, t + i * 0.07));
}

// Player hit SFX
function sfxHit() {
  if (!audioCtx || !soundEnabled) return;
  const t = audioCtx.currentTime;
  playTone(180, 'sawtooth', 0.18, 0.5, t);
  playTone(120, 'square',   0.15, 0.4, t + 0.05);
}

// Boss phase change SFX
function sfxBossPhase() {
  if (!audioCtx || !soundEnabled) return;
  const t = audioCtx.currentTime;
  [200, 150, 100, 80].forEach((f, i) => playTone(f, 'sawtooth', 0.2, 0.6, t + i * 0.1));
}

// Wave start SFX
function sfxWaveStart() {
  if (!audioCtx || !soundEnabled) return;
  const t = audioCtx.currentTime;
  [330, 440, 550, 660].forEach((f, i) => playTone(f, 'square', 0.12, 0.35, t + i * 0.08));
}

// =============================================================================
//  BACKGROUND MUSIC — procedural chiptune loop
// =============================================================================
const MELODY = [220,0,262,0,294,0,330,262,0,220,0,196,0,220,0,0];
const BASS   = [55,0,55,0,65,0,65,0,73,0,73,0,65,0,65,0];
let musicStep = 0, musicTimer = 0;
const BEAT = 0.14;  // seconds per note

function tickMusic(dt) {
  if (!audioCtx || !soundEnabled || !gameRunning) return;
  musicTimer -= dt;
  if (musicTimer > 0) return;
  musicTimer = BEAT;
  const idx = musicStep % MELODY.length;

  // Melody
  if (MELODY[idx]) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(musicGain);
    osc.type = 'square';
    osc.frequency.value = MELODY[idx];
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + BEAT * 0.9);
    osc.start(); osc.stop(audioCtx.currentTime + BEAT * 0.9);
  }
  // Bass
  if (BASS[idx]) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(musicGain);
    osc.type = 'sawtooth';
    osc.frequency.value = BASS[idx];
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + BEAT * 0.7);
    osc.start(); osc.stop(audioCtx.currentTime + BEAT * 0.7);
  }
  musicStep++;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  if (musicGain) musicGain.gain.value = soundEnabled ? 0.18 : 0;
  if (sfxGain)   sfxGain.gain.value   = soundEnabled ? 0.35 : 0;
  document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
}

// =============================================================================
//  POWERUPS
// =============================================================================
const POWERUP_TYPES = [
  { type: 'shield',    color: '#00eeff', label: 'SHIELD',     glow: '#00eeff' },
  { type: 'repair',    color: '#00ff66', label: '+HP',        glow: '#00ff66' },
  { type: 'speed',     color: '#ffee00', label: 'SPEED',      glow: '#ffee00' },
  { type: 'rapidfire', color: '#ff4400', label: 'RAPID FIRE', glow: '#ff4400' },
  { type: 'omni',      color: '#ff00ff', label: '360°',       glow: '#ff00ff' },
];

function spawnPowerup() {
  const def = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({
    ...def,
    x: 60 + Math.random() * (W - 120),
    y: 60 + Math.random() * (H - 120),
    radius: 14, anim: Math.random() * Math.PI * 2, life: 12,
  });
}

function applyPowerup(player, type) {
  if      (type === 'shield')    { player.shieldTimer = 5; showAnnounce(`${player.label} 🛡 SHIELD`); }
  else if (type === 'repair')    { player.hp = Math.min(player.maxHp, player.hp + 40); updateHUD(); showAnnounce(`${player.label} ❤ REPAIRED`); }
  else if (type === 'speed')     { player.speedTimer  = 6; showAnnounce(`${player.label} ⚡ SPEED`); }
  else if (type === 'rapidfire') { player.rapidTimer  = 6; showAnnounce(`${player.label} 🔥 RAPID FIRE`); }
  else if (type === 'omni')      { player.omniTimer   = 7; showAnnounce(`${player.label} 🌀 360° FIRE`); }
  sfxPowerup();
  player.score += 50;
  updateHUD();
}

// =============================================================================
//  INPUT
// =============================================================================
document.addEventListener('keydown', e => { keys[e.code] = true; e.preventDefault && e.code === 'Space' && e.preventDefault(); });
document.addEventListener('keyup',   e => { keys[e.code] = false; });

// P1: WASD + Space
// P2 keyboard: IJKL + Shift
function getP1Input() {
  return {
    mx: (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0),
    my: (keys['KeyS'] || keys['ArrowDown']  ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp']   ? 1 : 0),
    shoot: keys['Space'],
  };
}

function getP2Input() {
  // Keyboard fallback
  const kb = {
    mx: (keys['KeyL'] ? 1 : 0) - (keys['KeyJ'] ? 1 : 0),
    my: (keys['KeyK'] ? 1 : 0) - (keys['KeyI'] ? 1 : 0),
    shoot: keys['ShiftLeft'] || keys['ShiftRight'],
  };
  // Gamepad override
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    return {
      mx:    Math.abs(gp.axes[0]) > 0.15 ? gp.axes[0] : kb.mx,
      my:    Math.abs(gp.axes[1]) > 0.15 ? gp.axes[1] : kb.my,
      shoot: gp.buttons[0]?.pressed || gp.buttons[7]?.pressed || kb.shoot,
    };
  }
  return kb;
}

// =============================================================================
//  DRAW — Player ship
// =============================================================================
function drawShip(p) {
  if (!p.alive) return;
  if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  // Thruster flame
  const moving = p.id === 1
    ? (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'])
    : (keys['KeyI'] || keys['KeyK'] || keys['KeyJ'] || keys['KeyL']);

  if (moving) {
    p.thrusterAnim += 0.3;
    const fl = 12 + Math.sin(p.thrusterAnim) * 6;
    const g = ctx.createLinearGradient(-30, 0, -30 - fl, 0);
    g.addColorStop(0, p.color + 'aa');
    g.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.moveTo(-20, -5); ctx.lineTo(-20 - fl, 0); ctx.lineTo(-20, 5);
    ctx.fillStyle = g; ctx.fill();
  }

  ctx.shadowColor = p.color;
  ctx.shadowBlur  = 14;

  // Hull
  ctx.beginPath();
  ctx.moveTo(24, 0); ctx.lineTo(0, -10); ctx.lineTo(-14, -8);
  ctx.lineTo(-20, -4); ctx.lineTo(-20, 4); ctx.lineTo(-14, 8); ctx.lineTo(0, 10);
  ctx.closePath();
  ctx.fillStyle   = p.id === 1 ? '#0a2a2a' : '#1a0a2a';
  ctx.strokeStyle = p.color;
  ctx.lineWidth   = 1.5;
  ctx.fill(); ctx.stroke();

  // Cockpit
  ctx.beginPath();
  ctx.ellipse(8, 0, 8, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle   = p.color + '33';
  ctx.strokeStyle = p.color + 'aa';
  ctx.lineWidth   = 1;
  ctx.fill(); ctx.stroke();

  // Wings
  ctx.beginPath();
  ctx.moveTo(0, -10); ctx.lineTo(-8, -22); ctx.lineTo(-18, -10); ctx.lineTo(-14, -8);
  ctx.fillStyle   = p.id === 1 ? '#0d3333' : '#1a0d33';
  ctx.strokeStyle = p.color + '88';
  ctx.lineWidth   = 1;
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 10); ctx.lineTo(-8, 22); ctx.lineTo(-18, 10); ctx.lineTo(-14, 8);
  ctx.fill(); ctx.stroke();

  // Player label above ship
  ctx.rotate(-p.angle);
  ctx.fillStyle    = p.color;
  ctx.font         = 'bold 9px "Share Tech Mono", monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur   = 6;
  ctx.fillText(p.label, 0, -30);

  ctx.restore();

  // Shield bubble
  if (p.shieldTimer > 0) {
    const pulse = 1 + 0.08 * Math.sin(Date.now() * 0.01);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.radius + 12) * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = '#00eeff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00eeff';
    ctx.shadowBlur  = 20;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.008);
    ctx.stroke();
    ctx.restore();
  }

  // Omni 360° spinning ring effect
  if (p.omniTimer > 0) {
    const spin = Date.now() * 0.004;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur  = 16;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = p.radius + 18;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.7;
      ctx.fill();
    }
    ctx.restore();
  }
}

// =============================================================================
//  DRAW — Enemy
// =============================================================================
function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  const colors = { patrol: '#ff6622', chaser: '#ff2266', kamikaze: '#ffaa00' };
  const col    = colors[e.type];
  ctx.shadowColor = col; ctx.shadowBlur = 10;

  if (e.type === 'kamikaze') {
    ctx.beginPath();
    ctx.moveTo(18,0); ctx.lineTo(4,-10); ctx.lineTo(-14,-6);
    ctx.lineTo(-18,0); ctx.lineTo(-14,6); ctx.lineTo(4,10);
    ctx.closePath();
    ctx.fillStyle='#1a0800'; ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.fill(); ctx.stroke();
  } else if (e.type === 'patrol') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2 + e.anim*0.3;
      const r = i%2===0 ? 18 : 12;
      i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fillStyle='#1a0800'; ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(22,0); ctx.lineTo(-8,-14); ctx.lineTo(-4,-6);
    ctx.lineTo(-16,-6); ctx.lineTo(-16,6); ctx.lineTo(-4,6); ctx.lineTo(-8,14);
    ctx.closePath();
    ctx.fillStyle='#1a0011'; ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.fill(); ctx.stroke();
  }

  // HP bar
  ctx.rotate(-e.angle);
  ctx.fillStyle='#ffffff15'; ctx.fillRect(-18, -e.radius-10, 36, 4);
  ctx.fillStyle=col;         ctx.fillRect(-18, -e.radius-10, 36*(e.hp/e.maxHp), 4);
  ctx.restore();
}

// =============================================================================
//  DRAW — Bullet
// =============================================================================
function drawBullet(b, isEnemy) {
  ctx.save();
  const col = isEnemy ? '#ff4466' : b.color;
  ctx.shadowColor = col; ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

// =============================================================================
//  DRAW — Powerup
// =============================================================================
function drawPowerup(p) {
  p.anim += 0.04;
  const pulse = 1 + 0.15 * Math.sin(p.anim * 3);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.anim * 0.5);
  ctx.shadowColor = p.glow; ctx.shadowBlur = 20;
  ctx.strokeStyle = p.color + 'aa'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, p.radius * pulse + 6, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -p.radius*pulse); ctx.lineTo(p.radius*pulse, 0);
  ctx.lineTo(0, p.radius*pulse);  ctx.lineTo(-p.radius*pulse, 0);
  ctx.closePath();
  ctx.fillStyle=p.color+'33'; ctx.strokeStyle=p.color; ctx.lineWidth=1.5;
  ctx.fill(); ctx.stroke();
  ctx.rotate(-p.anim * 0.5);
  ctx.shadowBlur=8; ctx.fillStyle=p.color;
  ctx.font='bold 7px "Share Tech Mono", monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(p.label, 0, 0);
  ctx.restore();
}

// =============================================================================
//  DRAW — Particle
// =============================================================================
function drawParticle(p) {
  const a = p.life / p.maxLife;
  ctx.save(); ctx.globalAlpha=a;
  ctx.shadowColor=p.color; ctx.shadowBlur=6;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r*a, 0, Math.PI*2);
  ctx.fillStyle=p.color; ctx.fill(); ctx.restore();
}

// =============================================================================
//  DRAW — Background
// =============================================================================
function drawBackground(dt) {
  ctx.fillStyle = '#010a0f'; ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(W*.7,H*.3,0,W*.7,H*.3,300);
  g1.addColorStop(0,'#00ffcc08'); g1.addColorStop(1,'transparent');
  ctx.fillStyle=g1; ctx.fillRect(0,0,W,H);
  const g2 = ctx.createRadialGradient(W*.2,H*.8,0,W*.2,H*.8,250);
  g2.addColorStop(0,'#cc44ff08'); g2.addColorStop(1,'transparent');
  ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);
  for (const s of stars) {
    s.y += s.speed * dt * 20; if (s.y > H) s.y = 0;
    s.twinkle += dt;
    const alpha = s.alpha * (0.7 + 0.3 * Math.sin(s.twinkle * 2));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle=`rgba(200,230,255,${alpha})`; ctx.fill();
  }
  // VS divider line
  if (gameMode === 'vs' && gameRunning) {
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = '#ffffff11';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H);
    ctx.stroke();
    ctx.restore();
  }
}

// =============================================================================
//  UPDATE PLAYER
// =============================================================================
function updatePlayer(p, input, dt) {
  if (!p.alive) return;

  // Tick powerup timers
  p.shieldTimer = Math.max(0, p.shieldTimer - dt);
  p.speedTimer  = Math.max(0, p.speedTimer  - dt);
  p.rapidTimer  = Math.max(0, p.rapidTimer  - dt);
  p.omniTimer   = Math.max(0, p.omniTimer   - dt);

  p.speed         = p.speedTimer > 0 ? 400 : 220;
  p.shootInterval = p.rapidTimer > 0 ? 0.06 : 0.18;

  // Movement
  let mx = input.mx, my = input.my;
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  p.vx += (mx * p.speed - p.vx) * dt * 8;
  p.vy += (my * p.speed - p.vy) * dt * 8;
  p.x  += p.vx * dt;
  p.y  += p.vy * dt;
  if (len > 0.1) p.angle = Math.atan2(p.vy, p.vx);

  p.x = Math.max(p.radius, Math.min(W - p.radius, p.x));
  p.y = Math.max(p.radius, Math.min(H - p.radius, p.y));
  p.invincible = Math.max(0, p.invincible - dt);

  // Shoot
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (input.shoot && p.shootCooldown <= 0) {
    if (p.omniTimer > 0) {
      // 360° — fire 8 bullets in all directions
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        bullets.push({ x: p.x, y: p.y, vx: Math.cos(a)*500, vy: Math.sin(a)*500, owner: p, color: '#ff00ff', life: 1.2, radius: 4 });
      }
      sfxOmniShoot();
    } else {
      spawnPlayerBullet(p, p.angle);
      sfxShoot();
    }
    p.shootCooldown = p.shootInterval;
  }
}

// =============================================================================
//  MAIN UPDATE
// =============================================================================
function update(dt) {
  if (!gameRunning) return;

  // Update players
  updatePlayer(p1, getP1Input(), dt);
  if (p2) updatePlayer(p2, getP2Input(), dt);

  // ── Player bullets ─────────────────────────────────────────────────────────
  bullets = bullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > W+20 || b.y < -20 || b.y > H+20) return false;

    // VS: bullet from p1 can hit p2 and vice versa
    if (gameMode === 'vs') {
      const target = b.owner.id === 1 ? p2 : p1;
      if (target && target.alive && target.invincible <= 0 && target.shieldTimer <= 0) {
        const d = Math.hypot(b.x - target.x, b.y - target.y);
        if (d < target.radius + b.radius) {
          target.hp -= 20;
          target.invincible = 0.8;
          spawnExplosion(b.x, b.y, b.color, 6);
          if (target.hp <= 0) killPlayer(target);
          updateHUD();
          return false;
        }
      }
    }
    return true;
  });

  // ── Enemy bullets ──────────────────────────────────────────────────────────
  enemyBullets = enemyBullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.x < -20 || b.x > W+20 || b.y < -20 || b.y > H+20) return false;
    for (const p of getAlivePlayers()) {
      if (p.invincible <= 0 && p.shieldTimer <= 0) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < p.radius + b.radius) {
          p.hp -= 15; p.invincible = 1.2;
          spawnExplosion(b.x, b.y, '#ff4466', 8);
          sfxHit();
          if (p.hp <= 0) killPlayer(p);
          updateHUD();
          return false;
        }
      }
    }
    return b.life > 0;
  });

  // ── Enemy agents ───────────────────────────────────────────────────────────
  updateBoss(dt);

  // Player bullet hits BOSS
  if (boss) {
    bullets = bullets.filter(b => {
      const d = Math.hypot(b.x - boss.x, b.y - boss.y);
      if (d < boss.radius + b.radius) {
        boss.hp -= 20;
        spawnExplosion(b.x, b.y, b.color, 5);
        b.owner.score += 15;
        if (boss.hp <= 0) {
          // ── STAGE CLEAR! ────────────────────────────────────────────────
          spawnExplosion(boss.x, boss.y, '#ff0044', 60);
          spawnExplosion(boss.x, boss.y, '#ff4400', 40);
          spawnExplosion(boss.x, boss.y, '#ffff00', 30);
          sfxExplosion(true);

          // Bonus score scales with stage and difficulty
          const stageBonus = stage * 500 * (difficulty === 'hard' ? 2 : difficulty === 'easy' ? 0.5 : 1);
          b.owner.score += Math.round(stageBonus);
          stage++;

          boss = null;
          document.getElementById('bossBar').style.display = 'none';

          // Heal all players a bit as reward
          for (const p of getAlivePlayers()) {
            p.hp = Math.min(p.maxHp, p.hp + 30);
          }

          // Trigger stage clear overlay for 3s, then continue
          stageClearTimer = 3.0;
          showStageClear(stage - 1, Math.round(stageBonus));
          updateHUD();
        }
        return false;
      }
      return true;
    });
  }

  enemies = enemies.filter(e => {
    updateEnemy(e, dt);

    // Kamikaze hits nearest player
    if (e.type === 'kamikaze') {
      for (const p of getAlivePlayers()) {
        if (p.invincible <= 0 && p.shieldTimer <= 0) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < e.radius + p.radius) {
            p.hp -= 35; p.invincible = 1.5;
            spawnExplosion(e.x, e.y, '#ffaa00', 20);
            if (p.hp <= 0) killPlayer(p);
            updateHUD();
            return false;
          }
        }
      }
    }

    // Player bullet hits enemy
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b  = bullets[i];
      const d  = Math.hypot(b.x - e.x, b.y - e.y);
      if (d < e.radius + b.radius) {
        e.hp -= 20;
        spawnExplosion(b.x, b.y, '#00ffcc', 6);
        b.owner.score += 10;   // partial score for hit
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          const pts = e.type==='kamikaze' ? 100 : (e.type==='chaser' ? 150 : 120);
          b.owner && (b.owner.score += pts);
          spawnExplosion(e.x, e.y, '#ff6622', 25);
          sfxExplosion(false);
          updateHUD();
          return false;
        }
        break;
      }
    }
    return true;
  });

  // ── Particles ──────────────────────────────────────────────────────────────
  particles = particles.filter(p => {
    p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.95; p.vy *= 0.95; p.life -= dt;
    return p.life > 0;
  });

  // ── Powerups ───────────────────────────────────────────────────────────────
  powerupSpawnTimer -= dt;
  if (powerupSpawnTimer <= 0) { spawnPowerup(); powerupSpawnTimer = D().powerupInterval; }

  powerups = powerups.filter(pu => {
    pu.life -= dt;
    for (const p of getAlivePlayers()) {
      const d = Math.hypot(pu.x - p.x, pu.y - p.y);
      if (d < pu.radius + p.radius) {
        applyPowerup(p, pu.type);
        spawnExplosion(pu.x, pu.y, pu.color, 18);
        return false;
      }
    }
    return pu.life > 0;
  });

  // ── Stage clear countdown ──────────────────────────────────────────────────
  if (stageClearTimer > 0) {
    stageClearTimer -= dt;
    if (stageClearTimer <= 0) hideStageClear();
  }

  // ── Wave progression (paused during stage clear) ───────────────────────────
  if (enemies.length === 0 && !boss && stageClearTimer <= 0) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      wave++;
      spawnWave(wave);
      showAnnounce(`STAGE ${stage}  WAVE ${wave}`);
      sfxWaveStart();
      waveTimer = 4;
      document.getElementById('waveDisplay').textContent  = wave;
      document.getElementById('stageDisplay').textContent = `STAGE ${stage}`;
    }
  }
}

// =============================================================================
//  DRAW — full frame
// =============================================================================
function draw(dt) {
  drawBackground(dt);
  particles.forEach(drawParticle);
  powerups.forEach(drawPowerup);
  bullets.forEach(b => drawBullet(b, false));
  enemyBullets.forEach(b => drawBullet(b, true));
  enemies.forEach(drawEnemy);
  drawBoss();
  drawShip(p1);
  if (p2) drawShip(p2);
}

// =============================================================================
//  GAME LOOP
// =============================================================================
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  update(dt);
  draw(dt);
  updatePowerupHUD();
  tickMusic(dt);
  requestAnimationFrame(loop);
}

// =============================================================================
//  KILL PLAYER & END CONDITIONS
// =============================================================================
function killPlayer(p) {
  p.alive = false;
  p.hp    = 0;
  spawnExplosion(p.x, p.y, p.color, 40);

  if (gameMode === 'single') {
    endGame(null);
    return;
  }

  // VS: check if both dead or one left
  const alive = getAlivePlayers();
  if (alive.length === 0) {
    // both died simultaneously — draw
    endGame('draw');
  } else if (alive.length === 1) {
    endGame(alive[0]);
  }
  // else game continues with one player dead
}

// =============================================================================
//  UI HELPERS
// =============================================================================
function updateHUD() {
  // P1
  document.getElementById('p1Score').textContent = p1.score;
  const f1 = document.getElementById('healthFill');
  const pct1 = Math.max(0, p1.hp / p1.maxHp);
  f1.style.width = (pct1 * 100) + '%';
  f1.style.background = pct1 < 0.3 ? 'linear-gradient(90deg,#ff4466,#ff2244)'
    : pct1 < 0.6 ? 'linear-gradient(90deg,#ffaa00,#ff8800)'
    : 'linear-gradient(90deg,#00ffcc,#00ff88)';

  // P2 (VS only)
  if (p2) {
    document.getElementById('p2Score').textContent = p2.score;
    const f2  = document.getElementById('healthFill2');
    const pct2 = Math.max(0, p2.hp / p2.maxHp);
    f2.style.width = (pct2 * 100) + '%';
    f2.style.background = pct2 < 0.3 ? 'linear-gradient(90deg,#ff4466,#ff2244)'
      : pct2 < 0.6 ? 'linear-gradient(90deg,#ffaa00,#ff8800)'
      : 'linear-gradient(90deg,#cc44ff,#aa22ff)';
  }
}

function updatePowerupHUD() {
  // P1 powerups
  const cfgP1 = [
    { id:'pup-shield', bar:'bar-shield', timer: p1.shieldTimer, max:5 },
    { id:'pup-speed',  bar:'bar-speed',  timer: p1.speedTimer,  max:6 },
    { id:'pup-rapid',  bar:'bar-rapid',  timer: p1.rapidTimer,  max:6 },
    { id:'pup-omni',   bar:'bar-omni',   timer: p1.omniTimer,   max:7 },
  ];
  for (const c of cfgP1) {
    const icon = document.getElementById(c.id);
    const bar  = document.getElementById(c.bar);
    if (!icon || !bar) continue;
    if (c.timer > 0) { icon.classList.add('active'); bar.style.width = (c.timer/c.max*100)+'%'; }
    else icon.classList.remove('active');
  }

  // P2 powerups (VS only)
  if (p2) {
    const cfgP2 = [
      { id:'pup2-shield', bar:'bar2-shield', timer: p2.shieldTimer, max:5 },
      { id:'pup2-speed',  bar:'bar2-speed',  timer: p2.speedTimer,  max:6 },
      { id:'pup2-rapid',  bar:'bar2-rapid',  timer: p2.rapidTimer,  max:6 },
      { id:'pup2-omni',   bar:'bar2-omni',   timer: p2.omniTimer,   max:7 },
    ];
    for (const c of cfgP2) {
      const icon = document.getElementById(c.id);
      const bar  = document.getElementById(c.bar);
      if (!icon || !bar) continue;
      if (c.timer > 0) { icon.classList.add('active'); bar.style.width = (c.timer/c.max*100)+'%'; }
      else icon.classList.remove('active');
    }
  }
}

function showAnnounce(text) {
  const el = document.getElementById('wave-announce');
  el.textContent  = `— ${text} —`;
  el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 2000);
}

function showStageClear(clearedStage, bonus) {
  const el = document.getElementById('stageClear');
  document.getElementById('stageClearNum').textContent  = `STAGE ${clearedStage} CLEAR`;
  document.getElementById('stageClearBonus').textContent = `+${bonus.toLocaleString()} BONUS`;
  document.getElementById('stageClearNext').textContent  = `ENTERING STAGE ${clearedStage + 1}...`;
  el.classList.add('visible');
}

function hideStageClear() {
  document.getElementById('stageClear').classList.remove('visible');
}

// =============================================================================
//  START / END
// =============================================================================
// =============================================================================
//  DIFFICULTY SELECTION
// =============================================================================
function setDifficulty(d) {
  difficulty = d;
  // Highlight selected button
  ['easy','medium','hard'].forEach(k => {
    const btn = document.getElementById('diff-' + k);
    if (!btn) return;
    btn.classList.toggle('selected', k === d);
  });
}

function startSingle() {
  gameMode = 'single';
  p1 = createPlayer(1);
  p2 = null;
  document.getElementById('p2HUD').style.display    = 'none';
  document.getElementById('powerupHUD2').style.display = 'none';
  _startCommon();
}

function startVS() {
  gameMode = 'vs';
  p1 = createPlayer(1);
  p2 = createPlayer(2);
  document.getElementById('p2HUD').style.display    = 'flex';
  document.getElementById('powerupHUD2').style.display = 'flex';
  _startCommon();
}

function _startCommon() {
  wave = 1; stage = 1; stageClearTimer = 0;
  waveTimer = 0; powerupSpawnTimer = D().powerupInterval; boss = null;
  document.getElementById('bossBar').style.display  = 'none';
  hideStageClear();
  bullets=[]; enemyBullets=[]; enemies=[]; particles=[]; powerups=[];
  initStars();
  spawnWave(1);
  document.getElementById('waveDisplay').textContent = '1';
  document.getElementById('stageDisplay').textContent = 'STAGE 1';
  document.getElementById('overlay').style.display   = 'none';
  gameRunning = true;
  initAudio();
  sfxWaveStart();
  updateHUD();
  // Show difficulty badge
  const badge = document.getElementById('diffBadge');
  if (badge) {
    badge.textContent = D().label;
    badge.style.color = D().color;
    badge.style.borderColor = D().color + '88';
  }
  showAnnounce('WAVE 1');
}

function endGame(winner) {
  gameRunning = false;

  const go = document.getElementById('gameOverScreen');
  const title = document.getElementById('gameOverTitle');
  const fs    = document.getElementById('finalScore');

  if (gameMode === 'single') {
    title.textContent = 'MISSION FAILED';
    title.style.color = '#ff4466';
    fs.textContent    = `SCORE: ${p1.score}`;
  } else if (winner === 'draw') {
    title.textContent = 'IT\'S A DRAW!';
    title.style.color = '#ffaa00';
    fs.textContent    = `P1: ${p1.score}  |  P2: ${p2.score}`;
  } else if (winner) {
    title.textContent = `${winner.label} WINS!`;
    title.style.color = winner.color;
    fs.textContent    = `${winner.label} SCORE: ${winner.score}`;
  }

  document.getElementById('startScreen').style.display    = 'none';
  go.style.display = 'flex';
  document.getElementById('overlay').style.display = 'flex';
}

// =============================================================================
//  INIT
// =============================================================================
initStars();
bullets=[]; enemyBullets=[]; enemies=[]; particles=[]; powerups=[];
p1 = createPlayer(1); p2 = null;
gameRunning = false;
lastTime = performance.now();
requestAnimationFrame(loop);
