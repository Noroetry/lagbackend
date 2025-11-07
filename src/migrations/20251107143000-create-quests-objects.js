'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quests_objects', {
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
      idObject: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'objects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.CHAR(1),
        allowNull: false,
        defaultValue: 'R'
      },
      quantity: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addIndex('quests_objects', ['idQuest', 'idObject', 'type'], {
      name: 'quests_objects_idQuest_idObject_type_unique_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeIndex('quests_objects', 'quests_objects_idQuest_idObject_type_unique_idx'); } catch (e) {}
    await queryInterface.dropTable('quests_objects');
  }
};
