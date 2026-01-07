import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('client_subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable();
    table.uuid('plan_id').notNullable().references('id').inTable('subscription_plans').onDelete('RESTRICT');
    table.enum('status', ['TRIAL', 'ACTIVE', 'GRACE', 'SUSPENDED', 'CANCELLED']).notNullable();
    table.timestamp('start_date').notNullable();
    table.timestamp('end_date').notNullable();
    table.timestamp('trial_end_date').nullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index(['client_id']);
    table.index(['plan_id']);
    table.index(['status']);
    table.index(['end_date']);
    
    // Note: Unique constraint for one active subscription per client 
    // will be enforced at the application level due to PostgreSQL limitations
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('client_subscriptions');
}