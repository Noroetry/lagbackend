#!/usr/bin/env node
/**
 * Script para dejar la base de datos 'virgen': vacía todas las tablas públicas
 * y reinicia las secuencias (Postgres).
 *
 * Uso:
 *  node scripts/reset-db.js [--dry] [--exclude=table1,table2]
 *
 * - --dry (o -d): no ejecuta el TRUNCATE, solo muestra lo que haría.
 * - --exclude=tabla1,tabla2: lista separada por comas de tablas a excluir (p. ej. SequelizeMeta).
 *
 * Nota: este script asume Postgres. Si tu `database.js` usa otro dialecto se intentará un borrado por tabla
 * pero las secuencias no se reiniciarán automáticamente.
 *
 * ADVERTENCIA: Haz backup antes de ejecutar en producción.
 */

const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function run() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry') || args.includes('-d');
  const exclArg = args.find(a => a.startsWith('--exclude='));
  const excludes = ['SequelizeMeta'];
  if (exclArg) {
    const listed = exclArg.split('=')[1] || '';
    for (const t of listed.split(',')) if (t && t.trim()) excludes.push(t.trim());
  }

  try {
    const dialect = (db.sequelize && typeof db.sequelize.getDialect === 'function') ? db.sequelize.getDialect() : null;

    // Obtener tablas públicas
    const rows = await db.sequelize.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
      { type: db.Sequelize.QueryTypes.SELECT }
    );

    // Seleccionar únicamente tablas relacionadas con quests (prefijo 'quests_')
    const allTables = rows.map(r => r.tablename);
    const tables = allTables.filter(t => t.startsWith('quests_') && !excludes.includes(t));

    if (tables.length === 0) {
      console.log('[reset-db] No se encontraron tablas de quests para truncar (filtro aplicado). Ninguna tabla de `users` u `objects` será tocada.');
      await db.sequelize.close();
      return;
    }

    const quoted = tables.map(t => `"${t}"`).join(', ');

    if (dialect === 'postgres') {
      const sql = `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`;
      console.log('[reset-db] Sentencia a ejecutar:');
      console.log(sql);
      if (dry) {
        console.log('[reset-db] Dry run activado. No se ejecuta el TRUNCATE.');
      } else {
        console.log('[reset-db] Ejecutando TRUNCATE...');
        await db.sequelize.query(sql);
        console.log('[reset-db] TRUNCATE y RESTART IDENTITY ejecutados correctamente.');
      }
    } else {
      console.warn('[reset-db] Dialect no es Postgres (detected:', dialect, '). Procederé a borrar por tabla y NO reiniciar secuencias automáticamente.');
      for (const t of tables) {
        const sql = `DELETE FROM "${t}";`;
        console.log(`[reset-db] Ejecutando: ${sql}`);
        if (!dry) await db.sequelize.query(sql);
      }
      console.log('[reset-db] Borrado por tabla ejecutado. Reinicio manual de secuencias requerido según el SGBD.');
    }

    await db.sequelize.close();
  } catch (err) {
    logger.error('[reset-db] Error durante reset:', err && err.message ? err.message : err);
    try { await db.sequelize.close(); } catch (e) {}
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[reset-db] Error inesperado:', err && err.message ? err.message : err);
  process.exit(1);
});
