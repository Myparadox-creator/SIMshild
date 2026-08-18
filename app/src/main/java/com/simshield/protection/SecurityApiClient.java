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
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Client for communicating with the SIMShield authoritative risk service.
 * <p>
 * Zero-Trust Principle: The Android client is an untrusted display and reporting client.
 * All scoring decisions and risk determinations are computed on the backend.
 */
final class SecurityApiClient {

    interface Callback<T> {
        void success(T result);
        void failure(String safeMessage);
    }

    static final class RiskResult {
        final int score;
        final String level;
        final List<String> reasonCodes;
        final String recommendedMitigation;
        final String alertTitle;
        final boolean simulation;

        RiskResult(int score, String level, List<String> reasonCodes, String recommendedMitigation, String alertTitle, boolean simulation) {
            this.score = score;
            this.level = level != null ? level : "LOW";
            this.reasonCodes = reasonCodes != null ? reasonCodes : new ArrayList<>();
            this.recommendedMitigation = recommendedMitigation != null ? recommendedMitigation : "ALLOW";
            this.alertTitle = alertTitle != null ? alertTitle : "";
            this.simulation = simulation;
        }
    }

    static final class TimelineEvent {
        final String eventId;
        final String eventType;
        final String source;
        final String timestamp;
        final String description;
        final boolean simulation;

        TimelineEvent(String eventId, String eventType, String source, String timestamp, String description, boolean simulation) {
            this.eventId = eventId;
            this.eventType = eventType;
            this.source = source;
            this.timestamp = timestamp;
            this.description = description;
            this.simulation = simulation;
        }
    }

    static final class FraudAlert {
        final String alertId;
        final String severity;
        final int riskScore;
        final String title;
        final String message;
        final String status;
        final String triggeredAt;

        FraudAlert(String alertId, String severity, int riskScore, String title, String message, String status, String triggeredAt) {
            this.alertId = alertId;
            this.severity = severity;
            this.riskScore = riskScore;
            this.title = title;
            this.message = message;
            this.status = status;
            this.triggeredAt = triggeredAt;
        }
    }

    private final String baseUrl;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    SecurityApiClient(String baseUrl) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
    }

    boolean isConfigured() {
        return !baseUrl.trim().isEmpty();
    }

    /**
     * Fetches current authoritative risk evaluation for a user.
     */
    void fetchRisk(String userId, Callback<RiskResult> callback) {
        if (!isConfigured()) {
            callback.failure("Backend not configured. Offline mode active.");
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
                mainHandler.post(() -> callback.failure(e.getMessage()));
            }
        });
    }

    /**
     * Fetches security event history for a user.
     */
    void fetchSecurityEvents(String userId, Callback<List<TimelineEvent>> callback) {
        if (!isConfigured()) {
            callback.failure("Backend not configured.");
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
                mainHandler.post(() -> callback.failure(e.getMessage()));
            }
        });
    }

    /**
     * Sends customer confirmation ("This was me" flow).
     */
    void confirmActivity(String userId, Callback<String> callback) {
        if (!isConfigured()) {
            mainHandler.post(() -> callback.success("Activity confirmed locally."));
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
                mainHandler.post(() -> callback.failure("Verification request failed."));
            }
        });
    }

    /**
     * Reports unauthorized fraud on an alert.
     */
    void reportFraud(String alertId, Callback<String> callback) {
        if (!isConfigured()) {
            mainHandler.post(() -> callback.success("Fraud report filed locally."));
            return;
        }

        executor.execute(() -> {
            try {
                executePost("/api/fraud-alerts/" + alertId + "/report", "{}");
                mainHandler.post(() -> callback.success("Fraud case opened. Protections activated."));
            } catch (Exception e) {
                mainHandler.post(() -> callback.failure("Failed to report fraud."));
            }
        });
    }

    /**
     * Sends a scenario request to the developer simulation endpoint.
     */
    void simulate(String userId, String scenario, Callback<RiskResult> callback) {
        if (!isConfigured()) {
            callback.failure("Backend not configured; showing offline simulation only.");
            return;
        }

        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("userId", userId != null ? userId : "demo-user");

                String raw = executePost("/api/simulation/" + scenario, payload.toString());
                JSONObject root = new JSONObject(raw);
                JSONObject risk = root.getJSONObject("risk");
                JSONObject alert = root.optJSONObject("alert");

                JSONArray reasonsArr = risk.optJSONArray("reasonCodes");
                List<String> reasons = new ArrayList<>();
                if (reasonsArr != null) {
                    for (int i = 0; i < reasonsArr.length(); i++) {
                        reasons.add(reasonsArr.getString(i));
                    }
                }

                RiskResult result = new RiskResult(
                        risk.getInt("riskScore"),
                        risk.getString("riskLevel"),
                        reasons,
                        risk.optString("recommendedMitigation", "ALLOW"),
                        alert != null ? alert.optString("title", "") : "",
                        root.optBoolean("simulation", true)
                );

                mainHandler.post(() -> callback.success(result));
            } catch (Exception e) {
                mainHandler.post(() -> callback.failure("Simulation service unavailable."));
            }
        });
    }

    private String executeGet(String path) throws IOException {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(baseUrl + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
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
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
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
            case "UNUSUAL_TRANSACTION": return "High-value ₹2,00,000 transaction flagged";
            case "UNUSUAL_LOCATION": return "Sign-in from new geolocation";
            default: return eventType.replace("_", " ").toLowerCase();
        }
    }
}
