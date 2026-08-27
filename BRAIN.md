# 🧠 SIMShield Core Architectural Brain & Context Reference

> **Single Source of Truth** for developers, future contributors, and AI pair-programmers working on **SIMShield** and **SIMShield Pay**.
> Read this document first before making architectural changes or extending features to prevent design drift or hallucinations.

---

## 🏛️ 1. Core Philosophy & Immutable Invariants

1. **Zero-Trust Server-Authoritative Principle**:
   - The Android mobile client is **strictly an untrusted presentation & reporting layer**.
   - The mobile client **never** computes risk decisions, approves transactions, or alters ledger balances directly.
   - All risk scores (0–100), decision enums (`ALLOW`, `REQUIRE_VERIFICATION`, `HOLD`, `BLOCK`), and balance debits are authoritatively computed on the backend server.
   - If the backend is unreachable, the client degrades gracefully into a self-contained local simulation engine without crashing.

2. **Zero Balance Loss Guardrail**:
   - Every payment request passes through a mandatory **Pre-Transaction Risk Check** (`POST /api/transactions/precheck`) **BEFORE** the simulated bank ledger executes any fund transfer.
   - If a transaction is blocked (`BLOCK` or `HOLD`), the user's balance **must remain strictly untouched** (e.g. ₹10,000 stays ₹10,000).

3. **Zero Raw PII Storage**:
   - No plaintext phone numbers, IMSIs, ICCIDs, IMEI device IDs, or IP addresses are stored.
   - Only salted HMAC-SHA256 hashes are persisted and correlated.
   - The Android app **never** requests sensitive SMS reading permissions (`READ_SMS` / `RECEIVE_SMS`).

