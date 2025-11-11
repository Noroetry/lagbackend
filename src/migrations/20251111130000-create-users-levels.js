"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users_levels', {
      level_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      minExpRequired: {
        type: Sequelize.BIGINT,
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

    // index on minExpRequired for faster level lookups by totalExp
    await queryInterface.addIndex('users_levels', ['minExpRequired'], {
      name: 'users_levels_minExp_idx'
    });

    // Seed levels 1..100 using a polynomial per-level cost scheme.
    // XP to go from level N to N+1 = B + (N * L) + (N^2 * C)
    // We store minExpRequired(level) as the cumulative XP required to reach that level from level 1.
    const rows = [];
    const B = 150; // base initial
    const L = 50;  // linear factor
    const C = 1.0; // quadratic factor
    let cumulative = 0;
    for (let level = 1; level <= 100; level++) {
      let minExp;
      if (level === 1) {
        minExp = 0;
      } else {
        // XP required to go from (level-1) to level
        const n = level - 1; // current level when computing the cost to reach `level`
        const xpForThis = Math.round(B + (n * L) + (n * n * C));
        cumulative += xpForThis;
        minExp = cumulative;
      }
      rows.push({ level_number: level, minExpRequired: minExp, createdAt: new Date(), updatedAt: new Date() });
    }
    await queryInterface.bulkInsert('users_levels', rows);
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeIndex('users_levels', 'users_levels_minExp_idx'); } catch (e) {}
    await queryInterface.dropTable('users_levels');
  }
};
