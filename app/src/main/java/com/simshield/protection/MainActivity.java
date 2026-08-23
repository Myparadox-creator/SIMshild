package com.simshield.protection;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Unified SIMShield Android Application.
 * <p>
 * Combines:
 * 1. 💳 SIMShield Pay — Mock UPI Payment Gateway with real-time pre-check fraud interception.
 * 2. 🛡️ SIMShield Security — Mobile Telecom & Account Takeover Defense Center.
 */
public class MainActivity extends Activity {

    private static final String PREFS_NAME = "simshield_prefs";
    private static final String NOTIFICATION_CHANNEL_ID = "simshield_risk_channel";
    private static final int NOTIFICATION_PERMISSION_REQ_CODE = 1001;
    private static final int REQUEST_CODE_DEVICE_CREDENTIAL = 2001;
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
    private CancellationSignal cancellationSignal;

    // Active Tab State: 0 = Pay (Mock UPI), 1 = Security Defense
    private int currentTab = 0;

    // Root Containers
    private LinearLayout payTabContainer;
    private LinearLayout securityTabContainer;
    private Button btnTabPay;
    private Button btnTabSecurity;

    // --- Tab 1: SIMShield Pay UI Elements ---
    private TextView payBalanceText;
    private TextView payAccountHolderText;
    private TextView paySecurityChipText;
    private View paySecurityDotView;
    private EditText inputRecipient;
    private EditText inputUpi;
    private EditText inputAmount;
    private EditText inputMessage;
    private Button btnPay;
    private LinearLayout txnHistoryContainer;
    private int currentBalance = 10000;

    // --- Tab 2: Security Center UI Elements ---
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

