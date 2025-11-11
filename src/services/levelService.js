/**
 * Utility functions to compute level XP requirements.
 * Centralizes the formula so other parts of the app can reuse it.
 */
function xpToLevelUp(n, B = 150, L = 50, C = 1.0) {
  // XP required to go from level n to n+1
  return Math.round(B + (n * L) + (n * n * C));
}

function minExpForLevel(level, B = 150, L = 50, C = 1.0) {
  // cumulative XP required to reach `level` from level 1 (level 1 => 0)
  if (level <= 1) return 0;
  let cum = 0;
  for (let n = 1; n < level; n++) {
    cum += xpToLevelUp(n, B, L, C);
  }
  return cum;
}

function generateLevels(maxLevel = 100, B = 150, L = 50, C = 1.0) {
  const rows = [];
  for (let level = 1; level <= maxLevel; level++) {
    rows.push({ level_number: level, minExpRequired: minExpForLevel(level, B, L, C) });
  }
  return rows;
}

module.exports = {
  xpToLevelUp,
  minExpForLevel,
  generateLevels
};
