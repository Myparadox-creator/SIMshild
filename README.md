
  
# 🛡️ SIMShield

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android_&_Node.js-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Android_SDK-API_26--35-blue?style=for-the-badge&logo=android" alt="Android SDK" />
  <img src="https://img.shields.io/badge/Backend-Node.js_20+_ESM-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tests-26%2F26_Passing-brightgreen?style=for-the-badge&logo=githubactions&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/Security-Zero--Trust_Client-red?style=for-the-badge&logo=shield" alt="Zero-Trust" />
</p>

<p align="center">
  <strong>Enterprise-Grade Mobile Identity Fraud Mitigation, SIM-Swap Defense & Account Takeover (ATO) Prevention Platform</strong>
</p>

---

## 📌 Executive Overview

**SIMShield** is a full-stack security solution designed to protect mobile banking, digital wallets, and FinTech applications from **SIM swap fraud**, **eSIM hijacking**, **unauthorized number porting**, and **correlated account takeover (ATO)**.

Built strictly on the **Zero-Trust Client Principle**, SIMShield never treats the phone as the fraud-decision authority. Instead, verified telecom signals are ingested via server-to-server HMAC webhooks, correlated across a **24-hour sliding temporal window**, and mapped to authoritative mitigation policies while the native Android app provides hardware-backed biometric authentication and instant panic killswitch controls.

---

## 🏛️ System Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │                  Telecom Carrier / Webhook              │
   │      (GSMA Open Gateway / CAMARA API Standards / Mock)  │
   └────────────────────────────┬────────────────────────────┘
                                │ HMAC-SHA256 Signed Webhook (X-Carrier-Signature)
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │             SIMShield Ingestion & Security API          │
   │                  (POST /api/mobile-events)              │
   └────────────────────────────┬────────────────────────────┘
                                │ Normalized MobileIdentityEvent
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │       RuleBasedRiskEngine (FraudRiskEngine Base)        │
   │  - 24-Hour Sliding Temporal Correlation Window          │
   │  - Multi-Signal Point Accumulation (Capped at 100)      │
   │  - Reason Code Extraction & Policy Mapping              │
   └─────────────┬─────────────────────────────┬─────────────┘
                 │                             │
                 ▼                             ▼
   ┌───────────────────────────┐ ┌───────────────────────────┐
   │   PostgreSQL Data Store   │ │  Mitigation Policy Engine │
   │ Events, Scores, Alerts,   │ │ ALLOW (0-29)              │
   │ Cases, Trusted Devices    │ │ WARN_USER (30-49)         │
   └─────────────┬─────────────┘ │ STEP_UP_AUTH (50-79)      │
                 │               │ HOLD_TRANSACTION (80-100) │
                 │               └─────────────┬─────────────┘
                 └──────────────┬──────────────┘
                                │ Authoritative REST API
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     Android Security App      │               │     SecOps Web Dashboard      │
│ - Security Status (Score/Risk)│               │ - Real-Time SVG Risk Gauge    │
│ - Recent Event Timeline Feed  │               │ - Attack Simulator Studio     │
│ - Native BiometricPrompt Auth │               │ - Incident Review Queue       │
│ - "Secure My Account" Lock    │               │ - Deep Event Signal Inspector │
└───────────────────────────────┘               └───────────────────────────────┘
```

---

## 📱 Mobile Application Installation Guide

You can install the **SIMShield Android Client (v1.1.0)** on your Android device (Android 8.0 / API 26 through Android 15 / API 35) using any of the methods below:

### 📥 Method 1: Download Pre-Built APK from GitHub Actions (Fastest)

1. Open this repository on GitHub in your browser.
2. Click on the **[Actions](https://github.com/Myparadox-creator/SIMshild/actions)** tab.
3. Select the latest successful workflow run for **`Build SIMShield APK`**.
4. Scroll down to the **Artifacts** section at the bottom of the summary page.
5. Click **`simshield-debug-apk`** to download the zip file.
6. Extract the zip file to obtain **`app-debug.apk`**.
7. Transfer/download the `.apk` file to your Android phone.
8. Tap **`app-debug.apk`** on your device to install:
   * *If prompted, enable "Install unknown apps" for your file manager or browser.*
9. Open **SIMShield** from your app drawer!

---

### 💻 Method 2: Build & Install via Command Line (ADB)

Ensure you have Android SDK and ADB installed with your device connected via USB with **USB Debugging enabled**:

```bash
# 1. Clone the repository
git clone https://github.com/Myparadox-creator/SIMshild.git
cd SIMshild

