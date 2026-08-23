package com.simshield.protection;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Client for communicating with the SIMShield authoritative risk service & Mock Bank ledger.
 * Includes automatic local zero-trust simulation fallback if network is offline.
 */
public final class SecurityApiClient {

    public interface Callback<T> {
        void success(T result);
        void failure(String safeMessage);
    }

    public static final class RiskResult {
        public final int score;
        public final String level;
        public final List<String> reasonCodes;
        public final String recommendedMitigation;
        public final String alertTitle;
        public final boolean simulation;

        public RiskResult(int score, String level, List<String> reasonCodes, String recommendedMitigation, String alertTitle, boolean simulation) {
            this.score = score;
            this.level = level != null ? level : "LOW";
            this.reasonCodes = reasonCodes != null ? reasonCodes : new ArrayList<>();
            this.recommendedMitigation = recommendedMitigation != null ? recommendedMitigation : "ALLOW";
            this.alertTitle = alertTitle != null ? alertTitle : "";
            this.simulation = simulation;
        }
    }

    public static final class TimelineEvent {
        public final String eventId;
        public final String eventType;
        public final String source;
        public final String timestamp;
        public final String description;
        public final boolean simulation;

        public TimelineEvent(String eventId, String eventType, String source, String timestamp, String description, boolean simulation) {
            this.eventId = eventId;
            this.eventType = eventType;
            this.source = source;
            this.timestamp = timestamp;
            this.description = description;
            this.simulation = simulation;
        }
    }

    public static final class AccountBalance {
        public final String userId;
        public final String accountNumber;
        public final int balance;
        public final String currency;
        public final String status;

        public AccountBalance(String userId, String accountNumber, int balance, String currency, String status) {
            this.userId = userId;
            this.accountNumber = accountNumber;
            this.balance = balance;
            this.currency = currency != null ? currency : "INR";
            this.status = status != null ? status : "ACTIVE";
        }
    }

    public static final class TransactionResult {
        public final String transactionId;
        public final String status;
        public final int amount;
        public final String currency;
        public final String recipientName;
        public final String upiId;
        public final int riskScore;
        public final String riskLevel;
        public final String decision;
        public final List<String> reasonCodes;
        public final int previousBalance;
        public final int newBalance;
        public final String createdAt;
        public final String executedAt;
        public final String message;

        public TransactionResult(String transactionId, String status, int amount, String currency,
                                 String recipientName, String upiId, int riskScore, String riskLevel,
                                 String decision, List<String> reasonCodes, int previousBalance,
                                 int newBalance, String createdAt, String executedAt, String message) {
            this.transactionId = transactionId;
            this.status = status != null ? status : "UNKNOWN";
            this.amount = amount;
            this.currency = currency != null ? currency : "INR";
            this.recipientName = recipientName != null ? recipientName : "";
            this.upiId = upiId != null ? upiId : "";
            this.riskScore = riskScore;
            this.riskLevel = riskLevel != null ? riskLevel : "LOW";
            this.decision = decision != null ? decision : "ALLOW";
            this.reasonCodes = reasonCodes != null ? reasonCodes : new ArrayList<>();
            this.previousBalance = previousBalance;
            this.newBalance = newBalance;
            this.createdAt = createdAt != null ? createdAt : "";
            this.executedAt = executedAt != null ? executedAt : "";
            this.message = message != null ? message : "";
        }
    }

    private String baseUrl;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    // Local Simulation State (Standalone offline fallback)
    private int localScore = 18;
    private String localLevel = "LOW";
    private List<String> localReasons = new ArrayList<>();
    private int localBalance = 10000;
    private String localAccountStatus = "ACTIVE";
    private final List<TimelineEvent> localEvents = new ArrayList<>();
    private final List<TransactionResult> localTransactions = new ArrayList<>();

    public SecurityApiClient(String baseUrl) {
        setBaseUrl(baseUrl);
        initLocalState();
    }

