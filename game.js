/* Mini Dash — Geometry Dash–style game
   - Home screen with arrows and levels 1–5
   - Blue block character with face
   - Set maps per level with spikes
   - Music per level: levelN.mp3
   - Info text shows Roblox changes by year; rotates each death
   - Effects: parallax BG, pulse to beat approximation, particles, screen shake
*/

(() => {
  const CANVAS = document.getElementById('game');
  const CTX = CANVAS.getContext('2d');
  const HOME = document.getElementById('home');
  const LEVEL_NAME = document.getElementById('levelName');
  const STATUS = document.getElementById('status');
  const ATTEMPTS = document.getElementById('attempts');
  const PROGRESS = document.getElementById('progress');
  const INFO = document.getElementById('infoText');
  const LEVEL_NUMBER = document.getElementById('levelNumber');
  const PLAY_BTN = document.getElementById('playBtn');
  const LEFT = document.querySelector('.arrow.left');
  const RIGHT = document.querySelector('.arrow.right');

  const W = CANVAS.width, H = CANVAS.height;
  const GROUND_Y = H - 120;
  const GRAVITY = 0.75;
  const JUMP_VEL = -12.5;
  const SPEED = 5.2;     // camera speed
  const BLOCK_SIZE = 40;
  const SHAKE_DECAY = 0.85;

  let currentLevelIndex = 0;
  let attempts = 0;
  let audio = null;
  let audioCtx = null;
  let analyser = null;
  let beatLevel = 0;  // for pulse
  let shake = 0;

  const levels = [
    {
      name: 'Level 1',
      music: 'level1.mp3',
      year: 2006,
      info: [
        '2006 Roblox: Early classic building, user-created places.',
        '2006: Basic blocky physics and simple social features.',
        '2006: First avatars with basic customization and hats.'
      ],
      map: makeEasyMap(1)
    },
    {
      name: 'Level 2',
      music: 'level2.mp3',
      year: 2008,
      info: [
        '2008 Roblox: Introduction of Roblox Studio advancements.',
        '2008: Tickets and early economy features.',
        '2008: Growth of community games and events.'
      ],
      map: makeEasyMap(2)
    },
    {
      name: 'Level 3',
      music: 'level3.mp3',
      year: 2016,
      info: [
        '2016 Roblox: R15 avatars and expanded animation.',
        '2016: Mobile expansion and improved graphics.',
        '2016: Developer marketplace matured.'
      ],
      map: makeEasyMap(3)
    },
    {
      name: 'Level 4',
      music: 'level4.mp3',
      year: 2018,
      info: [
        '2018 Roblox: FilteringEnabled standard for safety.',
        '2018: Better engine performance and lighting.',
        '2018: Larger events and platform partnerships.'
      ],
      map: makeEasyMap(4)
    },
    {
      name: 'Level 5',
      music: 'level5.mp3',
      year: 2025,
      info: [
        '2025 Roblox: Continued creator tools and UGC sophistication.',
        '2025: Cross-platform polish, monetization tools evolve.',
        '2025: Deeper social systems and discovery improvements.'
      ],
      map: makeEasyMap(5)
    }
  ];

  function makeEasyMap(seed) {
    // Returns an array of spike objects set along a path.
    // Each spike: { x, y, w, h, type }
    const spikes = [];
    let x = 300;
    const gap = 300;
    // Simple set map — easy spacing, small clusters.
    for (let i = 0; i < 18; i++) {
      const cluster = (i % 3 === 0) ? 2 : 1;
      for (let j = 0; j < cluster; j++) {
        const h = 60 + (j * 10);
        spikes.push({
          x: x + j * 40,
          y: GROUND_Y - h,
          w: 40,
          h,
          type: 'triangle'
        });
      }
      x += gap;
      if (i % 5 === 4) x += 100; // occasional extra spacing
    }
    // Finish portal region (goal)
    const goalX = x + 300;
    return { spikes, goalX };
  }

  // Parallax layers
  const layers = [
    { speed: 0.2, color: '#0b1224', elems: [] },
    { speed: 0.5, color: '#101a34', elems: [] },
    { speed: 1.0, color: '#132037', elems: [] }
  ];
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    for (let j = 0; j < 16; j++) {
      L.elems.push({
        x: Math.random() * W,
        y: 50 + Math.random() * (GROUND_Y - 200),
        w: 120 + Math.random() * 220,
        h: 20 + Math.random() * 60,
        alpha: 0.15 + Math.random() * 0.15
      });
    }
  }

  // Player
  const player = {
    x: 120,
    y: GROUND_Y - BLOCK_SIZE,
    vx: 0,
    vy: 0,
    w: BLOCK_SIZE,
    h: BLOCK_SIZE,
    onGround: true,
    dead: false,
    particles: []
  };

  // Camera
  let camX = 0;
  let progress = 0;

  // Info rotation per level
  let infoIndex = 0;

  // Input
  const keys = { jump: false };
  window.addEventListener('keydown', (e) => {
    if (['Space','KeyW','ArrowUp'].includes(e.code)) keys.jump = true;
    if (e.code === 'Escape') toHome();
    if (e.code === 'KeyR') restartLevel();
    if (e.code === 'Enter' && HOME.style.display !== 'none') startLevel(currentLevelIndex);
  });
  window.addEventListener('keyup', (e) => {
    if (['Space','KeyW','ArrowUp'].includes(e.code)) keys.jump = false;
  });

  // Home screen navigation
  LEFT.addEventListener('click', () => {
    currentLevelIndex = (currentLevelIndex + levels.length - 1) % levels.length;
    LEVEL_NUMBER.textContent = String(currentLevelIndex + 1);
    LEVEL_NAME.textContent = levels[currentLevelIndex].name;
  });
  RIGHT.addEventListener('click', () => {
    currentLevelIndex = (currentLevelIndex + 1) % levels.length;
    LEVEL_NUMBER.textContent = String(currentLevelIndex + 1);
    LEVEL_NAME.textContent = levels[currentLevelIndex].name;
  });
  PLAY_BTN.addEventListener('click', () => startLevel(currentLevelIndex));

  function toHome() {
    stopAudio();
    HOME.style.display = 'flex';
    CANVAS.style.display = 'none';
    STATUS.textContent = 'Ready';
  }

  function startLevel(idx) {
    attempts = 0;
    infoIndex = 0;
    initLevel(idx);
    HOME.style.display = 'none';
    CANVAS.style.display = 'block';
    STATUS.textContent = 'Playing';
    LEVEL_NAME.textContent = levels[idx].name;
    ATTEMPTS.textContent = 'Attempts: 0';
    PROGRESS.textContent = '0%';
  }

  function restartLevel() {
    stopAudio();
    initLevel(currentLevelIndex);
    STATUS.textContent = 'Playing';
  }

  function initLevel(idx) {
    currentLevelIndex = idx;
    const lev = levels[idx];
    // Reset player safely on ground
    player.x = 120;
    player.y = GROUND_Y - BLOCK_SIZE;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.dead = false;
    player.particles.length = 0;
    camX = 0;
    progress = 0;
    shake = 0;
    // Update info
    showInfo(`${lev.year} Roblox`);
    // Start audio
    playMusic(lev.music);
    // Start loop
    lastTime = performance.now();
    running = true;
    requestAnimationFrame(loop);
  }

  function showInfo(text) {
    INFO.textContent = text;
    INFO.style.opacity = 0.10;
  }

  function rotateInfoOnDeath() {
    const lev = levels[currentLevelIndex];
    infoIndex = (infoIndex + 1) % lev.info.length;
    const nxt = lev.info[infoIndex];
    // Slightly reduce opacity as you progress deeper (simulate "disappearing further you go")
    const base = 0.10;
    const reduce = Math.min(0.08, progress / 100 * 0.08);
    INFO.textContent = nxt;
    INFO.style.opacity = (base - reduce).toFixed(2);
  }

  function stopAudio() {
    if (audio) {
      audio.pause();
      audio.src = '';
      audio = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch {}
      audioCtx = null;
      analyser = null;
    }
  }

  function playMusic(src) {
    stopAudio();
    audio = new Audio(src);
    audio.loop = false;
    audio.volume = 0.9;

    // Beat approximation via analyser — used for UI pulse only
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    audio.play().catch(() => {
      // Autoplay block — user interaction required; handled by Play button
    });
  }

  // Rendering helpers
  function drawParallax(dt) {
    layers.forEach((L, i) => {
      CTX.fillStyle = L.color;
      L.elems.forEach(e => {
        e.x -= L.speed * SPEED * 0.5 * dt;
        if (e.x + e.w < camX) {
          e.x = camX + W + Math.random() * 300;
          e.y = 50 + Math.random() * (GROUND_Y - 200);
        }
        CTX.globalAlpha = e.alpha;
        CTX.fillRect(Math.floor(e.x - camX), Math.floor(e.y), e.w, e.h);
        CTX.globalAlpha = 1;
      });
    });
  }

  function drawGround() {
    // Ground
    CTX.fillStyle = '#0f1727';
    CTX.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    // Stripe
    CTX.fillStyle = '#132037';
    CTX.fillRect(0, GROUND_Y - 6, W, 6);
  }

  function drawBlock() {
    const px = Math.floor(player.x - camX);
    const py = Math.floor(player.y);

    // Glow pulse from beatLevel
    const glow = Math.min(1.0, 0.3 + beatLevel * 0.7);
    CTX.shadowColor = 'rgba(73,167,255,' + (0.45 * glow) + ')';
    CTX.shadowBlur = 20 * glow;

    // Body
    CTX.fillStyle = '#49a7ff';
    roundRect(px, py, player.w, player.h, 8);

    // Face
    CTX.shadowBlur = 0;
    CTX.fillStyle = '#062742';
    // Eyes
    CTX.fillRect(px + 10, py + 14, 6, 6);
    CTX.fillRect(px + player.w - 16, py + 14, 6, 6);
    // Smile
    CTX.strokeStyle = '#062742';
    CTX.lineWidth = 3;
    CTX.beginPath();
    CTX.arc(px + player.w / 2, py + 24, 8, 0, Math.PI);
    CTX.stroke();

    // Particles
    player.particles.forEach((p, i) => {
      CTX.globalAlpha = p.a;
      CTX.fillStyle = '#7cf9a6';
      CTX.fillRect(Math.floor(p.x - camX), Math.floor(p.y), p.w, p.h);
      CTX.globalAlpha = 1;
    });
  }

  function roundRect(x, y, w, h, r) {
    CTX.beginPath();
    CTX.moveTo(x + r, y);
    CTX.arcTo(x + w, y, x + w, y + h, r);
    CTX.arcTo(x + w, y + h, x, y + h, r);
    CTX.arcTo(x, y + h, x, y, r);
    CTX.arcTo(x, y, x + w, y, r);
    CTX.closePath();
    CTX.fill();
  }

  function drawSpike(s) {
    const sx = Math.floor(s.x - camX);
    const sy = Math.floor(s.y);
    const baseY = GROUND_Y;
    // Triangle spike
    CTX.fillStyle = '#ff5773';
    CTX.beginPath();
    CTX.moveTo(sx, baseY);
    CTX.lineTo(sx + s.w / 2, sy);
    CTX.lineTo(sx + s.w, baseY);
    CTX.closePath();
    CTX.fill();

    // Edge highlight
    CTX.strokeStyle = '#ff9bb0';
    CTX.lineWidth = 1.5;
    CTX.beginPath();
    CTX.moveTo(sx + s.w / 2, sy);
    CTX.lineTo(sx + s.w, baseY);
    CTX.stroke();
  }

  function drawGoal(x) {
    const gx = Math.floor(x - camX);
    // Portal rectangle
    CTX.strokeStyle = '#7cf9a6';
    CTX.lineWidth = 3;
    CTX.strokeRect(gx - 4, GROUND_Y - 100, 20, 100);
    // Glow bars
    CTX.globalAlpha = 0.25 + Math.sin(time * 0.005) * 0.15;
    CTX.fillStyle = '#7cf9a6';
    CTX.fillRect(gx - 8, GROUND_Y - 100, 6, 100);
    CTX.globalAlpha = 1;
  }

  // Physics and collision
  function updatePlayer(dt) {
    // Jump
    if (keys.jump && player.onGround && !player.dead) {
      player.vy = JUMP_VEL;
      player.onGround = false;
      emitParticles(8, player.x, player.y + player.h);
      shake = Math.max(shake, 4);
    }
    // Gravity
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    // Ground clamp
    if (player.y + player.h >= GROUND_Y) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    // Horizontal auto-run (camera moves, player mostly stays)
    player.x += (SPEED * 0.15) * dt;

    // Update particles
    player.particles = player.particles.filter(p => p.a > 0.02);
    player.particles.forEach(p => {
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.vy += 0.2 * dt;
      p.a *= 0.94;
    });
  }

  function emitParticles(n, x, y) {
    for (let i = 0; i < n; i++) {
      player.particles.push({
        x: x + (Math.random() * 12 - 6),
        y: y,
        w: 4, h: 4,
        vx: (Math.random() * 2 - 1) * 2,
        vy: -Math.random() * 3 - 1,
        a: 0.9
      });
    }
  }

  function rectTriCollision(px, py, pw, ph, sx, sy, sw, baseY) {
    // Spike triangle points
    const A = { x: sx, y: baseY };
    const B = { x: sx + sw / 2, y: sy };
    const C = { x: sx + sw, y: baseY };
    // Sample a few points along player bottom edge for quick test
    const samples = 6;
    for (let i = 0; i <= samples; i++) {
      const x = px + (i / samples) * pw;
      const y = py + ph;
      if (pointInTriangle({ x, y }, A, B, C)) return true;
    }
    // Also test front face midpoint
    const xMid = px + pw;
    const yMid = py + ph / 2;
    if (pointInTriangle({ x: xMid, y: yMid }, A, B, C)) return true;
    return false;
  }

  function pointInTriangle(P, A, B, C) {
    const area = (A, B, C) => Math.abs((A.x*(B.y-C.y)+B.x*(C.y-A.y)+C.x*(A.y-B.y)))/2;
    const areaABC = area(A,B,C);
    const areaPAB = area(P,A,B);
    const areaPBC = area(P,B,C);
    const areaPAC = area(P,A,C);
    return Math.abs(areaPAB + areaPBC + areaPAC - areaABC) < 0.5;
  }

  function checkCollisions(map) {
    const px = player.x, py = player.y, pw = player.w, ph = player.h;
    for (const s of map.spikes) {
      const sx = s.x, sy = s.y, sw = s.w;
      if (px + pw >= sx && px <= sx + sw && py + ph >= sy && py <= GROUND_Y) {
        if (rectTriCollision(px, py, pw, ph, sx, sy, sw, GROUND_Y)) {
          return true;
        }
      }
    }
    return false;
  }

  function checkGoal(map) {
    return (player.x + player.w) >= map.goalX - 6;
  }

  // Beat pulse using analyser
  const freqData = new Uint8Array(128);
  function updateBeat() {
    if (!analyser) { beatLevel *= 0.92; return; }
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 2; i < 24; i++) sum += freqData[i];
    const avg = sum / 22;
    const lvl = Math.max(0, (avg - 50) / 80);
    beatLevel = beatLevel * 0.85 + lvl * 0.15;
  }

  // Game loop
  let running = false;
  let lastTime = performance.now();
  let time = 0;

  function loop(t) {
    if (!running) return;
    const dt = Math.min(33, t - lastTime) / (1000/60); // normalize to ~60fps units
    lastTime = t;
    time += dt;

    // Camera progression
    camX += SPEED * dt;

    // Update beat
    updateBeat();

    // Update player
    if (!player.dead) {
      updatePlayer(dt);
    }

    // Compute progress
    const map = levels[currentLevelIndex].map;
    progress = Math.max(0, Math.min(100, ((player.x - 120) / (map.goalX - 120)) * 100));
    PROGRESS.textContent = `${Math.floor(progress)}%`;

    // Collisions
    if (!player.dead) {
      if (checkCollisions(map)) {
        onDeath();
      } else if (checkGoal(map)) {
        onWin();
      }
    }

    // Draw
    const ox = (Math.random() - 0.5) * shake;
    const oy = (Math.random() - 0.5) * shake;
    CTX.setTransform(1, 0, 0, 1, ox, oy);
    CTX.clearRect(-10, -10, W + 20, H + 20);

    drawParallax(dt);
    drawGround();

    // Spikes
    map.spikes.forEach(s => drawSpike(s));

    // Goal
    drawGoal(map.goalX);

    // Block
    drawBlock();

    // Foreground pulse line
    CTX.globalAlpha = 0.4 * (0.4 + beatLevel * 0.6);
    CTX.fillStyle = '#49a7ff';
    CTX.fillRect(0, GROUND_Y - 12, W, 2);
    CTX.globalAlpha = 1;

    // Decay shake
    shake *= SHAKE_DECAY;

    requestAnimationFrame(loop);
  }

  function onDeath() {
    player.dead = true;
    attempts++;
    ATTEMPTS.textContent = `Attempts: ${attempts}`;
    STATUS.textContent = 'Crashed';
    shake = 8;
    emitParticles(12, player.x + player.w / 2, player.y + player.h / 2);
    rotateInfoOnDeath();
    // Restart after short delay
    setTimeout(() => {
      stopAudio();
      initLevel(currentLevelIndex);
      STATUS.textContent = 'Playing';
    }, 900);
  }

  function onWin() {
    STATUS.textContent = 'Completed!';
    shake = 6;
    emitParticles(20, player.x + player.w / 2, player.y + player.h / 2);
    running = false;
    setTimeout(() => {
      toHome();
    }, 1200);
  }

  // Start on home
  toHome();
})();
