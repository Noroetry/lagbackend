const db = require('../src/config/database');
const bcrypt = require('bcryptjs');
const logger = require('../src/utils/logger');

async function ensureSystemUser() {
  const User = db.User;
  const SYS_USERNAME = process.env.SYSTEM_USERNAME || 'system';
  const SYS_EMAIL = process.env.SYSTEM_EMAIL || 'system@lag.com';
  const SYS_PASSWORD = process.env.SYSTEM_PASSWORD; // may be undefined in dev
  const SYS_ADMIN = Number(process.env.SYSTEM_ADMIN || 100);

  if (process.env.NODE_ENV === 'production' && !SYS_PASSWORD) {
    logger.error('SYSTEM_PASSWORD is required in production to seed system user');
    throw new Error('SYSTEM_PASSWORD required in production');
  }

  let systemUser = await User.findOne({ where: { username: SYS_USERNAME } });
  if (!systemUser) {
    const createPassword = SYS_PASSWORD || 'system';
    await User.create({ username: SYS_USERNAME, email: SYS_EMAIL, password: createPassword, admin: SYS_ADMIN });
    logger.info('Created system user:', SYS_USERNAME);
    return;
  }

  let changed = false;
  if (systemUser.email !== SYS_EMAIL) {
    systemUser.email = SYS_EMAIL;
    changed = true;
  }
  if (Number(systemUser.admin) !== SYS_ADMIN) {
    systemUser.admin = SYS_ADMIN;
    changed = true;
  }

  if (SYS_PASSWORD) {
    try {
      const matches = systemUser.comparePassword ? await systemUser.comparePassword(SYS_PASSWORD) : false;
      if (!matches) {
        const hashed = await bcrypt.hash(SYS_PASSWORD, 10);
        systemUser.password = hashed;
        changed = true;
      }
    } catch (err) {
      logger.warn('Could not verify/update system password:', err && err.message);
    }
  }

  if (changed) {
    await systemUser.save();
    logger.info('Updated system user settings');
  } else {
    logger.info('System user already correct');
  }
}

module.exports = ensureSystemUser;
