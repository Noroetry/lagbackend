const db = require('../src/config/database');
const ObjectItem = db.ObjectItem;

async function seedRewardObjects() {
  console.log('Creando objetos de recompensa base...');

  // Experiencia
  const [exp, expCreated] = await ObjectItem.findOrCreate({
    where: { type: 'experience' },
    defaults: {
      objectName: 'Experiencia',
      shortName: 'EXP',
      description: 'Puntos de experiencia del jugador',
      type: 'experience'
    }
  });
  console.log(`${expCreated ? '✓ Creado' : '- Ya existe'}: Experiencia (ID: ${exp.id})`);

  // Moneda
  const [coin, coinCreated] = await ObjectItem.findOrCreate({
    where: { type: 'coin' },
    defaults: {
      objectName: 'Moneda',
      shortName: 'COIN',
      description: 'Monedas del juego',
      type: 'coin'
    }
  });
  console.log(`${coinCreated ? '✓ Creado' : '- Ya existe'}: Moneda (ID: ${coin.id})`);

  // Quest
  const [quest, questCreated] = await ObjectItem.findOrCreate({
    where: { type: 'quest' },
    defaults: {
      objectName: 'Misión',
      shortName: 'QUEST',
      description: 'Asigna una misión especial al usuario',
      type: 'quest'
    }
  });
  console.log(`${questCreated ? '✓ Creado' : '- Ya existe'}: Misión (ID: ${quest.id})`);

  console.log('\n✓ Objetos de recompensa verificados/creados');
  console.log('\nResumen:');
  console.log(`- Experiencia: ID ${exp.id} (${exp.shortName})`);
  console.log(`- Moneda: ID ${coin.id} (${coin.shortName})`);
  console.log(`- Misión: ID ${quest.id} (${quest.shortName})`);
}

seedRewardObjects()
  .then(() => {
    console.log('\n✓ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Error:', err);
    process.exit(1);
  });
