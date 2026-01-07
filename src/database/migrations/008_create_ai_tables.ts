import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // AI Optimized Schedules
  await knex.schema.createTable('ai_optimized_schedules', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.json('schedule_data').notNullable();
    table.decimal('expected_viewership', 10, 2);
    table.decimal('revenue_projection', 10, 2);
    table.integer('confidence_score');
    table.string('optimization_strategy');
    table.timestamp('generated_at').notNullable();
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.index(['channel_id', 'generated_at']);
  });

  // AI Churn Predictions
  await knex.schema.createTable('ai_churn_predictions', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.enum('risk_level', ['low', 'medium', 'high']).notNullable();
    table.decimal('churn_probability', 5, 2).notNullable();
    table.json('prediction_data').notNullable();
    table.integer('confidence_score');
    table.timestamp('predicted_churn_date');
    table.timestamp('generated_at').notNullable();
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.index(['channel_id', 'risk_level']);
    table.index(['channel_id', 'generated_at']);
  });

  // AI Content Categories
  await knex.schema.createTable('ai_content_categories', (table) => {
    table.uuid('id').primary();
    table.uuid('media_item_id').notNullable();
    table.string('primary_category').notNullable();
    table.json('secondary_categories');
    table.json('tags');
    table.string('mood');
    table.json('target_audience');
    table.integer('confidence');
    table.timestamps(true, true);
    
    table.index(['media_item_id']);
    table.index(['primary_category']);
  });

  // AI Recommendations
  await knex.schema.createTable('ai_recommendations', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.enum('type', ['content', 'scheduling', 'monetization', 'engagement', 'technical']).notNullable();
    table.enum('priority', ['low', 'medium', 'high', 'critical']).notNullable();
    table.string('title').notNullable();
    table.text('description');
    table.json('recommendation_data').notNullable();
    table.decimal('expected_impact', 5, 2);
    table.integer('confidence');
    table.enum('status', ['pending', 'accepted', 'rejected', 'implemented']).defaultTo('pending');
    table.timestamp('expires_at');
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.index(['channel_id', 'type']);
    table.index(['channel_id', 'priority']);
    table.index(['status', 'expires_at']);
  });

  // AI Ad Optimizations
  await knex.schema.createTable('ai_ad_optimizations', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.uuid('content_id').notNullable();
    table.json('optimization_data').notNullable();
    table.decimal('expected_revenue', 10, 2);
    table.decimal('expected_viewer_impact', 5, 2);
    table.integer('confidence_score');
    table.timestamp('generated_at').notNullable();
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.index(['channel_id', 'content_id']);
    table.index(['channel_id', 'generated_at']);
  });

  // AI Viewer Behavior Analysis
  await knex.schema.createTable('ai_viewer_behavior_analysis', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.date('analysis_date').notNullable();
    table.integer('total_viewers');
    table.json('analysis_data').notNullable();
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.unique(['channel_id', 'analysis_date']);
    table.index(['channel_id', 'analysis_date']);
  });

  // AI Analysis Results (generic table for various AI analyses)
  await knex.schema.createTable('ai_analysis_results', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id');
    table.string('analysis_type').notNullable();
    table.json('results').notNullable();
    table.integer('confidence');
    table.json('recommendations');
    table.timestamp('generated_at').notNullable();
    table.timestamp('valid_until');
    table.timestamps(true, true);
    
    table.index(['channel_id', 'analysis_type']);
    table.index(['analysis_type', 'generated_at']);
    table.index(['valid_until']);
  });

  // AI Engine Configuration
  await knex.schema.createTable('ai_engine_configs', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.boolean('enable_content_analysis').defaultTo(true);
    table.boolean('enable_schedule_optimization').defaultTo(true);
    table.boolean('enable_churn_prediction').defaultTo(true);
    table.boolean('enable_ad_optimization').defaultTo(true);
    table.boolean('enable_recommendations').defaultTo(true);
    table.integer('content_analysis_interval').defaultTo(24);
    table.integer('schedule_optimization_interval').defaultTo(12);
    table.integer('churn_analysis_interval').defaultTo(24);
    table.integer('min_confidence_for_recommendations').defaultTo(70);
    table.integer('min_confidence_for_automation').defaultTo(85);
    table.integer('analysis_retention_days').defaultTo(90);
    table.integer('recommendation_retention_days').defaultTo(30);
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.unique(['channel_id']);
  });

  // Media Items (for content analysis)
  await knex.schema.createTable('media_items', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.string('title').notNullable();
    table.text('description');
    table.integer('duration').notNullable(); // in seconds
    table.string('file_path').notNullable();
    table.bigInteger('file_size');
    table.string('format');
    table.string('resolution');
    table.integer('bitrate');
    table.enum('content_type', ['entertainment', 'news', 'sports', 'educational', 'music', 'documentary', 'commercial']);
    table.enum('mood', ['upbeat', 'calm', 'dramatic', 'informative', 'energetic']);
    table.json('target_audience');
    table.json('categories');
    table.json('tags');
    table.decimal('average_view_time', 10, 2);
    table.decimal('engagement_score', 5, 2);
    table.decimal('retention_rate', 5, 2);
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.index(['channel_id', 'content_type']);
    table.index(['channel_id', 'engagement_score']);
  });

  // Viewer Patterns (for pattern analysis)
  await knex.schema.createTable('viewer_patterns', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.string('time_slot').notNullable(); // HH:MM format
    table.integer('day_of_week').notNullable(); // 0-6
    table.decimal('average_viewers', 10, 2);
    table.decimal('peak_viewers', 10, 2);
    table.decimal('average_watch_time', 10, 2);
    table.decimal('engagement_rate', 5, 2);
    table.json('preferred_content_types');
    table.json('device_distribution');
    table.json('geographic_distribution');
    table.date('analysis_date').notNullable();
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    table.unique(['channel_id', 'time_slot', 'day_of_week', 'analysis_date']);
    table.index(['channel_id', 'analysis_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('viewer_patterns');
  await knex.schema.dropTableIfExists('media_items');
  await knex.schema.dropTableIfExists('ai_engine_configs');
  await knex.schema.dropTableIfExists('ai_analysis_results');
  await knex.schema.dropTableIfExists('ai_viewer_behavior_analysis');
  await knex.schema.dropTableIfExists('ai_ad_optimizations');
  await knex.schema.dropTableIfExists('ai_recommendations');
  await knex.schema.dropTableIfExists('ai_content_categories');
  await knex.schema.dropTableIfExists('ai_churn_predictions');
  await knex.schema.dropTableIfExists('ai_optimized_schedules');
}