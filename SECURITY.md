# Security

## Twilio Webhook Signature Validation

All incoming Twilio webhooks (SMS) are validated using Twilio's request signature verification before any business logic executes.

### How it works

1. Twilio signs every webhook request with an HMAC-SHA1 signature in the `X-Twilio-Signature` header.
2. The `validateTwilioWebhook` middleware (`lib/twilio/validate.ts`) reconstructs the expected signature using the `TWILIO_AUTH_TOKEN` and compares it.
3. If the signature is missing or invalid, a 403 TwiML response is returned immediately.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TWILIO_AUTH_TOKEN` | Yes (production) | Your Twilio auth token, used to verify webhook signatures |
| `TWILIO_SKIP_VALIDATION` | No | Set to `true` in development to bypass signature checks |
| `TWILIO_WEBHOOK_URL` | No | Explicit webhook URL for signature validation; overrides auto-detected URL |

### Development

Set `TWILIO_SKIP_VALIDATION=true` in your `.env.local` to skip signature validation during local development. Never set this in production.

## Internal API Endpoint Protection

Internal endpoints under `app/api/internal/` are protected by two authentication mechanisms:

1. **X-Internal-Secret header**: Must match the `INTERNAL_API_SECRET` environment variable.
2. **Bearer token (Authorization header)**: Must match `MAINTENANCE_REVIEW_WORKER_SECRET`, `APPLICATION_SCREENING_WORKER_SECRET`, or `CRON_SECRET`.

Either mechanism is sufficient to authenticate a request. If neither is valid, the endpoint returns 401 Unauthorized.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `INTERNAL_API_SECRET` | Yes (production) | Shared secret for `X-Internal-Secret` header authentication |
| `MAINTENANCE_REVIEW_WORKER_SECRET` | Yes | Bearer token for maintenance review processing |
| `APPLICATION_SCREENING_WORKER_SECRET` | No | Bearer token for application screening processing |
| `CRON_SECRET` | Yes | Bearer token for cron job invocations |

## General Security Practices

- No secrets are logged or included in error responses.
- All webhook endpoints validate request authenticity before processing.
- Failed validation attempts are logged with structured logging (pino) for monitoring.
- Rate limiting should be applied to all public-facing endpoints.
- Row-Level Security (RLS) is enforced on all Supabase tables.
