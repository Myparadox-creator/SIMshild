# 🎬 SIMShield Live Hackathon & Demo Guide

This guide details the step-by-step procedure to demonstrate the full end-to-end capabilities of **SIMShield** and **SIMShield Pay (Mock UPI)**.

---

## 🎯 Demo Goal
Show judges and stakeholders that:
1. Legitimate payments proceed smoothly without friction.
2. A telecom SIM Swap and Account Takeover (ATO) attack is detected in real time.
3. The fraudulent transfer is **intercepted and blocked at the Pre-Check stage**.
4. The user's money is **100% safe (₹10,000 balance strictly untouched)**.
5. The user can activate **Panic Lockdown ("Secure My Account")** with zero reliance on compromised SMS OTP.

---

## 📋 Pre-Flight Checklist

1. Start the SIMShield backend:
   ```bash
   cd backend
   npm start
   ```
   *(Runs on `http://localhost:3001/` with demo mode enabled)*.
2. Open the SecOps Web Dashboard in your browser: **`http://localhost:3001/`**.
3. Launch the **SIMShield Android App** on your device or emulator:
   - On physical phone: Tap **`⚙️ Server`** $\rightarrow$ Enter `http://<LAPTOP-WIFI-IP>:3001` (or test completely offline!).
   - Tap **`🔄 Sync`** to confirm connection.

---

## 🚀 5-Step Demo Script

### Step 1: Show Initial Secure Posture
- Open the mobile app on the **`💳 SIMShield Pay`** tab.
- Point out:
  - **Available Balance: ₹10,000 INR**
  - **Security Status: `🟢 LOW RISK (18/100)`**
- Open the companion SecOps Dashboard on your screen to show live telemetry and needle gauge.

### Step 2: Normal Payment Flow (Positive Control)
- Tap the quick contact chip: **`Rahul (₹2k)`**.
- Tap **`[ CONTINUE TO PAY ₹2,000 ]`**.
- **What happens**:
  - The risk engine evaluates score $\le 29 \rightarrow$ `ALLOW`.
  - Dialog appears: **`🟢 Payment Successful`**.
  - Balance updates to **₹8,000 INR**.
  - Audit ledger logs the transaction.

### Step 3: Launch Multi-Stage Cyberattack (ATO Simulation)
- Tap **`[ Reset Scenario & Balance (₹10,000) ]`** to reset the baseline.
- Under **Developer Attack Simulator (Sandbox)**, tap:
  **`[ SIMULATE FULL ACCOUNT TAKEOVER (ATO) ]`**.
- **What happens**:
  - The sequential attack unfolds:
    1. Telecom carrier notifies SIM card replacement (`+30 pts`).
    2. Unrecognized device signs in (`+20 pts`).
    3. Password reset requested (`+15 pts`).
    4. Attacker adds fraudulent wire beneficiary (`+15 pts`).
  - Risk score elevates to **`🔴 95/100 (CRITICAL)`**.
  - SecOps Dashboard needle gauge moves into the red critical zone.

### Step 4: The "Hero" Moment — Fraudulent Payment Interception
- In the payment form, select **`Attacker (₹2k)`** (`attacker@fraudbank`).
- Tap **`[ CONTINUE TO PAY ₹2,000 ]`**.
- **The Result**:
  - The server pre-check intercepts the transfer: **`BLOCK`**.
  - High-priority security modal appears:
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
  - Highlight to audience: **The balance remains ₹10,000 with zero loss!**

### Step 5: Activate Emergency Panic Lockdown
- Tap **`[ 🔒 SECURE MY ACCOUNT ]`** in the alert modal.
- **What happens**:
  - Account status immediately becomes **`PROTECTED`**.
  - All outbound transfers and API requests are frozen.
  - Remote attacker sessions are instantly terminated.
  - A Priority 1 (P1) incident case appears in the SecOps triage queue.

---

## 🏆 Summary for Hackathon Judges
SIMShield delivers **zero-trust, server-authoritative defense** against modern mobile identity fraud by intercepting attacks *before* funds are moved, protecting user balances with zero dependency on compromised SMS OTP channels.
