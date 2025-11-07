'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quests_users', {
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
      state: {
        type: Sequelize.CHAR(1),
        allowNull: false,
        defaultValue: 'N'
      },
      finished: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      dateCreated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      dateRead: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      },
      dateExpiration: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      },
      dateFinished: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('quests_users', ['idQuest', 'idUser'], {
      name: 'quests_users_idQuest_idUser_unique_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeIndex('quests_users', 'quests_users_idQuest_idUser_unique_idx'); } catch (e) {}
    await queryInterface.dropTable('quests_users');
  }
};
