/* eslint-disable no-unused-vars */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn('quests_details', 'paramType', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'string'
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('quests_details', 'paramType');
  }
};
