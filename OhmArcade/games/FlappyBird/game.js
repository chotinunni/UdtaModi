// Flappy Bird game logic
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);
// ===================================
// SAVE PLAYER NAME PERMANENTLY
// ===================================

const PLAYER_NAME_KEY = "flappyBirdPlayerName";

const playerNameInput = document.getElementById("playerName");

// Load previously saved name
playerNameInput.value = localStorage.getItem(PLAYER_NAME_KEY) || "";

// Automatically save whenever the player types
playerNameInput.addEventListener("input", function () {
  localStorage.setItem(PLAYER_NAME_KEY, playerNameInput.value);
});

// Images
const birdImage = new Image();
birdImage.src = "images/bird.png";
const pipeCapImage = new Image();
pipeCapImage.src = "images/pipe-cap.png";
const pipeBodyImage1 = new Image();
pipeBodyImage1.src = "images/pipe-body1.png";
const pipeBodyImage2 = new Image();
pipeBodyImage2.src = "images/pipe-body2.png";
const PIPE_CAP_HEIGHT = 24,
  PIPE_CAP_WIDTH = 76,
  PIPE_BODY_TILE_HEIGHT = 60;

// Audio
const crashSound = $("crashSound"),
  pipePassSound = $("pipePassSound");
const milestoneSounds = [
  $("milestoneSound1"),
  $("milestoneSound2"),
  $("milestoneSound3"),
];
const backgroundMusic = $("backgroundMusic");
let isMuted = false;

function playAudio(audio) {
  if (isMuted || !audio) return;
  audio.currentTime = 0;
  audio.volume = 1;
  audio.play().catch((error) => console.warn("Audio playback:", error));
}
function stopAudio(audio) {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
function stopAllSounds() {
  stopAudio(crashSound);
  stopAudio(pipePassSound);
  milestoneSounds.forEach(stopAudio);
  stopAudio(backgroundMusic);
}
function playBackgroundMusic() {
  if (isMuted) return;
  backgroundMusic.volume = 0.35;
  if (backgroundMusic.paused) {
    backgroundMusic.currentTime = 0;
    backgroundMusic
      .play()
      .catch((error) => console.warn("Music playback:", error));
  }
}
function playMilestoneSound() {
  playAudio(
    milestoneSounds[Math.floor(Math.random() * milestoneSounds.length)],
  );
}
$("soundButton").addEventListener("click", () => {
  isMuted = !isMuted;
  $("soundButton").textContent = isMuted ? "🔇" : "🔊";
  if (isMuted) stopAllSounds();
  else if (gameRunning) playBackgroundMusic();
});

// Persistent data
const LEADERBOARD_KEY = "flappyBirdPlayerRecords";
const GAMES_KEY = "flappyBirdGamesPlayed";
const PERSONAL_BEST_KEY = "flappyBirdPersonalBests";
function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function getPlayerRecords() {
  const records = readJSON(LEADERBOARD_KEY, []);
  return Array.isArray(records)
    ? records.filter(
        (r) =>
          r &&
          typeof r.name === "string" &&
          Number.isFinite(r.score) &&
          r.score >= 0,
      )
    : [];
}
function getPersonalBest(name) {
  const bests = readJSON(PERSONAL_BEST_KEY, {});
  return Number(bests[name.trim().toLowerCase()] || 0);
}
function savePersonalBest(name, score) {
  const bests = readJSON(PERSONAL_BEST_KEY, {});
  const key = name.trim().toLowerCase(),
    previous = Number(bests[key] || 0);
  if (score > previous) bests[key] = score;
  try {
    localStorage.setItem(PERSONAL_BEST_KEY, JSON.stringify(bests));
  } catch (error) {
    console.warn("Could not save personal best:", error);
  }
  return Math.max(previous, score);
}
function renderLeaderboard() {
  const list = $("leaderboardList");
  list.replaceChildren();
  const medals = ["🥇", "🥈", "🥉"];
  const top = getPlayerRecords()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  top.forEach((record, index) => {
    const li = document.createElement("li"),
      name = document.createElement("span"),
      score = document.createElement("strong");
    name.textContent = `${medals[index]} ${record.name}`;
    score.textContent = `${record.score} pts`;
    li.append(name, score);
    list.appendChild(li);
  });
  $("emptyLeaderboard").classList.toggle("hidden", top.length > 0);
}
function updatePlayerRecord(name, score) {
  if (score <= 0) {
    $("recordMessage").textContent = "Score a point to enter the leaderboard!";
    renderLeaderboard();
    return;
  }
  const records = getPlayerRecords();
  records.push({ name, score });
  records.sort((a, b) => b.score - a.score);
  const top = records.slice(0, 3);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top));
  } catch (error) {
    console.warn("Could not save leaderboard:", error);
  }
  const position = top.findIndex((r) => r.name === name && r.score === score);
  $("recordMessage").textContent =
    position >= 0
      ? `🏆 You reached position #${position + 1}!`
      : "Good try! Keep playing to reach the Top 3!";
  renderLeaderboard();
}

