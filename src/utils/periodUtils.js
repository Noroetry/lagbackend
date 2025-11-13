/**
 * Utilidades para calcular periodicidad personalizada de quests
 * Soporta tres tipos de períodos:
 * 1. FIXED: Períodos fijos (D/W/M) - Sistema original
 * 2. WEEKDAYS: Días específicos de la semana (ej: Lunes, Miércoles, Viernes)
 * 3. PATTERN: Patrón cíclico personalizado (ej: 2 días on, 1 día off)
 */

const logger = require('./logger');

/**
 * Calcula la próxima fecha de activación/expiración basándose en la configuración de periodicidad
 * @param {Object} questHeader - Objeto QuestsHeader con campos de periodicidad
 * @param {Date} fromDate - Fecha desde la cual calcular (default: ahora)
 * @returns {Date} Próxima fecha de activación a las 03:00
 */
function computeNextExpiration(questHeader, fromDate = null) {
  const now = fromDate ? new Date(fromDate) : new Date();
  const target = new Date(now);
  target.setHours(3, 0, 0, 0);

  // Si aún no hemos pasado las 03:00 de hoy, usar hoy
  if (now < target) {
    return target;
  }

  const periodType = (questHeader.periodType || 'FIXED').toUpperCase();

  switch (periodType) {
    case 'FIXED':
      return computeFixedPeriod(questHeader.period, target);
    
    case 'WEEKDAYS':
      return computeWeekdaysPeriod(questHeader.activeDays, target);
    
    case 'PATTERN':
      return computePatternPeriod(
        questHeader.periodPattern,
        questHeader.patternStartDate,
        target
      );
    
    default:
      return computeFixedPeriod('D', target);
  }
}

/**
 * Calcula la fecha de expiración para la primera activación de una quest.
 * TODAS las quests expiran a las 03:00 del día válido correspondiente, sin margen personalizado.
 * 
 * Para WEEKDAYS y PATTERN:
 * - Si hoy NO es un día válido, programa para el próximo día válido a las 03:00.
 * - Si hoy SÍ es válido, expira a las 03:00 del día siguiente válido (no mañana, sino el siguiente en el patrón).
 * 
 * Para FIXED:
 * - Mantiene el comportamiento original con período fijo.
 * 
 * @param {Object} questHeader - Objeto QuestsHeader
 * @param {Date} activationDate - Fecha de activación (default: ahora)
 * @returns {Date} Fecha de expiración para esta activación
 */
function computeFirstActivationExpiration(questHeader, activationDate = null) {
  const now = activationDate ? new Date(activationDate) : new Date();
  const periodType = (questHeader.periodType || 'FIXED').toUpperCase();

  // Para FIXED: usar computeNextExpiration (comportamiento estándar a las 03:00)
  if (periodType === 'FIXED') {
    const expiration = computeNextExpiration(questHeader, now);
    return expiration;
  }

  // Para WEEKDAYS y PATTERN: verificar si hoy es día válido
  const isTodayValid = shouldBeActiveOnDate(questHeader, now);

  if (periodType === 'WEEKDAYS') {
    const boundary = new Date(now);
    boundary.setHours(3, 0, 0, 0);

    if (!isTodayValid) {
      // Si hoy NO es válido, programar para el próximo día válido a las 03:00
      return computeNextExpiration(questHeader, now);
    }

    // Si hoy SÍ es válido
    if (now < boundary) {
      // Si aún no son las 03:00, la misión se activa hoy hasta mañana a las 03:00
      const expiration = new Date(now);
      expiration.setDate(expiration.getDate() + 1);
      expiration.setHours(3, 0, 0, 0);
      return expiration;
    }

    // Si ya pasaron las 03:00, la misión caduca mañana a las 03:00
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 1);
    expiration.setHours(3, 0, 0, 0);
    return expiration;
  }

  if (!isTodayValid) {
    // Para PATTERN: Si hoy NO es válido, programar directamente para el próximo día válido a las 03:00
    return computeNextExpiration(questHeader, now);
  }

  // Si hoy SÍ es válido para PATTERN, expira según el siguiente día válido del patrón
  const nextExpiration = computeNextExpiration(questHeader, now);
  return nextExpiration;
}

/**
 * Calcula si un quest debe estar activo en una fecha específica
 * @param {Object} questHeader - Objeto QuestsHeader
 * @param {Date} date - Fecha a verificar
 * @returns {boolean} true si el quest debe estar activo ese día
 */
function shouldBeActiveOnDate(questHeader, date = new Date()) {
  const periodType = (questHeader.periodType || 'FIXED').toUpperCase();
  
  switch (periodType) {
    case 'FIXED':
      // Los períodos fijos siempre están activos (se controla por expiración)
      return true;
    
    case 'WEEKDAYS':
      return isActiveWeekday(questHeader.activeDays, date);
    
    case 'PATTERN':
      return isActiveInPattern(
        questHeader.periodPattern,
        questHeader.patternStartDate,
        date
      );
    
    default:
      return true;
  }
}

/**
 * Sistema original: períodos fijos D/W/M
 */
function computeFixedPeriod(period, fromDate) {
  const target = new Date(fromDate);
  const p = (period || 'D').toUpperCase();
  
  if (p === 'D' || p === 'R') {
    target.setDate(target.getDate() + 1);
    return target;
  }
  
  if (p === 'W') {
    target.setDate(target.getDate() + 7);
    return target;
  }
  
  if (p === 'M') {
    const month = target.getMonth();
    target.setMonth(month + 1);
    return target;
  }
  
  // Default: siguiente día
  target.setDate(target.getDate() + 1);
  return target;
}

