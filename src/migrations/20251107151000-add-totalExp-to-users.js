"use strict";

/**
 * Add totalExp (BIGINT) to users and remove old exp column if present.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Use raw queries with IF NOT EXISTS / IF EXISTS for safety
    await queryInterface.sequelize.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalExp" BIGINT DEFAULT 0;`
    );
    // Drop old exp column if it exists
    await queryInterface.sequelize.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "exp";`
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert: remove totalExp and restore exp as INTEGER DEFAULT 0 if not exists
    await queryInterface.sequelize.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "totalExp";`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "exp" INTEGER DEFAULT 0;`
    );
  },
};