// Difficulty
const difficulty = {
  easy: {
    gravity: 0.22,
    jump: -5,
    pipeSpeed: 1.5,
    pipeGap: 200,
    spawnDist: 260,
  },
  medium: {
    gravity: 0.4,
    jump: -7,
    pipeSpeed: 2.5,
    pipeGap: 190,
    spawnDist: 280,
  },
  hard: {
    gravity: 0.45,
    jump: -7.5,
    pipeSpeed: 3.2,
    pipeGap: 135,
    spawnDist: 280,
  },
};
const DIFFICULTY_KEY = "ohmArcadeFlappyDifficulty";
const savedDifficulty = localStorage.getItem(DIFFICULTY_KEY);
let selectedDifficulty = ["easy", "medium", "hard"].includes(savedDifficulty)
  ? savedDifficulty
  : "easy";
let gravity = difficulty[selectedDifficulty].gravity,
  jumpStrength = difficulty[selectedDifficulty].jump;
let pipeSpeed = difficulty[selectedDifficulty].pipeSpeed,
  pipeGap = difficulty[selectedDifficulty].pipeGap;
let spawnDistance = difficulty[selectedDifficulty].spawnDist;
function setDifficulty(level) {
  if (gameRunning) return;
  selectedDifficulty = level;
  localStorage.setItem(DIFFICULTY_KEY, level);
  const s = difficulty[level];
  gravity = s.gravity;
  jumpStrength = s.jump;
  pipeSpeed = s.pipeSpeed;
  pipeGap = s.pipeGap;
  spawnDistance = s.spawnDist;
  document
    .querySelectorAll(".difficulty-button")
    .forEach((b) => b.classList.toggle("active", b.dataset.level === level));
  $("modeLabel").textContent = `${level.toUpperCase()} MODE`;
  $("statsDifficulty").textContent = level.toUpperCase();
}
document
  .querySelectorAll(".difficulty-button")
  .forEach((b) =>
    b.addEventListener("click", () => setDifficulty(b.dataset.level)),
  );

// Game state
const birdX = 50,
  birdSize = 20,
  pipeWidth = 60;
let birdY = 280,
  velocity = 0,
  pipes = [],
  score = 0,
  gameRunning = false,
  animationId = null,
  playerName = "";

