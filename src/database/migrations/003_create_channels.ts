import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('channels', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable();
    table.string('name').notNullable();
    table.enum('status', ['STOPPED', 'STARTING', 'LIVE', 'ERROR']).notNullable().defaultTo('STOPPED');
    table.enum('resolution', ['SD', 'HD', 'FHD']).notNullable();
    table.integer('bitrate').notNullable();
    table.string('fallback_video').notNullable();
    table.boolean('hls_enabled').defaultTo(true);
    table.string('hls_endpoint').notNullable();
    
    // Feature flags
    table.boolean('analytics_enabled').defaultTo(true);
    table.boolean('monetization_enabled').defaultTo(false);
    table.boolean('ai_optimization_enabled').defaultTo(false);
    table.boolean('multi_platform_enabled').defaultTo(false);
    table.boolean('interaction_enabled').defaultTo(false);
    
    // Metrics
    table.bigInteger('total_uptime').defaultTo(0); // in seconds
    table.integer('restart_count').defaultTo(0);
    table.timestamp('last_start_time').nullable();
    table.timestamp('last_stop_time').nullable();
    
    table.timestamps(true, true);
    
    // Indexes
    table.index(['client_id']);
    table.index(['status']);
    table.index(['name']);
    
    // Unique constraint: channel name per client
    table.unique(['client_id', 'name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('channels');
}