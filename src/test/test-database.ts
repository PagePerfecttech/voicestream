// Mock database for testing
export const mockDb = {
  transaction: () => ({
    commit: () => Promise.resolve(),
    rollback: () => Promise.resolve(),
  }),
  raw: () => Promise.resolve([{ result: 1 }]),
  migrate: {
    latest: () => Promise.resolve(),
  },
  destroy: () => Promise.resolve(),
};

// Mock database functions for testing
export async function initializeTestDatabase(): Promise<void> {
  console.log('✅ Mock database initialized for testing');
}

export async function closeTestDatabase(): Promise<void> {
  console.log('✅ Mock database closed');
}