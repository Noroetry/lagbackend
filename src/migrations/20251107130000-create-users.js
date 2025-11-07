'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      admin: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalExp: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      title: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      job: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      range: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Z',
      },
      refreshToken: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
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
    // Add unique indexes for username and email
    await queryInterface.addIndex('users', ['username'], {
      name: 'users_username_unique_idx',
      unique: true
    });
    await queryInterface.addIndex('users', ['email'], {
      name: 'users_email_unique_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first, then drop table
    try {
      await queryInterface.removeIndex('users', 'users_username_unique_idx');
    } catch (err) {
      // ignore if index doesn't exist
    }
    try {
      await queryInterface.removeIndex('users', 'users_email_unique_idx');
    } catch (err) {
      // ignore if index doesn't exist
    }
    await queryInterface.dropTable('users');
  }
};
