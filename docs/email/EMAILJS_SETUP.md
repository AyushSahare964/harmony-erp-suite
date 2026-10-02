# Email (EmailJS) Setup & Template Studio

All outgoing emails from Harmony ERP / Real Care Small Animal Clinic are routed through **EmailJS**.

The email suite provides:
1. **Unified Code Architecture:** All templates, layout styles, and EmailJS parameters are defined in a single file: [`src/lib/email/templates.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/email/templates.ts).
2. **Interactive Single-File Studio:** A self-contained HTML/CSS/JavaScript file at [`src/lib/email/email_templates.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/email/email_templates.html) (and in [`public/email_templates.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/public/email_templates.html)) allowing you to visually preview, edit sample variables in real-time, test sending live emails, and copy the master EmailJS template with one click.

---

## 1. Quick Config Credentials

| Setting | Built-in Default | Environment Variable |
|---|---|---|
| **Service ID** | `service_1tmhrq1` | `EMAILJS_SERVICE_ID` |
| **Template ID** | `template_zo51h1i` | `EMAILJS_TEMPLATE_ID` |
| **Public Key** | `LyZojrjx5u929g6eU` | `EMAILJS_PUBLIC_KEY` |
| **Private Key** (Optional) | `""` | `EMAILJS_PRIVATE_KEY` |

Override these in `.env` / `.env.local` if using your own EmailJS account.

---

## 2. One-Time Dashboard Setup (Required)

1. **Allow server-side sending:**
   - Go to [EmailJS Dashboard](https://dashboard.emailjs.com/) → **Account** → **Security**.
   - Enable **"Allow EmailJS API for non-browser applications"**.
   - *(Optional)* If you enable "Use Private Key", paste the key into `EMAILJS_PRIVATE_KEY` in `.env`.

2. **Configure template `template_zo51h1i`:**
   - Go to **Email Templates** → **template_zo51h1i** (or create a new template).
   - Set **To Email:** `{{to_email}}`
   - Set **To Name:** `{{to_name}}`
   - Set **From Name:** `REAL CARE SMALL ANIMAL CLINIC`
   - Set **Subject:** `{{subject}}`
   - **Content:** Click **Edit Content** → switch to **Code Editor**, and choose either option below:

### Option A: Universal HTML Body (Simplest — 1 Line)
Paste exactly:
```html
{{{html_body}}}
```
*(Triple curly braces `{{{ }}}` prevent EmailJS from escaping HTML markup.)*

### Option B: Master EmailJS Branded Template (Rich HTML + Variables)
Paste the full responsive HTML template from [`src/lib/email/email_templates.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/email/email_templates.html). It accepts both structured template variables (`{{title}}`, `{{{details_table}}}`, `{{{items_table}}}`, `{{{highlight_box}}}`) AND falls back to `{{{html_body}}}` automatically!

---

## 3. Supported Email Templates

| # | Template | Trigger Point | Server Function |
|---|---|---|---|
| 1 | **Login Security Alert** | Successful staff login | `loginFn` in `serverFns/auth.ts` |
| 2 | **Staff Registration OTP** | Staff self-registration verification | `registerFn` in `serverFns/auth.ts` |
| 3 | **Password Reset Code** | "Forgot password?" modal (6-digit OTP) | `requestPasswordResetFn` in `serverFns/auth.ts` |
| 4 | **Appointment Confirmation** | New appointment booked | `bookAppointmentFn` in `serverFns/appointments.ts` |
| 5 | **Payment Due Reminder** | Scheduled billing reminder check | `dispatchDueReminderEmailsFn` in `serverFns/reminders.ts` |
| 6 | **Visit Summary & Invoice** | Visit finalized & billed | `finalizeVisitAndBillFn` in `serverFns/clinical.ts` |

---

## 4. Interactive Studio & Template Tester

Open the single-file studio in your browser to inspect or test all templates:
- When running the dev server: `http://localhost:8080/email_templates.html`
- Or open directly in your browser: `file:///c:/Users/HP pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/public/email_templates.html`

### Features:
- 📱 **Desktop (600px) & Mobile (375px) live preview toggle**.
- ✏️ **Live reactive inputs:** edit names, amounts, pet details, codes and see updates instantly.
- 📋 **One-click copy buttons:** copy full HTML, JSON parameters, or the EmailJS master template.
- ⚡ **Direct Test Sender:** send a live test email directly to your inbox via the EmailJS REST API.
