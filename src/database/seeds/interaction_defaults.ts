import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('viewer_effects').del();
  await knex('badges').del();

  // Insert default viewer effects
  await knex('viewer_effects').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Confetti Burst',
      type: 'ANIMATION',
      cost: 50,
      duration: 3,
      enabled: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Applause Sound',
      type: 'SOUND',
      cost: 25,
      duration: 2,
      enabled: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Heart Rain',
      type: 'ANIMATION',
      cost: 75,
      duration: 5,
      enabled: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Airhorn',
      type: 'SOUND',
      cost: 30,
      duration: 1,
      enabled: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Spotlight',
      type: 'OVERLAY',
      cost: 100,
      duration: 10,
      enabled: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Fireworks',
      type: 'ANIMATION',
      cost: 150,
      duration: 8,
      enabled: true
    }
  ]);

  // Insert default badges
  await knex('badges').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'First Steps',
      description: 'Sent your first chat message',
      icon: '👋',
      requirements: JSON.stringify([
        { type: 'CHAT_MESSAGES', value: 1, description: 'Send 1 chat message' }
      ]),
      rarity: 'COMMON'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Chatterbox',
      description: 'Sent 100 chat messages',
      icon: '💬',
      requirements: JSON.stringify([
        { type: 'CHAT_MESSAGES', value: 100, description: 'Send 100 chat messages' }
      ]),
      rarity: 'RARE'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Point Collector',
      description: 'Earned your first 100 points',
      icon: '⭐',
      requirements: JSON.stringify([
        { type: 'POINTS_EARNED', value: 100, description: 'Earn 100 points' }
      ]),
      rarity: 'COMMON'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Point Master',
      description: 'Earned 1000 points',
      icon: '🌟',
      requirements: JSON.stringify([
        { type: 'POINTS_EARNED', value: 1000, description: 'Earn 1000 points' }
      ]),
      rarity: 'EPIC'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Dedicated Viewer',
      description: 'Watched for 10 hours total',
      icon: '🎯',
      requirements: JSON.stringify([
        { type: 'WATCH_TIME', value: 36000, description: 'Watch for 10 hours total' }
      ]),
      rarity: 'RARE'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Super Fan',
      description: 'Watched for 100 hours total',
      icon: '🏆',
      requirements: JSON.stringify([
        { type: 'WATCH_TIME', value: 360000, description: 'Watch for 100 hours total' }
      ]),
      rarity: 'LEGENDARY'
    }
  ]);
}