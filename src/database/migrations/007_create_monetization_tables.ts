import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ad Networks table
  await knex.schema.createTable('ad_networks', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.enum('type', ['google_ad_manager', 'spotx', 'freewheel', 'custom']).notNullable();
    table.string('api_endpoint').notNullable();
    table.json('credentials').notNullable();
    table.boolean('is_active').defaultTo(true);
    
    // Configuration
    table.json('supported_ad_types').notNullable();
    table.decimal('minimum_bid', 10, 4).defaultTo(0);
    table.string('currency', 3).defaultTo('USD');
    
    // Performance metrics
    table.decimal('fill_rate', 5, 2).defaultTo(0);
    table.decimal('average_cpm', 10, 4).defaultTo(0);
    
    table.timestamps(true, true);
    
    table.index(['type', 'is_active']);
  });

  // Subscription Tiers table
  await knex.schema.createTable('subscription_tiers', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.integer('level').notNullable();
    table.json('features').notNullable();
    
    // Access Control
    table.json('allowed_channels').defaultTo('[]');
    table.json('restricted_content').defaultTo('[]');
    
    // Pricing
    table.decimal('monthly_price', 10, 2).notNullable();
    table.decimal('yearly_price', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('USD');
    
    // Limits
    table.integer('max_concurrent_streams').defaultTo(1);
    table.string('max_resolution').defaultTo('720p');
    table.boolean('ad_free_experience').defaultTo(false);
    
    table.timestamps(true, true);
    
    table.unique(['name']);
    table.index(['level']);
  });

  // Viewer Subscriptions table
  await knex.schema.createTable('viewer_subscriptions', (table) => {
    table.uuid('id').primary();
    table.string('viewer_id').notNullable();
    table.uuid('subscription_tier_id').notNullable();
    
    // Billing
    table.enum('status', ['active', 'cancelled', 'expired', 'suspended']).notNullable();
    table.timestamp('start_date').notNullable();
    table.timestamp('end_date').notNullable();
    table.enum('billing_cycle', ['monthly', 'yearly']).notNullable();
    
    // Payment
    table.string('payment_method_id').notNullable();
    table.timestamp('last_payment_date').nullable();
    table.timestamp('next_payment_date').nullable();
    
    table.timestamps(true, true);
    
    table.foreign('subscription_tier_id').references('id').inTable('subscription_tiers');
    table.index(['viewer_id', 'status']);
    table.index(['subscription_tier_id']);
  });

  // Pay-Per-View Events table
  await knex.schema.createTable('ppv_events', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.string('event_name').notNullable();
    table.text('description').nullable();
    
    // Scheduling
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.string('timezone').notNullable();
    
    // Pricing
    table.decimal('price', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('USD');
    
    // Access Control
    table.timestamp('purchase_deadline').notNullable();
    table.integer('access_duration').notNullable(); // hours
    
    // Status and metrics
    table.enum('status', ['upcoming', 'live', 'ended', 'cancelled']).defaultTo('upcoming');
    table.integer('total_purchases').defaultTo(0);
    table.decimal('total_revenue', 12, 2).defaultTo(0);
    
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels');
    table.index(['channel_id', 'status']);
    table.index(['start_time', 'end_time']);
  });

  // PPV Purchases table
  await knex.schema.createTable('ppv_purchases', (table) => {
    table.uuid('id').primary();
    table.string('viewer_id').notNullable();
    table.uuid('event_id').notNullable();
    
    // Purchase Details
    table.timestamp('purchase_date').notNullable();
    table.decimal('price', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('USD');
    
    // Access
    table.boolean('access_granted').defaultTo(false);
    table.timestamp('access_start_time').nullable();
    table.timestamp('access_end_time').nullable();
    
    // Payment
    table.enum('payment_status', ['pending', 'completed', 'failed', 'refunded']).defaultTo('pending');
    table.string('payment_method_id').notNullable();
    table.string('transaction_id').notNullable();
    
    table.timestamps(true, true);
    
    table.foreign('event_id').references('id').inTable('ppv_events');
    table.unique(['viewer_id', 'event_id']);
    table.index(['viewer_id']);
    table.index(['payment_status']);
  });

  // Ad Breaks table
  await knex.schema.createTable('ad_breaks', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.enum('type', ['pre-roll', 'mid-roll', 'post-roll']).notNullable();
    table.timestamp('scheduled_time').notNullable();
    table.integer('duration').notNullable(); // seconds
    table.enum('status', ['scheduled', 'playing', 'completed', 'failed']).defaultTo('scheduled');
    table.json('targeting_criteria').nullable();
    
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels');
    table.index(['channel_id', 'scheduled_time']);
    table.index(['status']);
  });

  // Ad Content table
  await knex.schema.createTable('ad_content', (table) => {
    table.uuid('id').primary();
    table.uuid('ad_break_id').notNullable();
    table.uuid('ad_network_id').notNullable();
    table.enum('ad_type', ['video', 'banner', 'overlay']).notNullable();
    table.string('content_url').notNullable();
    table.integer('duration').notNullable(); // seconds
    table.string('click_through_url').nullable();
    table.string('impression_tracking_url').nullable();
    
    // Targeting
    table.json('target_audience').nullable();
    table.json('geographic_targeting').nullable();
    table.json('device_targeting').nullable();
    
    // Revenue
    table.decimal('bid_amount', 10, 4).notNullable();
    table.string('currency', 3).defaultTo('USD');
    
    table.timestamps(true, true);
    
    table.foreign('ad_break_id').references('id').inTable('ad_breaks');
    table.foreign('ad_network_id').references('id').inTable('ad_networks');
    table.index(['ad_break_id']);
    table.index(['ad_network_id']);
  });

  // Revenue Records table
  await knex.schema.createTable('revenue_records', (table) => {
    table.uuid('id').primary();
    table.uuid('channel_id').notNullable();
    table.enum('source', ['advertising', 'subscription', 'ppv', 'donation', 'merchandise']).notNullable();
    
    // Revenue Details
    table.decimal('amount', 12, 4).notNullable();
    table.string('currency', 3).defaultTo('USD');
    table.timestamp('timestamp').notNullable();
    
    // Attribution
    table.string('source_id').nullable(); // ad break ID, subscription ID, etc.
    table.string('viewer_id').nullable();
    table.string('content_id').nullable();
    
    // Metadata
    table.json('metadata').nullable();
    
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels');
    table.index(['channel_id', 'source']);
    table.index(['timestamp']);
    table.index(['viewer_id']);
  });

  // Monetization Config table
  await knex.schema.createTable('monetization_configs', (table) => {
    table.uuid('channel_id').primary();
    
    // Ad Configuration
    table.boolean('ad_insertion_enabled').defaultTo(false);
    table.integer('ad_break_frequency').defaultTo(15); // minutes
    table.integer('max_ad_duration').defaultTo(120); // seconds
    table.json('allowed_ad_types').defaultTo('["mid-roll"]');
    
    // Subscription Configuration
    table.boolean('subscription_required').defaultTo(false);
    table.json('allowed_subscription_tiers').defaultTo('[]');
    table.integer('free_trial_duration').nullable(); // days
    
    // PPV Configuration
    table.boolean('ppv_enabled').defaultTo(false);
    table.decimal('default_event_price', 10, 2).defaultTo(0);
    table.string('currency', 3).defaultTo('USD');
    
    // Revenue Sharing
    table.decimal('revenue_share_percentage', 5, 2).defaultTo(30); // platform's share
    
    table.timestamps(true, true);
    
    table.foreign('channel_id').references('id').inTable('channels');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('monetization_configs');
  await knex.schema.dropTableIfExists('revenue_records');
  await knex.schema.dropTableIfExists('ad_content');
  await knex.schema.dropTableIfExists('ad_breaks');
  await knex.schema.dropTableIfExists('ppv_purchases');
  await knex.schema.dropTableIfExists('ppv_events');
  await knex.schema.dropTableIfExists('viewer_subscriptions');
  await knex.schema.dropTableIfExists('subscription_tiers');
  await knex.schema.dropTableIfExists('ad_networks');
}