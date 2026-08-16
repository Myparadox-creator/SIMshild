# SIMShield

SIMShield is a native Android security-status client plus a server-owned mobile-identity fraud risk service. It detects correlated SIM/eSIM and account-takeover signals. It never treats the phone client as the fraud-decision authority.

## Architecture

`Carrier or mock provider → POST /api/mobile-events → RuleBasedRiskEngine → risk score, alert, mitigation case → Android status screen/notification`.

The backend accepts the unified `MobileIdentityEvent` model with event ID, user ID, event type, source, timestamp, platform, hashed device/IP fields, carrier transition fields, verified flag, metadata, and an explicit `simulation` flag. Real and mock carrier sources are distinct: `CARRIER` is reserved for an authorized integration; `MOCK_CARRIER` always returns `simulation: true`.

## Risk and mitigation

The configurable engine in `backend/src/risk-engine.mjs` correlates events in a 24-hour window and caps scores at 100. Starting weights: recent SIM/eSIM change 30, port 25, carrier change 20, new device 20, password/PIN reset 15, beneficiary 15, unusual transaction 20, and failed authentication 10. Scores map to LOW (0–29), MEDIUM (30–49), HIGH (50–79), and CRITICAL (80–100). A mobile-identity change alone creates a warning—not a lock. A critical combination creates a review case and should hold a transaction / restrict sensitive changes at the banking provider.

## API

All production endpoints require the existing application authentication/authorization middleware before they are exposed.

- `POST /api/mobile-events` — ingest a validated event.
- `GET /api/users/{userId}/risk` — latest correlated score and reason codes.
- `GET /api/users/{userId}/security-events` — event timeline.
- `GET /api/users/{userId}/fraud-alerts` — alerts.
- `POST /api/fraud-alerts/{alertId}/acknowledge` and `/report` — customer action endpoints.
- `POST /api/simulation/{simSwap|esimChange|numberPort|accountTakeover}` — development only; set `SIMSHIELD_DEMO=true`.

Run the safe demo service with `SIMSHIELD_DEMO=true npm start` from `backend/`. Never enable simulation endpoints in production.

## Database

`backend/db/001_fraud_risk.sql` defines PostgreSQL tables for events, scores, alerts, cases, and trusted devices with user/time/event/status indexes. Only hashed or tokenized identifiers belong in these records; do not store OTPs, passwords, raw SIM IDs, account numbers, or authentication tokens.

## Android app and demo

Build the Android app normally. The developer simulation controls are explicitly labelled **Simulation**. To reach the backend, pass an HTTPS `RISK_API_BASE_URL` build property, for example `./gradlew assembleDebug -PRISK_API_BASE_URL=https://risk.example.test`. The app sends only a demo user and scenario to `/api/simulation`; the backend returns the authoritative score. Without a configured server, the app shows a local, clearly marked offline demonstration and does not claim carrier verification.

## Tests

Run `npm test` from `backend/`. Tests cover a single SIM change warning, SIM-change/new-device escalation, and a full correlated account-takeover scenario. GitHub Actions executes these tests before building the APK.

## Platform limits and real carrier integration

Android and iOS cannot reliably verify carrier-side SIM replacement, number porting, or eSIM provisioning. A real integration implements a server-to-server provider adapter that validates carrier webhook signatures, normalizes events into `MobileIdentityEvent` with `source: CARRIER`, hashes identifiers before storage, and submits them to the same endpoint. The client must not depend on SMS OTP or hidden device identifiers for recovery.
