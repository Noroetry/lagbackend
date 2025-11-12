'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Agregar nuevo campo para tipo de periodicidad
    await queryInterface.addColumn('quests_headers', 'periodType', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'FIXED',
      comment: 'Tipo de periodicidad: FIXED (D/W/M), WEEKDAYS (días específicos), PATTERN (patrón cíclico)'
    });

    // Para periodicidad por días de la semana específicos (ej: L-M-V)
    await queryInterface.addColumn('quests_headers', 'activeDays', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Días activos separados por coma (0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb). Ej: "1,3,5" para L-M-V'
    });

    // Para patrones cíclicos personalizados (ej: 2 días on, 1 día off)
    await queryInterface.addColumn('quests_headers', 'periodPattern', {
      type: Sequelize.STRING(200),
      allowNull: true,
      comment: 'Patrón cíclico donde 1=día activo, 0=descanso. Ej: "1,1,0" = 2 días on, 1 off'
    });

    // Fecha de inicio del patrón para cálculos cíclicos
    await queryInterface.addColumn('quests_headers', 'patternStartDate', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha de inicio del patrón para calcular días del ciclo'
    });

    // Migrar datos existentes: todas las quests existentes usan el sistema FIXED
    // El campo 'period' sigue siendo la fuente de verdad para FIXED
    // No necesitamos migrar nada más porque defaultValue: 'FIXED' ya está configurado
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('quests_headers', 'patternStartDate');
    await queryInterface.removeColumn('quests_headers', 'periodPattern');
    await queryInterface.removeColumn('quests_headers', 'activeDays');
    await queryInterface.removeColumn('quests_headers', 'periodType');
  }
};
