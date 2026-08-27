# 📡 SIMShield REST API Reference

The authoritative SIMShield risk and banking service runs on **port 3001** (or configured port). All endpoints communicate in JSON.

---

## 🔐 1. Ingestion & Webhooks

### Ingest Mobile Identity Event
- **Endpoint**: `POST /api/mobile-events`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Carrier-Signature: <HMAC-SHA256>` *(Optional in demo mode)*
- **Request Body**:
  ```json
  {
    "userId": "demo-user",
    "eventType": "SIM_CHANGED",
    "source": "CARRIER_WEBHOOK",
    "timestamp": "2026-08-27T10:30:00.000Z",
    "metadata": {
      "carrier": "Telecom Partner",
      "msisdnHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "status": "ACCEPTED",
    "eventId": "evt-948271",
    "ingestedAt": "2026-08-27T10:30:01.000Z"
  }
  ```

---

## 🛡️ 2. User Security & Risk State

### Get Authoritative Risk Evaluation
- **Endpoint**: `GET /api/users/:userId/risk`
- **Response**: `200 OK`
  ```json
  {
    "userId": "demo-user",
    "riskScore": 95,
    "riskLevel": "CRITICAL",
    "recommendedMitigation": "HOLD_TRANSACTION",
    "reasonCodes": [
      "RECENT_SIM_CHANGE",
      "NEW_DEVICE",
      "PASSWORD_RESET_AFTER_SIM_CHANGE",
      "NEW_BENEFICIARY_AFTER_SIM_CHANGE",
      "ACCOUNT_TAKEOVER_PATTERN"
    ],
    "evaluatedAt": "2026-08-27T10:35:00.000Z"
  }
  ```

### Get Chronological Security Events
- **Endpoint**: `GET /api/users/:userId/security-events`
- **Response**: `200 OK` (Array of TimelineEvent objects)

---

## 💳 3. Mock Banking & Transactions

### Pre-Transaction Risk Check
- **Endpoint**: `POST /api/transactions/precheck`
- **Request Body**:
  ```json
  {
    "userId": "demo-user",
    "recipientName": "Attacker Mule Account",
    "upiId": "attacker@fraudbank",
    "amount": 2000,
    "currency": "INR",
    "channel": "MOCK_UPI"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "transactionId": "TXN-829103",
    "decision": "BLOCK",
    "status": "BLOCKED",
    "riskScore": 95,
    "riskLevel": "CRITICAL",
    "reasonCodes": ["ACCOUNT_TAKEOVER_PATTERN"],
    "previousBalance": 10000,
    "newBalance": 10000,
    "amount": 2000,
    "currency": "INR",
    "message": "Transaction blocked. Account under threat."
  }
  ```

### Execute Authorized Transaction
- **Endpoint**: `POST /api/transactions/execute`
- **Request Body**:
  ```json
  {
    "transactionId": "TXN-829103",
    "userId": "demo-user"
  }
  ```
- **Response**: `200 OK` (or `403 Forbidden` if blocked or unauthorized)

### Get Live Account Balance
- **Endpoint**: `GET /api/users/:userId/balance`
- **Response**: `200 OK`
  ```json
  {
    "userId": "demo-user",
    "accountNumber": "AC10219988",
    "balance": 10000,
    "currency": "INR",
    "status": "ACTIVE"
  }
  ```

---

## 🔒 4. Mitigation & Customer Actions

### Emergency Panic Lockdown ("Secure My Account")
- **Endpoint**: `POST /api/security/emergency-lock`
- **Request Body**:
  ```json
  {
    "userId": "demo-user",
    "reason": "CUSTOMER_INITIATED_PANIC_LOCK"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "status": "PROTECTED",
    "message": "Account Protected: Outbound transfers frozen, sessions revoked, P1 case opened."
  }
  ```

### Biometric Verification Confirmation ("This was me")
- **Endpoint**: `POST /api/security/confirm-activity`
- **Request Body**:
  ```json
  {
    "userId": "demo-user",
    "verificationMethod": "BIOMETRIC_APP_PIN"
  }
  ```
- **Response**: `200 OK`

---

## 🎮 5. Developer Sandbox Replay

### Trigger Simulation Scenario
- **Endpoint**: `POST /api/simulation/:scenario`
- **Supported Scenarios**:
  - `sim-swap` (+30 pts)
  - `new-device` (+20 pts)
  - `account-takeover` (+95 pts)
  - `reset` (Restores clean state & ₹10,000 balance)
