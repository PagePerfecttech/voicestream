import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('rtmp_destinations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    table.string('server_url').notNullable();
    table.text('stream_key').notNullable(); // Encrypted stream key
    table.enum('platform', ['youtube', 'facebook', 'twitch', 'custom']).notNullable();
    table.boolean('enabled').defaultTo(true);
    table.timestamps(true, true);
    
    // Indexes
    table.index(['channel_id']);
    table.index(['platform']);
    table.index(['enabled']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('rtmp_destinations');
}