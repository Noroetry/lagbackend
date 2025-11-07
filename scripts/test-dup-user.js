// Script de prueba: intenta crear dos usuarios iguales para verificar constraints de unicidad
require('dotenv').config();
const db = require('../src/config/database');
const userService = require('../src/services/userService');

async function run() {
  try {
    await db.sequelize.authenticate();
    console.log('[test-dup-user] Conexión a DB OK');
  } catch (err) {
    console.error('[test-dup-user] No se pudo conectar a la base de datos:', err && err.message ? err.message : err);
    process.exit(1);
  }

  const payload = {
    username: 'dup_test_user',
    email: 'dup_test_user@example.com',
    password: 'TestPass123!'
  };

  try {
    const res1 = await userService.createUser(payload);
    console.log('[test-dup-user] Primer usuario creado:', res1 && res1.user ? `id=${res1.user.id}` : JSON.stringify(res1));
  } catch (err) {
    console.error('[test-dup-user] Error creando primer usuario:', err && err.message ? err.message : err);
    await cleanup();
    process.exit(1);
  }

  try {
    const res2 = await userService.createUser(payload);
    console.log('[test-dup-user] SEGUNDO usuario creado inesperadamente:', res2);
  } catch (err) {
    console.log('[test-dup-user] Segundo intento produjo error (esperado)');
    console.log('Error name:', err && err.name);
    console.log('Error message:', err && err.message);
    if (err && Array.isArray(err.errors)) {
      console.log('Errors:', err.errors.map(e => ({ path: e.path, message: e.message })));
    }
  }

  await cleanup();
  await db.sequelize.close();
  process.exit(0);
}

async function cleanup() {
  try {
    await db.User.destroy({ where: { username: 'dup_test_user' } });
    console.log('[test-dup-user] Cleanup: usuario borrado si existía');
  } catch (err) {
    console.warn('[test-dup-user] Cleanup fallido:', err && err.message ? err.message : err);
  }
}

run();
