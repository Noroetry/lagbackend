"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn('quests_users', 'rewardDelivered', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface/*, Sequelize */) => {
    return queryInterface.removeColumn('quests_users', 'rewardDelivered');
  }
};
