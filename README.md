# 🛡️ SIMShield 

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android_&_Node.js-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Android_SDK-API_26--35-blue?style=for-the-badge&logo=android" alt="Android SDK" />
  <img src="https://img.shields.io/badge/Backend-Node.js_20+_ESM-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tests-34%2F34_Passing-brightgreen?style=for-the-badge&logo=githubactions&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/Security-Zero--Trust_Pre--Check-red?style=for-the-badge&logo=shield" alt="Zero-Trust" />
</p>

<p align="center">
  <strong>Enterprise-Grade Mobile Identity Fraud Defense, SIM-Swap Detection & Real-Time Mock UPI Transaction Interception Platform</strong>
</p>

---

## 📌 Executive Overview

**SIMShield** is a full-stack security solution designed to protect mobile banking, digital wallets, and UPI payment apps from **SIM swap fraud**, **eSIM hijacking**, **unauthorized number porting**, and **correlated account takeover (ATO)**.

Built strictly on the **Zero-Trust Server-Authoritative Architecture**, SIMShield ensures:
> **A suspicious transaction is evaluated, intercepted, and blocked BEFORE simulated money transfer is executed.**

### 🌟 Key Capabilities:
* **💳 Integrated SIMShield Pay (Mock UPI)**: Real-time simulated UPI banking environment with live ₹10,000 INR balance, recipient selection, and transaction history.
* **⚡ Pre-Transaction Fraud Check**: Every payment request passes through the server risk engine before bank execution.
* **🛡️ Correlated Temporal Risk Scoring**: 24-hour sliding correlation window evaluating SIM swaps, new device logins, password resets, and new beneficiaries.
* **🔒 Zero Balance Loss on Blocked Fraud**: Blocked transactions strictly preserve user balance (₹10,000 untouched).
* **👆 Hardware Biometric Step-Up**: Android `BiometricPrompt` out-of-band identity verification for medium/high risk events.
* **🚨 Emergency Panic Lockdown**: Instantly freezes outbound transfers, revokes sessions, and opens P1 fraud investigation cases.
* **🌐 Dual Execution Modes**: Connects seamlessly to backend server or runs 100% self-contained standalone offline simulation on physical Android devices.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       UNIFIED SIMSHIELD ANDROID CLIENT                         │
│                                                                                │
│   ┌─────────────────────────────────────┐   ┌──────────────────────────────┐   │
│   │        💳 SIMShield Pay Tab         │   │   🛡️ Security Center Tab     │   │
│   │                                     │   │                              │   │
│   │ - Live Bank Balance (₹10,000 INR)   │   │ - 0-100 Hero Risk Score      │   │
│   │ - Quick Contacts (Rahul, Attacker)  │   │ - Telecom SIM/eSIM Threat Bar│   │
│   │ - Send Money (Mock UPI Form)        │   │ - "This was me" Biometrics   │   │
│   │ - Real-Time Pre-Check Interception  │   │ - 24-Hour Event Timeline     │   │
│   │ - Blocked Alert (Zero Money Lost)   │   │ - "Secure My Account" Lock   │   │
│   │ - Live Ledger Audit History         │   │ - Attack Simulator Sandbox   │   │
│   │ - In-App ⚙️ Backend Server Config   │   │ - Monitoring Preferences     │   │
│   └──────────────────┬──────────────────┘   └──────────────┬───────────────┘   │
└──────────────────────┼─────────────────────────────────────┼───────────────────┘
                       │                                     │
                       │ REST API / JSON (Cleartext Allowed) │
                       ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                       AUTHORITATIVE SIMSHIELD BACKEND                          │
│                                                                                │
│  - POST /api/transactions/precheck      - POST /api/transactions/execute       │
│  - GET  /api/users/:userId/balance      - POST /api/security/emergency-lock   │
│  - GET  /api/users/:userId/risk         - POST /api/simulation/:scenario       │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                       RULE-BASED RISK ENGINE (24-Hour Window)                  │
│                                                                                │
│   • SIM Swap (+30) • New Device (+20) • Password Reset (+15) • Beneficiary (+15) │
└──────────────────────┬──────────────────────┬──────────────────────┬───────────┘
                       │                      │                      │
                       ▼                      ▼                      ▼
                   🟢 ALLOW               🟡 VERIFY              🔴 BLOCK
                       │                      │                      │
                       ▼                      ▼                      ▼
                [  Mock Bank Ledger  ] [  Android Biometrics ] [ P1 Case Opened   ]
                [  Debit Balance     ] [  Hardware Step-Up   ] [ Balance Protected]
                [  ₹10,000 → ₹8,000  ] [  Execute upon Auth  ] [ Balance: ₹10,000 ]
