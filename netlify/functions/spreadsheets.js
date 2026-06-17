import { google } from 'googleapis';
import { verifySession, getGoogleAuthClient, getStorageStore } from './utils.js';
import dotenv from 'dotenv';

dotenv.config();

export const handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }

  try {
    // Verify session
    verifySession(event);

    const oauth2Client = await getGoogleAuthClient();
    const store = getStorageStore('lead-intelligence-store');

    if (event.httpMethod === 'GET') {
      // List spreadsheets from Drive
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      const response = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
        fields: 'files(id, name, webViewLink, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ files: response.data.files || [] })
      };
    } else if (event.httpMethod === 'POST') {
      // Set active spreadsheet ID
      const { spreadsheetId, name } = JSON.parse(event.body);

      if (!spreadsheetId || !name) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Missing spreadsheetId or name.' })
        };
      }

      await store.setJSON('active-spreadsheet', {
        spreadsheetId,
        name,
        connectedAt: new Date().toISOString()
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: true, message: 'Spreadsheet connected successfully.' })
      };
    }

    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  } catch (error) {
    console.error('Spreadsheets handler error:', error);
    return {
      statusCode: error.message.includes('Unauthorized') ? 401 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
