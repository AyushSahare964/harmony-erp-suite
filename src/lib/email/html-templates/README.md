# EmailJS HTML Templates Directory

This folder contains **individual, fully responsive HTML email templates** designed specifically to be copied and pasted directly into the [EmailJS Dashboard](https://dashboard.emailjs.com/admin/templates) for each query/transaction in the clinic ERP system.

---

## Template Mapping & Configuration

| File | Query / Purpose | Recommended EmailJS Template ID | Trigger Function in Code |
|---|---|---|---|
| [`1_login_alert.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/email-templates/1_login_alert.html) | Staff Login Security Alert | `template_login_alert` | `loginFn` in `src/lib/mongodb/serverFns/auth.ts` |
| [`2_registration_otp.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/email-templates/2_registration_otp.html) | Staff Self-Registration OTP | `template_registration_otp` | `registerFn` in `src/lib/mongodb/serverFns/auth.ts` |
| [`3_password_reset.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/email-templates/3_password_reset.html) | Password Reset Security Code | `template_password_reset` | `requestPasswordResetFn` in `src/lib/mongodb/serverFns/auth.ts` |
| [`4_appointment_confirmation.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/email-templates/4_appointment_confirmation.html) | Patient Appointment Confirmed | `template_appointment` | `createAppointmentFn` in `src/lib/mongodb/serverFns/appointments.ts` |
| [`5_payment_reminder.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/email-templates/5_payment_reminder.html) | Outstanding Balance Due Reminder | `template_payment_reminder` | `dispatchDueReminderEmailsFn` in `src/lib/mongodb/serverFns/reminders.ts` |
| [`6_visit_summary_bill.html`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/email-templates/6_visit_summary_bill.html) | Treatment Summary & Rx Bill | `template_visit_summary` | `finalizeVisitAndBillFn` in `src/lib/mongodb/serverFns/clinical.ts` |

---

## How to Add to EmailJS Website Draft / Editor

For each template:
1. Log in to your [EmailJS Dashboard](https://dashboard.emailjs.com/admin/templates).
2. Click **Create New Template** (or open an existing template).
3. In the Settings tab:
   - **Template Name:** Give it a recognizable name (e.g. *Login Alert*, *Appointment Confirmation*).
   - **Template ID:** Note the Template ID (or change it to match the table above, e.g. `template_login_alert`).
   - **To Email:** `{{to_email}}`
   - **To Name:** `{{to_name}}`
   - **From Name:** `REAL CARE SMALL ANIMAL CLINIC`
   - **Subject:** Use the recommended subject from the header comment in the HTML file (e.g. `{{subject}}` or specific text).
4. Click **Edit Content** &rarr; switch to the **Code Editor** tab.
5. Open the corresponding `.html` file from this folder, copy all code, and paste it into the EmailJS code editor.
6. Click **Save** in the top right.

---

## Overriding Template IDs via Environment Variables

You can configure individual Template IDs in your `.env` or `.env.local` file:

```env
# Optional: Specify individual template IDs for each query
EMAILJS_TEMPLATE_LOGIN_ALERT=template_login_alert
EMAILJS_TEMPLATE_REGISTRATION_OTP=template_registration_otp
EMAILJS_TEMPLATE_PASSWORD_RESET=template_password_reset
EMAILJS_TEMPLATE_APPOINTMENT=template_appointment
EMAILJS_TEMPLATE_PAYMENT_REMINDER=template_payment_reminder
EMAILJS_TEMPLATE_VISIT_SUMMARY=template_visit_summary

# Fallback default template ID if individual ones are not set
EMAILJS_TEMPLATE_ID=template_zo51h1i
```

If individual environment variables are not set, the system will use the corresponding default template ID, and if that is not configured, fall back to `EMAILJS_TEMPLATE_ID`.
