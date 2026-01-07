import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create streaming_platforms table
  await knex.schema.createTable('streaming_platforms', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable();
    table.string('name').notNullable(); // youtube, facebook, twitch, custom
    table.string('display_name').notNullable();
    table.jsonb('auth_credentials').notNullable().defaultTo('{}');
    table.jsonb('stream_requirements').notNullable().defaultTo('{}');
    table.boolean('enabled').notNullable().defaultTo(true);
    table.string('status').notNullable().defaultTo('DISCONNECTED'); // CONNECTED, DISCONNECTED, CONNECTING, ERROR, DISABLED
    table.string('auth_status').notNullable().defaultTo('PENDING'); // VALID, EXPIRED, INVALID, PENDING
    table.timestamp('last_connected').nullable();
    table.text('error_message').nullable();
    table.timestamps(true, true);
    
    // Foreign key constraint
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    
    // Indexes
    table.index(['channel_id']);
    table.index(['name']);
    table.index(['status']);
    table.index(['enabled']);
    
    // Unique constraint for platform per channel
    table.unique(['channel_id', 'name']);
  });

  // Create platform_analytics table
  await knex.schema.createTable('platform_analytics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('platform_id').notNullable();
    table.uuid('channel_id').notNullable();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    
    // Viewership metrics
    table.integer('viewers').notNullable().defaultTo(0);
    table.integer('peak_viewers').notNullable().defaultTo(0);
    table.bigInteger('total_views').notNullable().defaultTo(0);
    table.bigInteger('watch_time').notNullable().defaultTo(0); // in seconds
    
    // Engagement metrics
    table.integer('likes').notNullable().defaultTo(0);
    table.integer('comments').notNullable().defaultTo(0);
    table.integer('shares').notNullable().defaultTo(0);
    table.integer('subscribers').notNullable().defaultTo(0);
    
    // Technical metrics
    table.decimal('stream_quality', 5, 2).notNullable().defaultTo(0);
    table.integer('buffering_events').notNullable().defaultTo(0);
    table.integer('disconnections').notNullable().defaultTo(0);
    
    // Platform-specific metrics (JSON)
    table.jsonb('platform_specific_metrics').nullable().defaultTo('{}');
    
    table.timestamps(true, true);
    
    // Foreign key constraints
    table.foreign('platform_id').references('id').inTable('streaming_platforms').onDelete('CASCADE');
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    
    // Indexes
    table.index(['platform_id']);
    table.index(['channel_id']);
    table.index(['timestamp']);
    table.index(['timestamp', 'channel_id']);
    table.index(['timestamp', 'platform_id']);
  });

  // Create distribution_configs table
  await knex.schema.createTable('distribution_configs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable();
    table.jsonb('global_stream_config').notNullable().defaultTo('{}');
    table.jsonb('failure_handling').notNullable().defaultTo('{}');
    table.jsonb('analytics_config').notNullable().defaultTo('{}');
    table.timestamps(true, true);
    
    // Foreign key constraint
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    
    // Unique constraint - one config per channel
    table.unique(['channel_id']);
    
    // Index
    table.index(['channel_id']);
  });

  // Create distribution_logs table for tracking platform events
  await knex.schema.createTable('distribution_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable();
    table.uuid('platform_id').nullable(); // nullable for channel-wide events
    table.string('event_type').notNullable(); // START, STOP, ERROR, AUTH_REFRESH, etc.
    table.string('status').notNullable(); // SUCCESS, FAILURE, PENDING
    table.text('message').nullable();
    table.jsonb('metadata').nullable().defaultTo('{}');
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    
    // Foreign key constraints
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.foreign('platform_id').references('id').inTable('streaming_platforms').onDelete('CASCADE');
    
    // Indexes
    table.index(['channel_id']);
    table.index(['platform_id']);
    table.index(['event_type']);
    table.index(['status']);
    table.index(['timestamp']);
    table.index(['timestamp', 'channel_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('distribution_logs');
  await knex.schema.dropTableIfExists('distribution_configs');
  await knex.schema.dropTableIfExists('platform_analytics');
  await knex.schema.dropTableIfExists('streaming_platforms');
}