"use strict";

/**
 * Ensure quests_objects has a "type" column and a unique index including it.
 * This is idempotent and safe to run against DBs where the table was created
 * without the "type" column.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add type column if missing
    await queryInterface.sequelize.query(
      `ALTER TABLE "quests_objects" ADD COLUMN IF NOT EXISTS "type" CHAR(1) DEFAULT 'R';`
    );

    // Drop any existing index that references idQuest and idObject so we can replace it
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN SELECT indexname FROM pg_indexes WHERE tablename = 'quests_objects' AND indexdef ~ 'idQuest' AND indexdef ~ 'idObject' LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
        END LOOP;
      END $$;
    `);

    // Create the desired unique index including type
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS quests_objects_idQuest_idObject_type_unique_idx ON "quests_objects" ("idQuest","idObject","type");`
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove the composite index and drop the column if present
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS quests_objects_idQuest_idObject_type_unique_idx;`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "quests_objects" DROP COLUMN IF EXISTS "type";`
    );
  }
};
