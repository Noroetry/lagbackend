'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add a nullable shortName column to objects
    await queryInterface.addColumn('objects', 'shortName', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('objects', 'shortName');
    } catch (e) {
      // ignore if not present
    }
  }
};
