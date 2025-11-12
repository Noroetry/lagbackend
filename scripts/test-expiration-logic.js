/**
 * Script para validar la lógica de expiración de misiones
 * Prueba el nuevo sistema donde todas las misiones expiran a las 03:00
 * sin privilegio de duration personalizado
 */

const periodUtils = require('../src/utils/periodUtils');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testCase(description, testFn) {
  try {
    testFn();
    log(`✓ ${description}`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${description}`, 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

// Función helper para verificar fechas
function assertDateEquals(actual, expected, message) {
  if (actual.getTime() !== expected.getTime()) {
    throw new Error(`${message}\n  Expected: ${expected.toISOString()}\n  Actual: ${actual.toISOString()}`);
  }
}

function assertDateHour(date, hour, minute, message) {
  if (date.getHours() !== hour || date.getMinutes() !== minute) {
    throw new Error(`${message}\n  Expected: ${hour}:${minute}\n  Actual: ${date.getHours()}:${date.getMinutes()}`);
  }
}

log('\n=== TESTS DE EXPIRACIÓN DE MISIONES ===\n', 'cyan');

let passed = 0;
let failed = 0;

// TEST 1: Quest FIXED diaria - debe expirar a las 03:00 del día siguiente
if (testCase('Quest FIXED diaria activada a las 10:00 expira a las 03:00 del día siguiente', () => {
  const header = {
    periodType: 'FIXED',
    period: 'D',
    duration: 1440
  };
  const activationDate = new Date('2025-11-12T10:00:00');
  const expiration = periodUtils.computeFirstActivationExpiration(header, activationDate);
  
  const expected = new Date('2025-11-13T03:00:00');
  assertDateEquals(expiration, expected, 'La expiración debe ser a las 03:00 del día siguiente');
})) {
  passed++;
} else {
  failed++;
}

// TEST 2: Quest WEEKDAYS (L-M-V) activada en martes - debe expirar el miércoles a las 03:00
if (testCase('Quest WEEKDAYS (L-M-V) activada el martes expira el miércoles a las 03:00', () => {
  const header = {
    periodType: 'WEEKDAYS',
    activeDays: '1,3,5', // Lunes, Miércoles, Viernes
    period: 'D',
    duration: 1440
  };
  // Martes 12 de noviembre 2025 a las 14:00
  const activationDate = new Date('2025-11-12T14:00:00'); // Martes (día 2)
  const expiration = periodUtils.computeFirstActivationExpiration(header, activationDate);
  
  // Debe programar para miércoles 13 a las 03:00 (siguiente día válido)
  const expected = new Date('2025-11-13T03:00:00');
  assertDateEquals(expiration, expected, 'La expiración debe ser el miércoles a las 03:00');
})) {
  passed++;
} else {
  failed++;
}

// TEST 3: Quest WEEKDAYS (L-M-V) activada en lunes - debe expirar el miércoles a las 03:00
if (testCase('Quest WEEKDAYS (L-M-V) activada el lunes expira el miércoles a las 03:00', () => {
  const header = {
    periodType: 'WEEKDAYS',
    activeDays: '1,3,5', // Lunes, Miércoles, Viernes
    period: 'D',
    duration: 1440
  };
  // Lunes 11 de noviembre 2025 a las 10:00
  const activationDate = new Date('2025-11-10T10:00:00'); // Lunes (día 1)
  const expiration = periodUtils.computeFirstActivationExpiration(header, activationDate);
  
  // Debe programar para miércoles 12 a las 03:00 (siguiente día válido en el patrón)
  const expected = new Date('2025-11-12T03:00:00');
  assertDateEquals(expiration, expected, 'La expiración debe ser el miércoles a las 03:00');
})) {
  passed++;
} else {
  failed++;
}

// TEST 4: Quest WEEKDAYS activada antes de las 03:00 del día válido
if (testCase('Quest WEEKDAYS activada a las 01:00 del lunes expira a las 03:00 del mismo día', () => {
  const header = {
    periodType: 'WEEKDAYS',
    activeDays: '1,3,5', // Lunes, Miércoles, Viernes
    period: 'D',
    duration: 1440
  };
  // Lunes a las 01:00 (antes de las 03:00)
  const activationDate = new Date('2025-11-10T01:00:00'); // Lunes (día 1)
  const expiration = periodUtils.computeFirstActivationExpiration(header, activationDate);
  
  // Debe programar para el mismo lunes a las 03:00
  const expected = new Date('2025-11-10T03:00:00');
  assertDateEquals(expiration, expected, 'La expiración debe ser a las 03:00 del mismo día');
})) {
  passed++;
} else {
  failed++;
}

// TEST 5: Quest FIXED activada a las 02:00 expira a las 03:00 del mismo día
if (testCase('Quest FIXED activada a las 02:00 expira a las 03:00 del mismo día', () => {
  const header = {
    periodType: 'FIXED',
    period: 'D',
    duration: 1440
  };
  const activationDate = new Date('2025-11-12T02:00:00');
  const expiration = periodUtils.computeFirstActivationExpiration(header, activationDate);
  
  const expected = new Date('2025-11-12T03:00:00');
  assertDateEquals(expiration, expected, 'La expiración debe ser a las 03:00 del mismo día');
})) {
  passed++;
} else {
  failed++;
}

// TEST 6: Quest WEEKDAYS activada después de las 03:00 del día válido
if (testCase('Quest WEEKDAYS activada a las 16:00 del viernes expira el lunes a las 03:00', () => {
  const header = {
    periodType: 'WEEKDAYS',
    activeDays: '1,3,5', // Lunes, Miércoles, Viernes
    period: 'D',
    duration: 1440
  };
  // Viernes a las 16:00
  const activationDate = new Date('2025-11-14T16:00:00'); // Viernes (día 5)
  const expiration = periodUtils.computeFirstActivationExpiration(header, activationDate);
  
  // Debe programar para el siguiente lunes a las 03:00
  const expected = new Date('2025-11-17T03:00:00'); // Lunes siguiente
  assertDateEquals(expiration, expected, 'La expiración debe ser el lunes a las 03:00');
})) {
  passed++;
} else {
  failed++;
}

// TEST 7: Verificar que siempre expira a las 03:00 (hora correcta)
if (testCase('Todas las expiraciones son a las 03:00:00', () => {
  const headers = [
    { periodType: 'FIXED', period: 'D', duration: 1440 },
    { periodType: 'WEEKDAYS', activeDays: '1,3,5', period: 'D', duration: 1440 },
    { periodType: 'WEEKDAYS', activeDays: '0,2,4,6', period: 'D', duration: 1440 }
  ];
  
  const testDates = [
    new Date('2025-11-12T08:00:00'),
    new Date('2025-11-12T14:30:00'),
    new Date('2025-11-12T23:45:00')
  ];
  
  for (const header of headers) {
    for (const date of testDates) {
      const expiration = periodUtils.computeFirstActivationExpiration(header, date);
      assertDateHour(expiration, 3, 0, `La expiración debe ser a las 03:00:00, no ${expiration.getHours()}:${expiration.getMinutes()}`);
    }
  }
})) {
  passed++;
} else {
  failed++;
}

// TEST 8: Verificar computeNextExpiration para reactivación periódica
if (testCase('computeNextExpiration programa correctamente la siguiente activación', () => {
  const header = {
    periodType: 'WEEKDAYS',
    activeDays: '1,3,5', // Lunes, Miércoles, Viernes
    period: 'D'
  };
  
  // Si hoy es lunes después de las 03:00, la próxima es miércoles a las 03:00
  const monday = new Date('2025-11-10T10:00:00'); // Lunes
  const nextFromMonday = periodUtils.computeNextExpiration(header, monday);
  const expectedWednesday = new Date('2025-11-12T03:00:00');
  assertDateEquals(nextFromMonday, expectedWednesday, 'Desde lunes debe programar miércoles');
  
  // Si hoy es miércoles después de las 03:00, la próxima es viernes a las 03:00
  const wednesday = new Date('2025-11-12T10:00:00'); // Miércoles
  const nextFromWednesday = periodUtils.computeNextExpiration(header, wednesday);
  const expectedFriday = new Date('2025-11-14T03:00:00');
  assertDateEquals(nextFromWednesday, expectedFriday, 'Desde miércoles debe programar viernes');
  
  // Si hoy es viernes después de las 03:00, la próxima es lunes a las 03:00
  const friday = new Date('2025-11-14T10:00:00'); // Viernes
  const nextFromFriday = periodUtils.computeNextExpiration(header, friday);
  const expectedMonday = new Date('2025-11-17T03:00:00');
  assertDateEquals(nextFromFriday, expectedMonday, 'Desde viernes debe programar lunes');
})) {
  passed++;
} else {
  failed++;
}

// TEST 9: Usuario nuevo entra en martes - misión WEEKDAYS no se activa ese día
if (testCase('Usuario nuevo en martes: misión WEEKDAYS (L-M-V) programa para miércoles', () => {
  const header = {
    periodType: 'WEEKDAYS',
    activeDays: '1,3,5', // Lunes, Miércoles, Viernes
    period: 'D',
    duration: 1440
  };
  
  // Martes 12 de noviembre 2025 a las 18:00 (día no válido)
  const tuesdayActivation = new Date('2025-11-12T18:00:00'); // Martes (día 2)
  
  // Verificar que hoy NO es válido
  const isTodayValid = periodUtils.shouldBeActiveOnDate(header, tuesdayActivation);
  if (isTodayValid) {
    throw new Error('El martes NO debería ser un día válido para L-M-V');
  }
  
  // La expiración debe ser miércoles a las 03:00
  const expiration = periodUtils.computeFirstActivationExpiration(header, tuesdayActivation);
  const expectedWednesday = new Date('2025-11-13T03:00:00');
  assertDateEquals(expiration, expectedWednesday, 'Debe programar para el miércoles a las 03:00');
})) {
  passed++;
} else {
  failed++;
}

// TEST 10: Misión completada debe reprogramarse para el siguiente día válido
if (testCase('Misión completada el lunes se reprograma para miércoles a las 03:00', () => {
  const header = {
    periodType: 'WEEKDAYS',
    activeDays: '1,3,5', // Lunes, Miércoles, Viernes
    period: 'D'
  };
  
  // Completada el lunes a las 22:00
  const completionDate = new Date('2025-11-10T22:00:00'); // Lunes
  const nextExpiration = periodUtils.computeNextExpiration(header, completionDate);
  
  const expectedWednesday = new Date('2025-11-12T03:00:00');
  assertDateEquals(nextExpiration, expectedWednesday, 'Debe reprogramar para miércoles a las 03:00');
})) {
  passed++;
} else {
  failed++;
}

// Resumen
log('\n=== RESUMEN ===\n', 'cyan');
log(`Tests pasados: ${passed}`, 'green');
log(`Tests fallidos: ${failed}`, failed > 0 ? 'red' : 'green');

if (failed === 0) {
  log('\n✓ Todos los tests pasaron correctamente', 'green');
  process.exit(0);
} else {
  log('\n✗ Algunos tests fallaron', 'red');
  process.exit(1);
}
