import { google } from 'googleapis';
import { getStorageStore } from './utils.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const handler = async (event, context) => {
  try {
    const code = event.queryStringParameters.code;
    if (!code) {
      return {
        statusCode: 400,
        body: 'Missing authorization code.'
      };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    const host = event.headers.host || 'localhost:8888';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const defaultRedirect = `${protocol}://${host}/.netlify/functions/oauth-callback`;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirect;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email?.toLowerCase();
    const name = userInfo.data.name;

    const allowedEmail = process.env.ALLOWED_EMAIL?.toLowerCase();

    if (!email || !allowedEmail || email !== allowedEmail) {
      console.warn(`Unauthorized login attempt by ${email}`);
      return {
        statusCode: 302,
        headers: {
          Location: `${protocol}://${host}/?error=unauthorized`
        }
      };
    }

    // Save tokens in storage
    const store = getStorageStore('lead-intelligence-store');

    // Check if we have an existing refresh token in case Google didn't return one in this login
    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      try {
        const existing = await store.getJSON('google-oauth-tokens');
        if (existing && existing.refresh_token) {
          refreshToken = existing.refresh_token;
        }
      } catch (err) {
        console.error('Error reading existing tokens from blob store:', err);
      }
    }

    if (!refreshToken) {
      return {
        statusCode: 302,
        headers: {
          Location: `${protocol}://${host}/?error=no_refresh_token`
        }
      };
    }

    // Save to Netlify Blobs
    await store.setJSON('google-oauth-tokens', {
      refresh_token: refreshToken,
      email,
      name,
      updatedAt: new Date().toISOString()
    });

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-123456';
    const sessionToken = jwt.sign({ email }, jwtSecret, { expiresIn: '7d' });

    // Redirect user back to dashboard with token
    return {
      statusCode: 302,
      headers: {
        Location: `${protocol}://${host}/?token=${sessionToken}`
      }
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    const host = event.headers.host || 'localhost:8888';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return {
      statusCode: 302,
      headers: {
        Location: `${protocol}://${host}/?error=auth_failed`
      }
    };
  }
};