```

---

## 📱 Mobile Application Installation & Setup

You can install the **SIMShield Android Client (v1.1.0)** on your Android device (Android 8.0 / API 26 through Android 15 / API 35):

### 📥 Method 1: Download Pre-Built APK from GitHub Actions (Fastest)

1. Navigate to the **[Actions](https://github.com/Myparadox-creator/SIMshild/actions)** tab in this repository.
2. Select the latest successful workflow run for **`Build SIMShield APK`**.
3. Scroll down to **Artifacts** and download **`simshield-debug-apk`**.
4. Extract `app-debug.apk` and transfer it to your Android phone.
5. Tap to install (enable *"Install unknown apps"* if prompted).
6. Launch **SIMShield**!

---

### 💻 Method 2: Build & Install via Gradle / ADB

```bash
# 1. Clone the repository
git clone https://github.com/Myparadox-creator/SIMshild.git
cd SIMshild

# 2. Build Debug APK
./gradlew assembleDebug

# 3. Install directly to connected device
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

### 🛠️ Method 3: Open in Android Studio

1. Open **Android Studio** $\rightarrow$ **Open** $\rightarrow$ select the `SIMshild` root folder.
2. Wait for Gradle sync to complete.
3. Select your connected device or emulator from the device dropdown.
4. Click **Run `app`** (`Shift + F10`).

---

## ⚙️ Connecting the Mobile App to Backend

The mobile app includes a built-in **`⚙️ Server`** configuration button in the header bar:

* **On Android Emulator**: Enter `http://10.0.2.2:3001`
* **On Physical Phone (Same Wi-Fi)**: Enter `http://<YOUR-LAPTOP-IP>:3001` (e.g. `http://172.17.74.194:3001`)
* **Offline / Standalone Mode**: Leave empty or disconnect — the app will automatically run its built-in zero-trust risk engine locally!

---

## 🎮 Hackathon Demonstration Flow (5 Steps)

Follow this 5-step sequence for a complete demonstration of real-time fraud pre-check interception:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. Normal App  │ ──> │ 2. Normal Transfer│ ──> │ 3. Trigger ATO  │ ──> │ 4. Block Fraud   │ ──> │ 5. Panic Lockdown│
│ Balance: ₹10,000│     │ ₹2k to Rahul     │     │ Full Attack     │     │ ₹2k to Attacker  │     │ Transfers Frozen │
│ Risk: LOW (18)  │     │ Balance: ₹8,000  │     │ Risk: CRITICAL  │     │ Balance: ₹10,000 │     │ Sessions Revoked │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘     └──────────────────┘
```

### Step 1: Initial Health Posture
* Open **SIMShield** $\rightarrow$ `💳 SIMShield Pay` tab.
* Initial state: **Available Balance: ₹10,000 INR**, Security Status: **`🟢 LOW RISK (18/100)`**.

### Step 2: Demonstrate Normal Approved Payment
1. Select **Rahul (Personal)** (`rahul@mockbank`) $\rightarrow$ Amount: **₹2,000**.
2. Tap **`[ CONTINUE TO PAY ₹2,000 ]`**.
3. **Result**:
   - Backend evaluates risk: `ALLOW`.
   - Dialog shows: **`🟢 Payment Successful`**.
   - Simulated Bank Balance debits from **₹10,000 $\rightarrow$ ₹8,000**.

### Step 3: Trigger Multi-Stage Account Takeover (ATO) Attack
1. Tap **`[ Reset Scenario & Balance (₹10,000) ]`** to restore fresh state.
2. In the Developer Attack Simulator, tap **`[ SIMULATE FULL ACCOUNT TAKEOVER (ATO) ]`**.
3. The sequential attack chain is simulated:
   ```text
   SIM_SWAP (+30 pts) ➔ NEW_DEVICE (+20 pts) ➔ PASSWORD_RESET (+15 pts) ➔ NEW_BENEFICIARY (+15 pts)
   ```
4. Risk score elevates to **`🔴 CRITICAL RISK (95/100)`**.

### Step 4: Attempt Fraudulent Money Transfer (The "Hero" Interception)
1. Select **Attacker Mule Account** (`attacker@fraudbank`) $\rightarrow$ Amount: **₹2,000**.
2. Tap **`[ CONTINUE TO PAY ₹2,000 ]`**.
3. **Result**:
   - Server intercepts payment at pre-check stage: **`BLOCK`**.
   - High-Priority Fraud Dialog displays:
     ```text
     🚨 TRANSACTION BLOCKED

     Amount: ₹2,000
     Risk Score: 95/100 (CRITICAL)

     Reasons:
     • Recent SIM/eSIM change
     • New device
     • Password reset
     • New beneficiary

     Your money was not transferred.
     Simulated Bank Balance: ₹10,000 (UNTOUCHED)

     The transaction was blocked before simulated execution.
     ```
   - **The user's bank balance remains strictly ₹10,000 (Zero Loss!)**.

### Step 5: Activate Emergency "Secure My Account"
1. In the alert dialog, tap **`[ 🔒 SECURE MY ACCOUNT ]`**.
2. **Result**:
   - Account status becomes **`PROTECTED`**.
   - Outbound wire/UPI transfers: **FROZEN**.
   - Remote active sessions: **REVOKED**.
   - P1 Fraud Investigation Case: **OPENED**.

---

## 🖥️ Interactive SecOps Web Dashboard

SIMShield includes a high-contrast companion Security Operations (SecOps) Web Dashboard:

```bash
cd backend
npm start
```

Open **`http://localhost:3001/`** in your browser to access:
* **Live Bank Balance Metric**: Displays real-time ledger balance and account protection status.
* **💳 SIMShield Pay Gateway**: Interactive payment tester on web to verify pre-checks.
* **Live SVG Threat Gauge**: 0–100 animated needle gauge showing current risk score and mitigation policy.
* **Attack Simulator Studio**: 5-stage automated attack chain replay with live progress stepper.
* **Incident Case Review Queue**: Analyst triage queue with actions to release or hold transactions.
* **Real-Time Signal Feed**: Cryptographically verified audit log with JSON inspector.

