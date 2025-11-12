/**
 * Tests para el sistema de periodicidad personalizada
 * Ejecutar con: npm test -- periodUtils.test.js
 */

const periodUtils = require('../src/utils/periodUtils');

describe('PeriodUtils - Sistema de Periodicidad Personalizada', () => {
  
  describe('computeFixedPeriod', () => {
    test('Calcula correctamente período diario (D)', () => {
      const baseDate = new Date('2025-11-11T03:00:00');
      const nextDate = periodUtils.computeFixedPeriod('D', baseDate);
      
      expect(nextDate.getDate()).toBe(12);
      expect(nextDate.getHours()).toBe(3);
    });

    test('Calcula correctamente período semanal (W)', () => {
      const baseDate = new Date('2025-11-11T03:00:00');
      const nextDate = periodUtils.computeFixedPeriod('W', baseDate);
      
      expect(nextDate.getDate()).toBe(18);
      expect(nextDate.getHours()).toBe(3);
    });

    test('Calcula correctamente período mensual (M)', () => {
      const baseDate = new Date('2025-11-11T03:00:00');
      const nextDate = periodUtils.computeFixedPeriod('M', baseDate);
      
      expect(nextDate.getMonth()).toBe(11); // Diciembre (0-indexed)
      expect(nextDate.getDate()).toBe(11);
    });
  });

  describe('computeWeekdaysPeriod - Días Específicos', () => {
    test('Calcula próximo Lunes desde Viernes', () => {
      // Viernes 11 Nov 2025
      const friday = new Date('2025-11-07T03:00:00'); // Viernes
      const questHeader = { activeDays: '1' }; // Solo Lunes
      
      const nextDate = periodUtils.computeWeekdaysPeriod(questHeader.activeDays, friday);
      
      expect(nextDate.getDay()).toBe(1); // Lunes
      expect(nextDate.getDate()).toBe(10); // 10 Nov
    });

    test('Calcula L-M-V correctamente', () => {
      // Lunes 11 Nov 2025 (después de las 03:00)
      const monday = new Date('2025-11-11T04:00:00');
      monday.setHours(3, 0, 0, 0); // Base a las 03:00
      
      const questHeader = { activeDays: '1,3,5' }; // L-M-V
      
      // Desde Lunes → debe dar Miércoles
      const nextDate = periodUtils.computeWeekdaysPeriod(questHeader.activeDays, monday);
      expect(nextDate.getDay()).toBe(3); // Miércoles
    });

    test('Salta correctamente de Viernes a Lunes', () => {
      const friday = new Date('2025-11-14T03:00:00'); // Viernes
      const questHeader = { activeDays: '1,3,5' };
      
      const nextDate = periodUtils.computeWeekdaysPeriod(questHeader.activeDays, friday);
      expect(nextDate.getDay()).toBe(1); // Lunes
      expect(nextDate.getDate()).toBe(17);
    });

    test('Maneja Domingo como día 0', () => {
      const saturday = new Date('2025-11-15T03:00:00'); // Sábado
      const questHeader = { activeDays: '0' }; // Solo Domingo
      
      const nextDate = periodUtils.computeWeekdaysPeriod(questHeader.activeDays, saturday);
      expect(nextDate.getDay()).toBe(0); // Domingo
      expect(nextDate.getDate()).toBe(16);
    });
  });

  describe('isActiveWeekday', () => {
    test('Verifica correctamente día activo', () => {
      const monday = new Date('2025-11-11T10:00:00'); // Lunes
      const isActive = periodUtils.isActiveWeekday('1,3,5', monday);
      expect(isActive).toBe(true);
    });

    test('Verifica correctamente día inactivo', () => {
      const tuesday = new Date('2025-11-12T10:00:00'); // Martes
      const isActive = periodUtils.isActiveWeekday('1,3,5', tuesday);
      expect(isActive).toBe(false);
    });
  });

  describe('computePatternPeriod - Patrón Cíclico', () => {
    test('Calcula patrón 1,0 (día sí, día no)', () => {
      const startDate = new Date('2025-11-11T00:00:00');
      const fromDate = new Date('2025-11-11T03:00:00'); // Día 0 del patrón
      
      // Patrón: 1,0 (activo, descanso)
      // Día 0 (11 Nov): activo
      // Día 1 (12 Nov): descanso
      // Día 2 (13 Nov): activo (siguiente)
      
      const nextDate = periodUtils.computePatternPeriod('1,0', startDate, fromDate);
      expect(nextDate.getDate()).toBe(13); // Debería saltar al día 13
    });

    test('Calcula patrón 1,1,0,0 (2 on, 2 off)', () => {
      const startDate = new Date('2025-11-11T00:00:00');
      const fromDate = new Date('2025-11-11T03:00:00'); // Día 0
      
      // Día 0: activo
      // Día 1: activo (siguiente)
      
      const nextDate = periodUtils.computePatternPeriod('1,1,0,0', startDate, fromDate);
      expect(nextDate.getDate()).toBe(12);
    });

    test('Cicla correctamente el patrón', () => {
      const startDate = new Date('2025-11-11T00:00:00');
      const fromDate = new Date('2025-11-13T03:00:00'); // Día 2 (primer descanso)
      
      // Patrón 1,1,0,0
      // Día 0-1: activo
      // Día 2-3: descanso
      // Día 4: activo (debería volver aquí)
      
      const nextDate = periodUtils.computePatternPeriod('1,1,0,0', startDate, fromDate);
      expect(nextDate.getDate()).toBe(15); // 11+4 = 15
    });
  });

  describe('isActiveInPattern', () => {
    test('Verifica correctamente día activo en patrón', () => {
      const startDate = new Date('2025-11-11T00:00:00');
      const checkDate = new Date('2025-11-11T10:00:00'); // Día 0
      
      const isActive = periodUtils.isActiveInPattern('1,0', startDate, checkDate);
      expect(isActive).toBe(true);
    });

    test('Verifica correctamente día de descanso en patrón', () => {
      const startDate = new Date('2025-11-11T00:00:00');
      const checkDate = new Date('2025-11-12T10:00:00'); // Día 1
      
      const isActive = periodUtils.isActiveInPattern('1,0', startDate, checkDate);
      expect(isActive).toBe(false);
    });

    test('Cicla correctamente después de completar patrón', () => {
      const startDate = new Date('2025-11-11T00:00:00');
      const checkDate = new Date('2025-11-13T10:00:00'); // Día 2 (ciclo completo)
      
      // Patrón 1,0 se repite: día 2 = día 0 del ciclo
      const isActive = periodUtils.isActiveInPattern('1,0', startDate, checkDate);
      expect(isActive).toBe(true);
    });
  });

  describe('computeNextExpiration - Función Principal', () => {
    test('Usa FIXED correctamente', () => {
      const questHeader = {
        period: 'D',
        periodType: 'FIXED'
      };
      const fromDate = new Date('2025-11-11T04:00:00');
      
      const nextDate = periodUtils.computeNextExpiration(questHeader, fromDate);
      expect(nextDate.getDate()).toBe(12);
    });

    test('Usa WEEKDAYS correctamente', () => {
      const questHeader = {
        periodType: 'WEEKDAYS',
        activeDays: '1,3,5'
      };
      const monday = new Date('2025-11-11T04:00:00'); // Lunes
      monday.setHours(3, 0, 0, 0);
      
      const nextDate = periodUtils.computeNextExpiration(questHeader, monday);
      expect(nextDate.getDay()).toBe(3); // Miércoles
    });

    test('Usa PATTERN correctamente', () => {
      const questHeader = {
        periodType: 'PATTERN',
        periodPattern: '1,0',
        patternStartDate: new Date('2025-11-11T00:00:00')
      };
      const fromDate = new Date('2025-11-11T04:00:00');
      fromDate.setHours(3, 0, 0, 0);
      
      const nextDate = periodUtils.computeNextExpiration(questHeader, fromDate);
      expect(nextDate.getDate()).toBe(13); // Salta día 12 (descanso)
    });

    test('Retorna hoy si aún no son las 03:00', () => {
      const questHeader = {
        period: 'D',
        periodType: 'FIXED'
      };
      const earlyMorning = new Date('2025-11-11T02:00:00');
      
      const nextDate = periodUtils.computeNextExpiration(questHeader, earlyMorning);
      expect(nextDate.getDate()).toBe(11); // Mismo día
      expect(nextDate.getHours()).toBe(3);
    });
  });

  describe('shouldBeActiveOnDate', () => {
    test('FIXED siempre retorna true', () => {
      const questHeader = { periodType: 'FIXED', period: 'D' };
      const anyDate = new Date('2025-11-11T10:00:00');
      
      expect(periodUtils.shouldBeActiveOnDate(questHeader, anyDate)).toBe(true);
    });

    test('WEEKDAYS verifica correctamente', () => {
      const questHeader = { periodType: 'WEEKDAYS', activeDays: '1,3,5' };
      
      const monday = new Date('2025-11-11T10:00:00'); // Lunes
      const tuesday = new Date('2025-11-12T10:00:00'); // Martes
      
      expect(periodUtils.shouldBeActiveOnDate(questHeader, monday)).toBe(true);
      expect(periodUtils.shouldBeActiveOnDate(questHeader, tuesday)).toBe(false);
    });

    test('PATTERN verifica correctamente', () => {
      const questHeader = {
        periodType: 'PATTERN',
        periodPattern: '1,0',
        patternStartDate: new Date('2025-11-11T00:00:00')
      };
      
      const day0 = new Date('2025-11-11T10:00:00');
      const day1 = new Date('2025-11-12T10:00:00');
      
      expect(periodUtils.shouldBeActiveOnDate(questHeader, day0)).toBe(true);
      expect(periodUtils.shouldBeActiveOnDate(questHeader, day1)).toBe(false);
    });
  });

  describe('validatePeriodConfig', () => {
    test('Valida FIXED correctamente', () => {
      const valid = { periodType: 'FIXED', period: 'D' };
      const invalid = { periodType: 'FIXED', period: 'X' };
      
      expect(periodUtils.validatePeriodConfig(valid).valid).toBe(true);
      expect(periodUtils.validatePeriodConfig(invalid).valid).toBe(false);
    });

    test('Valida WEEKDAYS correctamente', () => {
      const valid = { periodType: 'WEEKDAYS', activeDays: '1,3,5' };
      const invalid1 = { periodType: 'WEEKDAYS' }; // Sin activeDays
      const invalid2 = { periodType: 'WEEKDAYS', activeDays: '8,9' }; // Números inválidos
      
      expect(periodUtils.validatePeriodConfig(valid).valid).toBe(true);
      expect(periodUtils.validatePeriodConfig(invalid1).valid).toBe(false);
      expect(periodUtils.validatePeriodConfig(invalid2).valid).toBe(false);
    });

    test('Valida PATTERN correctamente', () => {
      const valid = {
        periodType: 'PATTERN',
        periodPattern: '1,0',
        patternStartDate: new Date()
      };
      const invalid1 = { periodType: 'PATTERN' }; // Sin campos
      const invalid2 = {
        periodType: 'PATTERN',
        periodPattern: '1,2,3' // Valores inválidos
      };
      
      expect(periodUtils.validatePeriodConfig(valid).valid).toBe(true);
      expect(periodUtils.validatePeriodConfig(invalid1).valid).toBe(false);
      expect(periodUtils.validatePeriodConfig(invalid2).valid).toBe(false);
    });

    test('Retorna errores descriptivos', () => {
      const invalid = { periodType: 'WEEKDAYS' };
      const result = periodUtils.validatePeriodConfig(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('activeDays');
    });
  });

  describe('Casos de Uso Reales', () => {
    test('Entrenamiento L-M-V: secuencia completa de una semana', () => {
      const questHeader = {
        periodType: 'WEEKDAYS',
        activeDays: '1,3,5' // Lunes, Miércoles, Viernes
      };

      // Simular una semana completa
      const dates = [
        { date: new Date('2025-11-10T10:00:00'), expected: false, day: 'Dom' },
        { date: new Date('2025-11-11T10:00:00'), expected: true, day: 'Lun' },
        { date: new Date('2025-11-12T10:00:00'), expected: false, day: 'Mar' },
        { date: new Date('2025-11-13T10:00:00'), expected: true, day: 'Mié' },
        { date: new Date('2025-11-14T10:00:00'), expected: false, day: 'Jue' },
        { date: new Date('2025-11-15T10:00:00'), expected: true, day: 'Vie' },
        { date: new Date('2025-11-16T10:00:00'), expected: false, day: 'Sáb' },
      ];

      dates.forEach(({ date, expected, day }) => {
        const isActive = periodUtils.shouldBeActiveOnDate(questHeader, date);
        expect(isActive).toBe(expected);
      });
    });

    test('Cardio alternado: 7 días de ciclo', () => {
      const questHeader = {
        periodType: 'PATTERN',
        periodPattern: '1,0', // 1 día on, 1 día off
        patternStartDate: new Date('2025-11-11T00:00:00')
      };

      const results = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date('2025-11-11T00:00:00');
        date.setDate(date.getDate() + i);
        results.push(periodUtils.shouldBeActiveOnDate(questHeader, date));
      }

      // Debe alternar: true, false, true, false, ...
      expect(results).toEqual([true, false, true, false, true, false, true]);
    });

    test('Entrenamiento intensivo 2-2: ciclo completo', () => {
      const questHeader = {
        periodType: 'PATTERN',
        periodPattern: '1,1,0,0', // 2 días on, 2 días off
        patternStartDate: new Date('2025-11-11T00:00:00')
      };

      const results = [];
      for (let i = 0; i < 8; i++) {
        const date = new Date('2025-11-11T00:00:00');
        date.setDate(date.getDate() + i);
        results.push(periodUtils.shouldBeActiveOnDate(questHeader, date));
      }

      // Debe seguir patrón: on, on, off, off, on, on, off, off
      expect(results).toEqual([true, true, false, false, true, true, false, false]);
    });
  });
});
