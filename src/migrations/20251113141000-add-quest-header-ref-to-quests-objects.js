'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('quests_objects', 'id_quest_header', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Para recompensas tipo quest: ID del quest_header a asignar como premio',
      references: {
        model: 'quests_headers',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Crear índice para mejorar el rendimiento
    await queryInterface.addIndex('quests_objects', ['id_quest_header']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('quests_objects', ['id_quest_header']);
    await queryInterface.removeColumn('quests_objects', 'id_quest_header');
  }
};
