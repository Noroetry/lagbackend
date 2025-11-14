'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('messages_users');
    
    if (!tableInfo.title) {
      await queryInterface.addColumn('messages_users', 'title', {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: 'Sin título', // Para registros existentes
      });
    }

    if (!tableInfo.description) {
      await queryInterface.addColumn('messages_users', 'description', {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: 'Sin descripción', // Para registros existentes
      });
    }

    if (!tableInfo.adjunts) {
      await queryInterface.addColumn('messages_users', 'adjunts', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
        comment: 'Array de objetos con las recompensas: [{id: 1, quantity: 50}, {id: 2, quantity: 100}]',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('messages_users');
    
    if (tableInfo.title) {
      await queryInterface.removeColumn('messages_users', 'title');
    }
    if (tableInfo.description) {
      await queryInterface.removeColumn('messages_users', 'description');
    }
    if (tableInfo.adjunts) {
      await queryInterface.removeColumn('messages_users', 'adjunts');
    }
  }
};
