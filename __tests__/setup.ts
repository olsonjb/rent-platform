// Test setup — set dummy environment variables before any module loads
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
process.env.TWILIO_PHONE_NUMBER = "+15551234567";
process.env.STRIPE_MODE = "demo";
process.env.STRIPE_TEST_SECRET_KEY = "sk_test_dummy";
