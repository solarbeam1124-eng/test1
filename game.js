(() => {
  // Canvas setup
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // UI elements
  const home = document.getElementById('home');
  const playBtn = document.getElementById('playBtn');
  const prevLevelBtn = document.getElementById('prevLevel');
  const nextLevelBtn = document.getElementById('nextLevel');
  const levelNameEl = document.getElementById('levelName');
  const hud = document.getElementById('hud');
  const hudLevel = document.getElementById('hudLevel');
  const hudStatus = document.getElementById('hudStatus');
  const homeBtn = document.getElementById('homeBtn');
  const overlayInfo = document.getElementById('overlayInfo');

  // Input
  const keys = { jump: false, restart: false };

  // Basic audio + beat scheduling (manual BPM per level)
  let audio = null;
  let nextBeatTime = 0;

  // Camera and world
  let camX = 0;
  const gravity = 2200;     // px/s^2
  const jumpVel = -900;     // px/s
  const groundY = canvas.height - 120; // Ground height
  const player = {
    x: 120, y: groundY - 50, w: 48, h: 48,
    vx: 300, vy: 0, onGround: true,
    dead: false, deathTime: 0,
    particleCooldown: 0
  };

  // Visual difficulty ramp
  const fx = {
    parallaxLayers: [],
    particles: [],
  };

  // Spikes: triangles with simple AABB collision approximation
  const spikes = []; // {x,y,w,h}
  const staticSpikes = []; // Pre-placed spikes per level
  const beatSpawnedSpikes = []; // Spawned on beats

  // Level/meta definition
  const levels = [
    {
      name: 'Level 1 — 2006',
      year: 2006,
      audio: 'level1.mp3',
      bpm: 120,
      color: '#4da3ff',
      info: [
        '2006: Early Roblox era — foundational building tools, basic multiplayer, and user-generated worlds emerge.',
        '2006: Community-driven creativity set the tone for the platform’s future growth.',
        '2006: Simple aesthetics, emphasis on experimentation and player-made experiences.',
      ],
      // A few easy static spikes to start
      staticSpikes: [
        { x: 900, y: groundY, w: 40, h: 40 },
        { x: 1250, y: groundY, w: 40, h: 40 },
        { x: 1600, y: groundY, w: 40, h: 40 },
      ],
      fx: { parallax: true, particles: true, glow: true }
    },
    {
      name: 'Level 2 — 2008',
      year: 2008,
      audio: 'level2.mp3',
      bpm: 128,
      color: '#66d9ff',
      info: [
        '2008: Smoother networking and expanded building features improve creation and play.',
        '2008: Growing catalog of games; more robust scripting capabilities shape new genres.',
        '2008: Early social features help creators reach wider audiences.'
      ],
      staticSpikes: [
        { x: 850, y: groundY, w: 40, h: 40 },
        { x: 1150, y: groundY, w: 40, h: 40 },
        { x: 1500, y: groundY, w: 40, h: 40 },
        { x: 1900, y: groundY, w: 40, h: 40 },
      ],
      fx: { parallax: true, particles: true, glow: true }
    },
    {
      name: 'Level 3 — 2016',
      year: 2016,
      audio: 'level3.mp3',
      bpm: 130,
      color: '#7af5c9',
      info: [
        '2016: Visual updates and performance improvements elevate gameplay quality.',
        '2016: Mobile accessibility expands the audience and creator reach.',
        '2016: Community tools mature; discovery and game polish improve.'
      ],
      staticSpikes: [
        { x: 800, y: groundY, w: 40, h: 40 },
        { x: 1100, y: groundY, w: 40, h: 40 },
        { x: 1350, y: groundY, w: 40, h: 40 },
        { x: 1700, y: groundY, w: 40, h: 40 },
        { x: 2100, y: groundY, w: 40, h: 40 },
      ],
      fx: { parallax: true, particles: true, glow: true }
    },
    {
      name: 'Level 4 — 2018',
      year: 2018,
      audio: 'level4.mp3',
      bpm: 140,
      color: '#ffd166',
      info: [
        '2018: Avatars and economy features continue evolving for personalization.',
        '2018: Engine and platform enhancements support more complex experiences.',
        '2018: Competitive and cooperative modes flourish across genres.'
      ],
      staticSpikes: [
        { x: 750, y: groundY, w: 40, h: 40 },
        { x: 1000, y: groundY, w: 40, h: 40 },
        { x: 1300, y: groundY, w: 40, h: 40 },
        { x: 1650, y: groundY, w: 40, h: 40 },
        { x: 2050, y: groundY, w: 40, h: 40 },
        { x: 2450, y: groundY, w: 40, h: 40 },
      ],
      fx: { parallax: true, particles: true, glow: true }
    },
    {
      name: 'Level 5 — 2025',
      year: 2025,
      audio: 'level5.mp3',
      bpm: 150,
      color: '#ff6fd8',
      info: [
        '2025: Ongoing improvements in creation tools and performance shape richer worlds.',
        '2025: Cross-platform communities grow with better discovery and creator support.',
        '2025: Visual polish, effects, and accessibility continue advancing.'
      ],
      staticSpikes: [
        { x: 700, y: groundY, w: 40, h: 40 },
        { x: 950, y: groundY, w: 40, h: 40 },
        { x: 1200, y: groundY, w: 40, h: 40 },
        { x: 1500, y: groundY, w: 40, h: 40 },
        { x: 1850, y: groundY, w: 40, h: 40 },
        { x: 2250, y: groundY, w: 40, h: 40 },
        { x: 2650, y: groundY, w: 40, h: 40 },
      ],
      fx: { parallax: true, particles: true, glow: true }
    }
  ];

  let levelIndex = 0;
  let infoIndex = 0;
  let running = false;
  let lastTime = performance.now();

  // Home/UI bindings
  function updateLevelName() {
    levelNameEl.textContent = levels[levelIndex].name;
  }
  prevLevelBtn.addEventListener('click', () => {
    levelIndex = (levelIndex - 1 + levels.length) % levels.length;
    updateLevelName();
  });
  nextLevelBtn.addEventListener('click', () => {
    levelIndex = (levelIndex + 1) % levels.length;
    updateLevelName();
  });

  playBtn.addEventListener('click', () => startLevel(levelIndex));
  homeBtn.addEventListener('click', () => goHome());

  function goHome() {
    stopAudio();
    running = false;
    home.classList.remove('hidden');
    hud.classList.add('hidden');
    overlayInfo.classList.add('hidden');
    hudStatus.textContent = '';
  }

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.jump = true;
    if (e.code === 'KeyR') keys.restart = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.jump = false;
    if (e.code === 'KeyR') keys.restart = false;
  });

  // Start a level
  function startLevel(idx) {
    const lvl = levels[idx];
    levelIndex = idx;
    infoIndex = 0;
    running = true;

    // Reset player
    player.x = 120;
    player.y = groundY - player.h;
    player.vx = 300 + idx * 30; // slight speed increase each level
    player.vy = 0;
    player.onGround = true;
    player.dead = false;
    player.deathTime = 0;

    // Camera
    camX = 0;

    // Spikes
    spikes.length = 0;
    beatSpawnedSpikes.length = 0;
    staticSpikes.length = 0;
    lvl.staticSpikes.forEach(s => staticSpikes.push({ ...s }));

    // Audio
    stopAudio();
    audio = new Audio(lvl.audio);
    audio.crossOrigin = 'anonymous';
    audio.loop = false;
    audio.volume = 0.9;
    audio.addEventListener('canplay', () => {
      audio.play().catch(() => {});
    });
    audio.addEventListener('ended', () => {
      hudStatus.textContent = 'Level complete!';
      running = false;
    });

    // Beat scheduler based on BPM (simple approximation)
    nextBeatTime = 0; // seconds since start; we’ll compare with audio.currentTime
    overlayInfo.textContent = lvl.info[infoIndex];
    overlayInfo.classList.remove('hidden');

    // FX setup
    setupFX(lvl);

    // UI
    home.classList.add('hidden');
    hud.classList.remove('hidden');
    hudLevel.textContent = lvl.name;
    hudStatus.textContent = 'Good luck!';

    // Game loop
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function stopAudio() {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    audio = null;
  }

  // Game loop
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - lastTime) / 1000); // clamp dt
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  function update(dt) {
    const lvl = levels[levelIndex];

    // Handle input
    if ((keys.jump) && player.onGround && !player.dead) {
      player.vy = jumpVel;
      player.onGround = false;
    }
    if (keys.restart && player.dead) {
      startLevel(levelIndex);
      return;
    }

    // Physics
    if (!player.dead) {
      player.vy += gravity * dt;
      player.y += player.vy * dt;
      player.x += player.vx * dt;
    }

    // Ground clamp
    if (player.y + player.h >= groundY) {
      player.y = groundY - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    // Camera follows player
    const targetCam = player.x - canvas.width * 0.32;
    camX += (targetCam - camX) * 0.12;

    // Beat-based spawn
    if (audio) {
      const t = audio.currentTime;
      const spb = 60 / lvl.bpm;
      while (nextBeatTime < t + 0.02) {
        // Spawn a spike a bit ahead of player on each beat, easy spacing
        const spawnX = player.x + 520 + Math.random() * 120;
        beatSpawnedSpikes.push(makeSpike(spawnX, groundY));
        nextBeatTime += spb;
      }
    }

    // Consolidate spikes list
    spikes.length = 0;
    // Keep only those beat spikes that are not too close to each other; also cull far behind
    let lastPlacedX = -Infinity;
    for (const s of beatSpawnedSpikes) {
      if (s.x + s.w < player.x - 800) continue;
      if (Math.abs(s.x - lastPlacedX) < 80) continue;
      lastPlacedX = s.x;
      spikes.push(s);
    }
    for (const s of staticSpikes) spikes.push(s);

    // Check collision
    for (const s of spikes) {
      if (rectTriCollision(player, s)) {
        killPlayer();
        break;
      }
    }

    // FX update
    updateFX(dt, lvl);
  }

  function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    player.deathTime = performance.now();
    hudStatus.textContent = 'You hit a spike! Press R to retry.';
    // Cycle info text to next line
    const lvl = levels[levelIndex];
    infoIndex = (infoIndex + 1) % lvl.info.length;
    overlayInfo.textContent = lvl.info[infoIndex];
    // Small knockback
    player.vx *= 0.4;
    player.vy = -300;
    // Particle burst
    burst(player.x + player.w / 2, player.y + player.h / 2, lvl.color);
  }

  // Spike factory
  function makeSpike(x, groundY) {
    return { x, y: groundY, w: 40, h: 40 };
  }

  // Approximate rect-triangle collision using AABB and top wedge check
  function rectTriCollision(rect, tri) {
    // AABB overlap first
    const rx1 = rect.x, ry1 = rect.y, rx2 = rect.x + rect.w, ry2 = rect.y + rect.h;
    const tx1 = tri.x, ty1 = tri.y - tri.h, tx2 = tri.x + tri.w, ty2 = tri.y;
    if (rx2 < tx1 || rx1 > tx2 || ry2 < ty1 || ry1 > ty2) return false;
    // Approximate triangle plane: apex at (midX, ty1), base along [tx1,tx2] at ty2
    const midX = tri.x + tri.w / 2;
    // For each rect corner touching the triangle, check if above triangle edge lines
    const corners = [
      { x: rx1, y: ry1 }, { x: rx2, y: ry1 },
      { x: rx1, y: ry2 }, { x: rx2, y: ry2 },
    ];
    for (const c of corners) {
      if (pointInIsoTriangle(c.x, c.y, tx1, ty2, tx2, ty2, midX, ty1)) return true;
    }
    // Extra: if rect penetrates triangle area, treat as collision
    return true; // Keep forgiving: if AABB overlaps, we collide for simplicity
  }

  // Point-in-triangle (barycentric)
  function pointInIsoTriangle(px, py, x1, y1, x2, y2, x3, y3) {
    const denom = ((y2 - y3)*(x1 - x3) + (x3 - x2)*(y1 - y3));
    const a = ((y2 - y3)*(px - x3) + (x3 - x2)*(py - y3)) / denom;
    const b = ((y3 - y1)*(px - x3) + (x1 - x3)*(py - y3)) / denom;
    const c = 1 - a - b;
    return a >= 0 && b >= 0 && c >= 0;
  }

  // FX setup
  function setupFX(lvl) {
    fx.parallaxLayers = [
      { speed: 0.25, color: '#0c1324', hills: makeHills(0.25) },
      { speed: 0.5, color: '#0d162b', hills: makeHills(0.5) },
      { speed: 0.8, color: '#0f1b34', hills: makeHills(0.8) },
    ];
    fx.particles = [];
  }

  function makeHills(scale) {
    const arr = [];
    for (let i = 0; i < 10; i++) {
      arr.push({
        x: i * 600 + Math.random() * 300,
        w: 500 + Math.random() * 400,
        h: 40 + Math.random() * 120 * scale
      });
    }
    return arr;
  }

  function updateFX(dt, lvl) {
    // Trail particles from player
    player.particleCooldown -= dt;
    if (!player.dead && player.particleCooldown <= 0) {
      fx.particles.push({
        x: player.x + player.w / 2,
        y: player.y + player.h - 6,
        vx: -60 + Math.random() * 120,
        vy: -40 + Math.random() * 40,
        life: 0.6,
        color: lvl.color
      });
      player.particleCooldown = 0.035 - levelIndex * 0.003;
    }
    // Update particles
    for (const p of fx.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    // Cull
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      if (fx.particles[i].life <= 0) fx.particles.splice(i, 1);
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 28; i++) {
      fx.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 400,
        vy: (Math.random() - 0.5) * 400,
        life: 0.8 + Math.random() * 0.6,
        color
      });
    }
  }

  // Drawing
  function draw() {
    const lvl = levels[levelIndex];

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gradient
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#08101f');
    g.addColorStop(1, '#0e1526');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax
    if (lvl.fx.parallax) {
      for (const layer of fx.parallaxLayers) {
        ctx.fillStyle = layer.color;
        const baseX = -((camX) * layer.speed % 1200);
        for (let i = -1; i < 4; i++) {
          ctx.fillRect(baseX + i * 1200, canvas.height - 220, 1200, 220);
          for (const h of layer.hills) {
            const x = baseX + i * 1200 + h.x;
            const y = canvas.height - 220;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + h.w / 2, y - h.h);
            ctx.lineTo(x + h.w, y);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // Ground
    ctx.fillStyle = '#182642';
    const groundScreenX = -camX % 200;
    for (let i = -1; i < 6; i++) {
      ctx.fillRect(groundScreenX + i * 200, groundY, 200, canvas.height - groundY);
    }
    // Ground top line
    ctx.strokeStyle = '#2b3c60';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    // Spikes
    for (const s of spikes) {
      const sx = s.x - camX;
      const sy = s.y;
      if (sx < -60 || sx > canvas.width + 60) continue;
      drawSpike(sx, sy, s.w, s.h);
    }

    // Player
    const px = player.x - camX;
    const py = player.y;
    if (lvl.fx.glow) {
      ctx.shadowColor = lvl.color;
      ctx.shadowBlur = 28;
    } else {
      ctx.shadowBlur = 0;
    }

    // Body
    ctx.fillStyle = '#2f86ff';
    ctx.fillRect(px, py, player.w, player.h);
    // Face
    ctx.fillStyle = '#0b2a66';
    drawEye(px + 10, py + 16, 8);
    drawEye(px + player.w - 18, py + 16, 8);
    drawMouth(px + 12, py + 30, player.w - 24);

    // Particles
    ctx.shadowBlur = 0;
    for (const p of fx.particles) {
      const sx = p.x - camX;
      if (sx < -20 || sx > canvas.width + 20) continue;
      const a = Math.max(0, Math.min(1, p.life));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, p.y, 3 + 2 * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // HUD overlays already managed via DOM
  }

  function drawSpike(x, y, w, h) {
    ctx.fillStyle = '#cde2ff';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w / 2, y - h);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
    // Base
    ctx.fillStyle = '#8aa7cf';
    ctx.fillRect(x, y, w, 6);
  }

  function drawEye(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b2a66';
  }

  function drawMouth(x, y, w) {
    ctx.fillRect(x, y, w, 6);
  }

  // Initial UI
  updateLevelName();
})();
