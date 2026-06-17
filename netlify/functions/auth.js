import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export const handler = async (event, context) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    // Fallback redirect URI based on host header if GOOGLE_REDIRECT_URI is not set
    const host = event.headers.host || 'localhost:8888';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const defaultRedirect = `${protocol}://${host}/.netlify/functions/oauth-callback`;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirect;

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OAuth credentials not configured in environment variables.' })
      };
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Crucial: Requests refresh token
      prompt: 'consent',      // Crucial: Forces Google to display consent screen to always yield refresh token
      scope: scopes
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ authUrl })
    };
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
