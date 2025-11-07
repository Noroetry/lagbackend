'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quests_user_logs', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      idUser: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      result: {
        type: Sequelize.CHAR(1),
        allowNull: false,
      },
      rewards: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null
      },
      dateFinished: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      meta: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null
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

    // index to quickly query logs by user or quest
    await queryInterface.addIndex('quests_user_logs', ['idUser'], { name: 'quests_user_logs_idUser_idx' });
    await queryInterface.addIndex('quests_user_logs', ['idQuest'], { name: 'quests_user_logs_idQuest_idx' });
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeIndex('quests_user_logs', 'quests_user_logs_idUser_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_user_logs', 'quests_user_logs_idQuest_idx'); } catch (e) {}
    await queryInterface.dropTable('quests_user_logs');
  }
};