# 2. Build the Debug APK
./gradlew assembleDebug

# 3. Install directly to connected device
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

*(To point the mobile app to your live backend server, pass the `-PRISK_API_BASE_URL` flag:)*
```bash
./gradlew assembleDebug -PRISK_API_BASE_URL=http://10.0.2.2:3000
```

---

### 🛠️ Method 3: Open and Run in Android Studio

1. Open **Android Studio**.
2. Select **Open** and choose the `SIMshild/` root folder.
3. Wait for Gradle sync to complete.
4. Select your target device or emulator in the device dropdown.
5. Click **Run `app`** (`Shift + F10`) to build and launch immediately.

---

## 🎮 Interactive Attack Simulator Sandbox (In-App)

The mobile app includes a built-in **Developer & Hackathon Simulation Sandbox** allowing you to test real-world telecom threat scenarios safely:

| Scenario Button | Simulated Attack Flow | Visual Response |
| :--- | :--- | :--- |
| **`SIMULATE SIM SWAP`** | Simulates physical SIM replacement (+30 pts) | Score moves to **30 (MEDIUM)** with an informational warning banner. |
| **`SIMULATE ESIM CHANGE`** | Simulates digital eSIM profile migration (+30 pts) | Updates timeline to show *"eSIM profile changed"*. |
| **`SIMULATE NUMBER PORTING`** | Simulates MSISDN port-out to adversary carrier (+25 pts) | Risk score increases within the correlation window. |
| **`SIMULATE NEW DEVICE`** | Simulates unrecognized device login (+20 pts) | Correlated with SIM change $\rightarrow$ triggers **HIGH Risk (50 pts)**. |
| **`SIMULATE FULL ATO`** | Multi-stage cyberattack: SIM Swap $\rightarrow$ Device $\rightarrow$ Reset $\rightarrow$ Beneficiary $\rightarrow$ Wire | Score jumps to **`95-100 (CRITICAL)`**, fires **High-Priority Notification**, locks wire transfers, and reveals action buttons. |

### 🔒 In-App Customer Mitigation Controls:
* **`[ ✓ This was me (Verify Biometrics) ]`**: Launches the native Android **`BiometricPrompt`** fingerprint/face scanner to authenticate identity and clear warnings without relying on compromised SMS OTP.
* **`[ 🔒 Secure my account ]`**: Emergency killswitch that terminates remote sessions and freezes outbound banking transfers.
* **`[ ⚠️ Report unauthorized fraud ]`**: Instantly files an emergency incident case with the security operations center.

---

## 🖥️ Interactive SecOps Web Dashboard

SIMShield includes an embedded, high-contrast Security Operations (SecOps) Web Dashboard:

```bash
# 1. Navigate to backend directory
cd backend

# 2. Start the service with demo mode enabled
npm start
```

Open **`http://localhost:3000/`** in your browser to access:
* **Live SVG Threat Gauge**: Real-time needle gauge showing 0–100 risk score and active mitigation policy.
* **Attack Simulator Studio**: Automated 5-stage ATO attack chain replay with live progress stepper.
* **Incident Case Review Queue**: Security analyst review queue to hold transactions or resolve cases.
* **Signal Stream & Inspector**: Chronological audit feed with deep JSON payload inspection and SHA-256 hash validation.

---

## ⚖️ Multi-Signal Scoring Engine & Reason Codes

