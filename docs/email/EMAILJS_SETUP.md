# Email (EmailJS) Setup

The app sends exactly **two** emails, both through [EmailJS](https://dashboard.emailjs.com/):

| Email | Trigger | Server function | EmailJS template | HTML to paste |
|---|---|---|---|---|
| **Staff registration code** | "Verify" next to Work Email on the Register tab | `sendEmailOtpFn` in `serverFns/auth.ts` | `template_zo51h1i` | `email-templates/2_registration_otp.html` |
| **Password reset link** | "Forgot password?" on the login page | `requestPasswordResetFn` in `serverFns/auth.ts` | `template_rep7mlc` | `email-templates/3_password_reset.html` |

Code lives in `src/lib/email/` (`emailjs.ts` = sender, `templates.ts` = template parameters).
Both templates show the clinic logo (`{{clinic_logo_url}}` = `<site URL>/clinic-logo.png`, so it appears once the site is public).

## Configuration

Production site: **https://harmony-erp-suite-g28j.vercel.app** (used for the reset link and the logo URL).

| Variable | Needed? | Notes |
|---|---|---|
| `EMAILJS_PRIVATE_KEY` | **Yes — secret** | EmailJS → Account → API keys. Set it in `.env` locally and in Vercel → Settings → Environment Variables. Never commit it. |
| `APP_URL` | Optional | Defaults to the Vercel URL in production and `http://localhost:8080` in dev. |
| `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY` | Optional | Built-in defaults match the clinic account. |
| `EMAILJS_TEMPLATE_REGISTRATION_OTP`, `EMAILJS_TEMPLATE_PASSWORD_RESET` | Optional | Override the template IDs above. |
| `EMAIL_LOGO_URL` | Optional | Use a different public logo image. |

## One-time EmailJS dashboard setup

1. Account → Security: allow API access from non-browser applications.
2. For each template: **To Email** `{{to_email}}`, **To Name** `{{to_name}}`, then **Edit Content → Code Editor** and paste the matching HTML file from `email-templates/`.

## Safety rules built in

- **Registration code:** random 6 digits, stored hashed, valid 10 min, 5 wrong tries per code, 1 code/60 s, 5 codes/hour per email. Registration is refused unless the email was verified.
- **Reset link:** random 256-bit token, stored hashed, valid 30 min, single use; resetting signs out every session. The "forgot password" reply is the same whether or not the email exists.
- Failed sends never start the resend cooldown.
