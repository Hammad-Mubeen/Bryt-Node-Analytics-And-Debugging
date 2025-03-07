/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    return knex.schema.createTable("ballotedData", function (t) {
      t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      t.string("rpcURL").notNull();
      t.string("hash").notNull();
      t.string("timestamp").notNull();
      t.text("data").notNull();
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function (knex) {
    return knex.schema.dropTable("ballotedData");
  };
  