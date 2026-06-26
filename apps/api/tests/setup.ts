/**
 * Test setup file — loaded before all test suites.
 * Sets NODE_ENV to 'test' and configures test environment variables.
 */
process.env.NODE_ENV = 'test';
process.env.API_PORT = '4001';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.DATABASE_URL = 'postgresql://postgres:test@localhost:5432/kalavaras_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_that_is_long_enough_for_validation_minimum_32_chars';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_that_is_different_from_access_secret_32_chars';
process.env.INTERNAL_SERVICE_SECRET = 'test_internal_service_secret_16';
process.env.SLIT_SCAN_SERVICE_URL = 'http://localhost:5000';
process.env.R2_ACCOUNT_ID = 'test';
process.env.R2_ACCESS_KEY_ID = 'test';
process.env.R2_SECRET_ACCESS_KEY = 'test';
process.env.R2_BUCKET_NAME = 'test';
process.env.R2_PUBLIC_URL = 'http://localhost:4001/media';
process.env.RESEND_API_KEY = 're_test';
process.env.EMAIL_FROM = 'test@localhost';
process.env.LOG_LEVEL = 'error'; // Suppress logs in tests
