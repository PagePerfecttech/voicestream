import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('stream_processes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.integer('ffmpeg_pid').nullable();
    table.enum('status', ['IDLE', 'STARTING', 'RUNNING', 'STOPPING', 'ERROR']).notNullable().defaultTo('IDLE');
    table.timestamp('start_time').nullable();
    table.timestamp('last_heartbeat').nullable();
    
    // Configuration
    table.string('input_source').notNullable();
    table.specificType('output_targets', 'text[]').notNullable();
    
    // Health Metrics
    table.decimal('cpu_usage', 5, 2).defaultTo(0);
    table.bigInteger('memory_usage').defaultTo(0); // in bytes
    table.bigInteger('network_bandwidth').defaultTo(0); // in bytes/sec
    table.integer('error_count').defaultTo(0);
    
    // Recovery Configuration
    table.integer('max_restarts').defaultTo(3);
    table.integer('restart_delay').defaultTo(5000); // in milliseconds
    table.integer('health_check_interval').defaultTo(5000); // in milliseconds
    
    table.timestamps(true, true);
    
    // Indexes
    table.index(['channel_id']);
    table.index(['status']);
    table.index(['ffmpeg_pid']);
    
    // Unique constraint: one process per channel
    table.unique(['channel_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('stream_processes');
}