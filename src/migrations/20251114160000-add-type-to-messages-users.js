'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages_users', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'info',
      comment: 'Tipo de mensaje: info, reward, penalty'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('messages_users', 'type');
  }
};
