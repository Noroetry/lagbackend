const db = require('../src/config/database');

async function run() {
  try {
    const qs = await db.QuestsHeader.findAll({ include: [ { model: db.QuestsDetail }, { model: db.QuestsObject, include: [ db.ObjectItem ] } ] });
    console.log('Quests headers in DB:', qs.map(q => q.toJSON()));
  } catch (err) {
    console.error('Error querying quests:', err && err.message ? err.message : err);
  } finally {
    try { await db.sequelize.close(); } catch (e) {}
  }
}

run();
