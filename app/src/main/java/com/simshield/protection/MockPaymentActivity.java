package com.simshield.protection;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.Intent;
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
import android.widget.TextView;
import android.widget.Toast;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

/**
 * Standalone SIMShield Pay — Mock UPI Payment Application.
 * <p>
 * Demonstrates real-time fraud pre-check interception BEFORE bank ledger execution.
 * Balances are strictly preserved on BLOCKED transactions.
 */
public class MockPaymentActivity extends Activity {

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

    private SecurityApiClient api;
    private CancellationSignal cancellationSignal;

    // UI References
    private TextView balanceText;
    private TextView securityChipText;
    private View securityDotView;
    private TextView accountHolderText;
    private EditText inputRecipient;
    private EditText inputUpi;
    private EditText inputAmount;
    private EditText inputMessage;
    private LinearLayout txnHistoryContainer;
    private Button btnPay;

    private int currentBalance = 10000;
    private String currentRiskLevel = "LOW";
    private int currentRiskScore = 18;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        api = new SecurityApiClient(BuildConfig.RISK_API_BASE_URL);

        buildUiLayout();
        refreshAccountData();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshAccountData();
    }

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
        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);
        headerRow.setPadding(0, dp(4), 0, dp(14));

        LinearLayout headerTitles = new LinearLayout(this);
        headerTitles.setOrientation(LinearLayout.VERTICAL);
        headerTitles.addView(createText("SIMShield Pay", 22, COLOR_TEXT_PRIMARY));
        headerTitles.addView(createText("MOCK UPI · ZERO-TRUST PRE-CHECK GATEWAY", 11, COLOR_TEXT_MUTED));
        headerRow.addView(headerTitles, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        Button btnOpenSecurity = createButton("🛡️ Security", false);
        btnOpenSecurity.setOnClickListener(v -> {
            Intent intent = new Intent(MockPaymentActivity.this, MainActivity.class);
            startActivity(intent);
        });
        headerRow.addView(btnOpenSecurity);

        root.addView(headerRow);

        // 1. Hero Balance & Security Posture Card
        LinearLayout heroCard = createBox(COLOR_PRIMARY_BLUE, 20);
        heroCard.setOrientation(LinearLayout.VERTICAL);
        heroCard.setPadding(dp(20), dp(20), dp(20), dp(20));

        LinearLayout balanceHeaderRow = new LinearLayout(this);
        balanceHeaderRow.setGravity(Gravity.CENTER_VERTICAL);

        accountHolderText = createText("Rahul Sharma · AC10219988", 13, Color.rgb(218, 229, 255));
        balanceHeaderRow.addView(accountHolderText, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        // Security Status Chip inside Hero
        LinearLayout chipBox = createBox(Color.WHITE, 99);
        chipBox.setPadding(dp(10), dp(4), dp(10), dp(4));
        chipBox.setGravity(Gravity.CENTER_VERTICAL);

        securityDotView = new View(this);
        securityDotView.setLayoutParams(new LinearLayout.LayoutParams(dp(8), dp(8)));
        securityDotView.setBackground(createRoundedDrawable(COLOR_SUCCESS_GREEN, 99));
        chipBox.addView(securityDotView);

        securityChipText = createText(" LOW RISK", 11, COLOR_SUCCESS_GREEN);
        chipBox.addView(securityChipText);
        balanceHeaderRow.addView(chipBox);

        heroCard.addView(balanceHeaderRow);

        TextView subBal = createText("AVAILABLE SIMULATED BALANCE", 11, Color.rgb(218, 229, 255));
        subBal.setPadding(0, dp(12), 0, 0);
        heroCard.addView(subBal);

        balanceText = createText("₹10,000", 38, Color.WHITE);
        balanceText.setPadding(0, dp(4), 0, 0);
        heroCard.addView(balanceText);

        root.addView(heroCard, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // 2. Section: Send Money (Mock UPI Form)
        addSectionHeader(root, "SEND MONEY VIA MOCK UPI");
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

        // Form Fields
        inputRecipient = createInputField("Recipient Name", "Rahul (Personal)", InputType.TYPE_CLASS_TEXT);
        sendCard.addView(inputRecipient);

        inputUpi = createInputField("UPI ID / Virtual Payment Address", "rahul@mockbank", InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        sendCard.addView(inputUpi);

        inputAmount = createInputField("Amount (₹ INR)", "2000", InputType.TYPE_CLASS_NUMBER);
        sendCard.addView(inputAmount);

        inputMessage = createInputField("Message / Note (Optional)", "Demo payment", InputType.TYPE_CLASS_TEXT);
        sendCard.addView(inputMessage);

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

        root.addView(sendCard);

        // 3. Section: Attack Simulation Sandbox (In-App)
        addSectionHeader(root, "DEVELOPER ATTACK SIMULATOR (SANDBOX)");
        LinearLayout sandboxCard = createCard();
        sandboxCard.setPadding(dp(14), dp(14), dp(14), dp(14));

        sandboxCard.addView(createScenarioButton("Simulate SIM Swap (+30 pts)", "sim-swap"));
        sandboxCard.addView(createScenarioButton("Simulate New Device (+20 pts)", "new-device"));
        sandboxCard.addView(createScenarioButton("Simulate Full Account Takeover (ATO)", "account-takeover", true));
        sandboxCard.addView(createScenarioButton("Reset Scenario & Balance (₹10,000)", "reset", false));

        root.addView(sandboxCard);

        // 4. Section: Recent Transactions
        addSectionHeader(root, "RECENT TRANSACTIONS (LEDGER)");
        LinearLayout historyCard = createCard();
        historyCard.setPadding(dp(16), dp(16), dp(16), dp(16));

        txnHistoryContainer = new LinearLayout(this);
        txnHistoryContainer.setOrientation(LinearLayout.VERTICAL);
        historyCard.addView(txnHistoryContainer);

        root.addView(historyCard);

        // Disclaimer
        TextView disclaimer = createText(
                "Demo Environment: This is a simulated banking environment. No real money or NPCI/UPI network is accessed. SIMShield authorizes every transaction server-side before execution.",
                11,
                COLOR_TEXT_MUTED
        );
        disclaimer.setPadding(0, dp(16), 0, 0);
        root.addView(disclaimer);

        renderDefaultTransactions();
    }

    /**
     * Refreshes live balance and security status from backend.
     */
    private void refreshAccountData() {
        api.fetchBalance(DEFAULT_USER_ID, new SecurityApiClient.Callback<SecurityApiClient.AccountBalance>() {
            @Override
            public void success(SecurityApiClient.AccountBalance result) {
                currentBalance = result.balance;
                balanceText.setText("₹" + NumberFormat.getNumberInstance(Locale.US).format(result.balance));
                if ("PROTECTED".equals(result.status)) {
                    accountHolderText.setText("Rahul Sharma · 🔒 PROTECTED LOCKDOWN");
                } else {
                    accountHolderText.setText("Rahul Sharma · " + result.accountNumber);
                }
            }

            @Override
            public void failure(String safeMessage) {}
        });

        api.fetchRisk(DEFAULT_USER_ID, new SecurityApiClient.Callback<SecurityApiClient.RiskResult>() {
            @Override
            public void success(SecurityApiClient.RiskResult result) {
                currentRiskScore = result.score;
                currentRiskLevel = result.level;
                updateSecurityChip(result.score, result.level);
            }

            @Override
            public void failure(String safeMessage) {}
        });

        api.fetchTransactions(DEFAULT_USER_ID, new SecurityApiClient.Callback<List<SecurityApiClient.TransactionResult>>() {
            @Override
            public void success(List<SecurityApiClient.TransactionResult> transactions) {
                if (transactions != null && !transactions.isEmpty()) {
                    renderTransactions(transactions);
                }
            }

            @Override
            public void failure(String safeMessage) {}
        });
    }

    private void updateSecurityChip(int score, String level) {
        boolean isCritical = "CRITICAL".equals(level);
        boolean isHigh = "HIGH".equals(level);
        boolean isMedium = "MEDIUM".equals(level);

        int color = (isCritical || isHigh) ? COLOR_DANGER_RED : isMedium ? COLOR_WARNING_AMBER : COLOR_SUCCESS_GREEN;
        securityDotView.setBackground(createRoundedDrawable(color, 99));
        securityChipText.setTextColor(color);
        securityChipText.setText(" " + level + " RISK (" + score + ")");
    }

    /**
     * Initiates payment: sends pre-check request to SIMShield Risk Engine.
     */
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

        api.precheckTransaction(DEFAULT_USER_ID, finalRecipient, finalUpi, finalAmount, new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
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

    /**
     * Evaluates the pre-check decision: ALLOW, REQUIRE_VERIFICATION, or BLOCK.
     */
    private void handlePrecheckDecision(SecurityApiClient.TransactionResult result) {
        if ("ALLOW".equals(result.decision)) {
            // Authorized -> Execute simulated money transfer
            executeApprovedPayment(result);
        } else if ("REQUIRE_VERIFICATION".equals(result.decision)) {
            // Step-up authentication needed
            showVerificationRequiredDialog(result);
        } else {
            // CRITICAL / BLOCK / HOLD
            showBlockedTransactionAlert(result);
        }
    }

    /**
     * Scenario 1: Normal Payment Approved and Executed.
     */
    private void executeApprovedPayment(SecurityApiClient.TransactionResult precheck) {
        api.executeTransaction(precheck.transactionId, DEFAULT_USER_ID, new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
            @Override
            public void success(SecurityApiClient.TransactionResult execResult) {
                currentBalance = execResult.newBalance;
                balanceText.setText("₹" + NumberFormat.getNumberInstance(Locale.US).format(execResult.newBalance));

                new AlertDialog.Builder(MockPaymentActivity.this)
                        .setTitle("🟢 Payment Successful")
                        .setMessage("₹" + execResult.amount + " transferred to " + execResult.recipientName + " (" + execResult.upiId + ").\n\n"
                                + "Simulated Bank Balance:\n"
                                + "₹" + execResult.previousBalance + " ➔ ₹" + execResult.newBalance + "\n\n"
                                + "Transaction ID: " + execResult.transactionId)
                        .setPositiveButton("Done", (d, w) -> refreshAccountData())
                        .show();
            }

            @Override
            public void failure(String safeMessage) {
                showToast("Execution Failed", safeMessage);
                refreshAccountData();
            }
        });
    }

    /**
     * Scenario 2 & 3: Step-Up Verification Required Dialog.
     */
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

    /**
     * Scenario 4: CRITICAL Threat Blocked Dialog.
     */
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
                .setPositiveButton("🔒 SECURE MY ACCOUNT", (dialog, which) -> handleEmergencyLockAction())
                .setNegativeButton("Dismiss", (d, w) -> refreshAccountData())
                .setCancelable(false)
                .show();
    }

    /**
     * "Secure My Account" Action: Emergency Lockdown.
     */
    private void handleEmergencyLockAction() {
        api.emergencyLock(DEFAULT_USER_ID, new SecurityApiClient.Callback<String>() {
            @Override
            public void success(String result) {
                new AlertDialog.Builder(MockPaymentActivity.this)
                        .setTitle("Account Protected")
                        .setMessage("Emergency protections activated:\n\n"
                                + "• Outbound transfers: FROZEN\n"
                                + "• Beneficiary additions: LOCKED\n"
                                + "• Other active sessions: REVOKED\n"
                                + "• P1 Fraud Investigation Case: OPENED\n\n"
                                + "Your account balance is safe.")
                        .setPositiveButton("OK", (d, w) -> refreshAccountData())
                        .show();
            }

            @Override
            public void failure(String safeMessage) {
                showToast("Notice", safeMessage);
                refreshAccountData();
            }
        });
    }

    /**
     * Launches Hardware BiometricPrompt for Step-Up Verification.
     */
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
                            api.verifyAndAuthorizeTransaction(precheck.transactionId, "BIOMETRIC_FINGERPRINT", new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
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
                        api.verifyAndAuthorizeTransaction(precheck.transactionId, "APP_PIN", new SecurityApiClient.Callback<SecurityApiClient.TransactionResult>() {
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

    private void executeSandboxScenario(String scenario) {
        api.simulate(DEFAULT_USER_ID, scenario, new SecurityApiClient.Callback<SecurityApiClient.RiskResult>() {
            @Override
            public void success(SecurityApiClient.RiskResult result) {
                showToast("Sandbox Updated", "Simulated: " + scenario + "\nRisk Score: " + result.score + " (" + result.level + ")");
                refreshAccountData();
            }

            @Override
            public void failure(String safeMessage) {
                showToast("Simulation Notice", safeMessage);
                refreshAccountData();
            }
        });
    }

    private void renderTransactions(List<SecurityApiClient.TransactionResult> list) {
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

    private EditText createInputField(String label, String defaultValue, int inputType) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(0, dp(6), 0, dp(6));

        TextView lbl = createText(label, 12, COLOR_TEXT_MUTED);
        lbl.setPadding(0, 0, 0, dp(4));
        box.addView(lbl);

        EditText et = new EditText(this);
        et.setText(defaultValue);
        et.setInputType(inputType);
        et.setTextSize(14);
        et.setTextColor(COLOR_TEXT_PRIMARY);
        et.setBackground(createRoundedDrawable(Color.rgb(243, 244, 248), 8));
        et.setPadding(dp(12), dp(10), dp(12), dp(10));
        box.addView(et);

        return et;
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
}
