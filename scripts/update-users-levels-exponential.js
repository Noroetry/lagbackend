#!/usr/bin/env node
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function computeLevels(base = 150, linear = 50, quadratic = 1.0, maxLevel = 100) {
  // Polynomial per-level scheme:
  // XP to go from level N to N+1 = B + (N * L) + (N^2 * C)
  // We'll compute cumulative minExpRequired for each level.
  const rows = [];
  let cumulative = 0;
  for (let level = 1; level <= maxLevel; level++) {
    let minExp;
    if (level === 1) {
      minExp = 0;
    } else {
      const n = level - 1; // XP to reach `level` is computed using n
      const xpForThis = Math.round(base + (n * linear) + (n * n * quadratic));
      cumulative += xpForThis;
      minExp = cumulative;
    }
    rows.push({ level_number: level, minExpRequired: minExp });
  }
  return rows;
}

async function main() {
  logger.info('[update-users-levels-exponential] Starting update');
  const UsersLevel = db.UsersLevel;
  if (!UsersLevel) {
    logger.error('[update-users-levels-exponential] UsersLevel model not found. Ensure models are loaded and migration created.');
    process.exit(1);
  }

  // Polynomial coefficients (configurable via env vars): base, linear, quadratic
  const base = process.env.LEVEL_BASE ? Number(process.env.LEVEL_BASE) : 150; // B
  const linear = process.env.LEVEL_LINEAR ? Number(process.env.LEVEL_LINEAR) : 50; // L
  const quadratic = process.env.LEVEL_QUADRATIC ? Number(process.env.LEVEL_QUADRATIC) : 1.0; // C
  const maxLevel = process.env.LEVEL_MAX ? Number(process.env.LEVEL_MAX) : 100;

  // Postgres BIGINT max (signed)
  const MAX_BIGINT = 9223372036854775807;

  const levelService = require('../src/services/levelService');
  const rows = await levelService.generateLevels(maxLevel, base, linear, quadratic);

  const t = await db.sequelize.transaction();
  try {
    let created = 0;
    let updated = 0;
    for (const r of rows) {
      // upsert: use level_number as PK
      const existing = await UsersLevel.findByPk(r.level_number, { transaction: t });
      if (existing) {
        const prevVal = Number(existing.minExpRequired || 0);
        // if the computed value exceeds MAX_BIGINT, cap and store as string
        let newVal = r.minExpRequired;
        if (newVal > MAX_BIGINT) {
          logger.warn('[update-users-levels-exponential] Computed value exceeds BIGINT max, capping', { level: r.level_number, value: newVal });
          newVal = MAX_BIGINT;
        }
        // If value differs, update (use string when out of JS safe integer range)
        const toStore = (newVal > Number.MAX_SAFE_INTEGER) ? String(newVal) : newVal;
        if (prevVal !== Number(newVal)) {
          await existing.update({ minExpRequired: toStore }, { transaction: t });
          updated++;
          logger.info('[update-users-levels-exponential] Updated level', { level: r.level_number, from: prevVal, to: newVal });
        }
      } else {
        let toCreate = r.minExpRequired;
        if (toCreate > MAX_BIGINT) {
          logger.warn('[update-users-levels-exponential] Computed value exceeds BIGINT max, capping on create', { level: r.level_number, value: toCreate });
          toCreate = MAX_BIGINT;
        }
        const toStore = (toCreate > Number.MAX_SAFE_INTEGER) ? String(toCreate) : toCreate;
        await UsersLevel.create({ levelNumber: r.level_number, minExpRequired: toStore }, { transaction: t });
        created++;
        logger.info('[update-users-levels-exponential] Created level', { level: r.level_number, minExpRequired: toCreate });
      }
    }

    await t.commit();
    logger.info('[update-users-levels-exponential] Completed', { created, updated });
    // show summary of first 10 and last 5 levels
    logger.info('[update-users-levels-exponential] Sample levels:', rows.slice(0, 10).concat(rows.slice(-5)));
  } catch (err) {
    try { await t.rollback(); } catch (e) { logger.error('[update-users-levels-exponential] rollback failed', e); }
    logger.error('[update-users-levels-exponential] Error updating levels', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    try { await db.sequelize.close(); } catch (e) {}
  }
}

if (require.main === module) {
  main().catch(err => {
    logger.error('[update-users-levels-exponential] Unhandled error', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
