/* eslint-disable no-unused-vars */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // describeTable to check existence to avoid migration failure if column already removed
    const table = await queryInterface.describeTable('quests_details').catch(() => null);
    if (table && Object.prototype.hasOwnProperty.call(table, 'isNumber')) {
      return queryInterface.removeColumn('quests_details', 'isNumber');
    }
    // nothing to do
    return Promise.resolve();
  },

  down: async (queryInterface, Sequelize) => {
    // add the column back if missing
    const table = await queryInterface.describeTable('quests_details').catch(() => null);
    if (!table || !Object.prototype.hasOwnProperty.call(table, 'isNumber')) {
      return queryInterface.addColumn('quests_details', 'isNumber', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    return Promise.resolve();
  }
};
