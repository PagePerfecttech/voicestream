import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create viewer_sessions table
  await knex.schema.createTable('viewer_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('viewer_id').notNullable(); // Can be anonymous or user ID
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').nullable();
    
    // Viewer Information
    table.string('ip_address').notNullable();
    table.text('user_agent').notNullable();
    table.string('country').nullable();
    table.string('region').nullable();
    table.string('city').nullable();
    table.decimal('latitude', 10, 8).nullable();
    table.decimal('longitude', 11, 8).nullable();
    
    // Device Information
    table.string('device_type').nullable(); // mobile, desktop, tablet, tv
    table.string('browser').nullable();
    table.string('os').nullable();
    
    // Engagement Metrics
    table.integer('watch_time').defaultTo(0); // in seconds
    table.integer('interaction_count').defaultTo(0);
    table.integer('ad_view_count').defaultTo(0);
    table.integer('chat_message_count').defaultTo(0);
    
    table.timestamps(true, true);
    
    // Indexes
    table.index(['channel_id']);
    table.index(['viewer_id']);
    table.index(['start_time']);
    table.index(['end_time']);
    table.index(['country']);
    table.index(['device_type']);
  });

  // Create channel_metrics table for aggregated data
  await knex.schema.createTable('channel_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.timestamp('timestamp').notNullable();
    table.string('period_type').notNullable(); // 'minute', 'hour', 'day'
    
    // Viewership Metrics
    table.integer('concurrent_viewers').defaultTo(0);
    table.integer('total_views').defaultTo(0);
    table.integer('unique_viewers').defaultTo(0);
    table.decimal('average_watch_time', 10, 2).defaultTo(0);
    table.integer('peak_viewers').defaultTo(0);
    
    // Engagement Metrics
    table.integer('chat_messages').defaultTo(0);
    table.integer('poll_participation').defaultTo(0);
    table.integer('social_shares').defaultTo(0);
    table.integer('total_interactions').defaultTo(0);
    
    // Technical Metrics
    table.decimal('stream_quality', 5, 2).defaultTo(0); // 0-100 score
    table.integer('buffering_events').defaultTo(0);
    table.decimal('error_rate', 5, 4).defaultTo(0); // percentage
    table.integer('restart_count').defaultTo(0);
    
    // Revenue Metrics
    table.integer('ad_impressions').defaultTo(0);
    table.decimal('ad_revenue', 10, 2).defaultTo(0);
    table.decimal('subscription_revenue', 10, 2).defaultTo(0);
    table.decimal('total_revenue', 10, 2).defaultTo(0);
    
    table.timestamps(true, true);
    
    // Indexes
    table.index(['channel_id']);
    table.index(['timestamp']);
    table.index(['period_type']);
    table.unique(['channel_id', 'timestamp', 'period_type']);
  });

  // Create viewer_events table for real-time tracking
  await knex.schema.createTable('viewer_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('session_id').notNullable().references('id').inTable('viewer_sessions').onDelete('CASCADE');
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('event_type').notNullable(); // 'join', 'leave', 'chat', 'interaction', 'ad_view', 'error'
    table.timestamp('timestamp').notNullable();
    table.jsonb('event_data').nullable(); // Additional event-specific data
    
    table.timestamps(true, true);
    
    // Indexes
    table.index(['session_id']);
    table.index(['channel_id']);
    table.index(['event_type']);
    table.index(['timestamp']);
  });

  // Create analytics_reports table for generated reports
  await knex.schema.createTable('analytics_reports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('report_type').notNullable(); // 'daily', 'weekly', 'monthly'
    table.date('report_date').notNullable();
    table.jsonb('report_data').notNullable(); // Serialized report data
    table.timestamp('generated_at').notNullable();
    
    table.timestamps(true, true);
    
    // Indexes
    table.index(['channel_id']);
    table.index(['report_type']);
    table.index(['report_date']);
    table.unique(['channel_id', 'report_type', 'report_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('analytics_reports');
  await knex.schema.dropTable('viewer_events');
  await knex.schema.dropTable('channel_metrics');
  await knex.schema.dropTable('viewer_sessions');
}