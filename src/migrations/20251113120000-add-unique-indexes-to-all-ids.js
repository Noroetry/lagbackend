'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add unique indexes to id columns for all tables that don't have them explicitly
    
    // users table
    await queryInterface.addIndex('users', ['id'], {
      name: 'users_id_unique_idx',
      unique: true
    });

    // quests_headers table
    await queryInterface.addIndex('quests_headers', ['id'], {
      name: 'quests_headers_id_unique_idx',
      unique: true
    });

    // quests_details table
    await queryInterface.addIndex('quests_details', ['id'], {
      name: 'quests_details_id_unique_idx',
      unique: true
    });

    // quests_users table
    await queryInterface.addIndex('quests_users', ['id'], {
      name: 'quests_users_id_unique_idx',
      unique: true
    });

    // quests_users_detail table
    await queryInterface.addIndex('quests_users_detail', ['id'], {
      name: 'quests_users_detail_id_unique_idx',
      unique: true
    });

    // quests_user_logs table
    await queryInterface.addIndex('quests_user_logs', ['id'], {
      name: 'quests_user_logs_id_unique_idx',
      unique: true
    });

    // messages table
    await queryInterface.addIndex('messages', ['id'], {
      name: 'messages_id_unique_idx',
      unique: true
    });

    // messages_users table
    await queryInterface.addIndex('messages_users', ['id'], {
      name: 'messages_users_id_unique_idx',
      unique: true
    });

    // objects table - aunque ya tiene índice en objectName, agregamos uno para id
    await queryInterface.addIndex('objects', ['id'], {
      name: 'objects_id_unique_idx',
      unique: true
    });

    // quests_objects table
    await queryInterface.addIndex('quests_objects', ['id'], {
      name: 'quests_objects_id_unique_idx',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all unique indexes created
    try { await queryInterface.removeIndex('users', 'users_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_headers', 'quests_headers_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_details', 'quests_details_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_users', 'quests_users_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_users_detail', 'quests_users_detail_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_user_logs', 'quests_user_logs_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('messages', 'messages_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('messages_users', 'messages_users_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('objects', 'objects_id_unique_idx'); } catch (e) {}
    try { await queryInterface.removeIndex('quests_objects', 'quests_objects_id_unique_idx'); } catch (e) {}
  }
};
