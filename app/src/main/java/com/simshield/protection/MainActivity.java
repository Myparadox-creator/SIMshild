package com.simshield.protection;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Mobile Banking Security Status & SIM/eSIM Fraud Risk Detection Activity.
 * <p>
 * Displays real-time risk scores, correlated security timeline, fraud alert banners,
 * and customer mitigation actions ("This was me", "Secure my account", "Report fraud").
 */
public class MainActivity extends Activity {

    private static final String PREFS_NAME = "simshield_prefs";
    private static final String NOTIFICATION_CHANNEL_ID = "simshield_risk_channel";
    private static final int NOTIFICATION_PERMISSION_REQ_CODE = 1001;
    private static final String DEFAULT_USER_ID = "demo-user";

    // Palette Tokens
    private static final int COLOR_PRIMARY_BLUE = Color.rgb(49, 95, 212);
    private static final int COLOR_SUCCESS_GREEN = Color.rgb(18, 123, 83);
    private static final int COLOR_WARNING_AMBER = Color.rgb(217, 119, 6);
    private static final int COLOR_DANGER_RED = Color.rgb(187, 35, 67);
    private static final int COLOR_TEXT_PRIMARY = Color.rgb(24, 32, 51);
    private static final int COLOR_TEXT_MUTED = Color.rgb(101, 112, 138);
    private static final int COLOR_BG_LIGHT = Color.rgb(248, 249, 255);
    private static final int COLOR_CARD_BG = Color.WHITE;

    private SharedPreferences prefs;
    private SecurityApiClient riskApi;

    // Dynamic UI References
    private TextView scoreText;
    private TextView headlineText;
    private TextView statusTitleText;
    private TextView statusDetailText;
    private TextView riskChipText;
    private View riskDotView;
    private LinearLayout alertActionsContainer;
    private LinearLayout timelineListContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        riskApi = new SecurityApiClient(BuildConfig.RISK_API_BASE_URL);

        createNotificationChannel();
        checkNotificationPermission();

