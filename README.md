# Habit Tracker — React + Tailwind + Google Sheets + Sign In

## Features
- Sign up / sign in / sign out
- User-scoped habit data
- Calendar Matrix, Daily Focus, Insights & Streaks, Export
- Create, edit and delete habits
- Excel workbook and PDF exports
- Entries sheet includes `habitId`, `habitName`, `date`, `status`, `userEmail` (no timestamps)
- Only `done` and `missed` are stored; pending deletes the entry row
- Status clicks update the UI immediately and use a single-row Apps Script write; general habit edits are batched briefly
- Responsive desktop/mobile UI

## 1. Install
Install Node.js LTS. Open this folder in VS Code and run:
```bash
npm install
npm run dev
```

## 2. Configure Apps Script
1. Back up your current Google Sheet.
2. Open Google Sheets → Extensions → Apps Script.
3. Replace `Code.gs` with `google-apps-script/Code.gs`.
4. Replace `PASTE_YOUR_GOOGLE_SHEET_ID_HERE` with your real spreadsheet ID.
5. Save and run `setup()` once, authorizing access.
6. Deploy → Manage deployments → Edit → New version → Deploy. If needed create a Web app deployment.
7. Configure access according to your testing needs. The simple starter endpoint is intended for testing and non-sensitive data only.

The script adds/updates headers while preserving matching columns. Legacy rows without userEmail are claimed by the first newly registered account. Only do this if those records belong to that account.

## 3. Connect Vite
Copy `.env.example` to `.env` in the project root. Set:
```env
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```
Restart Vite after changing `.env` (`Ctrl+C`, then `npm run dev`).

## 4. Test
- Open the app, create an account with a unique email.
- Add a habit; check `Habits`.
- Mark a habit done; check `Entries`.
- `Entries` columns: key, habitId, habitName, date, status, userEmail. Only done/missed entries are stored; pending means the row is absent.
- Sign out and sign back in.

## 5. Production note
This is a lightweight starter authentication implementation, not a security-audited identity system. SHA-256 with a salt is not an ideal password-storage algorithm for production; there is no email verification, password reset, rate limiting, or strong session management. For a public production app, use a managed provider such as Supabase Auth or Firebase Auth, and server-side authorization. Do not store sensitive personal data in a publicly accessible Apps Script deployment.