    public void setBaseUrl(String url) {
        this.baseUrl = url == null ? "" : url.trim().replaceAll("/+$", "");
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.trim().isEmpty();
    }

    private void initLocalState() {
        localEvents.clear();
        localEvents.add(new TimelineEvent("evt-1", "PHYSICAL_SIM_ACTIVE", "Telecom Partner", "10:45 AM", "Physical SIM active & verified", false));
        localEvents.add(new TimelineEvent("evt-2", "KEYSTORE_ATTESTED", "Android KeyStore Enclave", "Yesterday", "App integrity check passed", false));
        localEvents.add(new TimelineEvent("evt-3", "HARDWARE_ROOT", "Hardware Root of Trust", "Aug 19", "Device security posture verified", false));

        localTransactions.clear();
        localTransactions.add(new TransactionResult("TXN-101", "COMPLETED", 2000, "INR", "Rahul (Personal)", "rahul@mockbank", 18, "LOW", "ALLOW", Collections.emptyList(), 12000, 10000, "Today", "Today", "Completed"));
        localTransactions.add(new TransactionResult("TXN-100", "COMPLETED", 1000, "INR", "Priya Patel", "priya@mockbank", 18, "LOW", "ALLOW", Collections.emptyList(), 13000, 12000, "Yesterday", "Yesterday", "Completed"));
    }

    /**
     * Fetches current authoritative risk evaluation.
     */
    public void fetchRisk(String userId, Callback<RiskResult> callback) {
        if (!isConfigured()) {
            mainHandler.post(() -> callback.success(new RiskResult(localScore, localLevel, localReasons, localLevel.equals("CRITICAL") ? "HOLD_TRANSACTION" : "ALLOW", "", true)));
            return;
        }

        executor.execute(() -> {
            try {
                String raw = executeGet("/api/users/" + userId + "/risk");
                JSONObject root = new JSONObject(raw);
                JSONArray reasonsArr = root.optJSONArray("reasonCodes");
                List<String> reasons = new ArrayList<>();
                if (reasonsArr != null) {
                    for (int i = 0; i < reasonsArr.length(); i++) {
                        reasons.add(reasonsArr.getString(i));
                    }
                }

                RiskResult result = new RiskResult(
                        root.optInt("riskScore", 0),
                        root.optString("riskLevel", "LOW"),
                        reasons,
                        root.optString("recommendedMitigation", "ALLOW"),
                        "",
                        false
                );
                mainHandler.post(() -> callback.success(result));
            } catch (Exception e) {
                // Fallback to local simulation
                mainHandler.post(() -> callback.success(new RiskResult(localScore, localLevel, localReasons, localLevel.equals("CRITICAL") ? "HOLD_TRANSACTION" : "ALLOW", "", true)));
            }
        });
    }

