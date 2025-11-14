'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Eliminar la tabla messages
    await queryInterface.dropTable('messages');
  },

  async down(queryInterface, Sequelize) {
    // Recrear la tabla messages si se revierte
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'info',
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });
  }
};
