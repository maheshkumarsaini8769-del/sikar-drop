# Security Hardening - Change Log

**Applied:** 2026-10-21
**Scope:** Remove OTP system, keep Truecaller as sole auth path, close all critical audit findings.

## What changed

| # | Change | File | Reason |
|---|--------|------|--------|
| 1 | Removed all `/api/otp/*` and `/api/settings/otp/*` endpoints | server.js | OTP bypassed Truecaller; user opted for Truecaller-only |
| 2 | Removed `getSystemOtp()` + `sendWhatsAppOtpViaProvider()` | server.js | Dead code after #1 |
| 3 | Removed `/api/settings/whatsapp` (OTP config) | server.js | Dead code after #1 |
| 4 | Helmet security headers | server.js | XSS/clickjack mitigation |
| 5 | Rate limit: 800/min read, 60/min write, 10/15min auth | server.js | Brute-force + DoS mitigation |
| 6 | Body parser: 2MB global, 10MB upload, upload parser first | server.js | DoS mitigation + image upload works |
| 7 | Strict `IS_DEV` (`development` only) | server.js | Staging treated as production |
| 8 | Env-var Super-Admin password (no hardcoded fallback in prod) | server.js | Eliminates backdoor |
| 9 | Env password synced to DB pin on login | server.js | Old DB pin cannot bypass env password |
| 10 | Removed all hardcoded sub-admin passwords | server.js | Eliminates backdoors |
| 11 | Truecaller tokens HMAC-signed | server.js | Kills prefix-only bypass |
| 12 | Opt-in `requireAdmin` middleware on 24 write routes | server.js | Ready for auth enforcement |
| 13 | Legacy `otp_codes` lookup kept in `db.js` | db.js | Backward compat only |

## Environment variables required in production

See `.env.example`. Server refuses to start if `ADMIN_TOKEN_SECRET` or `TRUECALLER_SECRET` are missing in production.

## Auth flow after patch

1. User enters phone + name in login modal
2. Clicks "Verify with Truecaller"
3. `POST /api/truecaller/init` -> returns `deepLinkUrl`
4. User's phone opens Truecaller app
5. Truecaller approves -> redirects to `/?truecaller=verified&requestId=...`
6. `site.js` polls `GET /api/truecaller/status?requestId=...` -> verified
7. `handleAuthSuccess()` -> saves user to localStorage
8. User proceeds to checkout

**No OTP step.** No SMS. No WhatsApp OTP. Truecaller only.

## Audit commands (post-deploy)

```bash
# 1. Server starts cleanly
npm start
# -> must print "Auth mode: Truecaller 1-Tap only"

# 2. OTP endpoints gone (should be 404)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8090/api/otp/send
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8090/api/otp/verify
# -> 404 both

# 3. Truecaller endpoints still work (401 = endpoint exists but rejects bad request)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8090/api/truecaller/init -H 'Content-Type: application/json' -d '{}'
# -> 200 or 400, NOT 404

# 4. Old super-admin password rejected
curl -X POST http://localhost:8090/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"maheshsaini10101@gmail.com","password":"mahesh99830"}'
# -> 401 (old password no longer works)

# 5. New password works + returns token
curl -X POST http://localhost:8090/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"maheshsaini10101@gmail.com","password":"<your env password>"}'
# -> 200 with "token": "..."

# 6. Rate limit auth (429 after 10 failed attempts)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8090/api/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"x","password":"y"}'
done | sort | uniq -c
# -> 401 x10, 429 x2

# 7. Security headers present
curl -I http://localhost:8090/ | grep -iE 'x-frame|x-content-type|strict-transport'
# -> all three present

# 8. Truecaller token prefix bypass closed
curl -X POST http://localhost:8090/api/truecaller/verify -H 'Content-Type: application/json' \
  -d '{"phone":"9829012345","truecallerToken":"tc_live_fake"}'
# -> 401 (not verified)

# 9. Products page still loads (200 with JSON array)
curl -s http://localhost:8090/api/products | head -c 100
# -> should start with "["
```

## Remediation Status (Report SEC-AUDIT-2026-10-21-002)

- F-01: Resolved. Sub-admin default credentials blacklisted and deactivated by default.
- F-02: Resolved. Hardcoded MongoDB credentials eliminated from mongo.js; loads strictly via process.env.MONGODB_URI.
- F-03: Resolved. Database re-assertion removed from db.js; seeds use INSERT OR IGNORE without resetting credentials.
- F-04: Resolved. Added id="live-footer-phone" to faq.html, about.html, why.html, and dynamic SSR replacement in server.js.
- F-05: Resolved. All vestigial OTP calls and configuration handlers removed from admin.html and index.html.

## Remaining Considerations

- ENFORCE_ADMIN_AUTH=false by default. Flip to true once admin panel client tokens are consistently attached.
- admin_users.pin hashing migration to bcrypt scheduled for next cycle.
- Append-only model for orders and customers by business design.