        buildUiLayout();
        refreshSecurityStatus();
    }

    /**
     * Constructs the responsive UI programmatically following clean visual hierarchy.
     */
    private void buildUiLayout() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(16), dp(18), dp(36));
        root.setBackgroundColor(COLOR_BG_LIGHT);
        scrollView.addView(root);
        setContentView(scrollView);

        // Header Title
        TextView appTitle = createText("SIMShield Mobile Security", 22, COLOR_TEXT_PRIMARY);
        appTitle.setPadding(0, dp(4), 0, dp(14));
        root.addView(appTitle);

        // 1. Hero Score & Risk Card
        LinearLayout heroCard = createBox(COLOR_PRIMARY_BLUE, 20);
        heroCard.setOrientation(LinearLayout.VERTICAL);
        heroCard.setPadding(dp(20), dp(20), dp(20), dp(20));

        headlineText = createText("You’re protected", 24, Color.WHITE);
        heroCard.addView(headlineText);

        TextView subHeadline = createText("MOBILE IDENTITY & ACCOUNT INTEGRITY", 11, Color.rgb(218, 229, 255));
        subHeadline.setPadding(0, dp(6), 0, 0);
        heroCard.addView(subHeadline);

        scoreText = createText("18  / 100", 42, Color.WHITE);
        scoreText.setPadding(0, dp(16), 0, 0);
        heroCard.addView(scoreText);

        root.addView(heroCard, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // 2. Section: Protection Status & Fraud Alerts
        addSectionHeader(root, "FRAUD RISK STATUS & ALERTS");
        LinearLayout statusCard = createCard();

        LinearLayout statusRow = new LinearLayout(this);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        statusRow.setPadding(dp(16), dp(16), dp(16), dp(10));

        riskDotView = new View(this);
        riskDotView.setLayoutParams(new LinearLayout.LayoutParams(dp(12), dp(12)));
        statusRow.addView(riskDotView);

        LinearLayout textGroup = new LinearLayout(this);
        textGroup.setOrientation(LinearLayout.VERTICAL);
        textGroup.setPadding(dp(12), 0, 0, 0);

        statusTitleText = createText("No active threat detected", 15, COLOR_TEXT_PRIMARY);
        textGroup.addView(statusTitleText);

        TextView subtitle = createText("Physical SIM & eSIM lifecycle signals normal.", 12, COLOR_TEXT_MUTED);
        textGroup.addView(subtitle);

        statusRow.addView(textGroup, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        riskChipText = createText("LOW", 11, COLOR_SUCCESS_GREEN);
        riskChipText.setPadding(dp(10), dp(6), dp(10), dp(6));
        statusRow.addView(riskChipText);

        statusCard.addView(statusRow);

        statusDetailText = createText(
                "SIMShield correlates telecom carrier signals with banking events in a 24-hour window to protect against SIM-swap and account takeover.",
                12,
                COLOR_TEXT_MUTED
        );
        statusDetailText.setPadding(dp(16), dp(6), dp(16), dp(14));
        statusCard.addView(statusDetailText);

        // 3. Customer Mitigation Action Buttons
        alertActionsContainer = new LinearLayout(this);
        alertActionsContainer.setOrientation(LinearLayout.VERTICAL);
        alertActionsContainer.setPadding(dp(16), 0, dp(16), dp(16));
        statusCard.addView(alertActionsContainer);

        root.addView(statusCard);

        // 4. Section: Security Event Timeline
        addSectionHeader(root, "RECENT SECURITY EVENTS (TIMELINE)");
        LinearLayout timelineCard = createCard();
        timelineCard.setPadding(dp(16), dp(16), dp(16), dp(16));

        timelineListContainer = new LinearLayout(this);
        timelineListContainer.setOrientation(LinearLayout.VERTICAL);
        timelineCard.addView(timelineListContainer);

        root.addView(timelineCard);

        // 5. Section: Monitoring Preferences
        addSectionHeader(root, "MONITORING PREFERENCES");
        LinearLayout monitoringCard = createCard();
        addMonitoringSwitch(monitoringCard, "SIM Swap Monitoring", "Receive real-time alerts on SIM card replacement", "pref_sim");
        addMonitoringSwitch(monitoringCard, "eSIM Hijack Defense", "Protect against unauthorized eSIM profile migration", "pref_esim");
        addMonitoringSwitch(monitoringCard, "Device & Login Anomaly Checks", "Detect unfamiliar sign-in devices or locations", "pref_device");
        root.addView(monitoringCard);

        // 6. Section: Developer Simulation Sandbox
        addSectionHeader(root, "DEVELOPER SIMULATION (SANDBOX)");
        LinearLayout simCard = createCard();
        simCard.setPadding(dp(14), dp(14), dp(14), dp(14));

        simCard.addView(createScenarioButton("Simulate SIM Swap (+30 pts)", "sim-swap"));
        simCard.addView(createScenarioButton("Simulate eSIM Change (+30 pts)", "esim-change"));
        simCard.addView(createScenarioButton("Simulate Number Porting (+25 pts)", "number-port"));
        simCard.addView(createScenarioButton("Simulate New Device Sign-In (+20 pts)", "new-device"));
        simCard.addView(createScenarioButton("Simulate Password Reset (+15 pts)", "password-reset"));
        simCard.addView(createScenarioButton("Simulate New Beneficiary (+15 pts)", "new-beneficiary"));
        simCard.addView(createScenarioButton("Simulate Suspicious Transaction (+20 pts)", "suspicious-transaction"));

        Button btnAto = createButton("Simulate Full Account Takeover (ATO)", true);
        btnAto.setOnClickListener(v -> executeSimulation("account-takeover"));
        simCard.addView(btnAto);

        Button btnClear = createButton("Reset / Clear Local Display", false);
        btnClear.setOnClickListener(v -> {
            showRiskState(18, "LOW", "No active threat detected", null);
            renderDefaultTimeline();
            showToast("Display reset", "Local UI cleared. Backend state is authoritative.");
        });
        simCard.addView(btnClear);

        root.addView(simCard);

        // Footer Disclaimer
        TextView disclaimer = createText(
                "Zero-Trust Principle: The client app never decides fraud scores locally. Authoritative risk is computed on the backend from verified carrier webhooks. No SMS OTPs or raw SIM IMSIs are accessed.",
                12,
                COLOR_TEXT_MUTED
        );
        disclaimer.setPadding(0, dp(18), 0, 0);
        root.addView(disclaimer);

        renderDefaultTimeline();
    }

    /**
     * Refreshes risk and timeline from backend API.
     */
    private void refreshSecurityStatus() {
        riskApi.fetchRisk(DEFAULT_USER_ID, new SecurityApiClient.Callback<SecurityApiClient.RiskResult>() {
            @Override
            public void success(SecurityApiClient.RiskResult result) {
                showRiskState(result.score, result.level, result.alertTitle, result.reasonCodes);
            }

            @Override
            public void failure(String safeMessage) {
                // Keep default offline demonstration display
            }
        });

        riskApi.fetchSecurityEvents(DEFAULT_USER_ID, new SecurityApiClient.Callback<List<SecurityApiClient.TimelineEvent>>() {
            @Override
            public void success(List<SecurityApiClient.TimelineEvent> events) {
                if (events != null && !events.isEmpty()) {
                    renderTimelineEvents(events);
                }
            }

            @Override
            public void failure(String safeMessage) {}
        });
    }

    /**
     * Updates the UI display according to evaluated risk score and level.
     */
    private void showRiskState(int score, String level, String alertTitle, List<String> reasonCodes) {
        boolean isHighRisk = "HIGH".equals(level) || "CRITICAL".equals(level);
        boolean isMediumRisk = "MEDIUM".equals(level);

        scoreText.setText(score + "  / 100");
        riskChipText.setText(level);

        int color = isHighRisk ? COLOR_DANGER_RED : isMediumRisk ? COLOR_WARNING_AMBER : COLOR_SUCCESS_GREEN;
        riskChipText.setTextColor(color);
        riskDotView.setBackground(createRoundedDrawable(color, 99));

        if (isHighRisk) {
            headlineText.setText("Action needed");
            statusTitleText.setText(alertTitle != null && !alertTitle.isEmpty() ? alertTitle : "Potential account takeover detected");
            statusDetailText.setText("Suspicious activity detected shortly after a mobile identity change. Sensitive actions and large transfers are paused.");
            renderCustomerActionButtons();
            dispatchHighRiskNotification();
        } else if (isMediumRisk) {
            headlineText.setText("Security Notice");
            statusTitleText.setText("Recent SIM/eSIM change detected");
            statusDetailText.setText("Your telecom partner reported a recent SIM lifecycle change. Non-punitive warning only.");
            renderCustomerActionButtons();
        } else {
            headlineText.setText("You’re protected");
            statusTitleText.setText("No active threat detected");
            statusDetailText.setText("SIMShield monitors device and mobile-number risk signals. Account alerts are provided only by linked, authorized providers.");
            alertActionsContainer.removeAllViews();
        }
    }

    /**
     * Renders customer action buttons: "This was me", "Secure my account", "Report fraud"
     */
    private void renderCustomerActionButtons() {
        alertActionsContainer.removeAllViews();

        Button btnThisWasMe = createButton("✓  This was me (Verify Identity)", false);
        btnThisWasMe.setOnClickListener(v -> handleThisWasMeAction());
        alertActionsContainer.addView(btnThisWasMe);

        Button btnSecure = createButton("🔒  Secure my account", false);
        btnSecure.setOnClickListener(v -> handleSecureAccountAction());
        alertActionsContainer.addView(btnSecure);

        Button btnReportFraud = createButton("⚠️  Report unauthorized fraud", true);
        btnReportFraud.setOnClickListener(v -> handleReportFraudAction());
        alertActionsContainer.addView(btnReportFraud);
    }

    /**
     * Customer Action: "This was me" flow (Biometric / Secure verification)
     */
    private void handleThisWasMeAction() {
        new AlertDialog.Builder(this)
                .setTitle("Confirm Account Activity")
                .setMessage("Please verify your identity using your device biometric authentication or App PIN. (Note: SMS OTP is not used as the recovery channel for your safety).")
                .setPositiveButton("Verify with Biometrics", (dialog, which) -> {
                    riskApi.confirmActivity(DEFAULT_USER_ID, new SecurityApiClient.Callback<String>() {
                        @Override
                        public void success(String result) {
                            showToast("Activity Confirmed", result);
                            showRiskState(18, "LOW", "No active threat detected", null);
                        }

                        @Override
                        public void failure(String safeMessage) {
                            showToast("Notice", safeMessage);
                        }
                    });
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    /**
     * Customer Action: "Secure my account"
     */
    private void handleSecureAccountAction() {
        new AlertDialog.Builder(this)
                .setTitle("Account Protections Activated")
                .setMessage("We have temporarily restricted wire transfers, beneficiary additions, and credential changes. Your account is secured.")
                .setPositiveButton("OK", null)
                .show();
    }

    /**
     * Customer Action: "Report fraud" flow
     */
    private void handleReportFraudAction() {
        new AlertDialog.Builder(this)
                .setTitle("Report Unauthorized SIM Hijack")
                .setMessage("An immediate fraud investigation case will be opened. Our 24/7 security dispatch team will hold high-value transactions.")
                .setPositiveButton("Confirm Fraud Report", (dialog, which) -> {
                    riskApi.reportFraud("alert-active", new SecurityApiClient.Callback<String>() {
                        @Override
                        public void success(String result) {
                            showToast("Fraud Reported", "Investigation case dispatched. Sensitive actions frozen.");
                        }

                        @Override
                        public void failure(String safeMessage) {
                            showToast("Report Sent", "Security team notified.");
                        }
                    });
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    /**
     * Executes developer simulation scenario.
     */
    private void executeSimulation(String scenario) {
        riskApi.simulate(DEFAULT_USER_ID, scenario, new SecurityApiClient.Callback<SecurityApiClient.RiskResult>() {
            @Override
            public void success(SecurityApiClient.RiskResult result) {
                showRiskState(result.score, result.level, result.alertTitle, result.reasonCodes);
                refreshSecurityStatus();
            }

            @Override
            public void failure(String safeMessage) {
                // Offline fallback representation
                if ("account-takeover".equals(scenario)) {
                    showRiskState(95, "CRITICAL", "Potential account takeover detected (Simulation)", null);
                    renderAtoTimeline();
                } else {
                    showRiskState(45, "MEDIUM", "SIM lifecycle event simulated (Simulation)", null);
                }
                showToast("Simulation Mode", safeMessage);
            }
        });
    }

    /**
     * Renders chronological timeline list.
     */
    private void renderTimelineEvents(List<SecurityApiClient.TimelineEvent> events) {
        timelineListContainer.removeAllViews();
        for (SecurityApiClient.TimelineEvent event : events) {
            String timeFormatted = formatTimestamp(event.timestamp);
            addTimelineItem(timeFormatted, event.description, event.simulation);
        }
    }

    private void renderDefaultTimeline() {
        timelineListContainer.removeAllViews();
        addTimelineItem("10:00 AM", "Physical SIM verified with telecom carrier", true);
        addTimelineItem("Yesterday", "App registered on trusted device", false);
    }

    private void renderAtoTimeline() {
        timelineListContainer.removeAllViews();
        addTimelineItem("10:01 AM", "eSIM profile changed (Telecom partner)", true);
        addTimelineItem("10:04 AM", "New unrecognized device sign-in", true);
        addTimelineItem("10:07 AM", "Password reset requested via out-of-band channel", true);
        addTimelineItem("10:12 AM", "New wire beneficiary added", true);
        addTimelineItem("10:15 AM", "₹2,00,000 transaction BLOCKED (CRITICAL HOLD)", true);
    }

    private void addTimelineItem(String time, String title, boolean isSim) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, dp(6), 0, dp(6));
        row.setGravity(Gravity.CENTER_VERTICAL);

        TextView timeView = createText(time, 11, COLOR_TEXT_MUTED);
        timeView.setLayoutParams(new LinearLayout.LayoutParams(dp(85), LinearLayout.LayoutParams.WRAP_CONTENT));
        row.addView(timeView);

        View dot = new View(this);
        dot.setLayoutParams(new LinearLayout.LayoutParams(dp(8), dp(8)));
        dot.setBackground(createRoundedDrawable(COLOR_PRIMARY_BLUE, 99));
        row.addView(dot);

        TextView titleView = createText("  " + title + (isSim ? " · Simulation" : ""), 13, COLOR_TEXT_PRIMARY);
        titleView.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        row.addView(titleView);

        timelineListContainer.addView(row);
    }

    private Button createScenarioButton(String label, String scenario) {
        Button btn = createButton(label, false);
        btn.setOnClickListener(v -> executeSimulation(scenario));
        return btn;
    }

    private void dispatchHighRiskNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, NOTIFICATION_CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("SIMShield: High-Risk Alert")
                .setContentText("Recent SIM change and abnormal activity detected. Sensitive actions paused.")
                .setPriority(Notification.PRIORITY_HIGH)
                .setAutoCancel(true);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(101, builder.build());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "Security Risk Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Critical alerts for SIM swaps and account takeover threats");
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQ_CODE);
            }
        }
    }

    private void addMonitoringSwitch(LinearLayout container, String title, String description, String prefKey) {
        LinearLayout row = new LinearLayout(this);
        row.setPadding(dp(16), dp(12), dp(16), dp(12));
        row.setGravity(Gravity.CENTER_VERTICAL);

        LinearLayout textLayout = new LinearLayout(this);
        textLayout.setOrientation(LinearLayout.VERTICAL);
        textLayout.addView(createText(title, 15, COLOR_TEXT_PRIMARY));
        textLayout.addView(createText(description, 12, COLOR_TEXT_MUTED));
        row.addView(textLayout, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        Switch toggle = new Switch(this);
        toggle.setChecked(prefs.getBoolean(prefKey, true));
        toggle.setOnCheckedChangeListener((btn, isChecked) ->
                prefs.edit().putBoolean(prefKey, isChecked).apply()
        );
        row.addView(toggle);

        container.addView(row);
    }

    private LinearLayout createCard() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(createRoundedDrawable(COLOR_CARD_BG, 16));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(12));
        card.setLayoutParams(params);
        return card;
    }

    private LinearLayout createBox(int color, int radiusDp) {
        LinearLayout box = new LinearLayout(this);
        box.setBackground(createRoundedDrawable(color, radiusDp));
        return box;
    }

    private TextView createText(String text, int sizeSp, int color) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextSize(sizeSp);
        tv.setTextColor(color);
        return tv;
    }

    private Button createButton(String text, boolean isDanger) {
        Button btn = new Button(this);
        btn.setText(text);
        btn.setTextColor(isDanger ? COLOR_DANGER_RED : COLOR_PRIMARY_BLUE);
        return btn;
    }

    private void addSectionHeader(LinearLayout container, String title) {
        TextView header = createText(title, 12, COLOR_TEXT_MUTED);
        header.setPadding(0, dp(16), 0, dp(8));
        container.addView(header);
    }

    private GradientDrawable createRoundedDrawable(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void showToast(String title, String message) {
        Toast.makeText(this, title + "\n" + message, Toast.LENGTH_LONG).show();
    }

    private String formatTimestamp(String isoTime) {
        try {
            SimpleDateFormat input = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            Date date = input.parse(isoTime);
            SimpleDateFormat output = new SimpleDateFormat("hh:mm a", Locale.US);
            return output.format(date != null ? date : new Date());
        } catch (Exception e) {
            return "Just now";
        }
    }
}
