'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quests_details', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      idQuest: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'quests_headers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      needParam: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      labelParam: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      descriptionParam: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isEditable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Unique composite index as requested (id + idQuest). Note: id is already PK but adding per spec
    await queryInterface.addIndex('quests_details', ['id', 'idQuest'], {
      name: 'quests_details_id_idQuest_unique_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeIndex('quests_details', 'quests_details_id_idQuest_unique_idx'); } catch (e) {}
    await queryInterface.dropTable('quests_details');
  }
};
