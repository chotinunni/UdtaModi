// Ohm Arcade homepage
document.getElementById("year").textContent = new Date().getFullYear();
const playableGames = document.querySelectorAll(
  ".game-card:not(.coming-card)",
).length;
document.getElementById("gameCount").textContent =
  `${playableGames} ${playableGames === 1 ? "GAME" : "GAMES"}`;
// To add a game later: add another .game-card in Index.html and point its PLAY link
// to that game's folder, for example games/NewGame/Index.html.