    /**
     * Fetches security event history.
     */
    public void fetchSecurityEvents(String userId, Callback<List<TimelineEvent>> callback) {
        if (!isConfigured()) {
            mainHandler.post(() -> callback.success(new ArrayList<>(localEvents)));
            return;
        }

        executor.execute(() -> {
            try {
                String raw = executeGet("/api/users/" + userId + "/security-events");
                JSONArray arr = new JSONArray(raw);
                List<TimelineEvent> events = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    events.add(new TimelineEvent(
                            obj.optString("eventId", ""),
                            obj.optString("eventType", ""),
                            obj.optString("source", ""),
                            obj.optString("timestamp", ""),
                            formatEventDescription(obj.optString("eventType", "")),
                            obj.optBoolean("simulation", true)
                    ));
                }
                mainHandler.post(() -> callback.success(events));
            } catch (Exception e) {
                mainHandler.post(() -> callback.success(new ArrayList<>(localEvents)));
            }
        });
    }

    /**
     * Fetches live mock bank balance.
     */
    public void fetchBalance(String userId, Callback<AccountBalance> callback) {
        if (!isConfigured()) {
            mainHandler.post(() -> callback.success(new AccountBalance(userId, "AC10219988", localBalance, "INR", localAccountStatus)));
            return;
        }

        executor.execute(() -> {
            try {
                String raw = executeGet("/api/users/" + userId + "/balance");
                JSONObject obj = new JSONObject(raw);
                AccountBalance bal = new AccountBalance(
                        obj.optString("userId", userId),
                        obj.optString("accountNumber", "AC10219988"),
                        obj.optInt("balance", 10000),
                        obj.optString("currency", "INR"),
                        obj.optString("status", "ACTIVE")
                );
                localBalance = bal.balance;
                localAccountStatus = bal.status;
                mainHandler.post(() -> callback.success(bal));
            } catch (Exception e) {
                mainHandler.post(() -> callback.success(new AccountBalance(userId, "AC10219988", localBalance, "INR", localAccountStatus)));
            }
        });
    }

    /**
     * Initiates Mock Payment Pre-check with authoritative risk engine.
     */
    public void precheckTransaction(String userId, String recipientName, String upiId, int amount, Callback<TransactionResult> callback) {
        if (!isConfigured()) {
            performLocalPrecheck(recipientName, upiId, amount, callback);
            return;
        }

        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("userId", userId);
                payload.put("recipientName", recipientName);
                payload.put("upiId", upiId);
                payload.put("amount", amount);
                payload.put("currency", "INR");
                payload.put("channel", "MOCK_UPI");

                String raw = executePost("/api/transactions/precheck", payload.toString());
                JSONObject obj = new JSONObject(raw);
                TransactionResult result = parseTransactionJson(obj);
                mainHandler.post(() -> callback.success(result));
            } catch (Exception e) {
                // Offline fallback precheck
                performLocalPrecheck(recipientName, upiId, amount, callback);
            }
        });
    }

    private void performLocalPrecheck(String recipientName, String upiId, int amount, Callback<TransactionResult> callback) {
        String txnId = "TXN-" + (int)(Math.random() * 900000 + 100000);
        String decision;
        String status;

        if ("PROTECTED".equals(localAccountStatus) || localScore >= 80) {
            decision = "BLOCK";
            status = "BLOCKED";
        } else if (localScore >= 30) {
            decision = "REQUIRE_VERIFICATION";
            status = "PENDING_VERIFICATION";
        } else {
            decision = "ALLOW";
            status = "AUTHORIZED";
        }

        TransactionResult result = new TransactionResult(
                txnId,
                status,
                amount,
                "INR",
                recipientName,
                upiId,
                localScore,
                localLevel,
                decision,
                new ArrayList<>(localReasons),
                localBalance,
                decision.equals("ALLOW") ? localBalance - amount : localBalance,
                "Just now",
                "",
                decision.equals("BLOCK") ? "Transaction blocked. Account under threat." : "Pre-check evaluated"
        );

        if (decision.equals("BLOCK")) {
            localTransactions.add(0, result);
        }

        mainHandler.post(() -> callback.success(result));
    }

    /**
     * Executes an authorized transaction.
     */
    public void executeTransaction(String transactionId, String userId, Callback<TransactionResult> callback) {
        if (!isConfigured()) {
            localBalance = Math.max(0, localBalance - 2000);
            TransactionResult res = new TransactionResult(
                    transactionId,
                    "COMPLETED",
                    2000,
                    "INR",
                    "Rahul",
                    "rahul@mockbank",
                    localScore,
                    localLevel,
                    "ALLOW",
                    Collections.emptyList(),
                    localBalance + 2000,
                    localBalance,
                    "Just now",
                    "Just now",
                    "Completed"
            );
            localTransactions.add(0, res);
            mainHandler.post(() -> callback.success(res));
            return;
        }

        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("transactionId", transactionId);
                payload.put("userId", userId);

                String raw = executePost("/api/transactions/execute", payload.toString());
                JSONObject obj = new JSONObject(raw);
                TransactionResult result = parseTransactionJson(obj);
                localBalance = result.newBalance;
                mainHandler.post(() -> callback.success(result));
            } catch (Exception e) {
                localBalance = Math.max(0, localBalance - 2000);
                TransactionResult res = new TransactionResult(
                        transactionId,
                        "COMPLETED",
                        2000,
                        "INR",
                        "Rahul",
                        "rahul@mockbank",
                        localScore,
                        localLevel,
                        "ALLOW",
                        Collections.emptyList(),
                        localBalance + 2000,
                        localBalance,
                        "Just now",
                        "Just now",
                        "Completed locally"
                );
                localTransactions.add(0, res);
                mainHandler.post(() -> callback.success(res));
            }
        });
    }

    /**
     * Authorizes a transaction following biometric verification.
     */
    public void verifyAndAuthorizeTransaction(String transactionId, String verificationMethod, Callback<TransactionResult> callback) {
        if (!isConfigured()) {
            TransactionResult res = new TransactionResult(
                    transactionId,
                    "AUTHORIZED",
                    2000,
                    "INR",
                    "Rahul",
                    "rahul@mockbank",
                    localScore,
                    localLevel,
                    "ALLOW",
                    Collections.emptyList(),
                    localBalance,
                    localBalance - 2000,
                    "Just now",
                    "",
                    "Authorized via biometrics"
            );
            mainHandler.post(() -> callback.success(res));
            return;
        }

        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("transactionId", transactionId);
                payload.put("verificationMethod", verificationMethod != null ? verificationMethod : "BIOMETRIC");

                String raw = executePost("/api/transactions/authorize", payload.toString());
                JSONObject obj = new JSONObject(raw);
                TransactionResult result = parseTransactionJson(obj);
                mainHandler.post(() -> callback.success(result));
            } catch (Exception e) {
                TransactionResult res = new TransactionResult(
                        transactionId,
                        "AUTHORIZED",
                        2000,
                        "INR",
                        "Rahul",
                        "rahul@mockbank",
                        localScore,
                        localLevel,
                        "ALLOW",
                        Collections.emptyList(),
                        localBalance,
                        localBalance - 2000,
                        "Just now",
                        "",
                        "Authorized locally"
                );
                mainHandler.post(() -> callback.success(res));
            }
        });
    }

    /**
     * Fetches transaction history.
     */
    public void fetchTransactions(String userId, Callback<List<TransactionResult>> callback) {
        if (!isConfigured()) {
            mainHandler.post(() -> callback.success(new ArrayList<>(localTransactions)));
            return;
        }

        executor.execute(() -> {
            try {
                String raw = executeGet("/api/users/" + userId + "/transactions");
                JSONArray arr = new JSONArray(raw);
                List<TransactionResult> list = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    list.add(parseTransactionJson(arr.getJSONObject(i)));
                }
                mainHandler.post(() -> callback.success(list));
            } catch (Exception e) {
                mainHandler.post(() -> callback.success(new ArrayList<>(localTransactions)));
            }
        });
    }

    /**
     * Activates emergency lockdown ("Secure My Account").
     */
    public void emergencyLock(String userId, Callback<String> callback) {
        localAccountStatus = "PROTECTED";
        localScore = 100;
        localLevel = "CRITICAL";
        localReasons = Arrays.asList("ACCOUNT_PROTECTED_EMERGENCY_LOCK", "TRANSFERS_FROZEN");
        localEvents.add(0, new TimelineEvent("evt-lock", "EMERGENCY_LOCK", "User Action", "Just now", "Emergency Panic Lockdown Activated", true));

        if (!isConfigured()) {
            mainHandler.post(() -> callback.success("Account Protected: Outbound transfers frozen, sessions revoked."));
            return;
        }

        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("userId", userId);
                payload.put("reason", "CUSTOMER_INITIATED_PANIC_LOCK");

                executePost("/api/security/emergency-lock", payload.toString());
                mainHandler.post(() -> callback.success("Account Protected: Outbound transfers frozen, sessions revoked."));
            } catch (Exception e) {
                mainHandler.post(() -> callback.success("Account Protected: Outbound transfers frozen locally."));
            }
        });
    }

    /**
     * Sends customer confirmation ("This was me" flow).
     */
    public void confirmActivity(String userId, Callback<String> callback) {
        localScore = 18;
        localLevel = "LOW";
        localReasons.clear();
        localEvents.add(0, new TimelineEvent("evt-conf", "ACTIVITY_CONFIRMED", "Biometric Authentication", "Just now", "Identity verified by user", true));

        if (!isConfigured()) {
            mainHandler.post(() -> callback.success("Identity verified. Warnings acknowledged."));
            return;
        }

        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("userId", userId);
                payload.put("verificationMethod", "BIOMETRIC_APP_PIN");
                executePost("/api/security/confirm-activity", payload.toString());
                mainHandler.post(() -> callback.success("Identity verified. Warnings acknowledged."));
            } catch (Exception e) {
                mainHandler.post(() -> callback.success("Identity verified locally."));
            }
        });
    }

    /**
     * Reports unauthorized fraud.
     */
    public void reportFraud(String alertId, Callback<String> callback) {
        localAccountStatus = "PROTECTED";
        localScore = 100;
        localLevel = "CRITICAL";

        if (!isConfigured()) {
            mainHandler.post(() -> callback.success("Fraud case opened. Protections activated."));
            return;
        }

        executor.execute(() -> {
            try {
                executePost("/api/fraud-alerts/" + alertId + "/report", "{}");
                mainHandler.post(() -> callback.success("Fraud case opened. Protections activated."));
            } catch (Exception e) {
                mainHandler.post(() -> callback.success("Fraud report registered locally."));
            }
        });
    }

    /**
     * Developer Attack Simulation.
     */
    public void simulate(String userId, String scenario, Callback<RiskResult> callback) {
        // Update local simulation state
        if ("reset".equals(scenario)) {
            localScore = 18;
            localLevel = "LOW";
            localReasons.clear();
            localBalance = 10000;
            localAccountStatus = "ACTIVE";
            initLocalState();
        } else if ("sim-swap".equals(scenario)) {
            localScore = 30;
            localLevel = "MEDIUM";
            localReasons = Collections.singletonList("RECENT_SIM_CHANGE");
            localEvents.add(0, new TimelineEvent("evt-sim", "SIM_CHANGED", "Telecom Carrier", "Just now", "Physical SIM replacement detected", true));
        } else if ("new-device".equals(scenario)) {
            localScore = 50;
            localLevel = "HIGH";
            localReasons = Arrays.asList("RECENT_SIM_CHANGE", "NEW_DEVICE", "ACCOUNT_TAKEOVER_PATTERN");
            localEvents.add(0, new TimelineEvent("evt-dev", "NEW_DEVICE_LOGIN", "Auth Service", "Just now", "New unrecognized device sign-in", true));
        } else if ("account-takeover".equals(scenario) || "ato".equals(scenario)) {
            localScore = 95;
            localLevel = "CRITICAL";
            localReasons = Arrays.asList("RECENT_SIM_CHANGE", "NEW_DEVICE", "PASSWORD_RESET", "NEW_BENEFICIARY", "ACCOUNT_TAKEOVER_PATTERN");
            localEvents.add(0, new TimelineEvent("evt-ato", "ACCOUNT_TAKEOVER_PATTERN", "Auth Service", "Just now", "Suspicious transfer after SIM change & password reset", true));
        }

        if (!isConfigured()) {
            mainHandler.post(() -> callback.success(new RiskResult(localScore, localLevel, localReasons, localLevel.equals("CRITICAL") ? "HOLD_TRANSACTION" : "ALLOW", "", true)));
            return;
        }

        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("userId", userId != null ? userId : "demo-user");

                String raw = executePost("/api/simulation/" + scenario, payload.toString());
                JSONObject root = new JSONObject(raw);
                JSONObject risk = root.optJSONObject("risk");
                if (risk == null) risk = root;
                JSONObject alert = root.optJSONObject("alert");

                JSONArray reasonsArr = risk.optJSONArray("reasonCodes");
                List<String> reasons = new ArrayList<>();
                if (reasonsArr != null) {
                    for (int i = 0; i < reasonsArr.length(); i++) {
                        reasons.add(reasonsArr.getString(i));
                    }
                }

                RiskResult result = new RiskResult(
                        risk.optInt("riskScore", 0),
                        risk.optString("riskLevel", "LOW"),
                        reasons,
                        risk.optString("recommendedMitigation", "ALLOW"),
                        alert != null ? alert.optString("title", "") : "",
                        root.optBoolean("simulation", true)
                );

                mainHandler.post(() -> callback.success(result));
            } catch (Exception e) {
                // Fallback to local simulation result
                mainHandler.post(() -> callback.success(new RiskResult(localScore, localLevel, localReasons, localLevel.equals("CRITICAL") ? "HOLD_TRANSACTION" : "ALLOW", "", true)));
            }
        });
    }

    private static TransactionResult parseTransactionJson(JSONObject obj) {
        JSONArray reasonsArr = obj.optJSONArray("reasonCodes");
        List<String> reasons = new ArrayList<>();
        if (reasonsArr != null) {
            for (int i = 0; i < reasonsArr.length(); i++) {
                reasons.add(reasonsArr.optString(i));
            }
        }

        return new TransactionResult(
                obj.optString("transactionId", ""),
                obj.optString("status", "UNKNOWN"),
                obj.optInt("amount", 0),
                obj.optString("currency", "INR"),
                obj.optString("recipientName", ""),
                obj.optString("upiId", ""),
                obj.optInt("riskScore", 0),
                obj.optString("riskLevel", "LOW"),
                obj.optString("decision", "ALLOW"),
                reasons,
                obj.optInt("previousBalance", 10000),
                obj.optInt("newBalance", 10000),
                obj.optString("createdAt", ""),
                obj.optString("executedAt", ""),
                obj.optString("message", "")
        );
    }

    private String executeGet(String path) throws IOException {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(baseUrl + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setRequestProperty("Accept", "application/json");

            int statusCode = conn.getResponseCode();
            if (statusCode / 100 != 2) {
                throw new IOException("HTTP Error " + statusCode);
            }

            try (InputStream in = conn.getInputStream()) {
                return readUtf8(in);
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String executePost(String path, String jsonBody) throws IOException {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(baseUrl + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);

            try (OutputStream out = conn.getOutputStream()) {
                out.write(jsonBody.getBytes(StandardCharsets.UTF_8));
            }

            int statusCode = conn.getResponseCode();
            if (statusCode / 100 != 2) {
                throw new IOException("HTTP Error " + statusCode);
            }

            try (InputStream in = conn.getInputStream()) {
                return readUtf8(in);
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String readUtf8(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[2048];
        int bytesRead;
        while ((bytesRead = in.read(buffer)) != -1) {
            out.write(buffer, 0, bytesRead);
        }
        return out.toString("UTF-8");
    }

    private static String formatEventDescription(String eventType) {
        switch (eventType) {
            case "SIM_CHANGED": return "Physical SIM replacement detected";
            case "ESIM_CHANGED": return "eSIM profile changed";
            case "ESIM_ADDED": return "eSIM profile added to device";
            case "NUMBER_PORTED": return "Mobile number port-out reported";
            case "NEW_DEVICE_LOGIN": return "New unrecognized device sign-in";
            case "PASSWORD_RESET": return "Password reset requested";
            case "PIN_RESET": return "Security PIN reset attempted";
            case "NEW_BENEFICIARY": return "New wire beneficiary added";
            case "UNUSUAL_TRANSACTION": return "Suspicious transaction pre-check flagged";
            case "UNUSUAL_LOCATION": return "Sign-in from new geolocation";
            case "FAILED_AUTH_ATTEMPTS": return "Emergency panic lockdown activated";
            default: return eventType.replace("_", " ").toLowerCase();
        }
    }
}
