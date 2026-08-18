/**
 * @file app.js
 * @description SIMShield SecOps Studio Frontend Controller.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    currentUser: 'demo-user',
    filter: 'ALL',
    events: [],
    cases: [],
    alerts: [],
    currentRisk: { riskScore: 0, riskLevel: 'LOW', reasonCodes: [] },
    metrics: { totalEvents: 0, activeAlerts: 0, criticalCases: 0, heldTransactions: 0 },
    isAtoRunning: false,
    pollTimer: null
  };

  const API_BASE = ''; // Same origin

  // DOM Element References
  const elements = {
    systemStatusDot: document.getElementById('system-status-dot'),
    systemStatusText: document.getElementById('system-status-text'),
    userSelect: document.getElementById('user-select'),
    btnResetState: document.getElementById('btn-reset-state'),
    btnCustomEvent: document.getElementById('btn-custom-event'),

    metricTotalEvents: document.getElementById('metric-total-events'),
    metricActiveAlerts: document.getElementById('metric-active-alerts'),
    metricAlertBadge: document.getElementById('metric-alert-badge'),
    metricOpenCases: document.getElementById('metric-open-cases'),
    metricHeldTxns: document.getElementById('metric-held-txns'),

    riskLevelBadge: document.getElementById('risk-level-badge'),
    gaugeFillPath: document.getElementById('gauge-fill-path'),
    gaugeNeedle: document.getElementById('gauge-needle'),
    gaugeScoreValue: document.getElementById('gauge-score-value'),

    mitigationBanner: document.getElementById('mitigation-banner'),
    mitigationTitle: document.getElementById('mitigation-title'),
    mitigationDesc: document.getElementById('mitigation-desc'),
    reasonTags: document.getElementById('reason-tags'),
    casesList: document.getElementById('cases-list'),

    atoProgress: document.getElementById('ato-stepper-progress'),
    atoProgressFill: document.getElementById('ato-progress-fill'),
    atoStepperLabel: document.getElementById('ato-stepper-label'),
    btnRunAto: document.getElementById('btn-run-ato'),
    simConsole: document.getElementById('sim-console-output'),

    timelineTbody: document.getElementById('timeline-tbody'),
    filterBtns: document.querySelectorAll('.filter-btn'),

    customModal: document.getElementById('custom-event-modal'),
    inspectorModal: document.getElementById('event-detail-modal'),
    inspectorSummary: document.getElementById('inspector-summary'),
    inspectorJson: document.getElementById('inspector-json'),
    inspectorTitle: document.getElementById('inspector-title')
  };

  /**
   * Helper: Logs to simulation console
   */
  function logConsole(message, type = '') {
    if (!elements.simConsole) return;
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${message}`;
    elements.simConsole.appendChild(line);
    elements.simConsole.scrollTop = elements.simConsole.scrollHeight;
  }

  /**
   * API Helper
   */
  async function apiFetch(endpoint, options = {}) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  /**
   * Updates the SVG Risk Gauge and Policy Banner
   */
  function updateGauge(score, level, reasonCodes = [], recommendedMitigation = 'ALLOW') {
    elements.gaugeScoreValue.textContent = score;
    elements.riskLevelBadge.textContent = `${level} RISK`;
    elements.riskLevelBadge.className = `badge-pill level-${level}`;

    // Gauge calculations: Total arc perimeter for R=80 semi-circle is PI * 80 ~= 251.32
    const totalArc = 251.32;
    const fillOffset = totalArc - (score / 100) * totalArc;
    elements.gaugeFillPath.style.strokeDashoffset = fillOffset;

    // Stroke Color Mapping
    const colorMap = {
      LOW: 'var(--color-low)',
      MEDIUM: 'var(--color-medium)',
      HIGH: 'var(--color-high)',
      CRITICAL: 'var(--color-critical)'
    };
    elements.gaugeFillPath.style.stroke = colorMap[level] || 'var(--color-low)';

    // Needle Rotation: -90deg at 0 to +90deg at 100
    const angle = -90 + (score / 100) * 180;
    elements.gaugeNeedle.style.transform = `rotate(${angle}deg)`;

    // Update Mitigation Policy Banner
    elements.mitigationBanner.className = `mitigation-banner policy-${recommendedMitigation}`;
    const policyMap = {
      ALLOW: {
        title: 'POLICY: ALLOW (0 - 29)',
        desc: 'Normal mobile identity profile. Unrestricted banking and authentication access.'
      },
      WARN_USER: {
        title: 'POLICY: WARN_USER (30 - 49)',
        desc: 'Non-punitive warning displayed on client. User advised to review recent SIM activity.'
      },
      STEP_UP_AUTH: {
        title: 'POLICY: STEP_UP_AUTH (50 - 79)',
        desc: 'Correlated suspicious pattern. Require FIDO2 / Biometric verification before sensitive operations.'
      },
      HOLD_TRANSACTION: {
        title: 'POLICY: HOLD_TRANSACTION (80 - 100)',
        desc: 'CRITICAL THREAT: Funds transfer placed on immediate hold. Security review case dispatched.'
      }
    };

    const pol = policyMap[recommendedMitigation] || policyMap.ALLOW;
    elements.mitigationTitle.textContent = pol.title;
    elements.mitigationDesc.textContent = pol.desc;

    // Reason Codes Tag Cloud
    elements.reasonTags.innerHTML = '';
    if (!reasonCodes || reasonCodes.length === 0) {
      elements.reasonTags.innerHTML = '<span class="reason-pill none">No active risk signals</span>';
    } else {
      reasonCodes.forEach((code) => {
        const pill = document.createElement('span');
        pill.className = `reason-pill ${code === 'ACCOUNT_TAKEOVER_PATTERN' ? 'critical' : ''}`;
        pill.textContent = code;
        elements.reasonTags.appendChild(pill);
      });
    }
  }

  /**
   * Renders Cases and Fraud Alerts
   */
  function renderCasesAndAlerts(cases, alerts) {
    elements.casesList.innerHTML = '';

    const openCases = (cases || []).filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED');
    const openAlerts = (alerts || []).filter((a) => a.status === 'OPEN');

    if (openCases.length === 0 && openAlerts.length === 0) {
      elements.casesList.innerHTML = `
        <div class="empty-state">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <p>No open fraud alerts or critical escalation cases for this subject.</p>
        </div>
      `;
      return;
    }

    // Render open cases first
    openCases.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'case-item';
      item.innerHTML = `
        <div class="case-meta">
          <span class="case-title text-danger">⚠️ ${c.title || `ATO Investigation: ${c.userId}`}</span>
          <span class="case-time">Case #${c.caseId.slice(0, 8)} · Status: ${c.status} · ${new Date(c.createdAt).toLocaleTimeString()}</span>
        </div>
        <div class="case-actions">
          <button class="btn btn-sm btn-secondary" onclick="window.SimShieldApp.resolveCase('${c.caseId}', 'HOLD')">Hold Txn</button>
          <button class="btn btn-sm btn-primary" onclick="window.SimShieldApp.resolveCase('${c.caseId}', 'RESOLVE')">Resolve Case</button>
        </div>
      `;
      elements.casesList.appendChild(item);
    });

    // Render open alerts
    openAlerts.forEach((a) => {
      const item = document.createElement('div');
      item.className = 'case-item';
      item.innerHTML = `
        <div class="case-meta">
          <span class="case-title">${a.title}</span>
          <span class="case-time">Alert #${a.alertId.slice(0, 8)} · Score: ${a.riskScore} · ${new Date(a.triggeredAt).toLocaleTimeString()}</span>
        </div>
        <div class="case-actions">
          <button class="btn btn-sm btn-secondary" onclick="window.SimShieldApp.acknowledgeAlert('${a.alertId}', 'acknowledge')">Acknowledge</button>
          <button class="btn btn-sm btn-danger" onclick="window.SimShieldApp.acknowledgeAlert('${a.alertId}', 'report')">Report Fraud</button>
        </div>
      `;
      elements.casesList.appendChild(item);
    });
  }

  /**
   * Renders Timeline Table
   */
  function renderTimeline(events) {
    const tbody = elements.timelineTbody;
    tbody.innerHTML = '';

    const filtered = (events || []).filter((e) => {
      if (state.filter === 'ALL') return true;
      if (state.filter === 'MOBILE') {
        return ['SIM_CHANGED', 'SIM_REPLACED', 'SIM_ACTIVATED', 'ESIM_CHANGED', 'ESIM_ADDED', 'NUMBER_PORTED', 'CARRIER_CHANGED'].includes(e.eventType);
      }
      if (state.filter === 'AUTH') {
        return ['NEW_DEVICE_LOGIN', 'DEVICE_CHANGED', 'PASSWORD_RESET', 'PIN_RESET', 'FAILED_AUTH_ATTEMPTS', 'UNUSUAL_LOCATION'].includes(e.eventType);
      }
      if (state.filter === 'TXN') {
        return ['NEW_BENEFICIARY', 'UNUSUAL_TRANSACTION'].includes(e.eventType);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">No security events found matching current filter.</td>
        </tr>
      `;
      return;
    }

    filtered.forEach((e) => {
      const tr = document.createElement('tr');
      const timeStr = new Date(e.timestamp).toLocaleTimeString();
      const isMock = e.source === 'MOCK_CARRIER' || e.simulation;
      const isCritical = ['SIM_CHANGED', 'ESIM_CHANGED', 'UNUSUAL_TRANSACTION', 'NEW_DEVICE_LOGIN'].includes(e.eventType);

      tr.innerHTML = `
        <td class="font-mono text-muted">${timeStr}</td>
        <td><span class="code-pill ${isCritical ? 'text-danger' : ''}">${e.eventType}</span></td>
        <td><span class="source-badge ${isMock ? 'mock' : ''}">${e.source}</span></td>
        <td class="font-mono">${e.userId}</td>
        <td>${e.platform} · ${e.deviceIdHash ? e.deviceIdHash.slice(0, 8) + '…' : '—'}</td>
        <td>${e.carrier || (e.previousCarrier ? `${e.previousCarrier} ➔ New` : '—')}</td>
        <td>${e.verified ? '✅ Verified' : isMock ? '🧪 Simulation' : '⚠️ Unverified'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="window.SimShieldApp.inspectEvent('${e.eventId}')">
            Inspect
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * Main Data Refresh Loop
   */
  async function refreshDashboard() {
    try {
      // 1. Fetch risk for active user
      const risk = await apiFetch(`/api/users/${state.currentUser}/risk`);
      state.currentRisk = risk;
      updateGauge(risk.riskScore, risk.riskLevel, risk.reasonCodes, risk.recommendedMitigation);

      // 2. Fetch events for active user (or all events)
      const events = await apiFetch(`/api/users/${state.currentUser}/security-events`);
      state.events = events;
      renderTimeline(events);

      // 3. Fetch alerts for active user
      const alerts = await apiFetch(`/api/users/${state.currentUser}/fraud-alerts`);
      state.alerts = alerts;

      // 4. Fetch cases
      const cases = await apiFetch(`/api/cases`);
      state.cases = cases;
      renderCasesAndAlerts(cases, alerts);

      // 5. Fetch telemetry metrics
      const metrics = await apiFetch(`/api/metrics`);
      state.metrics = metrics;
      elements.metricTotalEvents.textContent = metrics.totalEvents || events.length;
      elements.metricActiveAlerts.textContent = metrics.activeAlerts || alerts.filter((a) => a.status === 'OPEN').length;
      elements.metricOpenCases.textContent = metrics.criticalCases || cases.filter((c) => c.status === 'OPEN').length;
      elements.metricHeldTxns.textContent = metrics.heldTransactions || (risk.recommendedMitigation === 'HOLD_TRANSACTION' ? 1 : 0);

      // Health Indicator
      elements.systemStatusDot.className = 'pulse-dot';
      elements.systemStatusText.textContent = 'Backend Connected';
    } catch (err) {
      elements.systemStatusDot.className = 'pulse-dot error';
      elements.systemStatusText.textContent = 'Backend Error';
    }
  }

  /**
   * Public Action: Run Single Simulation Scenario
   */
  async function runSingleScenario(scenario) {
    try {
      logConsole(`Triggering simulation scenario: ${scenario}...`, 'info');
      const res = await apiFetch(`/api/simulation/${scenario}`, {
        method: 'POST',
        body: JSON.stringify({ userId: state.currentUser })
      });
      logConsole(`Scenario '${scenario}' applied. New Risk Score: ${res.risk.riskScore} (${res.risk.riskLevel})`, 'warn');
      await refreshDashboard();
    } catch (err) {
      logConsole(`Simulation failed: ${err.message}`, 'danger');
    }
  }

  /**
   * Public Action: Run Full Multi-Stage Account Takeover Sequence
   */
  async function runAtoScenario() {
    if (state.isAtoRunning) return;
    state.isAtoRunning = true;
    elements.btnRunAto.disabled = true;
    elements.atoProgress.style.display = 'flex';

    const steps = [
      { type: 'SIM_CHANGED', source: 'MOCK_CARRIER', label: 'Step 1/5: Attacker swaps physical SIM card at telecom carrier (+30 pts)' },
      { type: 'NEW_DEVICE_LOGIN', source: 'AUTH_SERVICE', label: 'Step 2/5: Attacker logs in from unknown Android device (+20 pts) [Escalates to HIGH]' },
      { type: 'PASSWORD_RESET', source: 'AUTH_SERVICE', label: 'Step 3/5: Attacker triggers SMS OTP password reset (+15 pts)' },
      { type: 'NEW_BENEFICIARY', source: 'AUTH_SERVICE', label: 'Step 4/5: Attacker registers fraudulent wire beneficiary (+15 pts)' },
      { type: 'UNUSUAL_TRANSACTION', source: 'AUTH_SERVICE', metadata: { transactionId: 'txn-held-99120', amount: '$45,000' }, label: 'Step 5/5: Attacker attempts $45,000 transfer → CRITICAL ATO HOLD (+20 pts)' }
    ];

    logConsole(`🚨 Launching Multi-Stage Account Takeover (ATO) Chain on subject '${state.currentUser}'...`, 'danger');

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const percent = ((i + 1) / steps.length) * 100;
      elements.atoProgressFill.style.width = `${percent}%`;
      elements.atoStepperLabel.textContent = step.label;
      logConsole(`[Chain Step ${i + 1}/5] Ingesting ${step.type}...`, 'warn');

      try {
        await apiFetch('/api/mobile-events', {
          method: 'POST',
          body: JSON.stringify({
            userId: state.currentUser,
            eventType: step.type,
            source: step.source,
            platform: 'ANDROID',
            metadata: step.metadata || {}
          })
        });
        await refreshDashboard();
      } catch (err) {
        logConsole(`Step ${i + 1} error: ${err.message}`, 'danger');
      }

      // 800ms delay between steps for visual playback
      if (i < steps.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    logConsole(`🛡️ ATO Chain Completed: Authoritative Policy = HOLD_TRANSACTION. Investigation Case Dispatched!`, 'success');
    elements.atoStepperLabel.textContent = 'Attack chain replay completed. Transaction successfully held.';
    state.isAtoRunning = false;
    elements.btnRunAto.disabled = false;
  }

  /**
   * Public Action: Resolve Investigation Case
   */
  async function resolveCase(caseId, action) {
    try {
      await apiFetch(`/api/cases/${caseId}/${action}`, { method: 'POST' });
      logConsole(`Case #${caseId.slice(0, 8)} updated with action: ${action}`, 'info');
      await refreshDashboard();
    } catch (err) {
      logConsole(`Failed to update case: ${err.message}`, 'danger');
    }
  }

  /**
   * Public Action: Acknowledge / Report Alert
   */
  async function acknowledgeAlert(alertId, action) {
    try {
      await apiFetch(`/api/fraud-alerts/${alertId}/${action}`, { method: 'POST' });
      logConsole(`Alert #${alertId.slice(0, 8)} resolved: ${action}`, 'info');
      await refreshDashboard();
    } catch (err) {
      logConsole(`Failed to resolve alert: ${err.message}`, 'danger');
    }
  }

  /**
   * Public Action: Reset State
   */
  async function resetState() {
    try {
      await apiFetch('/api/reset', {
        method: 'POST',
        body: JSON.stringify({ userId: state.currentUser })
      });
      logConsole(`Reset security state for user '${state.currentUser}'.`, 'info');
      elements.atoProgress.style.display = 'none';
      elements.atoProgressFill.style.width = '0%';
      await refreshDashboard();
    } catch (err) {
      logConsole(`Failed to reset: ${err.message}`, 'danger');
    }
  }

  /**
   * Public Action: Submit Custom Event
   */
  async function submitCustomEvent(e) {
    e.preventDefault();
    const userId = document.getElementById('event-userId').value;
    const eventType = document.getElementById('event-type').value;
    const source = document.getElementById('event-source').value;
    const carrier = document.getElementById('event-carrier').value;
    const rawDevice = document.getElementById('event-device').value;
    const rawIp = document.getElementById('event-ip').value;
    let metadata = {};
    try {
      metadata = JSON.parse(document.getElementById('event-metadata').value);
    } catch {}

    const payload = {
      userId,
      eventType,
      source,
      carrier,
      deviceIdHash: rawDevice ? `sha256_${rawDevice}` : null,
      ipAddressHash: rawIp ? `sha256_${rawIp}` : null,
      metadata
    };

    try {
      const res = await apiFetch('/api/mobile-events', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      logConsole(`Custom signal '${eventType}' injected for '${userId}'. Updated score: ${res.risk.riskScore}`, 'warn');
      closeModal();
      await refreshDashboard();
    } catch (err) {
      alert(`Error injecting signal: ${err.message}`);
    }
  }

  /**
   * Public Action: Inspect Event
   */
  function inspectEvent(eventId) {
    const event = state.events.find((e) => e.eventId === eventId);
    if (!event) return;

    elements.inspectorTitle.textContent = `Signal Detail: ${event.eventType}`;
    elements.inspectorSummary.innerHTML = `
      <div class="summary-item"><span class="summary-label">Event ID</span><span class="summary-val">${event.eventId.slice(0, 16)}…</span></div>
      <div class="summary-item"><span class="summary-label">Timestamp</span><span class="summary-val">${new Date(event.timestamp).toLocaleString()}</span></div>
      <div class="summary-item"><span class="summary-label">Origin / Source</span><span class="summary-val">${event.source}</span></div>
      <div class="summary-item"><span class="summary-label">Carrier Partner</span><span class="summary-val">${event.carrier || 'N/A'}</span></div>
      <div class="summary-item"><span class="summary-label">Device Hash</span><span class="summary-val">${event.deviceIdHash || 'None'}</span></div>
      <div class="summary-item"><span class="summary-label">IP Hash</span><span class="summary-val">${event.ipAddressHash || 'None'}</span></div>
    `;

    elements.inspectorJson.textContent = JSON.stringify(event, null, 2);
    elements.inspectorModal.style.display = 'flex';
  }

  function closeModal() {
    elements.customModal.style.display = 'none';
  }

  function closeInspector() {
    elements.inspectorModal.style.display = 'none';
  }

  function setFilter(filterName) {
    state.filter = filterName;
    elements.filterBtns.forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-filter') === filterName);
    });
    renderTimeline(state.events);
  }

  function clearLogs() {
    if (elements.simConsole) elements.simConsole.innerHTML = '';
  }

  // Initialization
  function init() {
    elements.userSelect.addEventListener('change', (e) => {
      state.currentUser = e.target.value;
      logConsole(`Target subject switched to '${state.currentUser}'.`, 'info');
      refreshDashboard();
    });

    elements.btnResetState.addEventListener('click', resetState);
    elements.btnCustomEvent.addEventListener('click', () => {
      elements.customModal.style.display = 'flex';
    });

    // Initial load
    refreshDashboard();

    // Polling interval (every 3 seconds)
    state.pollTimer = setInterval(refreshDashboard, 3000);
  }

  // Expose to window for inline HTML onclick handlers
  window.SimShieldApp = {
    runSingleScenario,
    runAtoScenario,
    resolveCase,
    acknowledgeAlert,
    resetState,
    submitCustomEvent,
    inspectEvent,
    closeModal,
    closeInspector,
    setFilter,
    clearLogs
  };

  // Start app on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
