import { verifySession, getStorageStore } from './utils.js';
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  try {
    // Verify session
    const decoded = verifySession(event);

    const store = getStorageStore('lead-intelligence-store');
    
    // Fetch OAuth tokens meta
    const tokens = await store.getJSON('google-oauth-tokens');
    const activeSpreadsheet = await store.getJSON('active-spreadsheet');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        authenticated: !!tokens,
        email: tokens?.email || decoded.email,
        name: tokens?.name || '',
        activeSpreadsheet: activeSpreadsheet || null
      })
    };
  } catch (error) {
    console.error('user-info error:', error);
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
