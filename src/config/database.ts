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
    console.log('🔍 Testing database connection...');
    const connectionTest = db.raw('SELECT 1 as test').timeout(15000);
    await connectionTest;
    console.log('✅ Database connection established');
    
    // Only run migrations if we're not in a problematic state
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_MIGRATIONS === 'true') {
      console.log('🔄 Running database migrations...');
      await db.migrate.latest();
      console.log('✅ Database migrations completed');
      
      // Check if we need to run seeds
      if (process.env.NODE_ENV === 'production' && process.env.RUN_SEEDS === 'true') {
        console.log('🌱 Running database seeds...');
        await db.seed.run();
        console.log('✅ Database seeds completed');
      }
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
    
    // In production, retry once after a delay
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Retrying database connection in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const retryTest = db.raw('SELECT 1 as test').timeout(15000);
        await retryTest;
        console.log('✅ Database connection established on retry');
        return;
      } catch (retryError) {
        console.error('❌ Database retry failed:', retryError);
      }
    }
    
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await db.destroy();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.warn('⚠️ Error closing database connection:', error);
  }
}