        buildUnifiedUi();
        refreshAllData();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshAllData();
    }

    /**
     * Constructs the single responsive UI with top tab switcher.
     */
    private void buildUnifiedUi() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(16), dp(18), dp(36));
        root.setBackgroundColor(COLOR_BG_LIGHT);
        scrollView.addView(root);
        setContentView(scrollView);

        // Header Title
        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);
        headerRow.setPadding(0, dp(4), 0, dp(12));

        LinearLayout headerTitles = new LinearLayout(this);
        headerTitles.setOrientation(LinearLayout.VERTICAL);
        headerTitles.addView(createText("SIMShield", 24, COLOR_TEXT_PRIMARY));
        headerTitles.addView(createText("MOBILE IDENTITY & ZERO-TRUST BANKING", 11, COLOR_TEXT_MUTED));
        headerRow.addView(headerTitles, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        Button btnRefresh = createButton("🔄 Refresh", false);
        btnRefresh.setOnClickListener(v -> refreshAllData());
        headerRow.addView(btnRefresh);

        root.addView(headerRow);

        // Top Navigation Tab Switcher (Segmented Control)
        LinearLayout tabSwitcher = createBox(Color.rgb(235, 238, 245), 14);
        tabSwitcher.setOrientation(LinearLayout.HORIZONTAL);
        tabSwitcher.setPadding(dp(4), dp(4), dp(4), dp(4));

        btnTabPay = new Button(this);
        btnTabPay.setText("💳 SIMShield Pay");
        btnTabPay.setTextSize(13);
        btnTabPay.setTextColor(Color.WHITE);
        btnTabPay.setBackground(createRoundedDrawable(COLOR_PRIMARY_BLUE, 10));
        btnTabPay.setOnClickListener(v -> switchTab(0));

        btnTabSecurity = new Button(this);
        btnTabSecurity.setText("🛡️ Security Center");
        btnTabSecurity.setTextSize(13);
        btnTabSecurity.setTextColor(COLOR_TEXT_MUTED);
        btnTabSecurity.setBackground(createRoundedDrawable(Color.TRANSPARENT, 10));
        btnTabSecurity.setOnClickListener(v -> switchTab(1));

        LinearLayout.LayoutParams tabParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        tabSwitcher.addView(btnTabPay, tabParams);
        tabSwitcher.addView(btnTabSecurity, tabParams);

        LinearLayout.LayoutParams switcherParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        switcherParams.setMargins(0, 0, 0, dp(16));
        root.addView(tabSwitcher, switcherParams);

        // Tab 1 Container: SIMShield Pay
        payTabContainer = new LinearLayout(this);
        payTabContainer.setOrientation(LinearLayout.VERTICAL);
        buildPayTabViews(payTabContainer);
        root.addView(payTabContainer);

        // Tab 2 Container: Security Center
        securityTabContainer = new LinearLayout(this);
        securityTabContainer.setOrientation(LinearLayout.VERTICAL);
        securityTabContainer.setVisibility(View.GONE);
        buildSecurityTabViews(securityTabContainer);
        root.addView(securityTabContainer);
    }

    private void switchTab(int tabIndex) {
        currentTab = tabIndex;
        if (tabIndex == 0) {
            payTabContainer.setVisibility(View.VISIBLE);
            securityTabContainer.setVisibility(View.GONE);
            btnTabPay.setTextColor(Color.WHITE);
            btnTabPay.setBackground(createRoundedDrawable(COLOR_PRIMARY_BLUE, 10));
            btnTabSecurity.setTextColor(COLOR_TEXT_MUTED);
            btnTabSecurity.setBackground(createRoundedDrawable(Color.TRANSPARENT, 10));
        } else {
            payTabContainer.setVisibility(View.GONE);
            securityTabContainer.setVisibility(View.VISIBLE);
            btnTabSecurity.setTextColor(Color.WHITE);
            btnTabSecurity.setBackground(createRoundedDrawable(COLOR_PRIMARY_BLUE, 10));
            btnTabPay.setTextColor(COLOR_TEXT_MUTED);
            btnTabPay.setBackground(createRoundedDrawable(Color.TRANSPARENT, 10));
        }
        refreshAllData();
    }

    // =========================================================================
    // TAB 1: SIMShield Pay (Mock UPI Payment Gateway)
    // =========================================================================

    private void buildPayTabViews(LinearLayout container) {
        // 1. Hero Balance & Security Posture Card
        LinearLayout heroCard = createBox(COLOR_PRIMARY_BLUE, 20);
        heroCard.setOrientation(LinearLayout.VERTICAL);
        heroCard.setPadding(dp(20), dp(20), dp(20), dp(20));

        LinearLayout balanceHeaderRow = new LinearLayout(this);
        balanceHeaderRow.setGravity(Gravity.CENTER_VERTICAL);

        payAccountHolderText = createText("Rahul Sharma · AC10219988", 13, Color.rgb(218, 229, 255));
        balanceHeaderRow.addView(payAccountHolderText, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        LinearLayout chipBox = createBox(Color.WHITE, 99);
        chipBox.setPadding(dp(10), dp(4), dp(10), dp(4));
        chipBox.setGravity(Gravity.CENTER_VERTICAL);

        paySecurityDotView = new View(this);
        paySecurityDotView.setLayoutParams(new LinearLayout.LayoutParams(dp(8), dp(8)));
        paySecurityDotView.setBackground(createRoundedDrawable(COLOR_SUCCESS_GREEN, 99));
        chipBox.addView(paySecurityDotView);

        paySecurityChipText = createText(" LOW RISK", 11, COLOR_SUCCESS_GREEN);
        chipBox.addView(paySecurityChipText);
        balanceHeaderRow.addView(chipBox);

        heroCard.addView(balanceHeaderRow);

        TextView subBal = createText("AVAILABLE SIMULATED BALANCE", 11, Color.rgb(218, 229, 255));
        subBal.setPadding(0, dp(12), 0, 0);
        heroCard.addView(subBal);

        payBalanceText = createText("₹10,000", 38, Color.WHITE);
        payBalanceText.setPadding(0, dp(4), 0, 0);
        heroCard.addView(payBalanceText);

        container.addView(heroCard, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // 2. Section: Send Money (Mock UPI Form)
        addSectionHeader(container, "SEND MONEY VIA MOCK UPI");
        LinearLayout sendCard = createCard();
        sendCard.setPadding(dp(16), dp(16), dp(16), dp(16));

        // Quick Beneficiary Chips
        TextView quickLabel = createText("Quick Contacts:", 12, COLOR_TEXT_MUTED);
        quickLabel.setPadding(0, 0, 0, dp(6));
        sendCard.addView(quickLabel);

        HorizontalScrollView hScroll = new HorizontalScrollView(this);
        hScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout contactChipsRow = new LinearLayout(this);
        contactChipsRow.setOrientation(LinearLayout.HORIZONTAL);

        contactChipsRow.addView(createContactChip("Rahul (₹2k)", "Rahul (Personal)", "rahul@mockbank", "2000"));
        contactChipsRow.addView(createContactChip("Priya (₹1k)", "Priya Patel", "priya@mockbank", "1000"));
        contactChipsRow.addView(createContactChip("Amit (₹500)", "Amit Kumar", "amit@mockbank", "500"));
        contactChipsRow.addView(createContactChip("Attacker (₹2k)", "Attacker Mule Account", "attacker@fraudbank", "2000"));

        hScroll.addView(contactChipsRow);
        sendCard.addView(hScroll);

        // Form Fields (Safe child addition)
        inputRecipient = new EditText(this);
        sendCard.addView(createFormBox("Recipient Name", inputRecipient, "Rahul (Personal)", InputType.TYPE_CLASS_TEXT));

        inputUpi = new EditText(this);
        sendCard.addView(createFormBox("UPI ID / Virtual Payment Address", inputUpi, "rahul@mockbank", InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS));

        inputAmount = new EditText(this);
        sendCard.addView(createFormBox("Amount (₹ INR)", inputAmount, "2000", InputType.TYPE_CLASS_NUMBER));

        inputMessage = new EditText(this);
        sendCard.addView(createFormBox("Message / Note (Optional)", inputMessage, "Demo payment", InputType.TYPE_CLASS_TEXT));

        btnPay = createButton("CONTINUE TO PAY ₹2,000", false);
        btnPay.setBackground(createRoundedDrawable(COLOR_PRIMARY_BLUE, 12));
        btnPay.setTextColor(Color.WHITE);
        btnPay.setPadding(0, dp(14), 0, dp(14));
        btnPay.setOnClickListener(v -> initiatePaymentFlow());

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.setMargins(0, dp(12), 0, 0);
        sendCard.addView(btnPay, btnParams);

        container.addView(sendCard);

        // 3. Section: Quick Attack Sandbox
        addSectionHeader(container, "DEVELOPER ATTACK SIMULATOR (SANDBOX)");
        LinearLayout sandboxCard = createCard();
        sandboxCard.setPadding(dp(14), dp(14), dp(14), dp(14));

        sandboxCard.addView(createScenarioButton("Simulate SIM Swap (+30 pts)", "sim-swap"));
        sandboxCard.addView(createScenarioButton("Simulate New Device (+20 pts)", "new-device"));
        sandboxCard.addView(createScenarioButton("Simulate Full Account Takeover (ATO)", "account-takeover", true));
        sandboxCard.addView(createScenarioButton("Reset Scenario & Balance (₹10,000)", "reset", false));

        container.addView(sandboxCard);

        // 4. Section: Recent Transactions
        addSectionHeader(container, "RECENT TRANSACTIONS (LEDGER)");
        LinearLayout historyCard = createCard();
        historyCard.setPadding(dp(16), dp(16), dp(16), dp(16));

        txnHistoryContainer = new LinearLayout(this);
        txnHistoryContainer.setOrientation(LinearLayout.VERTICAL);
        historyCard.addView(txnHistoryContainer);

        container.addView(historyCard);

        renderDefaultTransactions();
    }

    private View createFormBox(String label, EditText editText, String defaultValue, int inputType) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(0, dp(6), 0, dp(6));

        TextView lbl = createText(label, 12, COLOR_TEXT_MUTED);
        lbl.setPadding(0, 0, 0, dp(4));
        box.addView(lbl);

        editText.setText(defaultValue);
        editText.setInputType(inputType);
        editText.setTextSize(14);
        editText.setTextColor(COLOR_TEXT_PRIMARY);
        editText.setBackground(createRoundedDrawable(Color.rgb(243, 244, 248), 8));
        editText.setPadding(dp(12), dp(10), dp(12), dp(10));
        box.addView(editText);

        return box;
    }

    private View createContactChip(String label, String name, String upi, String amount) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setTextSize(11);
        btn.setTextColor(COLOR_PRIMARY_BLUE);
        btn.setBackground(createRoundedDrawable(Color.rgb(238, 242, 255), 99));
        btn.setPadding(dp(12), dp(4), dp(12), dp(4));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, dp(8), 0);
        btn.setLayoutParams(params);

        btn.setOnClickListener(v -> {
            inputRecipient.setText(name);
            inputUpi.setText(upi);
            inputAmount.setText(amount);
            btnPay.setText("CONTINUE TO PAY ₹" + amount);
        });

        return btn;
    }

    private void initiatePaymentFlow() {
        String recipient = inputRecipient.getText().toString().trim();
        String upiId = inputUpi.getText().toString().trim();
        String amountStr = inputAmount.getText().toString().trim();

        if (recipient.isEmpty()) recipient = "Rahul (Personal)";
        if (upiId.isEmpty()) upiId = "rahul@mockbank";
        int amount = 2000;
        try {
            amount = Integer.parseInt(amountStr);
        } catch (Exception e) {
            amount = 2000;
        }

        final int finalAmount = amount;
        final String finalRecipient = recipient;
        final String finalUpi = upiId;

        btnPay.setEnabled(false);
        btnPay.setText("Interception Pre-Check Running...");

        riskApi.precheckTransaction(DEFAULT_USER_ID, finalRecipient, finalUpi, finalAmount, new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
            @Override
            public void success(SecurityApiClient.TransactionResult result) {
                btnPay.setEnabled(true);
                btnPay.setText("CONTINUE TO PAY ₹" + finalAmount);
                handlePrecheckDecision(result);
            }

            @Override
            public void failure(String safeMessage) {
                btnPay.setEnabled(true);
                btnPay.setText("CONTINUE TO PAY ₹" + finalAmount);
                showToast("Error", safeMessage);
            }
        });
    }

    private void handlePrecheckDecision(SecurityApiClient.TransactionResult result) {
        if ("ALLOW".equals(result.decision)) {
            executeApprovedPayment(result);
        } else if ("REQUIRE_VERIFICATION".equals(result.decision)) {
            showVerificationRequiredDialog(result);
        } else {
            showBlockedTransactionAlert(result);
        }
    }

    private void executeApprovedPayment(SecurityApiClient.TransactionResult precheck) {
        riskApi.executeTransaction(precheck.transactionId, DEFAULT_USER_ID, new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
            @Override
            public void success(SecurityApiClient.TransactionResult execResult) {
                currentBalance = execResult.newBalance;
                payBalanceText.setText("₹" + NumberFormat.getNumberInstance(Locale.US).format(execResult.newBalance));

                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("🟢 Payment Successful")
                        .setMessage("₹" + execResult.amount + " transferred to " + execResult.recipientName + " (" + execResult.upiId + ").\n\n"
                                + "Simulated Bank Balance:\n"
                                + "₹" + execResult.previousBalance + " ➔ ₹" + execResult.newBalance + "\n\n"
                                + "Transaction ID: " + execResult.transactionId)
                        .setPositiveButton("Done", (d, w) -> refreshAllData())
                        .show();
            }

            @Override
            public void failure(String safeMessage) {
                showToast("Execution Failed", safeMessage);
                refreshAllData();
            }
        });
    }

    private void showVerificationRequiredDialog(SecurityApiClient.TransactionResult precheck) {
        new AlertDialog.Builder(this)
                .setTitle("🟡 Additional Verification Required")
                .setMessage("SIMShield detected security signals requiring biometric confirmation:\n\n"
                        + formatReasons(precheck.reasonCodes) + "\n\n"
                        + "Risk Score: " + precheck.riskScore + "/100 (" + precheck.riskLevel + ")\n\n"
                        + "Please scan your fingerprint to verify this ₹" + precheck.amount + " transfer.")
                .setPositiveButton("Verify with Biometrics", (dialog, which) -> launchBiometricStepUp(precheck))
                .setNegativeButton("Cancel Transfer", null)
                .show();
    }

    private void showBlockedTransactionAlert(SecurityApiClient.TransactionResult precheck) {
        String reasonsFormatted = formatReasons(precheck.reasonCodes);
        if (reasonsFormatted.isEmpty()) {
            reasonsFormatted = "• Recent SIM/eSIM change\n• New device\n• Password reset\n• New beneficiary";
        }

        new AlertDialog.Builder(this)
                .setTitle("🚨 TRANSACTION BLOCKED")
                .setMessage("Amount: ₹" + precheck.amount + "\n\n"
                        + "Risk Score: " + precheck.riskScore + "/100\n"
                        + "Risk Level: " + precheck.riskLevel + "\n\n"
                        + "Reasons:\n"
                        + reasonsFormatted + "\n\n"
                        + "Your money was not transferred.\n"
                        + "Simulated Bank Balance: ₹" + NumberFormat.getNumberInstance(Locale.US).format(currentBalance) + " (UNTOUCHED)\n\n"
                        + "The transaction was blocked before simulated execution.")
                .setPositiveButton("🔒 SECURE MY ACCOUNT", (dialog, which) -> handleSecureAccountAction())
                .setNegativeButton("Dismiss", (d, w) -> refreshAllData())
                .setCancelable(false)
                .show();
    }

    private void launchBiometricStepUp(SecurityApiClient.TransactionResult precheck) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            cancellationSignal = new CancellationSignal();
            BiometricPrompt.Builder builder = new BiometricPrompt.Builder(this)
                    .setTitle("Authenticate Transfer")
                    .setSubtitle("Confirm ₹" + precheck.amount + " transfer to " + precheck.recipientName)
                    .setDescription("Place your finger on sensor to authorize payment.")
                    .setNegativeButton("Cancel", getMainExecutor(), (d, w) -> showToast("Cancelled", "Verification cancelled."));

            BiometricPrompt prompt = builder.build();
            prompt.authenticate(
                    cancellationSignal,
                    getMainExecutor(),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authResult) {
                            super.onAuthenticationSucceeded(authResult);
                            riskApi.verifyAndAuthorizeTransaction(precheck.transactionId, "BIOMETRIC_FINGERPRINT", new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
                                @Override
                                public void success(SecurityApiClient.TransactionResult res) {
                                    executeApprovedPayment(res);
                                }

                                @Override
                                public void failure(String safeMessage) {
                                    showToast("Authorization Failed", safeMessage);
                                }
                            });
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                            showToast("Fingerprint Error", "Fingerprint not recognized.");
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            fallbackPinVerification(precheck);
                        }
                    }
            );
        } else {
            fallbackPinVerification(precheck);
        }
    }

    private void fallbackPinVerification(SecurityApiClient.TransactionResult precheck) {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        input.setHint("Enter 4-digit UPI PIN (e.g. 1234)");
        input.setPadding(dp(16), dp(12), dp(16), dp(12));

        new AlertDialog.Builder(this)
                .setTitle("Security PIN Verification")
                .setMessage("Enter your App Security PIN to authenticate this ₹" + precheck.amount + " transfer:")
                .setView(input)
                .setPositiveButton("Verify & Pay", (dialog, which) -> {
                    String pin = input.getText().toString().trim();
                    if (!pin.isEmpty()) {
                        riskApi.verifyAndAuthorizeTransaction(precheck.transactionId, "APP_PIN", new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
                            @Override
                            public void success(SecurityApiClient.TransactionResult res) {
                                executeApprovedPayment(res);
                            }

                            @Override
                            public void failure(String safeMessage) {
                                showToast("Failed", safeMessage);
                            }
                        });
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    // =========================================================================
    // TAB 2: Security Center (Telecom & Account Takeover Defense)
    // =========================================================================

    private void buildSecurityTabViews(LinearLayout container) {
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

        container.addView(heroCard, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // 2. Section: Protection Status & Fraud Alerts
        addSectionHeader(container, "FRAUD RISK STATUS & ALERTS");
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

        alertActionsContainer = new LinearLayout(this);
        alertActionsContainer.setOrientation(LinearLayout.VERTICAL);
        alertActionsContainer.setPadding(dp(16), 0, dp(16), dp(16));
        statusCard.addView(alertActionsContainer);

        container.addView(statusCard);

        // 3. Section: Security Event Timeline
        addSectionHeader(container, "RECENT SECURITY EVENTS (TIMELINE)");
        LinearLayout timelineCard = createCard();
        timelineCard.setPadding(dp(16), dp(16), dp(16), dp(16));

        timelineListContainer = new LinearLayout(this);
        timelineListContainer.setOrientation(LinearLayout.VERTICAL);
        timelineCard.addView(timelineListContainer);

        container.addView(timelineCard);

        // 4. Section: Monitoring Preferences
        addSectionHeader(container, "MONITORING PREFERENCES");
        LinearLayout monitoringCard = createCard();
        monitoringCard.setPadding(dp(16), dp(10), dp(16), dp(10));

        monitoringCard.addView(createPreferenceToggle(
                "Carrier SIM-Swap Alerts",
                "Instant push when telecom partner reports ICCID changes.",
                "pref_carrier_sim",
                true
        ));
        monitoringCard.addView(createDivider());
        monitoringCard.addView(createPreferenceToggle(
                "eSIM Profile Protection",
                "Flag active profile transfers across devices.",
                "pref_esim_guard",
                true
        ));
        monitoringCard.addView(createDivider());
        monitoringCard.addView(createPreferenceToggle(
                "Biometric Wire Authorizations",
                "Require local biometric verification for high-risk activity.",
                "pref_biometric_auth",
                true
        ));

        container.addView(monitoringCard);
    }

    // =========================================================================
    // Data Synchronization
    // =========================================================================

    private void refreshAllData() {
        // 1. Fetch live balance
        riskApi.fetchBalance(DEFAULT_USER_ID, new SecurityApiClient.Callback<SecurityApiClient.AccountBalance>() {
            @Override
            public void success(SecurityApiClient.AccountBalance result) {
                currentBalance = result.balance;
                if (payBalanceText != null) {
                    payBalanceText.setText("₹" + NumberFormat.getNumberInstance(Locale.US).format(result.balance));
                }
                if (payAccountHolderText != null) {
                    if ("PROTECTED".equals(result.status)) {
                        payAccountHolderText.setText("Rahul Sharma · 🔒 PROTECTED LOCKDOWN");
                    } else {
                        payAccountHolderText.setText("Rahul Sharma · " + result.accountNumber);
                    }
                }
            }

            @Override
            public void failure(String safeMessage) {}
        });

        // 2. Fetch authoritative risk score
        riskApi.fetchRisk(DEFAULT_USER_ID, new SecurityApiClient.Callback<SecurityApiClient.RiskResult>() {
            @Override
            public void success(SecurityApiClient.RiskResult result) {
                renderRiskState(result.score, result.level, result.reasonCodes, result.recommendedMitigation);
            }

            @Override
            public void failure(String safeMessage) {
                renderRiskState(18, "LOW", null, "ALLOW");
            }
        });

        // 3. Fetch security event timeline
        riskApi.fetchSecurityEvents(DEFAULT_USER_ID, new SecurityApiClient.Callback<List<SecurityApiClient.TimelineEvent>>() {
            @Override
            public void success(List<SecurityApiClient.TimelineEvent> events) {
                if (events != null && !events.isEmpty()) {
                    renderTimelineEvents(events);
                } else {
                    renderDefaultTimeline();
                }
            }

            @Override
            public void failure(String safeMessage) {
                renderDefaultTimeline();
            }
        });

        // 4. Fetch transactions history
        riskApi.fetchTransactions(DEFAULT_USER_ID, new SecurityApiClient.Callback<List<SecurityApiClient.TransactionResult>>() {
            @Override
            public void success(List<SecurityApiClient.TransactionResult> transactions) {
                if (transactions != null && !transactions.isEmpty()) {
                    renderTransactions(transactions);
                } else {
                    renderDefaultTransactions();
                }
            }

            @Override
            public void failure(String safeMessage) {
                renderDefaultTransactions();
            }
        });
    }

    private void renderRiskState(int score, String level, List<String> reasonCodes, String recommendedMitigation) {
        boolean isCritical = "CRITICAL".equals(level);
        boolean isHigh = "HIGH".equals(level);
        boolean isMedium = "MEDIUM".equals(level);

        int primaryColor = (isCritical || isHigh) ? COLOR_DANGER_RED : isMedium ? COLOR_WARNING_AMBER : COLOR_SUCCESS_GREEN;

        // Update Pay Tab chip
        if (paySecurityDotView != null) {
            paySecurityDotView.setBackground(createRoundedDrawable(primaryColor, 99));
        }
        if (paySecurityChipText != null) {
            paySecurityChipText.setTextColor(primaryColor);
            paySecurityChipText.setText(" " + level + " RISK (" + score + ")");
        }

        // Update Security Tab
        if (scoreText != null) {
            scoreText.setText(score + "  / 100");
        }
        if (headlineText != null) {
            headlineText.setText(isCritical ? "Critical Account Takeover" : isHigh ? "Suspicious Activity Detected" : isMedium ? "Review Recent SIM Activity" : "You’re protected");
        }
        if (riskDotView != null) {
            riskDotView.setBackground(createRoundedDrawable(primaryColor, 99));
        }
        if (riskChipText != null) {
            riskChipText.setText(level);
            riskChipText.setTextColor(primaryColor);
            riskChipText.setBackground(createRoundedDrawable(isCritical || isHigh ? Color.rgb(255, 235, 238) : isMedium ? Color.rgb(254, 243, 199) : Color.rgb(236, 253, 245), 99));
        }
        if (statusTitleText != null) {
            statusTitleText.setText(isCritical ? "Active SIM-Swap Takeover Chain" : isHigh ? "Multiple Correlated Security Events" : isMedium ? "Recent SIM Card Change" : "No active threat detected");
        }
        if (statusDetailText != null) {
            if (reasonCodes != null && !reasonCodes.isEmpty()) {
                statusDetailText.setText("Detected signals:\n" + formatReasons(reasonCodes));
            } else {
                statusDetailText.setText("Physical SIM & eSIM lifecycle signals normal. No suspicious carrier porting detected.");
            }
        }

        renderAlertActions(level, score);
    }

    private void renderAlertActions(String level, int score) {
        if (alertActionsContainer == null) return;
        alertActionsContainer.removeAllViews();

        if ("MEDIUM".equals(level) || "HIGH".equals(level)) {
            Button btnConfirm = createButton("This was me (Verify Identity)", false);
            btnConfirm.setBackground(createRoundedDrawable(Color.rgb(238, 242, 255), 10));
            btnConfirm.setOnClickListener(v -> launchBiometricPrompt("Verify Recent SIM Change"));
            alertActionsContainer.addView(btnConfirm);

            Button btnSecure = createButton("Secure my account", true);
            btnSecure.setOnClickListener(v -> handleSecureAccountAction());
            alertActionsContainer.addView(btnSecure);
        } else if ("CRITICAL".equals(level)) {
            Button btnPanic = createButton("🔒 SECURE MY ACCOUNT (FREEZE TRANSFERS)", true);
            btnPanic.setBackground(createRoundedDrawable(COLOR_DANGER_RED, 10));
            btnPanic.setTextColor(Color.WHITE);
            btnPanic.setOnClickListener(v -> handleSecureAccountAction());
            alertActionsContainer.addView(btnPanic);

            Button btnReport = createButton("Report Unauthorized SIM Hijack", true);
            btnReport.setOnClickListener(v -> handleReportFraudAction());
            alertActionsContainer.addView(btnReport);
        }
    }

    private void renderTransactions(List<SecurityApiClient.TransactionResult> list) {
        if (txnHistoryContainer == null) return;
        txnHistoryContainer.removeAllViews();
        for (SecurityApiClient.TransactionResult txn : list) {
            boolean isBlocked = "BLOCKED".equals(txn.status) || "BLOCK".equals(txn.decision);
            boolean isCompleted = "COMPLETED".equals(txn.status);

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.VERTICAL);
            row.setPadding(0, dp(8), 0, dp(8));

            LinearLayout topRow = new LinearLayout(this);
            topRow.setGravity(Gravity.CENTER_VERTICAL);

            TextView recipient = createText(txn.recipientName + " (" + txn.upiId + ")", 14, COLOR_TEXT_PRIMARY);
            topRow.addView(recipient, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

            TextView amount = createText((isCompleted ? "- ₹" : "₹") + txn.amount, 14, isBlocked ? COLOR_DANGER_RED : COLOR_SUCCESS_GREEN);
            topRow.addView(amount);
            row.addView(topRow);

            LinearLayout subRow = new LinearLayout(this);
            subRow.setGravity(Gravity.CENTER_VERTICAL);
            subRow.setPadding(0, dp(2), 0, 0);

            TextView statusChip = createText(txn.status, 11, isBlocked ? COLOR_DANGER_RED : isCompleted ? COLOR_SUCCESS_GREEN : COLOR_WARNING_AMBER);
            subRow.addView(statusChip);

            TextView riskInfo = createText(" · Score: " + txn.riskScore + " (" + txn.riskLevel + ")", 11, COLOR_TEXT_MUTED);
            subRow.addView(riskInfo);

            row.addView(subRow);
            txnHistoryContainer.addView(row);
        }
    }

    private void renderDefaultTransactions() {
        if (txnHistoryContainer == null) return;
        txnHistoryContainer.removeAllViews();
        addDefaultTxnItem("Rahul (Personal)", "- ₹2,000", "COMPLETED", "Score: 18 (LOW)", false);
        addDefaultTxnItem("Priya Patel", "- ₹1,000", "COMPLETED", "Score: 18 (LOW)", false);
        addDefaultTxnItem("Salary Credit", "+ ₹25,000", "COMPLETED", "Score: 0 (LOW)", true);
    }

    private void addDefaultTxnItem(String name, String amountStr, String status, String risk, boolean isCredit) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, dp(6), 0, dp(6));

        LinearLayout topRow = new LinearLayout(this);
        topRow.setGravity(Gravity.CENTER_VERTICAL);
        topRow.addView(createText(name, 14, COLOR_TEXT_PRIMARY), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        topRow.addView(createText(amountStr, 14, isCredit ? COLOR_SUCCESS_GREEN : COLOR_TEXT_PRIMARY));
        row.addView(topRow);

        LinearLayout subRow = new LinearLayout(this);
        subRow.addView(createText(status, 11, COLOR_SUCCESS_GREEN));
        subRow.addView(createText(" · " + risk, 11, COLOR_TEXT_MUTED));
        row.addView(subRow);

        txnHistoryContainer.addView(row);
    }

    private void renderTimelineEvents(List<SecurityApiClient.TimelineEvent> events) {
        if (timelineListContainer == null) return;
        timelineListContainer.removeAllViews();
        for (SecurityApiClient.TimelineEvent e : events) {
            boolean isCritical = e.eventType.contains("SIM") || e.eventType.contains("TAKEOVER") || e.eventType.contains("UNUSUAL");
            addTimelineItem(e.description, e.source, e.timestamp != null && e.timestamp.length() >= 16 ? e.timestamp.substring(11, 16) : "Today", isCritical);
        }
    }

    private void renderDefaultTimeline() {
        if (timelineListContainer == null) return;
        timelineListContainer.removeAllViews();
        addTimelineItem("Physical SIM active & verified", "Telecom Partner Webhook", "10:45 AM", false);
        addTimelineItem("App integrity check passed", "Android KeyStore Enclave", "Yesterday", false);
        addTimelineItem("Device security posture verified", "Hardware Root of Trust", "Aug 19", false);
    }

    private void addTimelineItem(String title, String subtitle, String time, boolean isCritical) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.HORIZONTAL);
        item.setPadding(0, dp(6), 0, dp(6));
        item.setGravity(Gravity.CENTER_VERTICAL);

        View dot = new View(this);
        dot.setLayoutParams(new LinearLayout.LayoutParams(dp(8), dp(8)));
        dot.setBackground(createRoundedDrawable(isCritical ? COLOR_DANGER_RED : COLOR_SUCCESS_GREEN, 99));
        item.addView(dot);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setPadding(dp(10), 0, 0, 0);

        textCol.addView(createText(title, 13, COLOR_TEXT_PRIMARY));
        textCol.addView(createText(subtitle, 11, COLOR_TEXT_MUTED));
        item.addView(textCol, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        item.addView(createText(time, 11, COLOR_TEXT_MUTED));
        timelineListContainer.addView(item);
    }

    // =========================================================================
    // Biometric Authentication & Customer Actions
    // =========================================================================

    private void launchBiometricPrompt(String subtitle) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            cancellationSignal = new CancellationSignal();
            BiometricPrompt.Builder builder = new BiometricPrompt.Builder(this)
                    .setTitle("Verify Identity")
                    .setSubtitle(subtitle)
                    .setDescription("Authenticate to confirm your recent mobile activity.")
                    .setNegativeButton("Cancel", getMainExecutor(), (d, w) -> showToast("Cancelled", "Verification cancelled."));

            BiometricPrompt prompt = builder.build();
            prompt.authenticate(
                    cancellationSignal,
                    getMainExecutor(),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authResult) {
                            super.onAuthenticationSucceeded(authResult);
                            riskApi.confirmActivity(DEFAULT_USER_ID, new SecurityApiClient.Callback<String>() {
                                @Override
                                public void success(String res) {
                                    showToast("Verified", "Identity confirmed. Risk score lowered.");
                                    refreshAllData();
                                }

                                @Override
                                public void failure(String safeMessage) {
                                    showToast("Notice", safeMessage);
                                }
                            });
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                            showToast("Error", "Biometric not recognized.");
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            fallbackPinPrompt();
                        }
                    }
            );
        } else {
            fallbackPinPrompt();
        }
    }

    private void fallbackPinPrompt() {
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (km != null && km.isKeyguardSecure()) {
            Intent intent = km.createConfirmDeviceCredentialIntent("Verify Identity", "Confirm your screen lock.");
            if (intent != null) {
                startActivityForResult(intent, REQUEST_CODE_DEVICE_CREDENTIAL);
                return;
            }
        }
        showToast("Identity Verified", "Screen lock verified.");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CODE_DEVICE_CREDENTIAL && resultCode == RESULT_OK) {
            riskApi.confirmActivity(DEFAULT_USER_ID, new SecurityApiClient.Callback<String>() {
                @Override
                public void success(String res) {
                    showToast("Verified", "Identity verified via PIN.");
                    refreshAllData();
                }

                @Override
                public void failure(String safeMessage) {
                    showToast("Notice", safeMessage);
                }
            });
        }
    }

    private void handleSecureAccountAction() {
        riskApi.emergencyLock(DEFAULT_USER_ID, new SecurityApiClient.Callback<String>() {
            @Override
            public void success(String result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Account Protections Activated")
                        .setMessage("Emergency lockdown activated on backend:\n\n• Outbound wire & UPI transfers: FROZEN\n• Beneficiary additions: LOCKED\n• Remote sessions: REVOKED\n• P1 Fraud Investigation Case: OPENED\n\nYour account is secured.")
                        .setPositiveButton("OK", (d, w) -> refreshAllData())
                        .show();
            }

            @Override
            public void failure(String safeMessage) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Account Protections Activated")
                        .setMessage("Transfers and beneficiary additions restricted.")
                        .setPositiveButton("OK", null)
                        .show();
            }
        });
    }

    private void handleReportFraudAction() {
        new AlertDialog.Builder(this)
                .setTitle("Report Unauthorized SIM Hijack")
                .setMessage("An immediate fraud investigation case will be opened. High-value transactions will be frozen.")
                .setPositiveButton("Confirm Fraud Report", (dialog, which) -> {
                    riskApi.reportFraud("alert-active", new SecurityApiClient.Callback<String>() {
                        @Override
                        public void success(String result) {
                            showToast("Fraud Reported", "Investigation case dispatched. Sensitive actions frozen.");
                            refreshAllData();
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

    private void executeSandboxScenario(String scenario) {
        riskApi.simulate(DEFAULT_USER_ID, scenario, new SecurityApiClient.Callback<SecurityApiClient.RiskResult>() {
            @Override
            public void success(SecurityApiClient.RiskResult result) {
                showToast("Sandbox Updated", "Simulated: " + scenario + "\nRisk Score: " + result.score + " (" + result.level + ")");
                refreshAllData();
            }

            @Override
            public void failure(String safeMessage) {
                showToast("Simulation Notice", safeMessage);
                refreshAllData();
            }
        });
    }

    // =========================================================================
    // UI Helpers & Utilities
    // =========================================================================

    private View createPreferenceToggle(String title, String subtitle, String prefKey, boolean defaultValue) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(10), 0, dp(10));

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.addView(createText(title, 14, COLOR_TEXT_PRIMARY));
        textCol.addView(createText(subtitle, 11, COLOR_TEXT_MUTED));
        row.addView(textCol, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        Switch sw = new Switch(this);
        sw.setChecked(prefs.getBoolean(prefKey, defaultValue));
        sw.setOnCheckedChangeListener((b, checked) -> prefs.edit().putBoolean(prefKey, checked).apply());
        row.addView(sw);

        return row;
    }

    private View createDivider() {
        View line = new View(this);
        line.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1));
        line.setBackgroundColor(Color.rgb(240, 242, 248));
        return line;
    }

    private Button createScenarioButton(String label, String scenario) {
        return createScenarioButton(label, scenario, false);
    }

    private Button createScenarioButton(String label, String scenario, boolean isDanger) {
        Button btn = createButton(label, isDanger);
        btn.setOnClickListener(v -> executeSandboxScenario(scenario));
        return btn;
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

    private String formatReasons(List<String> reasons) {
        if (reasons == null || reasons.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (String r : reasons) {
            sb.append("• ").append(formatReasonLabel(r)).append("\n");
        }
        return sb.toString().trim();
    }

    private String formatReasonLabel(String code) {
        switch (code) {
            case "RECENT_SIM_CHANGE": return "Recent SIM card replacement";
            case "RECENT_ESIM_CHANGE": return "Recent eSIM profile migration";
            case "NUMBER_PORTED": return "Mobile number porting reported";
            case "NEW_DEVICE": return "Unrecognized new device login";
            case "ACCOUNT_TAKEOVER_PATTERN": return "High-risk Account Takeover (ATO) sequence";
            case "PASSWORD_RESET_AFTER_SIM_CHANGE": return "Password reset shortly after SIM change";
            case "NEW_BENEFICIARY_AFTER_SIM_CHANGE": return "New beneficiary added after SIM change";
            case "ABNORMAL_TRANSACTION": return "Abnormal transaction amount/behavior";
            case "ACCOUNT_PROTECTED_EMERGENCY_LOCK": return "Account in emergency lockdown";
            case "TRANSFERS_FROZEN": return "Outbound transfers frozen";
            default: return code.replace("_", " ").toLowerCase();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "SIMShield Fraud Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("High-priority alerts for SIM swaps and suspicious ATO activity");
            channel.enableLights(true);
            channel.setLightColor(COLOR_DANGER_RED);
            channel.enableVibration(true);

            NotificationManager nm = getSystemService(NotificationManager.class);
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
}
