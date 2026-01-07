import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('subscription_plans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique();
    table.decimal('monthly_price', 10, 2).notNullable();
    table.integer('channel_limit').notNullable();
    table.enum('max_resolution', ['SD', 'HD', 'FHD']).notNullable();
    table.specificType('output_types', 'text[]').notNullable();
    table.integer('storage_limit').notNullable(); // in GB
    table.integer('concurrent_channels').notNullable();
    table.boolean('trial_allowed').defaultTo(true);
    table.timestamps(true, true);
    
    // Indexes
    table.index(['name']);
    table.index(['monthly_price']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('subscription_plans');
}