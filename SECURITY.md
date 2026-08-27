# 🔒 SIMShield Security Policy & Architecture Guide

## 📌 Executive Summary

**SIMShield** is built upon the **Zero-Trust Server-Authoritative Architecture**. In high-risk telecom and mobile identity threat environments (such as SIM swaps, eSIM profile hijacks, and SS7 SMS interception), the client device must be treated as potentially compromised.

This document outlines the security invariants, threat model, cryptographic mechanisms, data privacy controls, and vulnerability disclosure policies governing the SIMShield ecosystem.

---

## 🛡️ Core Security Invariants

1. **Zero-Trust Server Authority**:
   - The Android mobile application is strictly an **untrusted reporting and presentation interface**.
   - No risk determinations, policy decisions (`ALLOW`, `REQUIRE_VERIFICATION`, `HOLD`, `BLOCK`), or balance mutations are made on the mobile client.
   - All risk evaluations are computed authoritatively on the backend risk engine using a 24-hour sliding correlation window.

2. **Pre-Transaction Fraud Interception (Zero Balance Loss)**:
   - Financial transfers cannot execute without passing an authoritative **Pre-Transaction Risk Evaluation** (`POST /api/transactions/precheck`).
   - If an account takeover (ATO) pattern or high-risk signal is active, the transaction state transitions to `BLOCKED`.
   - The simulated bank ledger strictly rejects execution attempts (`403 Forbidden`), and the user's funds remain **100% untouched**.

3. **Zero Raw PII Persistence**:
   - Plaintext phone numbers (MSISDNs), IMSIs, ICCIDs, IMEI numbers, and IP addresses are **never** stored in logs, databases, or memory.
   - All identifiers are normalized and irreversibly hashed using **HMAC-SHA256** with server-side secret salts.

4. **No SMS OTP Access Dependency**:
   - The SIMShield Android application **never** requests or requires `READ_SMS` or `RECEIVE_SMS` Android permissions.
   - High-risk verification uses out-of-band **hardware-backed biometric authentication** (`BiometricPrompt`) via the device's secure enclave (TEE / StrongBox), rendering SMS interception attacks useless.

5. **Atomic Emergency Lockdown**:
   - Activating **"Secure My Account"** immediately transitions account status to `PROTECTED`.
   - Outbound wire and UPI transfers are frozen, active remote sessions are revoked, and a Priority 1 (P1) incident case is dispatched to SecOps.

---

## 🎯 Threat Model & Mitigations

| Threat Vector | Adversary Technique | SIMShield Countermeasure |
| :--- | :--- | :--- |
| **Physical SIM Swap** | Social engineering carrier store representative to issue a replacement SIM card (+30 risk points). | Carrier webhooks ingest `SIM_CHANGED` event. Authoritative policy restricts high-value transactions; prompts out-of-band biometric verification. |
| **eSIM Profile Migration** | Maliciously downloading eSIM profile via phishing or QR code compromise (+30 risk points). | `ESIM_CHANGED` event flags digital profile change within 24h correlation window. |
| **Unauthorized Number Port (MNP)** | Porting phone number to adversary carrier (+25 risk points). | `NUMBER_PORTED` event triggers warning banner and escalates risk score. |
| **SMS OTP Interception** | Reading 2FA SMS codes via swapped SIM. | App replaces SMS 2FA with hardware biometric attestation (`BiometricPrompt` on Android). |
| **Multi-Stage Account Takeover (ATO)** | Sequential attack: SIM Swap $\rightarrow$ New Device Sign-in $\rightarrow$ Password Reset $\rightarrow$ Beneficiary Addition. | Multi-signal correlation engine detects temporal attack chain, caps score at **100 (CRITICAL)**, and **BLOCKS** transfers before execution. |
| **Client-Side API Tampering** | Adversary attempts to bypass precheck by calling `/api/transactions/execute` directly with arbitrary payloads. | Backend re-validates risk score and rejects unauthorized executions with `403 Forbidden`. |

---

## 🔑 Cryptography & Authentication Standards

- **Carrier Webhook Signatures**:
  Incoming carrier events (`POST /api/mobile-events`) require cryptographic verification using `X-Carrier-Signature`:
  $$\text{Signature} = \text{HMAC-SHA256}(\text{SecretKey}, \text{RawPayload})$$
  Comparisons are executed using **timing-safe equality** (`crypto.timingSafeEqual`) to prevent timing attacks.

- **Hardware Biometric Attestation**:
  Biometric prompts interact directly with the Android **Trusted Execution Environment (TEE)** or **StrongBox Keymaster**, ensuring cryptographic keys never enter user-space memory.

- **Database Protection**:
  PostgreSQL schemas enforce parameterized queries to eliminate SQL injection vulnerabilities.

---

## 🚨 Vulnerability Reporting & Disclosure

We welcome responsible security research and vulnerability reports.

### Scope
- Authoritative backend risk engine and REST APIs (`backend/`)
- Mobile identity ingestion and temporal correlation algorithms
- Simulated banking ledger state machine and pre-check enforcement
- Native Android application (`app/`)

### Reporting Process
If you discover a security vulnerability in SIMShield:
1. **Do not open a public GitHub issue.**
2. Email your findings to: **`security@simshield.local`** (or create a private GitHub Security Advisory).
3. Include detailed reproduction steps, proof of concept (PoC), and affected versions.
4. The maintainers will respond within **48 hours** with an acknowledgment and remediation timeline.

---

## 📄 License
This project and its security specifications are licensed under the [MIT License](LICENSE).
