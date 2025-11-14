'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('messages');
    
    // Eliminar columnas de messages solo si existen
    if (tableInfo.title) {
      await queryInterface.removeColumn('messages', 'title');
    }
    if (tableInfo.description) {
      await queryInterface.removeColumn('messages', 'description');
    }
    if (tableInfo.code) {
      await queryInterface.removeColumn('messages', 'code');
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('messages');
    
    // Restaurar columnas en caso de rollback solo si no existen
    if (!tableInfo.title) {
      await queryInterface.addColumn('messages', 'title', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Sin título',
      });
    }

    if (!tableInfo.description) {
      await queryInterface.addColumn('messages', 'description', {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: 'Sin descripción',
      });
    }

    if (!tableInfo.code) {
      await queryInterface.addColumn('messages', 'code', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
    }
  }
};