---

## ⚖️ Multi-Signal Scoring Engine & Reason Codes

Signals are correlated across a **24-hour sliding window** and capped at **100 points**:

| Signal Identifier | Weight | Domain | Reason Code |
| :--- | :---: | :--- | :--- |
| `SIM_CHANGED` / `REPLACED` | **+30** | Telecom Physical | `RECENT_SIM_CHANGE` |
| `ESIM_CHANGED` / `ADDED` | **+30** | Telecom Digital | `RECENT_ESIM_CHANGE` |
| `NUMBER_PORTED` | **+25** | Telecom Routing | `NUMBER_PORTED` |
| `CARRIER_CHANGED` | **+20** | Telecom Network | `CARRIER_CHANGED` |
| `NEW_DEVICE_LOGIN` | **+20** | Authentication | `NEW_DEVICE / ACCOUNT_TAKEOVER_PATTERN` |
| `PASSWORD_RESET` | **+15** | Credential Recovery | `PASSWORD_RESET_AFTER_SIM_CHANGE` |
| `PIN_RESET` | **+15** | Credential Recovery | `PIN_RESET` |
| `NEW_BENEFICIARY` | **+15** | Core Banking | `NEW_BENEFICIARY_AFTER_SIM_CHANGE` |
| `UNUSUAL_TRANSACTION` | **+20** | Financial Velocity | `ABNORMAL_TRANSACTION` |
| `FAILED_AUTH_ATTEMPTS` | **+10** | Authentication | `FAILED_AUTH_ATTEMPTS` |

### 🚦 Automated Response Policies:
* **`0 – 29 LOW (ALLOW)`**: Normal profile. Payments execute automatically.
* **`30 – 49 MEDIUM (WARN_USER)`**: Step-up warning. User advised to review SIM activity.
* **`50 – 79 HIGH (STEP_UP_AUTH)`**: Hardware biometric authentication required before payment.
* **`80 – 100 CRITICAL (HOLD_TRANSACTION / BLOCK)`**: Outbound transfers blocked; balance untouched; P1 case opened.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` or `/dashboard` | Interactive SecOps Web Dashboard & Attack Simulator |
| `GET` | `/healthz`, `/readyz` | Liveness & readiness health checks |
| `GET` | `/api/metrics` | Telemetry metrics (events count, active alerts, held txns) |
| `POST` | `/api/mobile-events` | Ingest validated mobile identity event (HMAC verified) |
| `GET` | `/api/mobile-events` | Retrieve global recent security events stream |
| `GET` | `/api/users/{id}/risk` | Authoritative risk score, level, and reason codes |
| `GET` | `/api/users/{id}/security-events` | Chronological event timeline for the subject |
| `GET` | `/api/users/{id}/fraud-alerts` | Active fraud alerts for the subject |
| `GET` | `/api/users/{id}/balance` | Live mock bank balance and account status |
| `GET` | `/api/users/{id}/transactions` | Ledger transaction history with risk audit metadata |
| `POST` | `/api/transactions/precheck` | Pre-transaction fraud risk evaluation & decision (`ALLOW`/`BLOCK`) |
| `POST` | `/api/transactions/verify` | Step-up biometric authentication confirmation |
| `POST` | `/api/transactions/execute` | Authoritative mock bank debit/credit execution |
| `POST` | `/api/security/emergency-lock` | Panic lockdown: freeze transfers, revoke sessions, open P1 case |
| `POST` | `/api/security/confirm-activity` | "This was me" out-of-band biometric confirmation |
| `GET` | `/api/cases` | List all open fraud mitigation cases |
| `POST` | `/api/cases/{id}/{action}` | Case actions (`RESOLVE`, `HOLD`, `RELEASE`) |
| `POST` | `/api/simulation/{scenario}` | Dev sandbox (`sim-swap`, `esim-change`, `new-device`, `account-takeover`, `reset`) |

---

## 🧪 Automated Testing

SIMShield includes **34 automated test suites** covering risk scoring, temporal correlation, mock payments, transaction pre-checks, emergency lockdowns, and crypto signatures:

```bash
cd backend
npm test
```

```text
▶ SecOps Dashboard & Studio API Suite (7 tests)
  ✔ GET / serves HTML dashboard
  ✔ GET /styles.css serves CSS stylesheet
  ✔ GET /app.js serves JavaScript controller
  ✔ GET /api/metrics returns system metrics and telemetry
  ✔ GET /api/mobile-events returns global recent events list
  ✔ Case escalation and resolution workflow
  ✔ POST /api/reset clears user state cleanly
