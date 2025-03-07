/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  return knex.schema.createTable("blocks", function (t) {
    t.bigint('id').primary();
    t.string("block_hash").notNull();
    t.string("rpcURL").notNull();
    t.string("Status").nullable();
    t.string("version").notNull();
    t.string("merkle_root").notNull();
    t.string("block_number").notNull();
    t.string("block_status").nullable();
    t.string("previous_hash").notNull();
    t.string("state_root").notNull();
    t.string("transaction_root").notNull();
    t.string("reciept_root").notNull();
    t.string("timestamp").nullable();
    t.string("logs_bloom").notNull();
    t.specificType('transactions', 'text ARRAY');
    t.string("block_reward").notNull();
    t.string("value").notNull();
    t.string("data").notNull();
    t.string("to").notNull();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("blocks");
};