Signals are correlated within a **24-hour sliding window** and capped at **100 points**:

| Signal Identifier | Weight | Domain | Standardized Reason Code |
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
* **`0 – 29 LOW (ALLOW)`**: Normal profile. Unrestricted banking and authentication access.
* **`30 – 49 MEDIUM (WARN_USER)`**: Non-punitive warning displayed on client. User advised to review SIM activity.
* **`50 – 79 HIGH (STEP_UP_AUTH)`**: Step-up authentication required (Biometrics / FIDO2). Sensitive actions restricted.
* **`80 – 100 CRITICAL (HOLD_TRANSACTION)`**: Automatic hold on outbound wire transfers; P1 fraud case opened.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` or `/dashboard` | Interactive SecOps Web Dashboard & Attack Simulator |
| `GET` | `/healthz`, `/readyz` | Liveness & readiness probes |
| `GET` | `/api/metrics` | Telemetry metrics (events count, active alerts, open cases) |
| `POST` | `/api/mobile-events` | Ingest validated mobile identity event (HMAC verified) |
| `GET` | `/api/mobile-events` | Retrieve global recent security events stream |
| `GET` | `/api/users/{id}/risk` | Authoritative risk score, level, and reason codes |
| `GET` | `/api/users/{id}/security-events` | Chronological event timeline for the subject |
| `GET` | `/api/users/{id}/fraud-alerts` | Active fraud alerts for the subject |
| `POST` | `/api/fraud-alerts/{id}/acknowledge` | Acknowledge security warning banner |
| `POST` | `/api/fraud-alerts/{id}/report` | Report unauthorized fraud & open incident case |
| `POST` | `/api/security/confirm-activity` | "This was me" out-of-band biometric confirmation |
| `GET` | `/api/cases` | List all open fraud mitigation cases |
| `POST` | `/api/cases/{id}/{action}` | Case actions (`RESOLVE`, `HOLD`, `RELEASE`) |
| `POST` | `/api/simulation/{scenario}` | Dev sandbox (`sim-swap`, `esim-change`, `number-port`, `account-takeover`) |

---

## 🐳 Docker Deployment

Run the complete stack (Node.js API + PostgreSQL database) with a single command:

```bash
cd backend
docker compose up -d
```

---

## 🧪 Automated Testing

SIMShield includes a comprehensive automated test suite covering risk scoring, temporal correlation, crypto, API endpoints, and dashboard integration:

```bash
cd backend
npm test
```

```text
✔ SecOps Dashboard & Studio API Suite (7 tests)
✔ HTTP API Integration Suite (7 tests)
✔ Event validation & normalization (1 test)
✔ SIM & eSIM warning detection (2 tests)
✔ Number port detection (1 test)
✔ Account Takeover pattern escalation (1 test)
✔ Temporal sequence & 24h window expiration (2 tests)
✔ Full correlated 100-point takeover sequence (1 test)
✔ Customer confirmation & fraud reporting (2 tests)
✔ Crypto HMAC & timing-safe signatures (2 tests)

ℹ total tests: 26 | suites: 0 | pass: 26 | fail: 0 | duration: ~450ms
```

---

## 🔒 Security & Privacy Guardrails

* **Zero Raw PII Storage:** Only salted HMAC-SHA256 hashes of device IDs, IP addresses, and phone numbers are stored.
* **No SMS OTP Access:** The app never requests `READ_SMS` or `RECEIVE_SMS` permissions.
* **Carrier Signature Validation:** Ingested carrier webhooks verify `X-Carrier-Signature` HMAC tokens.
* **Hardware Attestation:** Biometric confirmations interact directly with Android's secure hardware enclave (`BiometricPrompt`).

---

## 📄 Implementation Plan & Specifications

* **Architecture Document:** [`docs/SIMShield_Implementation_Plan.pdf`](docs/SIMShield_Implementation_Plan.pdf)
* **License:** [MIT License](LICENSE)
