import { google } from 'googleapis';
import { getStore } from '@netlify/blobs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

class LocalFileStore {
  constructor(name) {
    this.filePath = path.resolve(process.cwd(), `.local-store-${name}.json`);
  }

  async readData() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content || '{}');
      }
    } catch (err) {
      console.error('Error reading local file store:', err);
    }
    return {};
  }

  async writeData(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing local file store:', err);
    }
  }

  async getJSON(key) {
    const data = await this.readData();
    return data[key] !== undefined ? data[key] : null;
  }

  async setJSON(key, value) {
    const data = await this.readData();
    data[key] = value;
    await this.writeData(data);
  }

  async get(key) {
    const val = await this.getJSON(key);
    return val !== null ? String(val) : null;
  }

  async set(key, value) {
    await this.setJSON(key, value);
  }
}

export function getStorageStore(name) {
  // If running locally via Netlify CLI (NETLIFY_DEV is set) or if site ID is missing, fall back to local file storage
  const isLocalDev = process.env.NETLIFY_DEV === 'true' || !process.env.SITE_ID;
  
  if (isLocalDev) {
    return new LocalFileStore(name);
  }

  try {
    return getStore({ name });
  } catch (err) {
    console.warn(`Netlify getStore failed, falling back to local file storage: ${err.message}`);
    return new LocalFileStore(name);
  }
}

// Predefined Headers (source of truth from Code.js)
export const HEADERS = [
  'Business Name',
  'Website URL',
  'Address',
  'City',
  'Industry',
  'Notes',
  'Primary Email',
  'Other Emails',
  'Phone',
  'Contact Page',
  'Lead Score',
  'Lead Quality',
  'Quality Reason',
  'Recommended Angle',
  'Personalization Point',
  'Email Subject',
  'Email Draft',
  'Approved To Send',
  'Sent Status',
  'Sent At',
  'Follow Up Subject',
  'Follow Up Draft',
  'Approved To Send Follow Up',
  'Follow Up Sent Status',
  'Follow Up Sent At',
  'Last Checked',
];

export const CONFIG = {
  sheetName: 'Leads',
  maxPagesPerLead: 4,
  fetchTimeoutMs: 15000,
  minScoreToRecommend: 70,
  senderName: 'Prasha Infotech',
  senderEmail: 'sales@prashainfotech.com',
  bookingUrl: 'https://calendly.com/infotechprasha19/30min',
  websiteUrl: 'https://www.prashainfotech.com',
  phone: '+91 6377090502',
  location: 'Vadodara, Gujarat, India',
  linkedinUrl: 'https://www.linkedin.com/company/prasha-infotech',
  serviceOffer: 'IT services, support, automation, cloud, cybersecurity, and website/app solutions',
  defaultCta: 'You can book a free consultation here:',
};

// ==========================================
// SESSION & GOOGLE CLIENT HELPERS
// ==========================================

export function verifySession(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing token');
  }
  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-123456';
  try {
    return jwt.verify(token, jwtSecret);
  } catch (err) {
    throw new Error('Unauthorized: Invalid token');
  }
}

export async function getGoogleAuthClient() {
  const store = getStorageStore('lead-intelligence-store');
  const credentials = await store.getJSON('google-oauth-tokens');
  if (!credentials || !credentials.refresh_token) {
    throw new Error('Google account not connected. Please log in first.');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: credentials.refresh_token
  });

  return oauth2Client;
}

export async function getSheetDetails(sheets, spreadsheetId, store, forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = await store.getJSON(`sheet-details-${spreadsheetId}`);
      if (cached && cached.sheetName && cached.sheetId !== undefined) {
        return cached;
      }
    } catch (err) {
      console.warn('Error reading sheet details cache:', err.message);
    }
  }

  console.log(`Fetching spreadsheet metadata for ID: ${spreadsheetId}...`);
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = metadata.data.sheets || [];
  
  let targetSheet = sheetsList.find(s => s.properties.title === CONFIG.sheetName);
  if (!targetSheet && sheetsList.length > 0) {
    targetSheet = sheetsList[0];
  }
  
  if (!targetSheet) {
    throw new Error('No sheets found in the spreadsheet.');
  }

  const details = {
    sheetName: targetSheet.properties.title,
    sheetId: targetSheet.properties.sheetId
  };

  try {
    await store.setJSON(`sheet-details-${spreadsheetId}`, details);
  } catch (err) {
    console.warn('Error saving sheet details cache:', err.message);
  }
  
  return details;
}


