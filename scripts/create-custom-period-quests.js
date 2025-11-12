/**
 * Script de ejemplo para crear quests con periodicidad personalizada
 * 
 * Ejemplos incluidos:
 * 1. Entrenamiento de Fuerza (Lunes, Miércoles, Viernes)
 * 2. Ejercicio día sí, día no
 * 3. Patrón 2 días on, 2 días off
 */

const db = require('../src/config/database');
const logger = require('../src/utils/logger');
const periodUtils = require('../src/utils/periodUtils');

async function createCustomPeriodicQuests() {
  try {
    const { ObjectItem, QuestsHeader, QuestsDetail, QuestsObject } = db;

    // 1. Crear objeto de experiencia si no existe
    const [expObject] = await ObjectItem.findOrCreate({
      where: { objectName: 'Experiencia' },
      defaults: { description: 'Experiencia', type: 'experience' }
    });
    logger.info('✓ Objeto de experiencia asegurado');

    // ==============================================
    // EJEMPLO 1: Entrenamiento de Fuerza (L-M-V)
    // ==============================================
    console.log('\n📅 Creando: Entrenamiento de Fuerza (Lunes-Miércoles-Viernes)');
    
    const [strengthTraining] = await QuestsHeader.findOrCreate({
      where: { title: 'Entrenamiento de Fuerza' },
      defaults: {
        title: 'Entrenamiento de Fuerza',
        description: 'Realiza tu rutina de entrenamiento de fuerza. Recuerda: el descanso es tan importante como el ejercicio.',
        welcomeMessage: '💪 ¡Es día de entrenar! Hoy toca fuerza.',
        period: 'D', // Mantener para compatibilidad, pero se usa periodType
        periodType: 'WEEKDAYS', // ← Nuevo tipo
        activeDays: '1,3,5', // ← Lunes (1), Miércoles (3), Viernes (5)
        duration: 1440, // 24 horas de ventana
        active: true,
        levelRequired: 1,
        baseRewardXP: 50,
        basePenaltyXP: -10
      }
    });

    // Detalles de la quest
    await QuestsDetail.findOrCreate({
      where: { idQuest: strengthTraining.id, description: 'Completé mi rutina de entrenamiento de fuerza' },
      defaults: {
        idQuest: strengthTraining.id,
        needParam: false,
        description: 'Completé mi rutina de entrenamiento de fuerza',
        isEditable: false,
        paramType: 'text'
      }
    });

    // Recompensa
    await QuestsObject.findOrCreate({
      where: { idQuest: strengthTraining.id, idObject: expObject.id },
      defaults: {
        idQuest: strengthTraining.id,
        idObject: expObject.id,
        type: 'R', // Reward
        quantity: 50
      }
    });

    console.log('✅ Entrenamiento de Fuerza creado');
    console.log('   - Se activará solo: Lunes, Miércoles y Viernes');
    console.log('   - Los demás días estarán en descanso');

    // Validar configuración
    const validation1 = periodUtils.validatePeriodConfig(strengthTraining);
    console.log(`   - Validación: ${validation1.valid ? '✓ OK' : '✗ ERROR'}`);
    if (!validation1.valid) {
      console.log('   - Errores:', validation1.errors);
    }

    // ==============================================
    // EJEMPLO 2: Ejercicio Alternado (día sí, día no)
    // ==============================================
    console.log('\n📅 Creando: Ejercicio Alternado (día sí, día no)');
    
    const patternStart = new Date();
    patternStart.setHours(0, 0, 0, 0);

    const [alternateExercise] = await QuestsHeader.findOrCreate({
      where: { title: 'Ejercicio Alternado' },
      defaults: {
        title: 'Ejercicio Alternado',
        description: 'Ejercicio cardiovascular con un día de descanso entre sesiones.',
        welcomeMessage: '🏃 ¡Hoy toca cardio! Dale con todo.',
        period: 'D',
        periodType: 'PATTERN', // ← Patrón cíclico
        periodPattern: '1,0', // ← 1 día activo, 1 día descanso
        patternStartDate: patternStart, // ← Inicio del patrón
        duration: 1440,
        active: true,
        levelRequired: 1,
        baseRewardXP: 40,
        basePenaltyXP: -8
      }
    });

    await QuestsDetail.findOrCreate({
      where: { idQuest: alternateExercise.id, description: 'Hice mi sesión de cardio' },
      defaults: {
        idQuest: alternateExercise.id,
        needParam: false,
        description: 'Hice mi sesión de cardio',
        isEditable: false,
        paramType: 'text'
      }
    });

    await QuestsObject.findOrCreate({
      where: { idQuest: alternateExercise.id, idObject: expObject.id },
      defaults: {
        idQuest: alternateExercise.id,
        idObject: expObject.id,
        type: 'R',
        quantity: 40
      }
    });

    console.log('✅ Ejercicio Alternado creado');
    console.log(`   - Patrón: día activo, día descanso (repetición)`);
    console.log(`   - Inicio del patrón: ${patternStart.toLocaleDateString()}`);

    const validation2 = periodUtils.validatePeriodConfig(alternateExercise);
    console.log(`   - Validación: ${validation2.valid ? '✓ OK' : '✗ ERROR'}`);
    if (!validation2.valid) {
      console.log('   - Errores:', validation2.errors);
    }

    // ==============================================
    // EJEMPLO 3: Patrón 2-2 (2 días on, 2 días off)
    // ==============================================
    console.log('\n📅 Creando: Entrenamiento Intensivo (2 días on, 2 días off)');
    
    const [intensiveTraining] = await QuestsHeader.findOrCreate({
      where: { title: 'Entrenamiento Intensivo' },
      defaults: {
        title: 'Entrenamiento Intensivo',
        description: 'Entrenamiento de alta intensidad con recuperación adecuada.',
        welcomeMessage: '🔥 ¡Día de entrenamiento intensivo! Vamos con todo.',
        period: 'D',
        periodType: 'PATTERN',
        periodPattern: '1,1,0,0', // ← 2 días on, 2 días off
        patternStartDate: patternStart,
        duration: 1440,
        active: true,
        levelRequired: 5, // Requiere nivel más alto
        baseRewardXP: 60,
        basePenaltyXP: -12
      }
    });

    await QuestsDetail.findOrCreate({
      where: { idQuest: intensiveTraining.id, description: 'Completé mi entrenamiento intensivo' },
      defaults: {
        idQuest: intensiveTraining.id,
        needParam: false,
        description: 'Completé mi entrenamiento intensivo',
        isEditable: false,
        paramType: 'text'
      }
    });

    await QuestsObject.findOrCreate({
      where: { idQuest: intensiveTraining.id, idObject: expObject.id },
      defaults: {
        idQuest: intensiveTraining.id,
        idObject: expObject.id,
        type: 'R',
        quantity: 60
      }
    });

    console.log('✅ Entrenamiento Intensivo creado');
    console.log('   - Patrón: 2 días activos, 2 días de descanso');

    const validation3 = periodUtils.validatePeriodConfig(intensiveTraining);
    console.log(`   - Validación: ${validation3.valid ? '✓ OK' : '✗ ERROR'}`);
    if (!validation3.valid) {
      console.log('   - Errores:', validation3.errors);
    }

    // ==============================================
    // DEMO: Calcular próximas activaciones
    // ==============================================
    console.log('\n📊 Simulación de próximas activaciones:');
    console.log('\n--- Entrenamiento de Fuerza (L-M-V) ---');
    let nextDate = new Date();
    for (let i = 0; i < 10; i++) {
      nextDate = periodUtils.computeNextExpiration(strengthTraining, nextDate);
      const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][nextDate.getDay()];
      console.log(`   ${i + 1}. ${nextDate.toLocaleDateString()} (${dayName})`);
    }

    console.log('\n--- Ejercicio Alternado (1 on, 1 off) ---');
    nextDate = new Date();
    for (let i = 0; i < 10; i++) {
      nextDate = periodUtils.computeNextExpiration(alternateExercise, nextDate);
      console.log(`   ${i + 1}. ${nextDate.toLocaleDateString()}`);
    }

    console.log('\n--- Entrenamiento Intensivo (2 on, 2 off) ---');
    nextDate = new Date();
    for (let i = 0; i < 10; i++) {
      nextDate = periodUtils.computeNextExpiration(intensiveTraining, nextDate);
      console.log(`   ${i + 1}. ${nextDate.toLocaleDateString()}`);
    }

    console.log('\n✅ Todas las quests personalizadas creadas exitosamente');
    console.log('\n💡 Notas importantes:');
    console.log('   - Las quests con periodType="WEEKDAYS" solo se activan en los días especificados');
    console.log('   - Las quests con periodType="PATTERN" siguen un patrón cíclico desde patternStartDate');
    console.log('   - Las quests con periodType="FIXED" usan el sistema original (D/W/M)');
    console.log('   - El sistema calcula automáticamente la próxima activación según el tipo');

  } catch (error) {
    logger.error('Error creando quests personalizadas:', error);
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Ejecutar el script
if (require.main === module) {
  createCustomPeriodicQuests()
    .then(() => {
      console.log('\n✨ Script completado');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Error fatal:', err);
      process.exit(1);
    });
}

module.exports = { createCustomPeriodicQuests };
