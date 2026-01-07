import { initializeTestDatabase, closeTestDatabase } from './test-database';

// Set test environment
process.env.NODE_ENV = 'test';

// Setup before all tests
beforeAll(async () => {
  try {
    // Use mock database for tests
    await initializeTestDatabase();
  } catch (error) {
    console.error('❌ Test setup failed:', error);
  }
}, 10000); // Reduce timeout to 10 seconds

// Cleanup after all tests
afterAll(async () => {
  try {
    await closeTestDatabase();
  } catch (error) {
    console.warn('⚠️ Error during test cleanup:', error);
  }
}, 10000);

// Clean up after each test
afterEach(async () => {
  // Clean up any test data if needed
  // This will be implemented as we add more tests
});