✔ SecOps Dashboard & Studio API Suite (92ms)

▶ HTTP API Integration Suite (7 tests)
  ✔ GET /healthz returns 200 HEALTHY
  ✔ POST /api/mobile-events ingests event and returns 201
  ✔ GET /api/users/:userId/risk returns updated risk evaluation
  ✔ GET /api/users/:userId/security-events returns event timeline
  ✔ POST /api/security/confirm-activity confirms user identity
  ✔ POST /api/fraud-alerts/:alertId/report opens fraud case
  ✔ POST /api/simulation/:scenario fails with 403 when demo disabled
✔ HTTP API Integration Suite (47ms)

✔ Event validation correctly normalizes and validates mobile identity events
✔ Recent SIM change is a warning-level medium risk (30 pts)
✔ Recent eSIM profile change is a warning-level medium risk (30 pts)
✔ Number ported event awards 25 risk points with a warning alert
✔ SIM change + new device login triggers ACCOUNT_TAKEOVER_PATTERN (50 pts)
✔ Temporal Sequence: Password reset & beneficiary addition shortly after SIM change
✔ Full correlated takeover sequence caps score at 100 and escalates to CRITICAL
✔ Events outside the 24-hour correlation window are ignored
✔ Safe customer confirmation ("This was me" flow) resolves alerts with verified audit trail
✔ Crypto HMAC hashing and timing-safe webhook signature verification

▶ Mock UPI & Transaction Anti-Fraud Suite (7 tests)
  ✔ Scenario 1: Normal transaction with low risk completes and updates balance
  ✔ Scenario 2: SIM swap only raises risk to MEDIUM and requires verification
  ✔ Scenario 3: SIM swap + New device raises risk to HIGH and requires biometric step-up
  ✔ Scenario 4: Full ATO sequence results in CRITICAL risk, BLOCK decision, and zero balance change
  ✔ Scenario 5: Old SIM event outside 24h window does not penalize transaction
  ✔ Scenario 6: Emergency Lockdown freezes transfers immediately
  ✔ Scenario 7: Transaction history audit log accurately records all transactions
✔ Mock UPI & Transaction Anti-Fraud Suite (77ms)

ℹ total tests: 34 | suites: 0 | pass: 34 | fail: 0 | duration: ~250ms
```

---

## 🔒 Security & Privacy Guardrails

* **Zero Raw PII Storage:** Only salted HMAC-SHA256 hashes of device IDs, IP addresses, and phone numbers are stored.
* **No SMS OTP Access:** The app never requests `READ_SMS` or `RECEIVE_SMS` permissions.
* **Cleartext Network Policy:** Restricted explicitly for local testing via `android:usesCleartextTraffic="true"`.
* **Hardware Enclave Attestation:** Biometric confirmations interact directly with Android's secure hardware enclave (`BiometricPrompt`).
* **Authoritative Ledger Guard:** Blocked transactions can never debit funds; direct client-side execution attempts are rejected with `403 Forbidden`.

---

## 📄 License & Implementation Docs

* **Implementation Walkthrough:** [`walkthrough.md`](walkthrough.md)
* **License:** [MIT License](LICENSE)
