import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('subscription_plans', (table) => {
    table.enum('tier', ['BASIC', 'PREMIUM', 'ENTERPRISE']).notNullable().defaultTo('BASIC');
    table.integer('priority').notNullable().defaultTo(1);
    
    // Index for priority-based queries
    table.index(['priority']);
    table.index(['tier']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('subscription_plans', (table) => {
    table.dropColumn('tier');
    table.dropColumn('priority');
  });
}