function createPipe(x) {
  const min = 50,
    max = canvas.height - pipeGap - min;
  const top = Math.random() * (max - min) + min;
  pipes.push({ x, top, bottom: top + pipeGap, passed: false });
}
function startGame() {
  if (gameRunning) return;
  const name = $("playerName").value.trim();
  if (!name) {
    alert("Please enter your name before playing.");
    $("playerName").focus();
    return;
  }
  playerName = name;
  const s = difficulty[selectedDifficulty];
  gravity = s.gravity;
  jumpStrength = s.jump;
  pipeSpeed = s.pipeSpeed;
  pipeGap = s.pipeGap;
  spawnDistance = s.spawnDist;
  stopAllSounds();
  playBackgroundMusic();
  score = 0;
  birdY = 280;
  velocity = 0;
  pipes = [];
  $("scoreText").textContent = "0";
  $("startOverlay").classList.add("hidden");
  $("gameOverOverlay").classList.add("hidden");
  gameRunning = true;
  const games = Number(localStorage.getItem(GAMES_KEY) || 0) + 1;
  localStorage.setItem(GAMES_KEY, String(games));
  if (animationId !== null) cancelAnimationFrame(animationId);
  createPipe(canvas.width);
  gameLoop();
}
function restartGame() {
  $("gameOverOverlay").classList.add("hidden");
  startGame();
}
function goHome() {
  gameRunning = false;
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
  stopAllSounds();
  closeModals();
  $("gameOverOverlay").classList.add("hidden");
  $("startOverlay").classList.remove("hidden");
  $("scoreText").textContent = "0";
  drawBackground();
}
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, "#061426");
  sky.addColorStop(0.52, "#07517a");
  sky.addColorStop(1, "#073e4c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 400, 600);
  ctx.save();
  ctx.shadowColor = "#ffdb83";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#f4e6b8";
  ctx.beginPath();
  ctx.arc(300, 65, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.65)";
  [
    [40, 60],
    [100, 110],
    [190, 75],
    [350, 130],
    [260, 160],
    [60, 210],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#123b5a";
  ctx.beginPath();
  ctx.moveTo(0, 260);
  ctx.lineTo(45, 220);
  ctx.lineTo(100, 245);
  ctx.lineTo(180, 190);
  ctx.lineTo(255, 235);
  ctx.lineTo(325, 195);
  ctx.lineTo(400, 235);
  ctx.lineTo(400, 360);
  ctx.lineTo(0, 360);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#14505b";
  ctx.beginPath();
  ctx.moveTo(0, 285);
  ctx.lineTo(65, 265);
  ctx.lineTo(140, 300);
  ctx.lineTo(220, 270);
  ctx.lineTo(300, 300);
  ctx.lineTo(400, 260);
  ctx.lineTo(400, 390);
  ctx.lineTo(0, 390);
  ctx.closePath();
  ctx.fill();
  const ground = ctx.createLinearGradient(0, 350, 0, 600);
  ground.addColorStop(0, "#064a34");
  ground.addColorStop(1, "#032a20");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 350, 400, 250);
  ctx.fillStyle = "#167a62";
  ctx.fillRect(0, 350, 400, 5);
  ctx.strokeStyle = "rgba(90,190,120,.15)";
  ctx.lineWidth = 2;
  for (let x = 10; x < 400; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 600);
    ctx.lineTo(x - 4, 570);
    ctx.stroke();
  }
}
function drawBird() {
  if (birdImage.complete && birdImage.naturalWidth > 0) {
    ctx.save();
    const angle = Math.max(-0.35, Math.min(0.65, velocity * 0.07));
    ctx.translate(birdX + 15, birdY + 15);
    ctx.rotate(angle);
    ctx.drawImage(birdImage, -17.5, -17.5, 35, 35);
    ctx.restore();
  } else {
    ctx.fillStyle = "#ffeb3b";
    ctx.fillRect(birdX, birdY, birdSize, birdSize);
  }
}
function drawPipeBody(image, x, y, width, height) {
  if (!image.complete || image.naturalWidth === 0 || height <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  for (let yy = y; yy < y + height; yy += PIPE_BODY_TILE_HEIGHT)
    ctx.drawImage(image, x, yy, width, PIPE_BODY_TILE_HEIGHT);
  ctx.restore();
}
function drawPipeCap(x, y, flip = false) {
  if (!pipeCapImage.complete || pipeCapImage.naturalWidth === 0) return;
  ctx.save();
  if (flip) {
    ctx.translate(x, y + PIPE_CAP_HEIGHT);
    ctx.scale(1, -1);
    ctx.drawImage(
      pipeCapImage,
      -(PIPE_CAP_WIDTH - pipeWidth) / 2,
      0,
      PIPE_CAP_WIDTH,
      PIPE_CAP_HEIGHT,
    );
  } else
    ctx.drawImage(
      pipeCapImage,
      x - (PIPE_CAP_WIDTH - pipeWidth) / 2,
      y,
      PIPE_CAP_WIDTH,
      PIPE_CAP_HEIGHT,
    );
  ctx.restore();
}
function drawPipes() {
  const body = score >= 10 ? pipeBodyImage2 : pipeBodyImage1;
  pipes.forEach((pipe) => {
    if (body.complete && body.naturalWidth > 0) {
      const topCapY = pipe.top - PIPE_CAP_HEIGHT;
      drawPipeBody(body, pipe.x, 0, pipeWidth, topCapY);
      drawPipeCap(pipe.x, topCapY, true);
      const bottomY = pipe.bottom + PIPE_CAP_HEIGHT;
      drawPipeCap(pipe.x, pipe.bottom, false);
      drawPipeBody(
        body,
        pipe.x,
        bottomY,
        pipeWidth,
        canvas.height - 25 - bottomY,
      );
    } else {
      ctx.fillStyle = "#269b45";
      ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
      ctx.fillRect(
        pipe.x,
        pipe.bottom,
        pipeWidth,
        canvas.height - pipe.bottom - 25,
      );
    }
  });
}
function updateGame() {
  velocity += gravity;
  birdY += velocity;
  pipes.forEach((pipe) => {
    pipe.x -= pipeSpeed;
    if (!pipe.passed && pipe.x + pipeWidth < birdX) {
      pipe.passed = true;
      score++;
      $("scoreText").textContent = score;
      playAudio(pipePassSound);
      if (score % 5 === 0) playMilestoneSound();
      if (score === 10) console.log("Pipe body 2 unlocked!");
    }
  });
  pipes = pipes.filter((pipe) => pipe.x + pipeWidth > 0);
  if (
    pipes.length === 0 ||
    pipes[pipes.length - 1].x < canvas.width - spawnDistance
  )
    createPipe(canvas.width);
  if (birdY < 0 || birdY + birdSize > canvas.height - 25) {
    triggerGameOver();
    return;
  }
  for (const pipe of pipes) {
    const horizontal = birdX + birdSize > pipe.x && birdX < pipe.x + pipeWidth;
    if (horizontal && (birdY < pipe.top || birdY + birdSize > pipe.bottom)) {
      triggerGameOver();
      return;
    }
  }
}
function triggerGameOver() {
  if (!gameRunning) return;
  gameRunning = false;
  stopAudio(backgroundMusic);
  playAudio(crashSound);
  $("finalScore").textContent = `Score: ${score}`;
  $("gameOverBest").textContent =
    `🏆 Personal Best: ${savePersonalBest(playerName, score)}`;
  $("gameOverDifficulty").textContent =
    `Difficulty: ${selectedDifficulty.toUpperCase()}`;
  updatePlayerRecord(playerName, score);
  $("startOverlay").classList.add("hidden");
  $("gameOverOverlay").classList.remove("hidden");
}
function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  drawBackground();
  drawPipes();
  drawBird();
  if (gameRunning) animationId = requestAnimationFrame(gameLoop);
}
function jump() {
  if (gameRunning) velocity = jumpStrength;
}

