# Lead Intelligence Dashboard

A premium, serverless lead intelligence dashboard built for **Prasha Infotech**. This platform migrates all automation logic from the original Google Apps Script into a modern React SPA hosted on Netlify, using **Google Sheets** as the database (single source of truth) and the **Gmail API** to handle personalized email outreach.

---

## Tech Stack (100% Free Tier)
1. **Frontend & Hosting**: Netlify
2. **Backend APIs**: Netlify Functions (Serverless Node.js API endpoints)
3. **Background Scheduler**: Netlify Scheduled Functions (runs every 10 minutes)
4. **Database & Storage**: Google Sheets API (database) + Netlify Blobs (session token persistence)
5. **Authentication**: Google OAuth 2.0 (SSO) with JWT sessions
6. **Outreach Mail Engine**: Gmail API (using connected account + `sales@prashainfotech.com` alias)
7. **Charts**: Recharts
8. **Styling**: Tailwind CSS (custom Prasha Infotech Navy/Gold brand theme)

---

## Google Cloud Project Setup Guide

To connect the dashboard, you must configure a Google Cloud project to authenticate users and call APIs.

### 1. Create Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** > **New Project** and name it `Lead Intelligence Automation`.

### 2. Enable Required APIs
Navigate to **APIs & Services > Library** and search for and enable:
*   **Google Sheets API**
*   **Gmail API**
*   **Google Drive API** (needed to list spreadsheets in Drive)

### 3. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth Consent Screen**.
2. Select **External** user type and click **Create**.
3. Fill in the App Name (e.g. `Prasha Lead Intelligence`) and your contact email.
4. On the **Scopes** page, add the following scopes manually:
    *   `https://www.googleapis.com/auth/spreadsheets` (Read/write access to sheets)
    *   `https://www.googleapis.com/auth/gmail.send` (Send emails via Gmail)
    *   `https://www.googleapis.com/auth/drive.readonly` (Read spreadsheets from Drive)
    *   `.../auth/userinfo.email` (View user email)
    *   `.../auth/userinfo.profile` (View user profile)
5. On the **Test Users** page, add your Google account email (and `sales@prashainfotech.com` if using a separate account) so you can login during development/testing.

### 4. Create OAuth Credentials
1. Go to **APIs & Services > Credentials** and click **Create Credentials** > **OAuth client ID**.
2. Select **Web application** as the application type.
3. Name it `Lead Dashboard Web Client`.
4. In **Authorized redirect URIs**, add:
    *   `http://localhost:8888/.netlify/functions/oauth-callback` (for local development)
    *   `https://<your-app-name>.netlify.app/.netlify/functions/oauth-callback` (for production)
5. Click **Create** and copy the **Client ID** and **Client Secret**.

---

## Gmail Sender Alias Setup

The dashboard sends emails on behalf of `sales@prashainfotech.com`. To allow this:
1. Log in to the Google Account connected to the dashboard.
2. Open Gmail settings (**Gear icon > See all settings**).
3. Navigate to the **Accounts and Import** tab.
4. Under **Send mail as**, click **Add another email address**.
5. Add name: `Prasha Infotech` and email: `sales@prashainfotech.com`.
6. Complete verification. Now this address acts as an authorized alias.

---

## Environment Variables Configuration

Create a `.env` file in the root folder of the project (e.g., `C:/Users/HP/.gemini/antigravity/scratch/lead_dashboard/.env`) for local development, and configure them under **Site configuration > Environment variables** in your Netlify dashboard for production.

```env
# Google OAuth Client Credentials
GOOGLE_CLIENT_ID="your_google_client_id_here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"

# Google OAuth Redirect URI
# Local Dev: http://localhost:8888/.netlify/functions/oauth-callback
# Production: https://<your-site-name>.netlify.app/.netlify/functions/oauth-callback
GOOGLE_REDIRECT_URI="http://localhost:8888/.netlify/functions/oauth-callback"

# Security Guards
# The ONLY Google account authorized to log in to the dashboard
ALLOWED_EMAIL="sales@prashainfotech.com"

# JWT Token Secret (Any long, random text string)
JWT_SECRET="a_secure_random_string_for_signing_tokens_12948"
```

---

## Local Development Instructions

You can run the full environment locally (including Serverless Functions and Key-Value Blobs storage emulation) using the Netlify CLI.

### 1. Install Netlify CLI Globally (If needed)
```bash
npm install -g netlify-cli
```

### 2. Install Project Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
netlify dev
```
This boots up the Vite React frontend on `http://localhost:5173` and emulates the Netlify API gateway on `http://localhost:8888`. Always navigate to `http://localhost:8888` in your browser.

---

## Running Automated Tests

Run the test suite using Vitest:
```bash
npm run test
```
This runs the 11 unit tests evaluating scraping regex, scoring formulas, recommended angles, personalization compilers, and drafting.

---

## Netlify Deployment Guide

1. Create a free account on [Netlify](https://www.netlify.com/).
2. Install the Netlify CLI and login: `netlify login`.
3. Initialize the site:
   ```bash
   netlify init
   ```
4. Set up the Environment Variables on your Netlify dashboard (**Site Configuration > Environment Variables**).
5. Build and Deploy:
   ```bash
   netlify deploy --prod
   ```

### Background Cron Synchronization
Once deployed, Netlify reads the configuration in `netlify.toml` and automatically creates a serverless Cron Job running `netlify/functions/scheduled-sync.js` every 10 minutes. This function:
*   Fetches new rows (where `Last Checked` is blank).
*   Enriches and scores them (limits to 5 rows per run to stay within timeouts).
*   Auto-drafts emails.
*   Sends any approved outreach/follow-up drafts using the connected Gmail account.
*   Runs completely in the background without needing your browser to be open.
