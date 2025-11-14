'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Eliminar la foreign key constraint y la columna id_message
    await queryInterface.removeColumn('messages_users', 'id_message');
  },

  async down(queryInterface, Sequelize) {
    // Recrear la columna y la foreign key si se revierte
    await queryInterface.addColumn('messages_users', 'id_message', {
      type: Sequelize.INTEGER,
      allowNull: true, // Permitir null temporalmente para rollback
      references: {
        model: 'messages',
        key: 'id'
      }
    });
  }
};