/**
 * Calcula próxima fecha para días específicos de la semana
 * @param {string} activeDays - String "1,3,5" para L-M-V
 * @param {Date} fromDate - Fecha base
 */
function computeWeekdaysPeriod(activeDays, fromDate) {
  if (!activeDays) {
    return computeFixedPeriod('D', fromDate);
  }

  const days = activeDays.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 0 && d <= 6);
  
  if (days.length === 0) {
    return computeFixedPeriod('D', fromDate);
  }

  // Ordenar días
  days.sort((a, b) => a - b);

  const current = new Date(fromDate);
  const currentDay = current.getDay(); // 0 = Domingo, 1 = Lunes, etc.

  // Buscar el próximo día activo
  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(current);
    nextDate.setDate(current.getDate() + i);
    const nextDay = nextDate.getDay();
    
    if (days.includes(nextDay)) {
      nextDate.setHours(3, 0, 0, 0);
      return nextDate;
    }
  }

  // Fallback: siguiente día (no debería llegar aquí)
  const fallback = new Date(current);
  fallback.setDate(current.getDate() + 1);
  fallback.setHours(3, 0, 0, 0);
  return fallback;
}

/**
 * Verifica si una fecha cae en un día activo según activeDays
 */
function isActiveWeekday(activeDays, date) {
  if (!activeDays) return true;
  
  const days = activeDays.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
  if (days.length === 0) return true;
  
  const dayOfWeek = date.getDay();
  return days.includes(dayOfWeek);
}

/**
 * Calcula próxima fecha para patrón cíclico personalizado
 * @param {string} periodPattern - String "1,1,0,1,0" (1=activo, 0=descanso)
 * @param {Date} patternStartDate - Fecha de inicio del patrón
 * @param {Date} fromDate - Fecha base
 */
function computePatternPeriod(periodPattern, patternStartDate, fromDate) {
  if (!periodPattern || !patternStartDate) {
    return computeFixedPeriod('D', fromDate);
  }

  const pattern = periodPattern.split(',').map(p => parseInt(p.trim(), 10)).filter(p => p === 0 || p === 1);
  
  if (pattern.length === 0) {
    return computeFixedPeriod('D', fromDate);
  }

  const start = new Date(patternStartDate);
  start.setHours(0, 0, 0, 0);
  
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);

  // Calcular días desde el inicio del patrón
  const daysSinceStart = Math.floor((current - start) / (1000 * 60 * 60 * 24));
  
  // Encontrar el próximo día activo en el patrón
  for (let i = 1; i <= pattern.length * 2; i++) { // buscar hasta 2 ciclos completos
    const daysFromStart = daysSinceStart + i;
    const patternIndex = daysFromStart % pattern.length;
    
    if (pattern[patternIndex] === 1) {
      const nextDate = new Date(current);
      nextDate.setDate(current.getDate() + i);
      nextDate.setHours(3, 0, 0, 0);
      return nextDate;
    }
  }

  // Fallback
  const fallback = new Date(current);
  fallback.setDate(current.getDate() + 1);
  fallback.setHours(3, 0, 0, 0);
  return fallback;
}

/**
 * Verifica si una fecha cae en un día activo según el patrón
 */
function isActiveInPattern(periodPattern, patternStartDate, date) {
  if (!periodPattern || !patternStartDate) return true;
  
  const pattern = periodPattern.split(',').map(p => parseInt(p.trim(), 10)).filter(p => p === 0 || p === 1);
  if (pattern.length === 0) return true;
  
  const start = new Date(patternStartDate);
  start.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  const daysSinceStart = Math.floor((checkDate - start) / (1000 * 60 * 60 * 24));
  const patternIndex = daysSinceStart % pattern.length;
  
  return pattern[patternIndex] === 1;
}

/**
 * Valida la configuración de periodicidad de un quest
 * @param {Object} questHeader - Objeto con configuración de periodicidad
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePeriodConfig(questHeader) {
  const errors = [];
  const periodType = (questHeader.periodType || 'FIXED').toUpperCase();
  
  switch (periodType) {
    case 'FIXED':
      if (!questHeader.period || !['D', 'W', 'M', 'R', 'U'].includes(questHeader.period.toUpperCase())) {
        errors.push('Invalid period value for FIXED type');
      }
      break;
    
    case 'WEEKDAYS':
      if (!questHeader.activeDays) {
        errors.push('activeDays is required for WEEKDAYS type');
      } else {
        const days = questHeader.activeDays.split(',').map(d => parseInt(d.trim(), 10));
        if (days.some(d => isNaN(d) || d < 0 || d > 6)) {
          errors.push('activeDays must contain valid day numbers (0-6)');
        }
        if (days.length === 0) {
          errors.push('activeDays must contain at least one day');
        }
      }
      break;
    
    case 'PATTERN':
      if (!questHeader.periodPattern) {
        errors.push('periodPattern is required for PATTERN type');
      } else {
        const pattern = questHeader.periodPattern.split(',').map(p => parseInt(p.trim(), 10));
        if (pattern.some(p => p !== 0 && p !== 1)) {
          errors.push('periodPattern must contain only 0 and 1');
        }
        if (pattern.length === 0) {
          errors.push('periodPattern must contain at least one value');
        }
      }
      if (!questHeader.patternStartDate) {
        errors.push('patternStartDate is required for PATTERN type');
      }
      break;
    
    default:
      errors.push(`Unknown periodType: ${periodType}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  computeNextExpiration,
  computeFirstActivationExpiration,
  shouldBeActiveOnDate,
  validatePeriodConfig,
  // Exportar funciones individuales para testing
  computeFixedPeriod,
  computeWeekdaysPeriod,
  computePatternPeriod,
  isActiveWeekday,
  isActiveInPattern
};
