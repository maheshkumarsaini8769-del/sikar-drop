# Security Hardening - Change Log

Applied: 2026-10-21
Purpose: Close critical and high-severity gaps from the audit.

## What changed

| # | Change | File | Impact |
|---|--------|------|--------|
| 1 | Added Helmet security headers | server.js | XSS/clickjack mitigation |
| 2 | Added rate limiting (200/min global, 10/15min auth) | server.js | Brute-force + DoS mitigation |
| 3 | Reduced JSON body limit 25MB -> 2MB (10MB for uploads) | server.js | Memory DoS mitigation |
| 4 | Removed hardcoded Super-Admin password | server.js | Eliminates backdoor |
| 5 | Removed hardcoded sub-admin passwords | server.js | Eliminates backdoor |
| 6 | Disabled `9999` OTP in production | server.js | Phone verification is now real |
| 7 | Truecaller tokens HMAC-signed (was base64 of phone) | server.js | Forged-token bypass closed |
| 8 | Added opt-in admin auth middleware | server.js | Enables real auth when ready |
| 9 | Added `.env.example` | new | Documents required secrets |

## How to deploy

1. `npm install helmet express-rate-limit`
2. Copy `.env.example` -> `.env.local` and fill in:
   - `SUPER_ADMIN_PASSWORD` (strong, 12+ chars)
   - `SUBADMIN_PASSWORD` (strong)
   - `ADMIN_TOKEN_SECRET` (32 random bytes)
   - `TRUECALLER_SECRET` (32 random bytes)
3. **Change passwords** in admin panel -> Accounts (if you still use default PINs)
4. Restart server: `npm start`
5. **Test everything is still working** (see checklist below)
6. After confirming admin panel sends `X-Admin-Token`, set `ENFORCE_ADMIN_AUTH=true`

## Testing checklist

- [ ] Login with correct password -> success + token returned
- [ ] Login with wrong password -> 401, rate-limited after 10 tries
- [ ] OTP verify with wrong code -> rejected (unless `ALLOW_TEST_OTP=true`)
- [ ] Truecaller flow -> still works end-to-end
- [ ] Products page loads -> no CSP/Helmet breakage
- [ ] Admin panel CRUD still works
- [ ] Contact form submits -> still works
- [ ] Bulk calculator still computes
- [ ] Cart + checkout still works
- [ ] Image upload still works (with 10MB limit)

## Still NOT covered (follow-up recommended)

- Admin API endpoints are still unauthenticated unless `ENFORCE_ADMIN_AUTH=true`
- No CSRF protection (needs cookie-based sessions first)
- `admin_users.pin` still stored in plaintext - migrate to bcrypt
- No `DELETE /api/orders`, `/api/customers`, `/api/khata` endpoints
- No input schema validation (zod/joi)
- Contact phone still hardcoded in footers of `faq.html`, `about.html`, `why.html`, `contact.html` (only the `#live-*` IDs are dynamic)

## Summary of audit findings addressed

| Audit finding | Severity | Status after patch |
|---|---|---|
| No auth on admin API | Critical | Ready but opt-in (ENFORCE_ADMIN_AUTH=true) |
| Hardcoded Super-Admin password | Critical | Removed |
| Plaintext PINs in DB | Critical | Not fixed (requires migration - separate patch) |
| Truecaller prefix-only bypass | Critical | Fixed |
| `9999` OTP bypass | Critical | Fixed in production |
| No CSRF protection | Critical | Not fixed (needs cookie sessions first) |
| No rate limiting | High | Added |
| Missing Helmet headers | High | Added |
| 25MB body limit | High | Reduced to 2MB |
| Wide-open CORS | High | Not fixed (needs allowlist config) |
| Missing DELETE for orders/customers | Medium | Not fixed (design decision) |
| Hardcoded phone in footers | Medium | Not fixed (HTML files) |
