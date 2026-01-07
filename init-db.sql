-- Create test database for running tests
CREATE DATABASE cloud_playout_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE cloud_playout TO postgres;
GRANT ALL PRIVILEGES ON DATABASE cloud_playout_test TO postgres;