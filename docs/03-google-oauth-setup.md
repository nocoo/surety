# Google OAuth Configuration Guide

This guide explains how to set up Google OAuth for Surety.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "Surety") and click "Create"

## Step 2: Configure OAuth Consent Screen

1. Navigate to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type and click "Create"
3. Fill in the required fields:
   - **App name**: Surety
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click "Save and Continue"
5. Skip "Scopes" (click "Save and Continue")
6. Add test users if in testing mode
7. Click "Save and Continue"

## Step 3: Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application" as the application type
4. Enter a name (e.g., "Surety Web Client")
5. Configure the URIs:

### Authorized JavaScript Origins

Add all domains where your app will run:

```
http://localhost:7015
https://yourdomain.com
```

### Authorized Redirect URIs

Add callback URLs for each domain:

```
http://localhost:7015/api/auth/callback/google
https://yourdomain.com/api/auth/callback/google
```

6. Click "Create"
7. Copy the **Client ID** and **Client Secret**

## Step 4: Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Fill in your credentials:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret

# Optional: Override base URL (auto-detected by default)
NEXTAUTH_URL=

# Allowed users (comma-separated emails)
ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com
```

## Step 5: Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and paste it as `NEXTAUTH_SECRET` in your `.env` file.

## URL Auto-Detection

Surety automatically detects the current domain from request headers, so you typically don't need to set `NEXTAUTH_URL`. The callback URL is generated dynamically based on:

1. `NEXTAUTH_URL` environment variable (if set)
2. `x-forwarded-host` header (for reverse proxies)
3. `host` header (fallback)

This allows the same configuration to work across multiple environments (localhost, staging, production).

## Troubleshooting

### "redirect_uri_mismatch" Error

This means the callback URL doesn't match what's configured in Google Cloud Console. Make sure:

1. The exact URL is added to "Authorized redirect URIs"
2. Protocol matches (http vs https)
3. Port is included for non-standard ports

### "Access Denied" After Login

This means the user's email is not in the `ALLOWED_EMAILS` list. Add their email to the comma-separated list.

### "no matching decryption secret" Error

This usually means:
1. `NEXTAUTH_SECRET` changed after cookies were set
2. Solution: Clear browser cookies and try again

## Security Notes

- Never commit `.env` file to version control
- Keep `GOOGLE_CLIENT_SECRET` and `NEXTAUTH_SECRET` secure
- Only add trusted emails to `ALLOWED_EMAILS`
- Use HTTPS in production
