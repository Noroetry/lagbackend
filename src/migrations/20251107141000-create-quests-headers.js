'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('quests_headers', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      period: {
        type: Sequelize.STRING(1),
        allowNull: false,
        defaultValue: 'D'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1440
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      levelRequired: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      baseRewardXP: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0
      },
      basePenaltyXP: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0
      },
      nextQuest: {
        type: Sequelize.INTEGER,
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

    // Unique indexes for title and description
    await queryInterface.addIndex('quests_headers', ['title'], {
      name: 'quests_headers_title_unique_idx',
      unique: true
    });
    await queryInterface.addIndex('quests_headers', ['description'], {
      name: 'quests_headers_description_unique_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeIndex('quests_headers', 'quests_headers_title_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_headers', 'quests_headers_description_unique_idx'); } catch (e) {}
    await queryInterface.dropTable('quests_headers');
  }
};