export const HEADER_ALIASES = {
  'Business Name': ['business name', 'business', 'company', 'company name', 'client', 'name'],
  'Website URL': ['website url', 'url', 'website', 'site', 'domain'],
  'Address': ['address', 'street address', 'location', 'dress'],
  'City': ['city', 'town'],
  'Industry': ['industry', 'category', 'business type', 'type', 'niche'],
  'Notes': ['notes', 'note', 'description', 'remarks'],
  'Primary Email': ['primary email', 'email', 'email address', 'contact email'],
  'Other Emails': ['other emails', 'other email', 'emails'],
  'Phone': ['phone', 'phone number', 'mobile', 'telephone'],
  'Contact Page': ['contact page', 'contact url'],
  'Lead Score': ['lead score', 'score'],
  'Lead Quality': ['lead quality', 'quality'],
  'Quality Reason': ['quality reason', 'reason'],
  'Recommended Angle': ['recommended angle', 'angle'],
  'Personalization Point': ['personalization point', 'personalization'],
  'Email Subject': ['email subject', 'subject'],
  'Email Draft': ['email draft', 'draft'],
  'Approved To Send': ['approved to send', 'approved'],
  'Sent Status': ['sent status', 'email status', 'status'],
  'Sent At': ['sent at', 'sent time'],
  'Follow Up Subject': ['follow up subject', 'follow up email subject'],
  'Follow Up Draft': ['follow up draft', 'follow up email draft'],
  'Approved To Send Follow Up': ['approved to send follow up', 'approved follow up'],
  'Follow Up Sent Status': ['follow up sent status', 'follow up status', 'followup status'],
  'Follow Up Sent At': ['follow up sent at', 'follow up sent time'],
  'Last Checked': ['last checked', 'timestamp', 'last processed']
};

export function getHeaderMap(rawHeaders) {
  const map = {};
  rawHeaders.forEach((h, i) => {
    if (h) {
      const cleanH = String(h).trim().toLowerCase();
      // Find if exact match exists in HEADERS
      let matchedHeader = HEADERS.find(target => target.toLowerCase() === cleanH);
      
      // Fallback to alias match
      if (!matchedHeader) {
        matchedHeader = HEADERS.find(target => {
          const aliases = HEADER_ALIASES[target] || [];
          return aliases.includes(cleanH);
        });
      }
      
      if (matchedHeader) {
        map[matchedHeader] = i + 1;
      }
    }
  });
  return map;
}

export function isEmailSent(lead) {
  const status = String(lead['Sent Status'] || '').toLowerCase();
  return status.includes('sent') && !status.includes('not');
}

export function isFollowUpSent(lead) {
  const status = String(lead['Follow Up Sent Status'] || '').toLowerCase();
  return status.includes('sent') && !status.includes('not');
}

// ==========================================
// SHEET DATA MAPPING HELPERS
// ==========================================

export function mapRowToObj(rowValues, headersMap) {
  const obj = {};
  HEADERS.forEach((header) => {
    const colIndex = headersMap[header];
    if (colIndex !== undefined) {
      const val = rowValues[colIndex - 1];
      // Convert true/false strings or boolean representations to actual booleans for checkbox fields
      if (header === 'Approved To Send' || header === 'Approved To Send Follow Up') {
        obj[header] = val === true || String(val).toUpperCase() === 'TRUE';
      } else {
        obj[header] = val !== undefined && val !== null ? String(val).trim() : '';
      }
    } else {
      obj[header] = header === 'Approved To Send' || header === 'Approved To Send Follow Up' ? false : '';
    }
  });
  return obj;
}

export function mapObjToRow(obj, headersMap, maxColumns, originalRowValues = []) {
  const row = [...originalRowValues];
  while (row.length < maxColumns) {
    row.push('');
  }
  // Fill spreadsheet cells
  Object.keys(headersMap).forEach((header) => {
    const index = headersMap[header] - 1;
    if (index >= 0 && index < maxColumns) {
      row[index] = obj[header] !== undefined ? obj[header] : '';
    }
  });
  return row;
}

// ==========================================
// SCRAPER & ENRICHMENT ENGINE
// ==========================================

export async function fetchPage(url) {
  try {
    const res = await axios.get(url, {
      timeout: CONFIG.fetchTimeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 4,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return { url, html: res.data || '' };
  } catch (err) {
    throw new Error(`HTTP fetch failed for ${url}: ${err.message}`);
  }
}

export function extractLinks(html, baseUrl) {
  try {
    const $ = cheerio.load(html);
    const links = [];
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href) links.push(href.trim());
    });

    const uniqueLinks = [...new Set(links)];
    return uniqueLinks
      .filter(link => !/^mailto:|^tel:|^#|javascript:/i.test(link))
      .map(link => absolutizeUrl(link, baseUrl))
      .filter(link => link && sameHost(link, baseUrl));
  } catch (err) {
    return [];
  }
}

function absolutizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString().split('#')[0];
  } catch (err) {
    return '';
  }
}

function sameHost(url, baseUrl) {
  try {
    const hostA = new URL(url).hostname.replace(/^www\./i, '');
    const hostB = new URL(baseUrl).hostname.replace(/^www\./i, '');
    return hostA === hostB;
  } catch (err) {
    return false;
  }
}

export function normalizeUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function extractEmails(html) {
  const decoded = html
    .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
    .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
    .replace(/\s*\(\s*dot\s*\)\s*/gi, '.');
  const matches = decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map(e => e.toLowerCase().trim()))].filter(email => !isBadEmail(email));
}

export function extractPhones(html) {
  const text = stripHtml(html);
  const matches = text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}/g) || [];
  return [...new Set(matches.map(p => p.trim()).filter(p => p.replace(/\D/g, '').length >= 7))];
}

export function chooseBestEmail(emails) {
  const preferred = emails.find(email => /^(hello|info|contact|sales|support|admin)@/i.test(email));
  return preferred || emails[0] || '';
}

export function isBadEmail(email) {
  return /example\.com|domain\.com|email\.com|sentry|wixpress|schema|yourname|name@|test@|noreply|no-reply/i.test(email);
}

export function stripHtml(html) {
  try {
    const $ = cheerio.load(html);
    $('script, style, iframe, noscript').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
  } catch (err) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export async function scrapeLead(website, existingPhone) {
  const normalized = normalizeUrl(website);
  let home;
  try {
    home = await fetchPage(normalized);
  } catch (err) {
    throw new Error(`Homepage fetch failed: ${err.message}`);
  }

  const links = extractLinks(home.html, normalized);
  const contactLinks = links
    .filter(url => /contact|about|support|team|locations?|service/i.test(url))
    .slice(0, CONFIG.maxPagesPerLead - 1);

  const pages = [home];
  for (const url of contactLinks) {
    try {
      const page = await fetchPage(url);
      pages.push(page);
    } catch (err) {
      // Keep going if one secondary page fails
    }
  }

  const combinedHtml = pages.map(p => p.html).join('\n');
  const emails = extractEmails(combinedHtml);
  const phones = extractPhones(combinedHtml);
  
  const contactPage = pages.find(p => /contact/i.test(p.url))?.url || contactLinks[0] || '';
  const primaryEmail = chooseBestEmail(emails);
  const otherEmails = emails.filter(e => e !== primaryEmail);

  return {
    website: normalized,
    pagesFetched: pages.length,
    hasWebsite: true,
    primaryEmail,
    otherEmails,
    phone: phones[0] || existingPhone || '',
    contactPage,
    hasHttps: /^https:\/\//i.test(normalized),
    text: stripHtml(combinedHtml).slice(0, 12000),
  };
}

// ==========================================
// SCORING, ANGLE & PERSONALIZATION LOGIC
// ==========================================

export function scoreLead(result, address, city) {
  let score = 0;
  const reasons = [];
  const websiteText = (result.text || '').toLowerCase();
  const lowerAddress = String(address || '').toLowerCase();
  const lowerCity = String(city || '').toLowerCase();

  if (result.hasWebsite) {
    score += 20;
    reasons.push('website active');
  }
  if (result.primaryEmail) {
    score += 25;
    reasons.push('email found');
  }
  if (result.phone) {
    score += 15;
    reasons.push('phone found');
  }
  if (result.contactPage) {
    score += 10;
    reasons.push('contact/about page found');
  }
  if (result.hasHttps) {
    score += 5;
    reasons.push('uses HTTPS');
  }
  if (lowerCity && websiteText.includes(lowerCity)) {
    score += 10;
    reasons.push('city matches website');
  }
  if (lowerAddress && websiteText.includes(lowerAddress.split(',')[0])) {
    score += 10;
    reasons.push('address appears on website');
  }
  if (/managed it|cyber|cloud|network|software|website|automation|support|security|server|backup/i.test(result.text)) {
    score += 5;
    reasons.push('IT-relevant signals found');
  }

  score = Math.min(score, 100);
  const quality = score >= 80 ? 'High' : score >= 60 ? 'Medium' : score >= 40 ? 'Low' : 'Needs Review';
  
  return {
    score,
    quality,
    reason: reasons.join(', ') || 'limited public info found'
  };
}

export function recommendAngle(result) {
  const text = (result.text || '').toLowerCase();
  if (/wordpress|shopify|woocommerce|website|booking|ecommerce/.test(text)) {
    return 'Website performance, maintenance, SEO, and conversion improvements';
  }
  if (/clinic|doctor|dental|health|patient/.test(text)) {
    return 'Secure systems, appointment workflow automation, backups, and compliance-friendly IT support';
  }
  if (/restaurant|cafe|hotel|salon|spa/.test(text)) {
    return 'Local online presence, booking/order workflow, Wi-Fi, POS, and support reliability';
  }
  if (/manufacturing|construction|logistics|warehouse/.test(text)) {
    return 'Operations automation, device/network reliability, cloud backup, and security';
  }
  return 'Reliable IT support, automation, cybersecurity, cloud setup, and website/app improvements';
}

export function createPersonalizationPoint(result, industry, city, notes) {
  const lowerIndustry = String(industry || '').toLowerCase();
  const lowerCity = String(city || '');
  const rawNotes = String(notes || '');
  const rating = extractNoteValue(rawNotes, 'Rating');
  const reviews = extractNoteValue(rawNotes, 'Reviews');
  const text = String(result.text || '').toLowerCase();
  const place = lowerCity ? ` in ${lowerCity}` : '';

  const reviewsContext = rating || reviews 
    ? ` It looks like you've built a solid reputation there${rating ? ` (${rating} stars)` : ''}${reviews ? ` with ${reviews} reviews` : ''}, so ensuring a smooth booking and contact flow online is super valuable.` 
    : '';

  if (/toasttab|online order|order online|menu|reservation|delivery|pickup/.test(text) || /cafe|coffee|restaurant|food|bar|bakery/.test(lowerIndustry)) {
    return `how you manage reservations and online orders${place}.${reviewsContext}`;
  }
  if (/appointment|book now|schedule|service menu/.test(text) || /salon|spa|beauty|wellness/.test(lowerIndustry)) {
    return `your booking system${place}. Setting up frictionless online scheduling and automated reminders helps save a lot of admin work weekly.${reviewsContext}`;
  }
  if (/patient|clinic|doctor|dental|health|medical|insurance/.test(text) || /clinic|doctor|dental|medical|health/.test(lowerIndustry)) {
    return `your patient intake and scheduling workflows${place}. Simple secure forms, automatic backups, and seamless scheduling can make a big difference for staff and patients.${reviewsContext}`;
  }
  if (/shopify|woocommerce|cart|checkout|product|catalog|ecommerce/.test(text) || /shop|retail|store|ecommerce/.test(lowerIndustry)) {
    return `your ecommerce checkout flow${place}. Optimizing site speed, streamlining the catalog, and setting up automated abandoned-cart follow-ups are usually high-impact quick wins.${reviewsContext}`;
  }
  if (/portfolio|gallery|quote|estimate|project|construction|contractor/.test(text) || /construction|contractor|repair|service/.test(lowerIndustry)) {
    return `how you handle incoming quote requests${place}. Setting up quick automated follow-ups ensures that no hot lead gets missed.${reviewsContext}`;
  }
  if (result.contactPage || result.primaryEmail || result.phone) {
    return `how your website maps out contact and booking options. Connecting those forms into a simplified inquiry and automated follow-up workflow saves a lot of admin time.`;
  }
  
  return buildFallbackPersonalization('', industry, lowerCity, result.website);
}

export function buildFallbackPersonalization(businessName, industry, city, website) {
  const place = city ? ` in ${city}` : '';
  const category = industry ? `${industry} business` : 'business';
  if (website) {
    return `your online presence for the ${category}${place} to see if there are any quick ways to make it easier for clients to get in touch.`;
  }
  return `your current digital workflow to see how we could help with day-to-day IT support or automation.`;
}

export function extractNoteValue(notes, label) {
  const match = String(notes || '').match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
  return match ? match[1].trim() : '';
}

// ==========================================
// EMAIL DRAFT & HTML COMPILING LOGIC
// ==========================================

export function buildSubject(businessName, industry, angle) {
  const normalized = String(industry || angle || '').toLowerCase();
  const business = businessName || 'there';
  if (/cafe|coffee|restaurant|food|hotel|salon|spa/.test(normalized)) {
    return `${business} - quick question about your online booking/orders`;
  }
  if (/clinic|doctor|dental|medical|health/.test(normalized)) {
    return `${business} - secure IT workflow idea`;
  }
  if (/shop|retail|ecommerce|store/.test(normalized)) {
    return `${business} - website and automation idea`;
  }
  return `${business} - quick digital improvement idea`;
}

export function buildEmailDraft(lead) {
  const business = lead['Business Name'] || 'there';
  const angle = lead['Recommended Angle'] || CONFIG.serviceOffer;
  const website = lead['Website URL'] || '';
  const industry = lead['Industry'] || '';
  const city = lead['City'] || '';
  const personalization = lead['Personalization Point'] || buildFallbackPersonalization(business, industry, city, website);
  const subject = buildSubject(business, industry, angle);

  let intro = '';
  if (website) {
    intro = `I was checking out your website (${website}) and wanted to reach out directly.`;
  } else {
    const locationStr = city ? ` in ${city}` : '';
    intro = `I came across your business${locationStr} online and wanted to drop a line.`;
  }

  const body = [
    `Hi ${business} team,`,
    '',
    intro,
    '',
    `I was looking at ${personalization}`,
    '',
    `At Prasha Infotech, we help growing businesses like yours with ${angle.toLowerCase()}. Our focus is simple: keeping your systems secure, setting up backups, automating repetitive tasks, and building clean website/app solutions so your tech just works.`,
    '',
    `If it makes sense, we can do a quick review of your setup and share 2-3 practical, high-impact ideas.`,
    '',
    `${CONFIG.defaultCta} ${CONFIG.bookingUrl}`,
    '',
    `Best regards,`
  ].join('\n');

  return { subject, body };
}

export function buildFollowUpEmailDraft(lead) {
  const business = lead['Business Name'] || 'there';
  const angle = String(lead['Recommended Angle'] || '').toLowerCase();
  const personalization = String(lead['Personalization Point'] || '').toLowerCase();
  const firstSubject = String(lead['Email Subject'] || '').trim();
  const subject = firstSubject 
    ? (firstSubject.toLowerCase().startsWith('re:') ? firstSubject : `Re: ${firstSubject}`) 
    : `Following up - ${business}`;

  let followUpHook = '';
  
  if (/wordpress|shopify|woocommerce|website|booking|ecommerce|seo|performance|speed/.test(angle + ' ' + personalization)) {
    followUpHook = `I wanted to check if you've had a moment to look at whether improving your site speed or booking flow could help you convert more visitors into clients.`;
  } else if (/clinic|doctor|dental|health|patient|medical|secure|compliance/.test(angle + ' ' + personalization)) {
    followUpHook = `I wanted to check if securing your patient forms, setting up reliable backups, or streamlining clinic IT workflows is on your radar right now.`;
  } else if (/restaurant|cafe|hotel|salon|spa|local|order|wi-fi|pos/.test(angle + ' ' + personalization)) {
    followUpHook = `I wanted to check if you're open to streamlining your booking/ordering flow or improving your local online visibility to save your team some admin time.`;
  } else if (/manufacturing|construction|logistics|warehouse|operations|automation/.test(angle + ' ' + personalization)) {
    followUpHook = `I wanted to check if you've thought about automating some of your daily repetitive workflows or securing your operational files in the cloud.`;
  } else {
    followUpHook = `I wanted to check if you're open to a quick look at your current IT setup to see how we could help automate your workflows or secure your data.`;
  }

  const body = [
    `Hi ${business} team,`,
    '',
    `I wanted to send a quick note to follow up on my last email. I know how busy things get, so I'll keep this short.`,
    '',
    followUpHook,
    '',
    `If you're open to a quick 10-minute call next week to see if we can help optimize anything, feel free to grab a time here:`,
    `${CONFIG.bookingUrl}`,
    '',
    `Thanks,`
  ].join('\n');

  return { subject, body };
}

export function buildEmailHtml(plainDraft) {
  const paragraphs = plainDraft
    .split(/\n{2,}/)
    .filter(block => block.trim())
    .map(block =>
      `<p style="margin:0 0 14px;line-height:1.6;color:#233142;font-size:14px;">
        ${escapeHtml(block).replace(/\n/g, '<br>')}
      </p>`
    )
    .join('');

  return `
  <div style="background:#f5f5f5;padding:30px 15px;">
    <div style="max-width:700px;margin:auto;background:#ffffff;border-radius:10px;padding:25px;">
      ${paragraphs}
      <div style="margin-top:20px;">
        ${buildSignatureHtml()}
      </div>
    </div>
  </div>
  `;
}

export function buildFollowUpEmailHtml(plainDraft) {
  return buildEmailHtml(plainDraft);
}

export function buildSignatureHtml() {
  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; min-width:280px; font-family:'Segoe UI',Arial,sans-serif; background:#ffffff; border-collapse:collapse;">
    <tr>
        <!-- ============ LEFT BRAND PANEL (dark navy + gold) ============ -->
        <td width="185" bgcolor="#0d1b2a"
        style="padding:28px 18px; vertical-align:middle; text-align:center;">

        <!-- Brand mark – small diamond accent -->
        <div style="color:#caa13d; font-size:11px; letter-spacing:6px; margin-bottom:6px;">◆</div>

        <!-- Company name – typographic "logo" -->
        <div style="color:#caa13d; font-size:22px; font-weight:700; letter-spacing:4px; line-height:1.2;">PRASHA</div>
        <div style="color:#caa13d; font-size:15px; font-weight:300; letter-spacing:6px; line-height:1.2; margin-top:1px;">INFOTECH</div>

        <!-- Gold divider -->
        <div style="border-top:2px solid #caa13d; width:44px; margin:14px auto 12px;"></div>

        <!-- Unique tagline -->
        <div style="color:#d4c5a9; font-size:10px; letter-spacing:2px; text-transform:uppercase; line-height:18px; font-weight:400;">
            Innovating<br>Beyond<br>Boundaries
        </div>

        <!-- Small decorative line at bottom -->
        <div style="margin-top:16px; color:#caa13d; font-size:9px; letter-spacing:4px;">✦ ✦ ✦</div>
    </td>

    <!-- Gold vertical divider -->
    <td width="4" bgcolor="#caa13d" style="padding:0; font-size:0; line-height:0;">&nbsp;</td>

    <!-- ============ RIGHT INFO PANEL (white) ============ -->
    <td style="padding:26px 28px 22px 28px; vertical-align:middle; background:#ffffff;">

        <!-- Department Name -->
        <div style="font-size:24px; font-weight:700; color:#0d1b2a; letter-spacing:0.5px; line-height:1.2;">
            Sales Team
        </div>

        <!-- Title + gold accent -->
        <div style="font-size:13px; color:#caa13d; font-weight:600; letter-spacing:1.8px; text-transform:uppercase; margin-top:2px; border-bottom:1px solid #f0e8d8; padding-bottom:12px;">
            Business Development &nbsp;•&nbsp; Prasha Infotech
        </div>

        <!-- Contact details -->
        <div style="margin-top:14px; color:#4a4a4a; font-size:13px; line-height:24px; letter-spacing:0.2px;">
            &#9742; +91 6377090502<br>
            &#9993; <a href="mailto:sales@prashainfotech.com" style="color:#4a4a4a; text-decoration:none;">sales@prashainfotech.com</a><br>
            &#127760; <a href="https://www.prashainfotech.com" style="color:#4a4a4a; text-decoration:none;">www.prashainfotech.com</a><br>
            &#9873;  Vadodara, Gujarat, India
        </div>

        <!-- CTA Button -->
        <div style="margin-top:18px;">
            <a href="https://calendly.com/infotechprasha19/30min"
            style="
            background:#caa13d;
            color:#ffffff;
            text-decoration:none;
            padding:11px 22px;
            border-radius:50px;
            font-size:13px;
            font-weight:600;
            display:inline-block;
            letter-spacing:0.5px;
            border:1px solid #caa13d;
            ">&#128197; &nbsp;Book a Free Consultation</a>
        </div>

        <!-- Social – LinkedIn only -->
        <div style="margin-top:16px; font-size:13px;">
            <a href="https://www.linkedin.com/company/prasha-infotech"
            style="
            text-decoration:none;
            color:#0d1b2a;
            font-weight:500;
            letter-spacing:0.3px;
            ">&#128279; &nbsp;Connect on LinkedIn</a>
        </div>

        <!-- Bottom tagline + services -->
        <div style="margin-top:16px; padding-top:12px; border-top:1px solid #f0e8d8; font-size:11px; color:#888; line-height:17px; letter-spacing:0.3px;">
            <span style="color:#caa13d; font-weight:600;">Your Partner in Digital Transformation.</span><br>
            Web Development &nbsp;•&nbsp; AI Solutions &nbsp;•&nbsp; Branding &nbsp;•&nbsp; Automation
        </div>
    </td>
</tr>
</table>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