// Controls
canvas.addEventListener("pointerdown", () => {
  if (gameRunning) jump();
});
document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || document.activeElement?.tagName === "INPUT")
    return;
  if (!$("menuModal").classList.contains("hidden")) return;
  event.preventDefault();
  if (gameRunning) jump();
  else if ($("gameOverOverlay").classList.contains("hidden")) startGame();
});

// Modals
function openModal(id) {
  closeModals();
  $(id).classList.remove("hidden");
  if (id === "leaderboardModal") renderLeaderboard();
}
function closeModals() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
}
$("startButton").addEventListener("click", startGame);
$("restartButton").addEventListener("click", restartGame);
$("homeButton").addEventListener("click", () => {
  window.location.href = "../../Index.html";
});
$("leaderboardOpen").addEventListener("click", () =>
  openModal("leaderboardModal"),
);
$("menuOpen").addEventListener("click", () => openModal("menuModal"));
$("menuLeaderboard").addEventListener("click", () =>
  openModal("leaderboardModal"),
);
$("menuStats").addEventListener("click", () => {
  $("gamesPlayed").textContent = Number(localStorage.getItem(GAMES_KEY) || 0);
  $("personalBest").textContent = getPersonalBest($("playerName").value);
  $("statsDifficulty").textContent = selectedDifficulty.toUpperCase();
  openModal("statsModal");
});
$("menuHome").addEventListener("click", () => {
  window.location.href = "../../Index.html";
});
document
  .querySelectorAll("[data-close]")
  .forEach((b) => b.addEventListener("click", closeModals));
document.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m) closeModals();
  }),
);

// Initial screen
setDifficulty(selectedDifficulty);
renderLeaderboard();
drawBackground();