4. **Single-App Mobile Architecture**:
   - The mobile application is a single unified APK containing one launcher activity: [`com.simshield.protection.MainActivity`](file:///C:/Users/ASUS/.gemini/antigravity/scratch/SIMshild/app/src/main/java/com/simshield/protection/MainActivity.java).
   - It features an in-app segmented top tab switcher:
     - **Tab 0 (`💳 SIMShield Pay`)**: Mock UPI payment gateway, balance card, recipient picker, payment form, and ledger history.
     - **Tab 1 (`🛡️ Security Center`)**: Telecom fraud detection, 0–100 risk gauge, 24h timeline, "This was me" biometric confirmation, and panic lockdown.

---

## 📁 2. Complete Codebase Map

```
SIMshild/
├── app/                                 # Native Android Application (Java, API 26-35)
│   ├── src/main/
│   │   ├── java/com/simshield/protection/
│   │   │   ├── MainActivity.java        # Single launcher activity with Pay & Security tabs
│   │   │   └── SecurityApiClient.java   # HTTP network client + fallback local simulation engine
│   │   ├── res/
│   │   │   └── values/styles.xml        # Theme & styling definitions
│   │   └── AndroidManifest.xml          # Single launcher intent filter + cleartext HTTP policy
│   └── build.gradle                     # Android SDK 35, Java 17, RISK_API_BASE_URL config
│
├── backend/                             # Authoritative Backend (Node.js 20+ ESM Zero-Dependency)
│   ├── src/
│   │   ├── server.mjs                   # HTTP server lifecycle, routes dispatch, CORS & static files
│   │   ├── risk-engine.mjs              # RuleBasedRiskEngine, scoring, evaluateTransactionRisk()
│   │   ├── banking/
│   │   │   ├── mock-bank.mjs            # Simulated ledger (₹10k balance, atomic debit/credit)
│   │   │   └── transaction-manager.mjs  # Transaction state machine (PRECHECK -> AUTHORIZED -> COMPLETED/BLOCKED)
│   │   ├── repository/
│   │   │   ├── risk-repository.mjs      # Abstract repository interface
│   │   │   ├── in-memory-repo.mjs       # Zero-dependency in-memory data store with MockBank
│   │   │   └── postgres-repo.mjs        # Optional PostgreSQL production adapter
│   │   └── routes/
│   │       ├── transactions.mjs         # /api/transactions/* & /api/users/:id/{balance,transactions}
│   │       ├── security.mjs             # /api/security/emergency-lock & confirm-activity
│   │       ├── simulation.mjs           # /api/simulation/:scenario (sim-swap, new-device, ato, reset)
│   │       ├── events.mjs               # /api/mobile-events (webhook ingestion with HMAC)
│   │       ├── users.mjs                # /api/users/:id/{risk,security-events,fraud-alerts}
│   │       ├── cases.mjs                # /api/cases/* (incident escalation triage)
│   │       └── metrics.mjs              # /api/metrics (telemetry ribbon)
│   │
│   ├── public/                          # SecOps Studio Web Dashboard
│   │   ├── index.html                   # High-contrast UI, SVG risk gauge, payment tester, audit feed
│   │   ├── app.js                       # Frontend state controller & real-time polling
│   │   └── styles.css                   # Responsive dark SecOps theme
│   │
│   ├── db/
│   │   ├── 001_init.sql                 # Baseline security schema
│   │   └── 002_mock_payments.sql        # Accounts, beneficiaries, transactions schema
│   │
│   ├── test/                            # Comprehensive Automated Test Suites (34 Tests)
│   │   ├── risk-engine.test.mjs         # Scoring rules, temporal 24h window, caps, crypto
│   │   ├── api.test.mjs                 # REST HTTP integration tests
│   │   ├── transactions.test.mjs        # 7 mock payment & anti-fraud scenarios
│   │   └── dashboard.test.mjs           # SecOps studio API tests
│   │
│   └── package.json                     # Node 20+ ESM, "test": "node --test"
│
├── BRAIN.md                             # Architectural brain and developer memory (THIS FILE)
├── README.md                            # Comprehensive user & hackathon documentation
└── .github/workflows/
    ├── backend-ci.yml                   # Node 20.x & 22.x test runner CI
    └── android-apk.yml                  # Debug APK build & artifact upload CI
```

---

## ⚖️ 3. Risk Engine Scoring & Decision Logic

### A. Temporal Sliding Correlation Window: **24 Hours (86,400,000 ms)**
- Events older than 24 hours are safely ignored by the correlation engine.
- Score is calculated by accumulating weights from active events, capped at **100**.

### B. Signal Weights & Reason Codes:
| Trigger / Signal | Weight | Reason Code | Description |
| :--- | :---: | :--- | :--- |
| `SIM_CHANGED` / `REPLACED` | **+30** | `RECENT_SIM_CHANGE` | Physical SIM card swap detected by telecom carrier |
| `ESIM_CHANGED` / `ADDED` | **+30** | `RECENT_ESIM_CHANGE` | Digital eSIM profile transfer to new device |
| `NUMBER_PORTED` | **+25** | `NUMBER_PORTED` | Mobile number port-out to adversary network |
| `CARRIER_CHANGED` | **+20** | `CARRIER_CHANGED` | Carrier change without pre-notification |
| `NEW_DEVICE_LOGIN` | **+20** | `NEW_DEVICE` | First-time login from unrecognized hardware device |
| `PASSWORD_RESET` | **+15** | `PASSWORD_RESET_AFTER_SIM_CHANGE` | Password recovery attempt within 24h of SIM change |
| `PIN_RESET` | **+15** | `PIN_RESET` | UPI / security PIN reset requested |
| `NEW_BENEFICIARY` | **+15** | `NEW_BENEFICIARY_AFTER_SIM_CHANGE` | Wire / UPI beneficiary added shortly after SIM swap |
| `ABNORMAL_TRANSACTION` | **+20** | `ABNORMAL_TRANSACTION` | High-value transfer ($\ge ₹20,000$ during elevated risk or $\ge ₹50,000$) |
| `ACCOUNT_TAKEOVER_PATTERN`| **=95** | `ACCOUNT_TAKEOVER_PATTERN` | Correlated sequence: SIM change + new device + (password reset or new beneficiary) |

### C. Authoritative Policy & Transaction Decisions:
| Score Range | Risk Level | Policy (`recommendedMitigation`) | Transaction Decision | Action Required |
| :---: | :---: | :---: | :---: | :--- |
| **0 – 29** | `LOW` | `ALLOW` | `ALLOW` | Transaction auto-approved; funds debited. |
| **30 – 49** | `MEDIUM` | `WARN_USER` | `REQUIRE_VERIFICATION` | Warning banner; Biometric confirmation advised. |
| **50 – 79** | `HIGH` | `STEP_UP_AUTH` | `REQUIRE_VERIFICATION` | Mandatory Android `BiometricPrompt` step-up before payment. |
| **80 – 100** | `CRITICAL`| `HOLD_TRANSACTION` | `BLOCK` | **Transaction BLOCKED**. Balance untouched. P1 case opened. |

---

## 💳 4. Mock Banking & Transaction State Machine

```
[ POST /api/transactions/precheck ]
                 │
                 ▼
      (Evaluate 24h Risk)
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
   ALLOW       VERIFY      BLOCK
     │           │           │
     │     (Biometrics)      │
     │           │           ▼
     │           ▼   [ Status: BLOCKED ]
     │      AUTHORIZED [ Balance: ₹10k Untouched ]
     │           │
     ▼           ▼
[ POST /api/transactions/execute ]
                 │
                 ▼
        (Atomic Bank Debit)
                 │
                 ▼
       [ Status: COMPLETED ]
       [ Balance: ₹10k ➔ ₹8k ]
```

### Transaction States:
* `PRECHECKED`: Pre-check calculated, awaiting client decision.
* `PENDING_VERIFICATION`: Suspicious signal detected; awaiting biometric authentication.
* `AUTHORIZED`: Biometric step-up passed; ready for atomic execution.
* `COMPLETED`: Funds successfully debited on mock bank ledger.
* `BLOCKED`: Blocked by risk engine; funds protected with zero deduction.
* `HELD`: Transaction paused pending SecOps analyst review.

---

## 🔌 5. Network & Port Conventions

* **Default Backend Port**: `3001` (to prevent port collisions with other local dev servers on port 3000).
* **Base URLs**:
  * **SecOps Web Dashboard**: `http://localhost:3001/`
  * **Android Emulator (AVD)**: `http://10.0.2.2:3001`
  * **Physical Android Device**: `http://<LAPTOP-WIFI-IP>:3001` (configured via in-app `⚙️ Server` button).
* **Android Cleartext Policy**: `android:usesCleartextTraffic="true"` is declared in `AndroidManifest.xml` to allow testing against local HTTP endpoints.

---

## ⚠️ 6. Common Pitfalls & Hallucination Preventions

1. **Android View Parenting**:
   - **NEVER** call `parent.addView(child)` on an `EditText` or `View` that was already added inside an inner layout helper. Android throws `IllegalStateException: The specified child already has a parent`.

2. **Client-Side Authorization Bypass**:
   - Direct calls to `/api/transactions/execute` without an authorized `transactionId` or for a blocked user **must return `403 Forbidden`**.

3. **Node.js Test Runner in CI**:
   - In `backend/package.json`, the test script must be `"test": "node --test"`. Do **not** use bash globbing like `"test": "node --test test/**/*.test.mjs"`, which fails on Ubuntu Linux CI runners without globstar.

4. **Emergency Lockdown Semantics**:
   - When `POST /api/security/emergency-lock` is triggered (via `"Secure My Account"`), the account status becomes `PROTECTED`. In this state, **all outbound transfers are unconditionally blocked**, active sessions are revoked, and a P1 fraud case is created.

---

## 🧪 7. Validation Checklist for New Features

Before committing or pushing any new code:
1. Run backend automated test suite:
   ```bash
   cd backend
   npm test
   ```
   *(Must report 34 passing tests, 0 failures).*
2. Verify Java compilation against Android SDK API 34:
   ```powershell
   javac -classpath "$env:LOCALAPPDATA\Android\Sdk\platforms\android-34\android.jar" -d app/build/classes app/src/main/java/com/simshield/protection/*.java app/build/generated/source/buildConfig/debug/com/simshield/protection/BuildConfig.java
   ```
3. Test SecOps dashboard live: `http://localhost:3001/`
4. Confirm git status is clean and changes follow zero-trust server-authoritative design.
