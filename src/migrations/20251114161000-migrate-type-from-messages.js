'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Copiar el campo type de la tabla messages a messages_users
    await queryInterface.sequelize.query(`
      UPDATE messages_users mu
      SET type = m.type
      FROM messages m
      WHERE mu.id_message = m.id
    `);
  },

  async down(queryInterface, Sequelize) {
    // No hay vuelta atrás, pero podríamos resetear a 'info' si fuera necesario
    await queryInterface.sequelize.query(`
      UPDATE messages_users
      SET type = 'info'
    `);
  }
};
