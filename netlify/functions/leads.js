import { google } from 'googleapis';
import { 
  verifySession, 
  getGoogleAuthClient, 
  HEADERS, 
  CONFIG,
  mapRowToObj, 
  mapObjToRow, 
  scrapeLead, 
  scoreLead, 
  recommendAngle, 
  createPersonalizationPoint,
  buildEmailDraft,
  buildFollowUpEmailDraft,
  buildEmailHtml,
  buildFollowUpEmailHtml,
  getStorageStore,
  getHeaderMap,
  getSheetDetails,
  isEmailSent,
  isFollowUpSent
} from './utils.js';
import dotenv from 'dotenv';

dotenv.config();

// Helper to convert column number to letter
function getColumnLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    let modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}

// Helper to construct a raw MIME message for Gmail API
function createMimeMessage({ to, from, subject, body, html }) {
  const boundary = '____boundary____';
  
  // Format From header with friendly name
  const fromHeader = CONFIG.senderName ? `"${CONFIG.senderName}" <${from}>` : from;

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ];

  const partHeaders = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body).toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
    '',
    `--${boundary}--`
  ];

  const email = [...headers, ...partHeaders].join('\r\n');
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

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

    const store = getStorageStore('lead-intelligence-store');
    const activeSpreadsheet = await store.getJSON('active-spreadsheet');

    if (!activeSpreadsheet || !activeSpreadsheet.spreadsheetId) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ leads: [], error: 'No spreadsheet connected' })
      };
    }

    const { spreadsheetId } = activeSpreadsheet;
    const oauth2Client = await getGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    let sheetDetails;
    try {
      sheetDetails = await getSheetDetails(sheets, spreadsheetId, store);
    } catch (err) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `Failed to resolve sheet details: ${err.message}` })
      };
    }
    let { sheetName, sheetId } = sheetDetails;

    // ==========================================
    // GET: FETCH LEADS
    // ==========================================
    if (event.httpMethod === 'GET') {
      let response;
      try {
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z` // fetch columns A to Z
        });
      } catch (err) {
        console.warn(`GET leads: failed with sheetName ${sheetName}, retrying with fresh metadata:`, err.message);
        const fresh = await getSheetDetails(sheets, spreadsheetId, store, true);
        sheetName = fresh.sheetName;
        sheetId = fresh.sheetId;
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
      }

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ leads: [], headers: [], sheetName })
        };
      }

      const rawHeaders = rows[0];
      const headersMap = getHeaderMap(rawHeaders);

      const leads = rows.slice(1).map((row, i) => {
        const lead = mapRowToObj(row, headersMap);
        lead.rowNumber = i + 2; // Row number 1-indexed, starting after header row (row 2)
        return lead;
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ leads, headers: rawHeaders, sheetName })
      };
    }

    // ==========================================
    // POST: ACTIONS
    // ==========================================
    if (event.httpMethod === 'POST') {
      const { action, payload } = JSON.parse(event.body);

      // 1. SETUP SHEET
      if (action === 'setupSheet') {
        let response;
        try {
          response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:Z1`
          });
        } catch (err) {
          console.warn(`setupSheet: failed to get headers, retrying with fresh metadata: ${err.message}`);
          const fresh = await getSheetDetails(sheets, spreadsheetId, store, true);
          sheetName = fresh.sheetName;
          sheetId = fresh.sheetId;
          response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:Z1`
          });
        }

        const existingHeaders = (response.data.values && response.data.values[0]) || [];
        const existingHeadersMap = getHeaderMap(existingHeaders);
        const missingHeaders = HEADERS.filter(h => existingHeadersMap[h] === undefined);

        let currentLastColumn = existingHeaders.length;
        
        if (existingHeaders.length === 0) {
          // If empty, write all headers
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [HEADERS] }
          });
          currentLastColumn = HEADERS.length;
        } else if (missingHeaders.length > 0) {
          // Append missing headers
          const startCol = getColumnLetter(currentLastColumn + 1);
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!${startCol}1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [missingHeaders] }
          });
          currentLastColumn += missingHeaders.length;
        }

        // Fetch headers again to compile map
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!1:1`
        });
        const currentHeaders = headerResponse.data.values[0] || [];
        const headersMap = getHeaderMap(currentHeaders);

        const approvedCol = headersMap['Approved To Send'];
        const approvedFollowUpCol = headersMap['Approved To Send Follow Up'];

        // Format Header formatting and validations (Checkboxes)
        const batchRequests = [
          // Format header row (Navy background, bold white text)
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: currentLastColumn
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.09, green: 0.2, blue: 0.3 }, // Navy #17324D
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          }
        ];

        // Format checkboxes
        if (approvedCol) {
          batchRequests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: approvedCol - 1,
                endColumnIndex: approvedCol
              },
              cell: {
                dataValidation: {
                  condition: { type: 'BOOLEAN' },
                  showCustomUi: true
                }
              },
              fields: 'dataValidation'
            }
          });
        }

        if (approvedFollowUpCol) {
          batchRequests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: approvedFollowUpCol - 1,
                endColumnIndex: approvedFollowUpCol
              },
              cell: {
                dataValidation: {
                  condition: { type: 'BOOLEAN' },
                  showCustomUi: true
                }
              },
              fields: 'dataValidation'
            }
          });
        }

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: batchRequests }
        });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, message: 'Sheet configured successfully.' })
        };
      }

      // Helper to fetch current header maps for following actions
      let headerResponse;
      try {
        headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!1:1`
        });
      } catch (err) {
        console.warn(`POST actions: failed to get headers, retrying with fresh metadata: ${err.message}`);
        const fresh = await getSheetDetails(sheets, spreadsheetId, store, true);
        sheetName = fresh.sheetName;
        sheetId = fresh.sheetId;
        headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!1:1`
        });
      }
      const currentHeaders = headerResponse.data.values[0] || [];
      const headersMap = getHeaderMap(currentHeaders);

      // 2. UPDATE CELL VALUES (e.g. checkbox toggles or inline edits)
      if (action === 'updateCells') {
        const { updates } = payload; // [{ rowNumber, colName, value }]
        const data = updates.map(({ rowNumber, colName, value }) => {
          const colIndex = headersMap[colName];
          if (!colIndex) throw new Error(`Column "${colName}" not found in sheet.`);
          const colLetter = getColumnLetter(colIndex);
          return {
            range: `${sheetName}!${colLetter}${rowNumber}`,
            values: [[value]]
          };
        });

        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data
          }
        });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true })
        };
      }

      // 3. ENRICH LEADS (CHUNKS)
      if (action === 'enrichLeads') {
        const { rowsToProcess } = payload; // Array of row numbers
        const results = [];
        const updates = [];

        // Fetch sheet rows to get existing details
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
        const allRows = response.data.values || [];
        if (allRows.length === 0) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, results: [] })
          };
        }

        // Use headers from row 0 directly to avoid an extra API call
        const actionHeadersMap = getHeaderMap(allRows[0]);

        for (const rowNum of rowsToProcess) {
          const rowValues = allRows[rowNum - 1] || [];
          const lead = mapRowToObj(rowValues, actionHeadersMap);
          const website = lead['Website URL'];

          // Skip if no website or if email has already been sent/processed
          if (!website || isEmailSent(lead) || isFollowUpSent(lead)) {
            results.push({ rowNumber: rowNum, status: 'skipped', reason: 'Missing website or email already sent.' });
            continue;
          }

          try {
            // Scrape
            const result = await scrapeLead(website, lead['Phone']);
            // Score
            const score = scoreLead(result, lead['Address'], lead['City']);
            // Recommend Outreach Angle
            const angle = recommendAngle(result);
            // Personalization
            const personalization = createPersonalizationPoint(result, lead['Industry'], lead['City'], lead['Notes']);

            lead['Primary Email'] = result.primaryEmail || '';
            lead['Other Emails'] = result.otherEmails.join(', ');
            if (result.phone) lead['Phone'] = String(result.phone);
            lead['Contact Page'] = result.contactPage || '';
            lead['Lead Score'] = score.score;
            lead['Lead Quality'] = score.quality;
            lead['Quality Reason'] = score.reason;
            lead['Recommended Angle'] = angle;
            lead['Personalization Point'] = personalization;
            lead['Last Checked'] = new Date().toISOString();

            results.push({ rowNumber: rowNum, status: 'success', score: score.score, quality: score.quality });
          } catch (err) {
            lead['Lead Quality'] = 'Needs Review';
            lead['Quality Reason'] = `Enrichment failed: ${err.message}`;
            lead['Last Checked'] = new Date().toISOString();
            results.push({ rowNumber: rowNum, status: 'error', error: err.message });
          }

          // Convert back to row array, preserving other columns
          const maxCols = Math.max(allRows[0].length, HEADERS.length);
          const updatedRow = mapObjToRow(lead, actionHeadersMap, maxCols, rowValues);

          // Write updates back
          updates.push({
            range: `${sheetName}!A${rowNum}:${getColumnLetter(maxCols)}${rowNum}`,
            values: [updatedRow]
          });
        }

        if (updates.length > 0) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: updates
            }
          });
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, results })
        };
      }

      // 4. DRAFT EMAILS (CHUNKS)
      if (action === 'draftEmails') {
        const { rowsToProcess, draftType } = payload; // draftType: 'first' or 'followup'
        const updates = [];

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
        const allRows = response.data.values || [];
        if (allRows.length === 0) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true })
          };
        }

        const actionHeadersMap = getHeaderMap(allRows[0]);

        for (const rowNum of rowsToProcess) {
          const rowValues = allRows[rowNum - 1] || [];
          const lead = mapRowToObj(rowValues, actionHeadersMap);

          if (draftType === 'first') {
            // Lock first email drafting if it is already sent
            if (isEmailSent(lead)) {
              continue;
            }
            const draft = buildEmailDraft(lead);
            lead['Email Subject'] = draft.subject;
            lead['Email Draft'] = draft.body;
          } else {
            // Lock follow-up drafting if follow-up already sent or first email NOT sent yet
            if (isFollowUpSent(lead) || !isEmailSent(lead)) {
              continue;
            }
            const draft = buildFollowUpEmailDraft(lead);
            lead['Follow Up Subject'] = draft.subject;
            lead['Follow Up Draft'] = draft.body;
          }

          const maxCols = Math.max(allRows[0].length, HEADERS.length);
          const updatedRow = mapObjToRow(lead, actionHeadersMap, maxCols, rowValues);

          updates.push({
            range: `${sheetName}!A${rowNum}:${getColumnLetter(maxCols)}${rowNum}`,
            values: [updatedRow]
          });
        }

        if (updates.length > 0) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: updates
            }
          });
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true })
        };
      }

      // 5. SEND APPROVED EMAILS (CHUNKS)
      if (action === 'sendEmails') {
        const { rowsToProcess } = payload; // Array of row numbers
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
        const allRows = response.data.values || [];
        if (allRows.length === 0) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, results: [] })
          };
        }

        const actionHeadersMap = getHeaderMap(allRows[0]);
        const results = [];
        const updates = [];

        // Sending alias configured from env or default alias
        const senderEmail = CONFIG.senderEmail;

        for (const rowNum of rowsToProcess) {
          const rowValues = allRows[rowNum - 1] || [];
          const lead = mapRowToObj(rowValues, actionHeadersMap);

          const toEmail = lead['Primary Email'];
          
          // Verify what type of email we are sending (First vs Follow-up)
          const approvedFirst = lead['Approved To Send'] === true;
          const sentFirst = isEmailSent(lead);
          const approvedFollowUp = lead['Approved To Send Follow Up'] === true;
          const sentFollowUp = isFollowUpSent(lead);

          let mailType = '';
          let subject = '';
          let body = '';
          let html = '';

          if (approvedFirst && !sentFirst && lead['Email Subject'] && lead['Email Draft']) {
            mailType = 'first';
            subject = lead['Email Subject'];
            body = lead['Email Draft'];
            html = buildEmailHtml(body);
          } else if (approvedFollowUp && !sentFollowUp && lead['Follow Up Subject'] && lead['Follow Up Draft']) {
            mailType = 'followup';
            subject = lead['Follow Up Subject'];
            body = lead['Follow Up Draft'];
            html = buildFollowUpEmailHtml ? buildFollowUpEmailHtml(body) : buildEmailHtml(body);
          }

          if (!mailType || !toEmail || !subject || !body) {
            results.push({ rowNumber: rowNum, status: 'skipped', reason: 'Not approved, already sent, or missing draft.' });
            continue;
          }

          try {
            // Build RFC 2822 email message
            const rawMessage = createMimeMessage({
              to: toEmail,
              from: senderEmail,
              subject,
              body,
              html
            });

            // Send via Gmail API
            await gmail.users.messages.send({
              userId: 'me',
              requestBody: { raw: rawMessage }
            });

            // Update statuses to match dropdown option 'Email Sent'
            if (mailType === 'first') {
              lead['Sent Status'] = 'Email Sent';
              lead['Sent At'] = new Date().toISOString();
            } else {
              lead['Follow Up Sent Status'] = 'Email Sent';
              lead['Follow Up Sent At'] = new Date().toISOString();
            }

            results.push({ rowNumber: rowNum, status: 'success', type: mailType });
          } catch (err) {
            console.error(`Gmail send error for row ${rowNum}:`, err);
            lead['Quality Reason'] = `Email send error (${mailType}): ${err.message}`;
            results.push({ rowNumber: rowNum, status: 'error', error: err.message });
          }

          const maxCols = Math.max(allRows[0].length, HEADERS.length);
          const updatedRow = mapObjToRow(lead, actionHeadersMap, maxCols, rowValues);

          updates.push({
            range: `${sheetName}!A${rowNum}:${getColumnLetter(maxCols)}${rowNum}`,
            values: [updatedRow]
          });
        }

        if (updates.length > 0) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: updates
            }
          });
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, results })
        };
      }

      // 6. DELETE DUPLICATES
      if (action === 'deleteDuplicates') {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
        const allRows = response.data.values || [];

        if (allRows.length < 2) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, deletedCount: 0 })
          };
        }

        const seen = new Set();
        const rowsToDelete = []; // 0-indexed row indices

        allRows.slice(1).forEach((row, i) => {
          const rowNumber = i + 2;
          const lead = mapRowToObj(row, headersMap);

          const business = String(lead['Business Name'] || '').trim().toLowerCase();
          const website = String(lead['Website URL'] || '')
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '');
          const email = String(lead['Primary Email'] || '').trim().toLowerCase();

          const key = website || email || business;
          if (!key) return;

          if (seen.has(key)) {
            rowsToDelete.push(rowNumber - 1); // sheet delete index is 0-indexed relative to grid dimension
          } else {
            seen.add(key);
          }
        });

        if (rowsToDelete.length > 0) {
          // Sort descending to avoid index shifting when deleting
          rowsToDelete.sort((a, b) => b - a);

          const requests = rowsToDelete.map(index => ({
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: index,
                endIndex: index + 1
              }
            }
          }));

          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
          });
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, deletedCount: rowsToDelete.length })
        };
      }

      // 7. IMPORT CSV LEADS
      if (action === 'importCsv') {
        const { leads } = payload; // Array of lead objects
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:Z1`
        });
        const existingHeaders = (response.data.values && response.data.values[0]) || [];

        // Check columns to map and write
        const maxCols = Math.max(existingHeaders.length, HEADERS.length);
        const rowsToAppend = leads.map(lead => {
          // Fill template empty items
          const completeLead = { ...lead };
          HEADERS.forEach(h => {
            if (completeLead[h] === undefined) {
              completeLead[h] = h === 'Approved To Send' || h === 'Approved To Send Follow Up' ? false : '';
            }
          });
          return mapObjToRow(completeLead, headersMap, maxCols);
        });

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: rowsToAppend }
        });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, importedCount: leads.length })
        };
      }
    }

    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  } catch (error) {
    console.error('Leads handler error:', error);
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
