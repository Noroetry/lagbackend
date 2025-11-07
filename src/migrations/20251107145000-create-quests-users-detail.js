'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quests_users_detail', {
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
      idDetail: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'quests_details',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      value: {
        type: Sequelize.DOUBLE,
        allowNull: true,
        defaultValue: null
      },
      isChecked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      dateUpdated: {
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

    await queryInterface.addIndex('quests_users_detail', ['idQuest', 'idDetail', 'idUser'], {
      name: 'quests_users_detail_idQuest_idDetail_idUser_unique_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeIndex('quests_users_detail', 'quests_users_detail_idQuest_idDetail_idUser_unique_idx'); } catch (e) {}
    await queryInterface.dropTable('quests_users_detail');
  }
};
