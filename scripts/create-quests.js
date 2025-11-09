#!/usr/bin/env node
/*
  Script para crear varias quests en la base de datos usando `src/utils/createQuest`.

  Uso:
    node scripts/create-quests.js [path/to/quests.json] [--dry]

  - Si no se especifica archivo, busca `scripts/new-quests.json` relativo a la raíz del proyecto.
  - Por defecto el script COMMITea los cambios. Si pasas `--dry` o `-d`, todo se ejecuta en una transacción y se hace ROLLBACK al final (útil para pruebas).

  Formato JSON esperado: array de payloads que acepta `createQuest` (ver `src/utils/createQuest.js`).
*/

const fs = require('fs');
const path = require('path');
const createQuest = require('../src/utils/createQuest');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function run() {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => !a.startsWith('-')) || 'scripts/new-quests.json';
  const dry = args.includes('--dry') || args.includes('-d');

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error('[create-quests] Archivo no encontrado:', filePath);
    process.exit(1);
  }

  let payloads;
  try {
    payloads = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error('[create-quests] Error leyendo/parsing JSON:', err && err.message ? err.message : err);
    process.exit(1);
  }

  if (!Array.isArray(payloads)) {
    console.error('[create-quests] El JSON debe ser un array de payloads');
    process.exit(1);
  }

  const t = await db.sequelize.transaction();
  try {
    const created = [];
    for (const p of payloads) {
      console.log('[create-quests] Creando quest:', p && p.header && p.header.title ? p.header.title : '<sin título>');
      const q = await createQuest(p, t);
      created.push(q && q.id ? q.id : (q && q.toJSON ? q.toJSON() : q));
      console.log('[create-quests] Creada quest id=', q && q.id);
    }

    if (dry) {
      await t.rollback();
      console.log('[create-quests] Dry run: rollback aplicado, no se persisten cambios. IDs (no persistidos):', created);
    } else {
      await t.commit();
      console.log('[create-quests] Commit realizado. Quests creadas:', created);
    }
  } catch (err) {
    try { await t.rollback(); } catch (e) { logger.error('[create-quests] rollback fallo', e && e.message ? e.message : e); }
    console.error('[create-quests] Error creando quests:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    try { await db.sequelize.close(); } catch (e) {}
  }
}

run().catch(err => {
  console.error('[create-quests] Error inesperado:', err && err.message ? err.message : err);
  process.exit(1);
});
