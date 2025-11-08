/* eslint-disable no-unused-vars */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change column type to TEXT to allow storing strings or numeric values
    return queryInterface.changeColumn('quests_users_detail', 'value', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to DOUBLE (note: reverting may fail if non-numeric data exists)
    return queryInterface.changeColumn('quests_users_detail', 'value', {
      type: Sequelize.DOUBLE,
      allowNull: true,
      defaultValue: null
    });
  }
};
