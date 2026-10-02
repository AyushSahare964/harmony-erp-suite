import fs from 'node:fs';

const t1 = fs.readFileSync('email-templates/1_login_alert.html', 'utf8');
const t2 = fs.readFileSync('email-templates/2_registration_otp.html', 'utf8');
const t3 = fs.readFileSync('email-templates/3_password_reset.html', 'utf8');
const t4 = fs.readFileSync('email-templates/4_appointment_confirmation.html', 'utf8');
const t5 = fs.readFileSync('email-templates/5_payment_reminder.html', 'utf8');
const t6 = fs.readFileSync('email-templates/6_visit_summary_bill.html', 'utf8');

// Build the script file using string array to avoid backtick escaping issues
const parts = [];

parts.push(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EmailJS Master Templates Studio — Real Care Clinic</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #090d16;
      --panel-bg: #0f172a;
      --card-bg: #1e293b;
      --border-color: #334155;
      --border-subtle: #1e293b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --primary: #0284c7;
      --primary-hover: #0369a1;
      --primary-light: #e0f2fe;
      --accent: #38bdf8;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --radius: 10px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* Top Navigation Header */
    header {
      background-color: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-badge {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);
    }

    .brand-titles h1 {
      font-size: 17px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.3px;
    }

    .brand-titles p {
      font-size: 12px;
      color: var(--text-muted);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      text-decoration: none;
      font-family: inherit;
    }

    .btn-primary {
      background-color: var(--primary);
      color: #ffffff;
    }
    .btn-primary:hover {
      background-color: var(--primary-hover);
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
    }

    .btn-secondary {
      background-color: var(--card-bg);
      color: var(--text-main);
      border-color: var(--border-color);
    }
    .btn-secondary:hover {
      background-color: #334155;
      color: #ffffff;
    }

    .btn-success {
      background-color: #059669;
      color: #ffffff;
    }
    .btn-success:hover {
      background-color: #047857;
    }

    /* Main App Layout */
    .app-container {
      display: grid;
      grid-template-columns: 290px 380px 1fr;
      flex: 1;
      height: calc(100vh - 69px);
      overflow: hidden;
    }

    @media (max-width: 1200px) {
      .app-container {
        grid-template-columns: 250px 330px 1fr;
      }
    }

    @media (max-width: 900px) {
      .app-container {
        display: flex;
        flex-direction: column;
        height: auto;
        overflow: visible;
      }
    }

    /* Sidebar 1: Template Navigation */
    .sidebar-templates {
      background-color: var(--panel-bg);
      border-right: 1px solid var(--border-color);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
    }

    .sidebar-heading {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-dim);
      padding: 8px 12px 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 8px;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      user-select: none;
    }

    .nav-item:hover {
      background-color: var(--card-bg);
      color: var(--text-main);
    }

    .nav-item.active {
      background-color: rgba(2, 132, 199, 0.15);
      border-color: rgba(2, 132, 199, 0.4);
      color: var(--accent);
      font-weight: 600;
    }

    .nav-item .icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .nav-badge {
      margin-left: auto;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 9999px;
      font-weight: 700;
      text-transform: uppercase;
      background: var(--card-bg);
      color: var(--text-muted);
    }

    .nav-item.active .nav-badge {
      background: rgba(2, 132, 199, 0.3);
      color: var(--accent);
    }

    /* Panel 2: Live Variable Controls */
    .panel-controls {
      background-color: #0c1222;
      border-right: 1px solid var(--border-color);
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .control-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }

    .control-header h2 {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
    }

    .template-id-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      padding: 3px 8px;
      border-radius: 6px;
      background-color: rgba(2, 132, 199, 0.2);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: var(--accent);
    }

    .control-header p {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .form-input, .form-textarea, .form-select {
      background-color: var(--panel-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 9px 12px;
      color: #ffffff;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s ease;
      width: 100%;
    }

    .form-input:focus, .form-textarea:focus, .form-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.15);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .random-btn {
      background: none;
      border: none;
      color: var(--accent);
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
      text-decoration: underline;
      padding: 0;
      margin-left: auto;
    }

    /* Panel 3: Preview & Code View */
    .panel-preview {
      background-color: var(--bg-dark);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .preview-toolbar {
      background-color: var(--panel-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .tab-group {
      display: flex;
      background-color: var(--bg-dark);
      padding: 3px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      gap: 2px;
    }

    .tab-btn {
      padding: 6px 13px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-family: inherit;
      transition: all 0.15s ease;
    }

    .tab-btn.active {
      background-color: var(--card-bg);
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .device-toggles {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .device-btn {
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-color);
      background-color: var(--card-bg);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .device-btn.active {
      background-color: rgba(2, 132, 199, 0.2);
      border-color: var(--accent);
      color: var(--accent);
    }

    /* Email Simulation Frame */
    .preview-canvas {
      flex: 1;
      padding: 30px 20px;
      overflow-y: auto;
      display: flex;
      justify-content: center;
      background: radial-gradient(circle at top, #1e293b 0%, #090d16 100%);
    }

    .email-viewport-frame {
      width: 600px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.1);
      transition: width 0.3s ease;
      overflow: hidden;
      align-self: flex-start;
      border: 1px solid var(--border-color);
    }

    .email-viewport-frame.mobile {
      width: 375px;
    }

    .client-header-bar {
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 16px;
      font-size: 11px;
      color: #64748b;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .client-header-bar b {
      color: #0f172a;
    }

    #preview-iframe {
      width: 100%;
      height: 640px;
      border: none;
      display: block;
      background: #f1f5f9;
    }

    /* Code View Section */
    .code-view-container {
      display: none;
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background-color: #0b0f19;
    }

    .code-box {
      background-color: #050811;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
    }

    .code-box-header {
      background-color: var(--panel-bg);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
    }

    .code-box-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
    }

    pre code {
      display: block;
      padding: 18px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .emailjs-banner {
      background: linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(56, 189, 248, 0.05) 100%);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .emailjs-banner-icon {
      font-size: 24px;
      background: rgba(56, 189, 248, 0.1);
      padding: 8px;
      border-radius: 8px;
    }

    .emailjs-banner-content h3 {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 4px;
    }

    .emailjs-banner-content p {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .test-sender-box {
      margin-top: 14px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 14px;
    }

    .test-sender-box h4 {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #ffffff;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-msg {
      font-size: 12px;
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      display: none;
    }
    .status-msg.success { display: block; background: #064e3b; color: #6ee7b7; border: 1px solid #059669; }
    .status-msg.error { display: block; background: #7f1d1d; color: #fca5a5; border: 1px solid #dc2626; }
  </style>
</head>
<body>

  <!-- Top App Header -->
  <header>
    <div class="brand-section">
      <div class="logo-badge">🐾</div>
      <div class="brand-titles">
        <h1>EmailJS Unified Template Suite</h1>
        <p>Real Care Small Animal Clinic · Dedicated HTML Templates per Query</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" id="btn-copy-draft" onclick="copyActiveDraftTemplate()">
        📋 Copy This Template HTML for EmailJS
      </button>
      <a href="https://dashboard.emailjs.com/admin/templates" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
        🚀 Open EmailJS Dashboard
      </a>
    </div>
  </header>

  <!-- Main 3-Column Studio -->
  <div class="app-container">

    <!-- 1. Left Nav: Templates List -->
    <nav class="sidebar-templates">
      <div class="sidebar-heading">Clinical &amp; System Queries</div>
      
      <div class="nav-item active" onclick="switchTemplate('loginAlert')" id="nav-loginAlert">
        <span class="icon">🛡️</span>
        <span>Login Security Alert</span>
        <span class="nav-badge">Auth</span>
      </div>

      <div class="nav-item" onclick="switchTemplate('registrationOTP')" id="nav-registrationOTP">
        <span class="icon">✉️</span>
        <span>Registration OTP</span>
        <span class="nav-badge">New</span>
      </div>

      <div class="nav-item" onclick="switchTemplate('passwordReset')" id="nav-passwordReset">
        <span class="icon">🔐</span>
        <span>Password Reset Code</span>
        <span class="nav-badge">Auth</span>
      </div>

      <div class="nav-item" onclick="switchTemplate('appointment')" id="nav-appointment">
        <span class="icon">📅</span>
        <span>Appointment Confirmation</span>
        <span class="nav-badge">Booking</span>
      </div>

      <div class="nav-item" onclick="switchTemplate('paymentDue')" id="nav-paymentDue">
        <span class="icon">💰</span>
        <span>Payment Due Reminder</span>
        <span class="nav-badge">Billing</span>
      </div>

      <div class="nav-item" onclick="switchTemplate('visitSummary')" id="nav-visitSummary">
        <span class="icon">🩺</span>
        <span>Treatment &amp; Invoice</span>
        <span class="nav-badge">Clinical</span>
      </div>

      <div class="sidebar-heading" style="margin-top: 14px;">Master Template</div>
      <div class="nav-item" onclick="switchTemplate('emailjsMaster')" id="nav-emailjsMaster">
        <span class="icon">⚙️</span>
        <span>Universal Master Template</span>
        <span class="nav-badge" style="background:#0284c7; color:#fff;">All-In-One</span>
      </div>
    </nav>

    <!-- 2. Middle Panel: Live Reactive Controls -->
    <aside class="panel-controls" id="panel-controls">
      <div class="control-header">
        <h2 id="control-title">Login Alert Settings</h2>
        <div id="template-id-badge" class="template-id-pill">ID: template_login_alert</div>
        <p id="control-desc">Customize sample parameters to preview reactive changes.</p>
      </div>

      <div id="dynamic-form-container">
        <!-- Form inputs dynamically injected -->
      </div>

      <!-- Quick Test Sender Box -->
      <div class="test-sender-box">
        <h4>⚡ Send Live Test via EmailJS</h4>
        <div class="form-group" style="margin-bottom: 8px;">
          <label>Recipient Test Email</label>
          <input type="email" id="test-to-email" class="form-input" placeholder="you@domain.com">
        </div>
        <button class="btn btn-success" style="width: 100%; justify-content: center;" onclick="sendTestEmailDirectly()">
          Send Test Email Now
        </button>
        <div id="test-status-msg" class="status-msg"></div>
      </div>
    </aside>

    <!-- 3. Right Panel: Visual Preview & Code Tabs -->
    <main class="panel-preview">
      <div class="preview-toolbar">
        <div class="tab-group">
          <button class="tab-btn active" id="tab-visual" onclick="showTab('visual')">👁️ Visual Preview</button>
          <button class="tab-btn" id="tab-draft" onclick="showTab('draft')">📄 EmailJS Template HTML</button>
          <button class="tab-btn" id="tab-params" onclick="showTab('params')">{ } EmailJS Params</button>
          <button class="tab-btn" id="tab-html" onclick="showTab('html')">&lt;/&gt; Rendered Output</button>
        </div>

        <div class="device-toggles" id="device-toggle-group">
          <button class="device-btn active" id="dev-desktop" onclick="setDevice('desktop')">
            🖥️ Desktop (600px)
          </button>
          <button class="device-btn" id="dev-mobile" onclick="setDevice('mobile')">
            📱 Mobile (375px)
          </button>
        </div>

        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="copyActiveCode()">
          📋 Copy Code
        </button>
      </div>

      <!-- Visual Viewport -->
      <div class="preview-canvas" id="canvas-visual">
        <div class="email-viewport-frame" id="viewport-frame">
          <div class="client-header-bar">
            <div><b>From:</b> Real Care Small Animal Clinic &lt;care@realcareclinic.com&gt;</div>
            <div id="client-to-line"><b>To:</b> dr.sharma@example.com</div>
            <div id="client-subj-line"><b>Subject:</b> Security Alert: New Sign-in to Your Clinic Account</div>
          </div>
          <iframe id="preview-iframe" title="Email Live Preview"></iframe>
        </div>
      </div>

      <!-- EmailJS Draft Template Code View (Individual File Content) -->
      <div class="code-view-container" id="canvas-draft">
        <div class="emailjs-banner">
          <div class="emailjs-banner-icon">📋</div>
          <div class="emailjs-banner-content">
            <h3 id="draft-banner-title">EmailJS Template HTML (Ready for Dashboard)</h3>
            <p id="draft-banner-desc">Create a template with Template ID <b id="draft-banner-tid">template_login_alert</b> in your EmailJS Dashboard, switch to Code Editor, and paste this exact code.</p>
          </div>
        </div>
        <div class="code-box">
          <div class="code-box-header">
            <span class="code-box-title" id="draft-box-filename">email-templates/1_login_alert.html</span>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="copyCodeFrom('draft-html-code')">Copy EmailJS HTML</button>
          </div>
          <pre><code id="draft-html-code"></code></pre>
        </div>
      </div>

      <!-- EmailJS Params Code View -->
      <div class="code-view-container" id="canvas-params">
        <div class="emailjs-banner">
          <div class="emailjs-banner-icon">💡</div>
          <div class="emailjs-banner-content">
            <h3>Automated Query Parameter Payload</h3>
            <p>When the query executes in code, <code>sendEmail()</code> transmits these parameters matching the template variables.</p>
          </div>
        </div>
        <div class="code-box">
          <div class="code-box-header">
            <span class="code-box-title">template_params (JSON Payload)</span>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="copyCodeFrom('params-json-code')">Copy JSON</button>
          </div>
          <pre><code id="params-json-code"></code></pre>
        </div>
      </div>

      <!-- Rendered HTML Code View -->
      <div class="code-view-container" id="canvas-html">
        <div class="code-box">
          <div class="code-box-header">
            <span class="code-box-title">Full Inlined HTML Source (Ready for {{{html_body}}})</span>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="copyCodeFrom('rendered-html-code')">Copy HTML</button>
          </div>
          <pre><code id="rendered-html-code"></code></pre>
        </div>
      </div>
    </main>

  </div>

  <!-- JavaScript Engine -->
  <script>
    const RAW_TEMPLATES = {
      loginAlert: { id: "template_login_alert", filename: "email-templates/1_login_alert.html", html: ${JSON.stringify(t1)} },
      registrationOTP: { id: "template_registration_otp", filename: "email-templates/2_registration_otp.html", html: ${JSON.stringify(t2)} },
      passwordReset: { id: "template_password_reset", filename: "email-templates/3_password_reset.html", html: ${JSON.stringify(t3)} },
      appointment: { id: "template_appointment", filename: "email-templates/4_appointment_confirmation.html", html: ${JSON.stringify(t4)} },
      paymentDue: { id: "template_payment_reminder", filename: "email-templates/5_payment_reminder.html", html: ${JSON.stringify(t5)} },
      visitSummary: { id: "template_visit_summary", filename: "email-templates/6_visit_summary_bill.html", html: ${JSON.stringify(t6)} }
    };

    const state = {
      activeTemplate: 'loginAlert',
      activeTab: 'visual',
      device: 'desktop',
      clinic: {
        fullName: 'REAL CARE SMALL ANIMAL CLINIC',
        tagline: "An Animal's Eyes Have The Power to Speak a Great Language",
        address: 'Real Care Small Animal Clinic, Nagpur, Maharashtra',
        phone: '+91 87674 84342',
        email: 'care@realcareclinic.com',
        doctorName: 'Dr. Makarand M. Dixit'
      },
      templates: {
        loginAlert: {
          name: 'Dr. Neha Sharma',
          email: 'neha.sharma@realcareclinic.com',
          role: 'Attending Veterinary Surgeon',
          whenIST: '03 Oct 2026, 11:42 PM'
        },
        registrationOTP: {
          name: 'Dr. Rohan Verma',
          email: 'rohan.verma@example.com',
          code: '849201',
          minutes: 10
        },
        passwordReset: {
          name: 'Dr. Makarand Dixit',
          code: '419725',
          minutes: 10
        },
        appointment: {
          ownerName: 'Sunita Rao',
          petName: 'Bruno (Golden Retriever)',
          date: '04 Oct 2026',
          time: '10:30 AM',
          doctor: 'Dr. Makarand M. Dixit',
          token: 'TK-14',
          reason: 'Annual Vaccination Booster & Dental Check'
        },
        paymentDue: {
          ownerName: 'Vikram Joshi',
          petName: 'Milo (Persian Cat)',
          amount: 2850,
          dueDate: '08 Oct 2026',
          invoiceNo: 'INV-2026-0891',
          reminderType: 'Overdue Post-Operative Care & Pharmacy Balance'
        },
        visitSummary: {
          ownerName: 'Ananya Deshmukh',
          petName: 'Rocky (German Shepherd)',
          date: '03 Oct 2026',
          doctor: 'Dr. Makarand M. Dixit',
          invoiceNo: 'INV-2026-0902',
          prescriptionNo: 'RX-2026-0441',
          diagnosis: 'Acute Gastrointestinal Upset with Mild Dehydration',
          notes: 'Administered IV fluids & antiemetic. Bland chicken/rice diet for 3 days. Ample fresh water.',
          nextVisitDate: '06 Oct 2026 (Follow-up Check)',
          lines: [
            { name: 'Clinical Consultation & Physical Examination', qty: 1, total: 500, dosage: 'Full vitals check' },
            { name: 'Cerenia Antiemetic Injection (10mg/ml)', qty: 1, total: 650, dosage: '1 ml SC once' },
            { name: 'Normal Saline (0.9% NaCl) 500ml IV Infusion', qty: 1, total: 450, dosage: 'Slow drip administered' },
            { name: 'Pantocid IV Injection', qty: 1, total: 200, dosage: 'Administered' },
            { name: 'Probiotic Paste Syringe (15ml)', qty: 1, total: 450, dosage: '2 ml orally twice daily after food for 5 days' }
          ],
          totalAmount: 2250,
          amountPaid: 2000,
          balanceDue: 250
        }
      }
    };

    function esc(s) {
      return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
    }

    function inr(n) {
      return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderIndividualTemplateWithValues(templateKey) {
      const raw = RAW_TEMPLATES[templateKey];
      if (!raw) return '';
      let html = raw.html;
      const c = state.clinic;
      const d = state.templates[templateKey];

      html = html.split('{{clinic_name}}').join(c.fullName);
      html = html.split('{{clinic_tagline}}').join(c.tagline);
      html = html.split('{{clinic_address}}').join(c.address);
      html = html.split('{{clinic_phone}}').join(c.phone);

      if (templateKey === 'loginAlert') {
        html = html.split('{{to_name}}').join(d.name);
        html = html.split('{{account_email}}').join(d.email);
        html = html.split('{{user_role}}').join(d.role);
        html = html.split('{{login_time}}').join(d.whenIST);
        html = html.split('{{security_status}}').join('Successful Authentication');
      } else if (templateKey === 'registrationOTP') {
        html = html.split('{{to_name}}').join(d.name);
        html = html.split('{{account_email}}').join(d.email);
        html = html.split('{{otp_code}}').join(d.code);
        html = html.split('{{expiry_minutes}}').join(String(d.minutes));
        html = html.split('{{role_name}}').join('Staff Portal Access');
        html = html.split('{{purpose}}').join('Staff Self-Registration Verification');
      } else if (templateKey === 'passwordReset') {
        html = html.split('{{to_name}}').join(d.name);
        html = html.split('{{reset_code}}').join(d.code);
        html = html.split('{{expiry_minutes}}').join(String(d.minutes));
      } else if (templateKey === 'appointment') {
        html = html.split('{{owner_name}}').join(d.ownerName);
        html = html.split('{{pet_name}}').join(d.petName);
        html = html.split('{{appointment_date}}').join(d.date);
        html = html.split('{{appointment_time}}').join(d.time);
        html = html.split('{{doctor_name}}').join(d.doctor);
        html = html.split('{{queue_token}}').join(d.token);
        html = html.split('{{reason_for_visit}}').join(d.reason);
      } else if (templateKey === 'paymentDue') {
        html = html.split('{{owner_name}}').join(d.ownerName);
        html = html.split('{{pet_name}}').join(d.petName);
        html = html.split('{{amount_due}}').join(inr(d.amount));
        html = html.split('{{due_date}}').join(d.dueDate);
        html = html.split('{{invoice_no}}').join(d.invoiceNo);
        html = html.split('{{reminder_type}}').join(d.reminderType);
      } else if (templateKey === 'visitSummary') {
        html = html.split('{{owner_name}}').join(d.ownerName);
        html = html.split('{{pet_name}}').join(d.petName);
        html = html.split('{{visit_date}}').join(d.date);
        html = html.split('{{doctor_name}}').join(d.doctor);
        html = html.split('{{invoice_no}}').join(d.invoiceNo);
        html = html.split('{{prescription_no}}').join(d.prescriptionNo);
        html = html.split('{{diagnosis}}').join(d.diagnosis);
        html = html.split('{{doctor_advice}}').join(d.notes);
        html = html.split('{{next_visit_date}}').join(d.nextVisitDate);
        html = html.split('{{total_amount}}').join(inr(d.totalAmount));
        html = html.split('{{amount_paid}}').join(inr(d.amountPaid));
        html = html.split('{{balance_due}}').join(inr(d.balanceDue));
        html = html.split('{{balance_due_color}}').join(d.balanceDue > 0 ? '#dc2626' : '#16a34a');

        const td = 'style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;vertical-align:top;"';
        const rows = (d.lines || []).map(function(l) {
          const doseHtml = l.dosage ? '<div style="color:#64748b;font-size:12px;margin-top:3px;">Dosage: ' + esc(l.dosage) + '</div>' : '';
          return '<tr><td ' + td + '><b>' + esc(l.name) + '</b>' + doseHtml + '</td><td ' + td + ' align="center">' + esc(l.qty) + '</td><td ' + td + ' align="right">' + inr(l.total) + '</td></tr>';
        }).join('');
        html = html.split('{{{itemized_table_rows}}}').join(rows);
      }

      return html;
    }

    function getParamsForTemplate(type) {
      const c = state.clinic;
      const d = state.templates[type];
      if (type === 'loginAlert') {
        return {
          to_email: d.email, to_name: d.name, subject: "Security Alert: New Sign-in to Your Clinic Account",
          clinic_name: c.fullName, clinic_tagline: c.tagline, clinic_address: c.address, clinic_phone: c.phone,
          account_email: d.email, user_role: d.role, login_time: d.whenIST, security_status: "Successful Authentication"
        };
      }
      if (type === 'registrationOTP') {
        return {
          to_email: d.email, to_name: d.name, subject: "Your Staff Registration Verification Code: " + d.code,
          clinic_name: c.fullName, clinic_tagline: c.tagline, clinic_address: c.address, clinic_phone: c.phone,
          account_email: d.email, otp_code: d.code, expiry_minutes: String(d.minutes), role_name: "Staff Portal Access", purpose: "Staff Self-Registration Verification"
        };
      }
      if (type === 'passwordReset') {
        return {
          to_email: 'staff@realcareclinic.com', to_name: d.name, subject: "Your Password Reset Code: " + d.code,
          clinic_name: c.fullName, clinic_tagline: c.tagline, clinic_address: c.address, clinic_phone: c.phone,
          reset_code: d.code, expiry_minutes: String(d.minutes)
        };
      }
      if (type === 'appointment') {
        return {
          to_email: 'petowner@example.com', to_name: d.ownerName, owner_name: d.ownerName, pet_name: d.petName,
          subject: "Appointment Confirmed for " + d.petName + " — " + d.date,
          clinic_name: c.fullName, clinic_tagline: c.tagline, clinic_address: c.address, clinic_phone: c.phone,
          appointment_date: d.date, appointment_time: d.time, doctor_name: d.doctor, queue_token: d.token, reason_for_visit: d.reason
        };
      }
      if (type === 'paymentDue') {
        return {
          to_email: 'accounts@example.com', to_name: d.ownerName, owner_name: d.ownerName, pet_name: d.petName,
          subject: "Payment Reminder: " + inr(d.amount) + " Due for " + d.petName,
          clinic_name: c.fullName, clinic_tagline: c.tagline, clinic_address: c.address, clinic_phone: c.phone,
          amount_due: inr(d.amount), due_date: d.dueDate, invoice_no: d.invoiceNo, reminder_type: d.reminderType
        };
      }
      if (type === 'visitSummary') {
        return {
          to_email: 'ananya.deshmukh@example.com', to_name: d.ownerName, owner_name: d.ownerName, pet_name: d.petName,
          subject: "Treatment Summary & Invoice " + d.invoiceNo + " for " + d.petName,
          clinic_name: c.fullName, clinic_tagline: c.tagline, clinic_address: c.address, clinic_phone: c.phone,
          visit_date: d.date, doctor_name: d.doctor, invoice_no: d.invoiceNo, prescription_no: d.prescriptionNo,
          diagnosis: d.diagnosis, doctor_advice: d.notes, next_visit_date: d.nextVisitDate,
          total_amount: inr(d.totalAmount), amount_paid: inr(d.amountPaid), balance_due: inr(d.balanceDue),
          balance_due_color: d.balanceDue > 0 ? '#dc2626' : '#16a34a'
        };
      }
      return {};
    }

    function render() {
      document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });
      const activeNav = document.getElementById('nav-' + state.activeTemplate);
      if (activeNav) activeNav.classList.add('active');

      if (state.activeTemplate === 'emailjsMaster') {
        renderMasterView();
        return;
      }

      const raw = RAW_TEMPLATES[state.activeTemplate];
      document.getElementById('control-title').innerText = getTemplateTitle(state.activeTemplate);
      document.getElementById('template-id-badge').innerText = 'ID: ' + raw.id;
      document.getElementById('control-desc').innerText = 'Editing parameters for ' + raw.filename;
      document.getElementById('device-toggle-group').style.display = 'flex';

      renderFormControls();

      const renderedHtml = renderIndividualTemplateWithValues(state.activeTemplate);
      const params = getParamsForTemplate(state.activeTemplate);

      document.getElementById('client-to-line').innerHTML = '<b>To:</b> ' + esc(params.to_name || 'Client') + ' &lt;' + esc(params.to_email || 'client@example.com') + '&gt;';
      document.getElementById('client-subj-line').innerHTML = '<b>Subject:</b> ' + esc(params.subject || 'Notification');
      if (!document.getElementById('test-to-email').value) {
        document.getElementById('test-to-email').value = params.to_email || 'test@example.com';
      }

      document.getElementById('preview-iframe').srcdoc = renderedHtml;

      document.getElementById('draft-box-filename').innerText = raw.filename + ' (' + raw.id + ')';
      document.getElementById('draft-banner-tid').innerText = raw.id;
      document.getElementById('draft-html-code').textContent = raw.html;

      document.getElementById('rendered-html-code').textContent = renderedHtml;
      document.getElementById('params-json-code').textContent = JSON.stringify({
        service_id: "service_1tmhrq1",
        template_id: raw.id,
        user_id: "LyZojrjx5u929g6eU",
        template_params: params
      }, null, 2);
    }

    function renderMasterView() {
      document.getElementById('control-title').innerText = "Universal Master Template";
      document.getElementById('template-id-badge').innerText = 'ID: template_zo51h1i';
      document.getElementById('control-desc').innerText = "Single template handling all queries via {{{html_body}}} or parameters.";
      
      const fc = document.getElementById('dynamic-form-container');
      fc.innerHTML = '<div class="emailjs-banner" style="margin-bottom:0;"><div class="emailjs-banner-icon">💡</div><div class="emailjs-banner-content"><h3>Single Template Fallback</h3><p>If you prefer not to create 6 separate templates in EmailJS, you can use the universal template with <code>{{{html_body}}}</code>.</p></div></div>';

      const rendered = renderIndividualTemplateWithValues('loginAlert');
      document.getElementById('preview-iframe').srcdoc = rendered;
      document.getElementById('draft-html-code').textContent = '{{{html_body}}}';
      document.getElementById('rendered-html-code').textContent = rendered;
      document.getElementById('params-json-code').textContent = JSON.stringify({
        service_id: "service_1tmhrq1",
        template_id: "template_zo51h1i",
        template_params: {
          to_email: "test@example.com",
          to_name: "Staff Name",
          subject: "Clinic Notification",
          html_body: rendered
        }
      }, null, 2);
    }

    function getTemplateTitle(key) {
      const map = {
        loginAlert: '1. Login Security Alert',
        registrationOTP: '2. Staff Registration OTP',
        passwordReset: '3. Password Reset Code',
        appointment: '4. Appointment Confirmation',
        paymentDue: '5. Payment Due Reminder',
        visitSummary: '6. Treatment & Invoice Summary',
        emailjsMaster: 'Universal Master Template'
      };
      return map[key] || 'Settings';
    }

    function renderFormControls() {
      const fc = document.getElementById('dynamic-form-container');
      const t = state.activeTemplate;
      const d = state.templates[t];
      let html = '';

      if (t === 'loginAlert') {
        html = '<div class="form-group"><label>Staff Member Name</label><input type="text" class="form-input" value="' + esc(d.name) + '" oninput=\\'updateField("loginAlert", "name", this.value)\\'></div>' +
          '<div class="form-group"><label>Account Email</label><input type="email" class="form-input" value="' + esc(d.email) + '" oninput=\\'updateField("loginAlert", "email", this.value)\\'></div>' +
          '<div class="form-group"><label>Assigned Staff Role</label><input type="text" class="form-input" value="' + esc(d.role) + '" oninput=\\'updateField("loginAlert", "role", this.value)\\'></div>' +
          '<div class="form-group"><label>Timestamp (IST)</label><input type="text" class="form-input" value="' + esc(d.whenIST) + '" oninput=\\'updateField("loginAlert", "whenIST", this.value)\\'></div>';
      } else if (t === 'registrationOTP') {
        html = '<div class="form-group"><label>Staff Full Name</label><input type="text" class="form-input" value="' + esc(d.name) + '" oninput=\\'updateField("registrationOTP", "name", this.value)\\'></div>' +
          '<div class="form-group"><label>Registered Email</label><input type="email" class="form-input" value="' + esc(d.email) + '" oninput=\\'updateField("registrationOTP", "email", this.value)\\'></div>' +
          '<div class="form-group"><div style="display:flex;align-items:center;"><label>6-Digit OTP Code</label><button class="random-btn" onclick=\\'generateRandomCode("registrationOTP")\\'>🎲 Randomize</button></div>' +
          '<input type="text" maxlength="6" class="form-input" style="font-family:monospace;font-size:16px;letter-spacing:4px;" value="' + esc(d.code) + '" oninput=\\'updateField("registrationOTP", "code", this.value)\\'></div>' +
          '<div class="form-group"><label>Expiry Minutes</label><input type="number" class="form-input" value="' + d.minutes + '" oninput=\\'updateField("registrationOTP", "minutes", this.value)\\'></div>';
      } else if (t === 'passwordReset') {
        html = '<div class="form-group"><label>Staff Full Name</label><input type="text" class="form-input" value="' + esc(d.name) + '" oninput=\\'updateField("passwordReset", "name", this.value)\\'></div>' +
          '<div class="form-group"><div style="display:flex;align-items:center;"><label>6-Digit Reset Code</label><button class="random-btn" onclick=\\'generateRandomCode("passwordReset")\\'>🎲 Randomize</button></div>' +
          '<input type="text" maxlength="6" class="form-input" style="font-family:monospace;font-size:16px;letter-spacing:4px;" value="' + esc(d.code) + '" oninput=\\'updateField("passwordReset", "code", this.value)\\'></div>' +
          '<div class="form-group"><label>Expiry Minutes</label><input type="number" class="form-input" value="' + d.minutes + '" oninput=\\'updateField("passwordReset", "minutes", this.value)\\'></div>';
      } else if (t === 'appointment') {
        html = '<div class="form-group"><label>Pet Owner Name</label><input type="text" class="form-input" value="' + esc(d.ownerName) + '" oninput=\\'updateField("appointment", "ownerName", this.value)\\'></div>' +
          '<div class="form-group"><label>Pet Name &amp; Breed</label><input type="text" class="form-input" value="' + esc(d.petName) + '" oninput=\\'updateField("appointment", "petName", this.value)\\'></div>' +
          '<div class="form-row"><div class="form-group"><label>Date</label><input type="text" class="form-input" value="' + esc(d.date) + '" oninput=\\'updateField("appointment", "date", this.value)\\'></div>' +
          '<div class="form-group"><label>Time</label><input type="text" class="form-input" value="' + esc(d.time) + '" oninput=\\'updateField("appointment", "time", this.value)\\'></div></div>' +
          '<div class="form-group"><label>Doctor</label><input type="text" class="form-input" value="' + esc(d.doctor) + '" oninput=\\'updateField("appointment", "doctor", this.value)\\'></div>' +
          '<div class="form-group"><label>Queue Token #</label><input type="text" class="form-input" value="' + esc(d.token) + '" oninput=\\'updateField("appointment", "token", this.value)\\'></div>' +
          '<div class="form-group"><label>Reason for Visit</label><input type="text" class="form-input" value="' + esc(d.reason) + '" oninput=\\'updateField("appointment", "reason", this.value)\\'></div>';
      } else if (t === 'paymentDue') {
        html = '<div class="form-group"><label>Pet Owner Name</label><input type="text" class="form-input" value="' + esc(d.ownerName) + '" oninput=\\'updateField("paymentDue", "ownerName", this.value)\\'></div>' +
          '<div class="form-group"><label>Pet Name</label><input type="text" class="form-input" value="' + esc(d.petName) + '" oninput=\\'updateField("paymentDue", "petName", this.value)\\'></div>' +
          '<div class="form-row"><div class="form-group"><label>Amount Due (₹ INR)</label><input type="number" class="form-input" value="' + d.amount + '" oninput=\\'updateField("paymentDue", "amount", this.value)\\'></div>' +
          '<div class="form-group"><label>Due Date</label><input type="text" class="form-input" value="' + esc(d.dueDate) + '" oninput=\\'updateField("paymentDue", "dueDate", this.value)\\'></div></div>' +
          '<div class="form-group"><label>Invoice Number</label><input type="text" class="form-input" value="' + esc(d.invoiceNo) + '" oninput=\\'updateField("paymentDue", "invoiceNo", this.value)\\'></div>' +
          '<div class="form-group"><label>Reminder Description</label><input type="text" class="form-input" value="' + esc(d.reminderType) + '" oninput=\\'updateField("paymentDue", "reminderType", this.value)\\'></div>';
      } else if (t === 'visitSummary') {
        html = '<div class="form-group"><label>Pet Owner</label><input type="text" class="form-input" value="' + esc(d.ownerName) + '" oninput=\\'updateField("visitSummary", "ownerName", this.value)\\'></div>' +
          '<div class="form-group"><label>Pet Name</label><input type="text" class="form-input" value="' + esc(d.petName) + '" oninput=\\'updateField("visitSummary", "petName", this.value)\\'></div>' +
          '<div class="form-group"><label>Clinical Diagnosis</label><input type="text" class="form-input" value="' + esc(d.diagnosis) + '" oninput=\\'updateField("visitSummary", "diagnosis", this.value)\\'></div>' +
          '<div class="form-group"><label>Doctor&#39;s Advice &amp; Instructions</label><textarea class="form-textarea" rows="2" oninput=\\'updateField("visitSummary", "notes", this.value)\\'>' + esc(d.notes) + '</textarea></div>' +
          '<div class="form-row"><div class="form-group"><label>Total Bill (₹)</label><input type="number" class="form-input" value="' + d.totalAmount + '" oninput=\\'updateField("visitSummary", "totalAmount", this.value)\\'></div>' +
          '<div class="form-group"><label>Amount Paid (₹)</label><input type="number" class="form-input" value="' + d.amountPaid + '" oninput=\\'updateField("visitSummary", "amountPaid", this.value)\\'></div></div>' +
          '<div class="form-group"><label>Balance Due (₹)</label><input type="number" class="form-input" value="' + d.balanceDue + '" oninput=\\'updateField("visitSummary", "balanceDue", this.value)\\'></div>';
      }

      fc.innerHTML = html;
    }

    function switchTemplate(type) {
      state.activeTemplate = type;
      render();
    }

    function updateField(tmpl, field, val) {
      state.templates[tmpl][field] = val;
      render();
    }

    function generateRandomCode(tmpl) {
      state.templates[tmpl].code = String(Math.floor(100000 + Math.random() * 900000));
      render();
    }

    function showTab(tab) {
      state.activeTab = tab;
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.getElementById('tab-' + tab).classList.add('active');

      document.getElementById('canvas-visual').style.display = tab === 'visual' ? 'flex' : 'none';
      document.getElementById('canvas-draft').style.display = tab === 'draft' ? 'block' : 'none';
      document.getElementById('canvas-params').style.display = tab === 'params' ? 'block' : 'none';
      document.getElementById('canvas-html').style.display = tab === 'html' ? 'block' : 'none';
    }

    function setDevice(dev) {
      state.device = dev;
      document.querySelectorAll('.device-btn').forEach(function(b) { b.classList.remove('active'); });
      document.getElementById('dev-' + dev).classList.add('active');

      const frame = document.getElementById('viewport-frame');
      if (dev === 'mobile') {
        frame.classList.add('mobile');
      } else {
        frame.classList.remove('mobile');
      }
    }

    function copyActiveDraftTemplate() {
      const raw = RAW_TEMPLATES[state.activeTemplate];
      const text = raw ? raw.html : document.getElementById('draft-html-code').textContent;
      navigator.clipboard.writeText(text).then(function() {
        const btn = document.getElementById('btn-copy-draft');
        const orig = btn.innerHTML;
        btn.innerHTML = '✅ Copied ' + (raw ? raw.id : 'HTML') + ' to Clipboard!';
        setTimeout(function() { btn.innerHTML = orig; }, 2500);
      });
    }

    function copyCodeFrom(elementId) {
      const code = document.getElementById(elementId).textContent;
      navigator.clipboard.writeText(code).then(function() {
        alert('Copied to clipboard!');
      });
    }

    function copyActiveCode() {
      if (state.activeTab === 'draft') {
        copyCodeFrom('draft-html-code');
      } else if (state.activeTab === 'html') {
        copyCodeFrom('rendered-html-code');
      } else if (state.activeTab === 'params') {
        copyCodeFrom('params-json-code');
      } else {
        copyActiveDraftTemplate();
      }
    }

    async function sendTestEmailDirectly() {
      const toEmail = document.getElementById('test-to-email').value.trim();
      const statusEl = document.getElementById('test-status-msg');

      if (!toEmail || !toEmail.includes('@')) {
        statusEl.className = 'status-msg error';
        statusEl.innerText = 'Please enter a valid recipient email address.';
        return;
      }

      const raw = RAW_TEMPLATES[state.activeTemplate];
      const tid = raw ? raw.id : 'template_zo51h1i';

      statusEl.className = 'status-msg';
      statusEl.style.display = 'block';
      statusEl.innerText = 'Sending email via EmailJS (Template: ' + tid + ')...';

      const params = getParamsForTemplate(state.activeTemplate);
      params.to_email = toEmail;
      params.html_body = renderIndividualTemplateWithValues(state.activeTemplate);

      try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: 'service_1tmhrq1',
            template_id: tid,
            user_id: 'LyZojrjx5u929g6eU',
            template_params: params
          })
        });

        if (res.ok) {
          statusEl.className = 'status-msg success';
          statusEl.innerText = '✅ Sent successfully to ' + toEmail + '! Check your inbox.';
        } else {
          const txt = await res.text();
          statusEl.className = 'status-msg error';
          statusEl.innerText = '❌ EmailJS (' + res.status + '): ' + txt;
        }
      } catch (err) {
        statusEl.className = 'status-msg error';
        statusEl.innerText = 'Network error: ' + err.message;
      }
    }

    window.addEventListener('DOMContentLoaded', function() {
      render();
    });
  </script>
</body>
</html>`);

const finalHtml = parts.join('');
fs.writeFileSync('src/lib/email/email_templates.html', finalHtml, 'utf8');
fs.writeFileSync('public/email_templates.html', finalHtml, 'utf8');
console.log('Successfully compiled and synchronized email_templates.html to both src/lib/email/ and public/!');
