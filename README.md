# SIMShield

SIMShield is an enterprise-grade native Android security status client paired with a server-owned mobile identity fraud mitigation service. It detects correlated SIM swap, eSIM hijacking, unauthorized number porting, and account takeover (ATO) attacks, strictly adhering to the **Zero-Trust Client Principle** (the phone client is an untrusted display, while risk scoring and mitigation policies remain authoritative on the backend).

---

## 🏗 Architecture

```
Telecom Carrier / Webhook ──(HMAC-Signed)──► POST /api/mobile-events
                                                      │
                                                      ▼
                                            RuleBasedRiskEngine
                                            (24h Sliding Window & Scoring)
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
             PostgreSQL Data Store                                        Mitigation Policy Engine
        (Events, Scores, Alerts, Cases)                             (ALLOW / WARN / STEP_UP / HOLD)
                       │                                                             │
                       └──────────────────────────────┬──────────────────────────────┘
                                                      ▼
                                           Android Security Client
                                           (GET /api/users/:id/risk)
```

---

## 🚀 Quick Start

### 1. Run Backend Locally (Node.js)

```bash
cd backend
# Enable demo mode for sandbox simulations
export SIMSHIELD_DEMO=true
npm start
```

### 2. Run Backend with PostgreSQL via Docker Compose

```bash
cd backend
docker compose up -d
```

### 3. Run Backend Test Suite

```bash
cd backend
npm test
```

---

## 📡 API Reference

All production endpoints require application authentication middleware before being exposed externally.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/healthz` | Service health status and readiness probe |
| `POST` | `/api/mobile-events` | Ingest validated mobile identity / security event |
| `GET` | `/api/users/{userId}/risk` | Retrieve latest authoritative risk evaluation |
| `GET` | `/api/users/{userId}/security-events` | Retrieve event timeline for user |
| `GET` | `/api/users/{userId}/fraud-alerts` | Retrieve active fraud alerts for user |
| `POST` | `/api/fraud-alerts/{alertId}/acknowledge` | Customer acknowledges warning banner |
| `POST` | `/api/fraud-alerts/{alertId}/report` | Customer reports unauthorized activity |
| `POST` | `/api/simulation/{scenario}` | Dev sandbox (`simSwap`, `esimChange`, `numberPort`, `accountTakeover`) |

---

## ⚖️ Risk & Mitigation Model

Events are correlated across a configurable **24-hour sliding window** and capped at a score of **100**.

| Risk Level | Score Range | Default Mitigation | Behavior |
| :--- | :--- | :--- | :--- |
| **LOW** | 0 – 29 | `ALLOW` | Normal activity. No customer friction. |
| **MEDIUM** | 30 – 49 | `WARN_USER` | Warning banner displayed. No account lockout. |
| **HIGH** | 50 – 79 | `STEP_UP_AUTH` | Require biometric/hardware token verification. |
| **CRITICAL** | 80 – 100 | `HOLD_TRANSACTION` | Place hold on funds transfer; open fraud investigation case. |

---

## 📱 Android Client

The Android client displays real-time security posture and provides a developer sandbox:
- **Build with custom backend URL:**
  ```bash
  ./gradlew assembleDebug -PRISK_API_BASE_URL=https://your-simshield-host.test
  ```
- Without a configured backend URL, the application operates in an explicit, clearly labeled offline demonstration mode.

---

## 🔒 Security & Privacy Guidelines

- **Tokenized Identifiers:** Only salted/HMAC hashes of device identifiers, IP addresses, and phone numbers are stored in `mobile_identity_events`.
- **Zero Raw PII:** Never store OTPs, SMS bodies, plaintext passwords, account credentials, or SIM IMSI numbers.
- **Webhook Authentication:** Carrier-submitted events support HMAC-SHA256 signature verification via the `X-Carrier-Signature` HTTP header.
