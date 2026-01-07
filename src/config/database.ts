import knex from 'knex';
import { config } from './index';

const knexConfig = require('../../knexfile.js');

// Use neon configuration if NEON_DATABASE_URL is provided, otherwise use the current environment
const dbConfig = process.env.NEON_DATABASE_URL ? knexConfig.neon : knexConfig[config.nodeEnv];

export const db = knex(dbConfig);
export { db as knex }; // Export as knex for compatibility

export async function initializeDatabase(): Promise<void> {
  try {
    // Test database connection with timeout
    const connectionTest = db.raw('SELECT 1').timeout(10000);
    await connectionTest;
    console.log('✅ Database connection established');
    
    // Only run migrations if we're not in a problematic state
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_MIGRATIONS === 'true') {
      await db.migrate.latest();
      console.log('✅ Database migrations completed');
    } else {
      console.log('⚠️ Skipping migrations in test environment');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    // In test environment, don't fail completely - allow tests to run without DB
    if (process.env.NODE_ENV === 'test') {
      console.warn('⚠️ Continuing tests without database connection');
      return;
    }
    
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
  console.log('✅ Database connection closed');
}