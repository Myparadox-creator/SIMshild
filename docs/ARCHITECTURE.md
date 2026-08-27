# 🏛️ SIMShield Architecture & Data Flow

## 📌 System Overview

**SIMShield** is an enterprise-grade mobile identity risk mitigation and zero-trust banking defense platform. It coordinates telecom identity signals, temporal fraud correlation, hardware-backed authentication, and real-time payment pre-check interception.

---

## 🏗️ Architectural Topology

```
                                 [ Telecom Partner Network ]
                                 (GSMA Open Gateway / Webhooks)
                                               │
                                               │ HMAC-SHA256 Signed Event (X-Carrier-Signature)
                                               ▼
                              ┌──────────────────────────────────┐
                              │  Ingestion Engine (Node.js ESM)  │
                              │     POST /api/mobile-events      │
                              └────────────────┬─────────────────┘
                                               │ Normalized MobileIdentityEvent
                                               ▼
                              ┌──────────────────────────────────┐
                              │     RuleBasedRiskEngine Core     │
                              │   - 24-Hour Correlation Window   │
                              │   - Multi-Signal Point Engine    │
                              │   - Policy: ALLOW/WARN/STEP/HOLD │
                              └────────┬─────────────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
                 ▼                                           ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│        Mock Banking Core         │        │    SecOps Operations Studio      │
│  - Pre-Check Interception        │        │  - SVG Risk Needle Gauge (0-100) │
│  - Ledger State Machine          │        │  - 5-Stage Attack Simulator      │
│  - ₹10,000 Starting Balance      │        │  - Incident Triage Review Queue  │
│  - Emergency Panic Freeze Lock   │        │  - Real-Time JSON Signal Stream  │
└────────────────┬─────────────────┘        └──────────────────────────────────┘
                 │
                 │ Authoritative JSON REST API
                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED SIMSHIELD ANDROID APP                         │
│                                                                              │
│   ┌──────────────────────────────────┐    ┌──────────────────────────────┐   │
│   │       💳 SIMShield Pay Tab       │    │    🛡️ Security Center Tab    │   │
│   │                                  │    │                              │   │
│   │ • Live Bank Balance (₹10,000)    │    │ • 0-100 Hero Risk Score      │   │
│   │ • Quick Contact Presets          │    │ • Telecom SIM Threat Chip    │   │
│   │ • Send Money Form (Mock UPI)     │    │ • 24h Correlated Timeline    │   │
│   │ • Real-Time Pre-Check Dialog     │    │ • "This was me" Biometrics   │   │
│   │ • 🚨 BLOCK Interception Alert    │    │ • "Secure My Account" Panic  │   │
│   │ • Ledger Transaction Audit Log   │    │ • Attack Sandbox Replay      │   │
│   │ • ⚙️ In-App Backend IP Dialog    │    │ • Monitoring Preferences     │   │
│   └──────────────────────────────────┘    └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Data Flow: Transaction Interception Lifecycle

```
User (Android Client)               SIMShield Risk Backend             Mock Banking Ledger
       │                                      │                                 │
       │ 1. Tap [ Pay ₹2,000 ]                │                                 │
       ├─────────────────────────────────────>│                                 │
       │    POST /api/transactions/precheck   │                                 │
       │                                      │                                 │
       │                                      │ 2. Correlate 24h Signals        │
       │                                      │    (SIM, Device, Pass, Benefic) │
       │                                      │                                 │
       │                                      ├─────────────────────────────────┤
       │                                      │ Evaluation Result:              │
       │                                      │ • Score: 95/100 (CRITICAL)      │
       │                                      │ • Decision: BLOCK               │
       │                                      │ • Reason: ATO_PATTERN           │
       │                                      ├─────────────────────────────────┤
       │                                      │                                 │
       │ 3. Return Pre-Check Interception     │                                 │
       │<─────────────────────────────────────┤                                 │
       │    { decision: "BLOCK", ... }        │                                 │
       │                                      │                                 │
       │ 4. Render 🚨 BLOCKED Dialog          │                                 │
       │    • Money was NOT transferred       │                                 │
       │    • Balance ₹10,000 (UNTOUCHED)     │                                 │
       │    • Show [ 🔒 SECURE MY ACCOUNT ]   │                                 │
       │                                      │                                 │
```

---

## 🔄 Temporal Sliding Window Mechanics

All mobile identity events and authentication actions are indexed by timestamp.
When evaluating risk:
1. Filter events where:
   $$\text{CurrentTime} - \text{EventTimestamp} \le 86,400,000\text{ ms (24 Hours)}$$
2. Events older than 24 hours are expired and excluded from penalty calculations.
3. Points accumulate additively and are capped at **100**.
4. Co-occurring combinations (e.g. `SIM_CHANGED` followed by `NEW_DEVICE_LOGIN`) activate pattern multipliers such as `ACCOUNT_TAKEOVER_PATTERN`.
