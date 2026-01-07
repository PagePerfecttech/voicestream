import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Chat messages table
  await knex.schema.createTable('chat_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('viewer_id').notNullable();
    table.string('username').notNullable();
    table.text('message').notNullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    table.boolean('moderated').defaultTo(false);
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);
    
    table.index(['channel_id', 'timestamp']);
    table.index(['viewer_id']);
  });

  // Polls table
  await knex.schema.createTable('polls', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('question').notNullable();
    table.json('options').notNullable(); // Array of strings
    table.integer('duration').notNullable(); // in seconds
    table.boolean('display_overlay').defaultTo(true);
    table.enum('status', ['ACTIVE', 'COMPLETED', 'CANCELLED']).defaultTo('ACTIVE');
    table.timestamp('end_time').notNullable();
    table.integer('total_votes').defaultTo(0);
    table.timestamps(true, true);
    
    table.index(['channel_id', 'status']);
    table.index(['end_time']);
  });

  // Poll votes table
  await knex.schema.createTable('poll_votes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('poll_id').notNullable().references('id').inTable('polls').onDelete('CASCADE');
    table.string('viewer_id').notNullable();
    table.integer('option_index').notNullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    
    table.unique(['poll_id', 'viewer_id']); // One vote per viewer per poll
    table.index(['poll_id']);
  });

  // Content votes table
  await knex.schema.createTable('content_votes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('viewer_id').notNullable();
    table.string('content_id').notNullable();
    table.enum('vote_type', ['UPVOTE', 'DOWNVOTE']).notNullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    
    table.unique(['channel_id', 'viewer_id', 'content_id']); // One vote per viewer per content
    table.index(['channel_id', 'content_id']);
  });

  // Social feed items table
  await knex.schema.createTable('social_feed_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('platform').notNullable();
    table.text('content').notNullable();
    table.string('author').notNullable();
    table.string('author_avatar').nullable();
    table.timestamp('timestamp').notNullable();
    table.integer('likes').defaultTo(0);
    table.integer('shares').defaultTo(0);
    table.string('url').notNullable();
    table.timestamps(true, true);
    
    table.index(['channel_id', 'timestamp']);
    table.index(['platform']);
  });

  // Viewer effects table
  await knex.schema.createTable('viewer_effects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.enum('type', ['SOUND', 'ANIMATION', 'OVERLAY']).notNullable();
    table.integer('cost').notNullable(); // in points
    table.integer('duration').notNullable(); // in seconds
    table.boolean('enabled').defaultTo(true);
    table.timestamps(true, true);
    
    table.unique(['name']);
  });

  // Triggered effects table
  await knex.schema.createTable('triggered_effects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('viewer_id').notNullable();
    table.uuid('effect_id').notNullable().references('id').inTable('viewer_effects').onDelete('CASCADE');
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    table.enum('status', ['PENDING', 'ACTIVE', 'COMPLETED']).defaultTo('PENDING');
    
    table.index(['channel_id', 'status']);
    table.index(['viewer_id']);
  });

  // Viewer points table
  await knex.schema.createTable('viewer_points', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('viewer_id').notNullable();
    table.integer('points').defaultTo(0);
    table.integer('total_earned').defaultTo(0);
    table.integer('total_spent').defaultTo(0);
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.timestamps(true, true);
    
    table.unique(['channel_id', 'viewer_id']);
    table.index(['viewer_id']);
  });

  // Badges table
  await knex.schema.createTable('badges', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('icon').notNullable();
    table.json('requirements').notNullable(); // Array of BadgeRequirement objects
    table.enum('rarity', ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).defaultTo('COMMON');
    table.timestamps(true, true);
    
    table.unique(['name']);
  });

  // Viewer badges table
  await knex.schema.createTable('viewer_badges', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('viewer_id').notNullable();
    table.uuid('badge_id').notNullable().references('id').inTable('badges').onDelete('CASCADE');
    table.timestamp('earned_at').defaultTo(knex.fn.now());
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    
    table.unique(['viewer_id', 'badge_id', 'channel_id']);
    table.index(['viewer_id']);
    table.index(['channel_id']);
  });

  // Engagement events table
  await knex.schema.createTable('engagement_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('viewer_id').notNullable();
    table.enum('event_type', ['CHAT', 'POLL_VOTE', 'CONTENT_VOTE', 'EFFECT_TRIGGER', 'BADGE_EARNED', 'POINTS_EARNED']).notNullable();
    table.json('event_data').nullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    table.integer('points').defaultTo(0);
    
    table.index(['channel_id', 'timestamp']);
    table.index(['viewer_id']);
    table.index(['event_type']);
  });

  // Interaction metrics table
  await knex.schema.createTable('interaction_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    table.integer('active_chat_users').defaultTo(0);
    table.integer('total_chat_messages').defaultTo(0);
    table.integer('active_polls').defaultTo(0);
    table.integer('total_poll_votes').defaultTo(0);
    table.integer('content_votes').defaultTo(0);
    table.integer('effects_triggered').defaultTo(0);
    table.integer('points_distributed').defaultTo(0);
    table.integer('badges_earned').defaultTo(0);
    table.integer('social_feed_items').defaultTo(0);
    
    table.index(['channel_id', 'timestamp']);
  });

  // Add interaction configuration to channels table
  await knex.schema.alterTable('channels', (table) => {
    table.json('interaction_config').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove interaction configuration from channels table
  await knex.schema.alterTable('channels', (table) => {
    table.dropColumn('interaction_config');
  });

  // Drop tables in reverse order of dependencies
  await knex.schema.dropTableIfExists('interaction_metrics');
  await knex.schema.dropTableIfExists('engagement_events');
  await knex.schema.dropTableIfExists('viewer_badges');
  await knex.schema.dropTableIfExists('badges');
  await knex.schema.dropTableIfExists('viewer_points');
  await knex.schema.dropTableIfExists('triggered_effects');
  await knex.schema.dropTableIfExists('viewer_effects');
  await knex.schema.dropTableIfExists('social_feed_items');
  await knex.schema.dropTableIfExists('content_votes');
  await knex.schema.dropTableIfExists('poll_votes');
  await knex.schema.dropTableIfExists('polls');
  await knex.schema.dropTableIfExists('chat_messages');
}