import { schedule } from '@netlify/functions';
import { google } from 'googleapis';
import { 
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
  buildSignatureHtml,
  getStorageStore
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

// Helper to construct MIME message for Gmail
function createMimeMessage({ to, from, subject, body, html }) {
  const boundary = '____boundary____';
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

const syncHandler = async (event, context) => {
  console.log('Scheduled Sync: Starting execution at', new Date().toISOString());

  try {
    const store = getStorageStore('lead-intelligence-store');
    const activeSpreadsheet = await store.getJSON('active-spreadsheet');

    if (!activeSpreadsheet || !activeSpreadsheet.spreadsheetId) {
      console.log('Scheduled Sync: No spreadsheet connected. Exiting.');
      return { statusCode: 200 };
    }

    const { spreadsheetId } = activeSpreadsheet;
    const oauth2Client = await getGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch sheet list
    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = metadata.data.sheets || [];
    let targetSheet = sheetsList.find(s => s.properties.title === CONFIG.sheetName);
    if (!targetSheet && sheetsList.length > 0) {
      targetSheet = sheetsList[0];
    }

    if (!targetSheet) {
      console.warn('Scheduled Sync: No sheet found. Exiting.');
      return { statusCode: 200 };
    }

    const sheetName = targetSheet.properties.title;

    // Fetch all values
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.log('Scheduled Sync: Spreadsheet is empty. Exiting.');
      return { statusCode: 200 };
    }

    const rawHeaders = rows[0];
    const headersMap = {};
    rawHeaders.forEach((header, index) => {
      if (header) headersMap[String(header).trim()] = index + 1;
    });

    const leads = rows.slice(1).map((row, i) => {
      const lead = mapRowToObj(row, headersMap);
      lead.rowNumber = i + 2;
      return lead;
    });

    console.log(`Scheduled Sync: Found ${leads.length} total lead rows.`);

    // 1. PROCESS UNCHECKED LEADS (Enrichment + Initial Drafting)
    // Limit to 5 leads per scheduled run to keep execution times safely within serverless limits
    const maxEnrichmentLimit = 5;
    let enrichmentCount = 0;
    const updates = [];

    for (const lead of leads) {
      if (enrichmentCount >= maxEnrichmentLimit) break;

      const website = lead['Website URL'];
      const lastChecked = lead['Last Checked'];

      // Process only if website is present and we haven't checked it yet
      if (website && !lastChecked) {
        enrichmentCount++;
        console.log(`Scheduled Sync: Enriching lead row ${lead.rowNumber} (${website})`);

        try {
          // Scrape
          const result = await scrapeLead(website, lead['Phone']);
          // Score
          const score = scoreLead(result, lead['Address'], lead['City']);
          // Angle
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

          // Auto draft email if score is good enough
          if (score.score >= CONFIG.minScoreToRecommend && lead['Primary Email']) {
            const draft = buildEmailDraft(lead);
            lead['Email Subject'] = draft.subject;
            lead['Email Draft'] = draft.body;
            console.log(`Scheduled Sync: Auto-drafted first email for row ${lead.rowNumber}`);
          }
        } catch (err) {
          console.error(`Scheduled Sync: Enrichment failed for row ${lead.rowNumber}:`, err.message);
          lead['Lead Quality'] = 'Needs Review';
          lead['Quality Reason'] = `Sync Enrichment failed: ${err.message}`;
          lead['Last Checked'] = new Date().toISOString();
        }

        const maxCols = Math.max(rawHeaders.length, HEADERS.length);
        const updatedRow = mapObjToRow(lead, headersMap, maxCols);

        updates.push({
          range: `${sheetName}!A${lead.rowNumber}:${getColumnLetter(maxCols)}${lead.rowNumber}`,
          values: [updatedRow]
        });
      }
    }

    // 2. SEND APPROVED EMAILS AND FOLLOW UPS
    // Limit sending to max 5 emails per scheduled run
    const maxSendLimit = 5;
    let sendCount = 0;
    const senderEmail = CONFIG.senderEmail;

    for (const lead of leads) {
      if (sendCount >= maxSendLimit) break;

      const toEmail = lead['Primary Email'];
      const approvedFirst = lead['Approved To Send'] === true;
      const sentFirst = lead['Sent Status'].toLowerCase() === 'sent';
      const approvedFollowUp = lead['Approved To Send Follow Up'] === true;
      const sentFollowUp = lead['Follow Up Sent Status'].toLowerCase() === 'sent';

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
        html = buildEmailHtml(body);
      }

      if (mailType && toEmail && subject && body) {
        sendCount++;
        console.log(`Scheduled Sync: Sending ${mailType} email to row ${lead.rowNumber} (${toEmail})`);

        try {
          const rawMessage = createMimeMessage({
            to: toEmail,
            from: senderEmail,
            subject,
            body,
            html
          });

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: rawMessage }
          });

          if (mailType === 'first') {
            lead['Sent Status'] = 'Sent';
            lead['Sent At'] = new Date().toISOString();
          } else {
            lead['Follow Up Sent Status'] = 'Sent';
            lead['Follow Up Sent At'] = new Date().toISOString();
          }
        } catch (err) {
          console.error(`Scheduled Sync: Gmail send error for row ${lead.rowNumber}:`, err.message);
          lead['Quality Reason'] = `Sync send error (${mailType}): ${err.message}`;
        }

        const maxCols = Math.max(rawHeaders.length, HEADERS.length);
        const updatedRow = mapObjToRow(lead, headersMap, maxCols);

        updates.push({
          range: `${sheetName}!A${lead.rowNumber}:${getColumnLetter(maxCols)}${lead.rowNumber}`,
          values: [updatedRow]
        });
      }
    }

    // Write all updates to the Google Sheet
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      console.log(`Scheduled Sync: Updated ${updates.length} rows in spreadsheet.`);
    }

    // Record last successful sync timestamp in Blobs
    await store.setJSON('sync-meta', {
      lastSyncTime: new Date().toISOString(),
      enrichedCount: enrichmentCount,
      sentCount: sendCount
    });

    console.log('Scheduled Sync: Completed successfully.');
    return { statusCode: 200 };
  } catch (error) {
    console.error('Scheduled Sync: Execution crashed:', error);
    return { statusCode: 500, body: error.message };
  }
};

export const handler = schedule('*/10 * * * *', syncHandler);
