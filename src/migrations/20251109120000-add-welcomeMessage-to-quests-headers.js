'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add a nullable TEXT column `welcomeMessage` to quests_headers
    await queryInterface.addColumn('quests_headers', 'welcomeMessage', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the column on rollback
    try {
      await queryInterface.removeColumn('quests_headers', 'welcomeMessage');
    } catch (e) {
      // ignore if column doesn't exist
    }
  }
};
