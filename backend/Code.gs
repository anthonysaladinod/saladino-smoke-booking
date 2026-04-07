/**
 * Saladino Smoke Catering — Google Apps Script Backend
 *
 * SETUP (do this once, in order):
 *
 * 1. Open script.google.com > New Project > name it "Saladino Smoke Booking"
 * 2. Paste this entire file into the editor (replace any existing code)
 * 3. Add the OAuth2 library:
 *      Extensions > Libraries > paste this ID > Add:
 *      1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
 * 4. Fill in CALENDAR_ID below (get it from Google Calendar > Settings > your catering calendar)
 * 5. Run createBookingSpreadsheet() — it logs the new spreadsheet ID. Paste that ID into SHEET_ID below.
 * 6. Fill in QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_COMPANY_ID (see QuickBooks setup below)
 * 7. Deploy > New Deployment > Web App
 *      Execute as: Me
 *      Who has access: Anyone
 * 8. Copy the deployment URL > paste into app.js CONFIG.BACKEND_URL
 * 9. Run authorizeQBO() > open the logged URL in your browser > sign in to QuickBooks
 *
 * QUICKBOOKS SETUP (one-time):
 *   a. Go to developer.intuit.com > sign in with your QBO account > Create an App
 *   b. Name: "Saladino Smoke Booking"  |  Scope: Accounting + Payments
 *   c. Keys & OAuth > copy Client ID and Client Secret > paste below
 *   d. Add your Apps Script URL as a Redirect URI:
 *      Format: https://script.google.com/macros/d/{SCRIPT_ID}/usercallback
 *      (Script ID is in Project Settings in the Apps Script editor)
 *   e. In QBO: go to your company > Settings > Company ID (paste into QBO_COMPANY_ID below)
 *
 * This script handles:
 *   - Date availability checks against Google Calendar
 *   - Booking submission: Sheets logging + Calendar event + Email notifications + QBO invoice
 */

// ═══ CONFIGURATION — FILL THESE IN ═══════════════════════════════════════════

const CALENDAR_ID      = 'primary';               // Paste your catering calendar ID here
const SHEET_ID         = '';                       // Paste the ID from createBookingSpreadsheet()
const SHEET_NAME       = 'Saladino Smoke \u2014 Booking Dashboard'; // Sheet tab name
const NOTIFICATION_EMAIL  = 'catering@saladinosmoke.com';
const CUSTOMER_FROM_NAME  = 'Saladino Smoke Catering';

// QuickBooks Online credentials
const QBO_CLIENT_ID    = '';                       // From developer.intuit.com
const QBO_CLIENT_SECRET = '';                      // From developer.intuit.com
const QBO_COMPANY_ID   = '';                       // Your QBO company/realm ID
const QBO_SANDBOX      = false;                    // true = sandbox, false = production

// ═══ WEB APP ENTRY POINTS ════════════════════════════════════════════════════

function doPost(e) {
  const action = e.parameter.action;
  const data = JSON.parse(e.postData.contents);

  let result;
  switch (action) {
    case 'checkDate':
      result = checkDateAvailability(data);
      break;
    case 'submitBooking':
      result = submitBooking(data);
      break;
    default:
      result = { error: 'Unknown action: ' + action };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Saladino Smoke Booking API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══ DATE AVAILABILITY CHECK ═════════════════════════════════════════════════

function checkDateAvailability(data) {
  try {
    const date = new Date(data.date + 'T00:00:00');
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const events = calendar.getEvents(startOfDay, endOfDay);

    const hasBooking = events.some(event => {
      const title = event.getTitle().toLowerCase();
      return title.includes('catering') ||
             title.includes('booking') ||
             title.includes('event') ||
             title.includes('saladino') ||
             title.includes('[catering]');
    });

    return { available: !hasBooking };
  } catch (error) {
    Logger.log('Date check error: ' + error.message);
    return { available: true, warning: 'Could not verify availability. Please call to confirm.' };
  }
}

// ═══ BOOKING SUBMISSION ══════════════════════════════════════════════════════

function submitBooking(data) {
  try {
    // 1. Write to Google Sheets
    const bookingId = writeToSheet(data);

    // 2. Create Google Calendar event (marked red — pending deposit)
    createCalendarEvent(data, bookingId);

    // 3. Send internal notification email to catering@saladinosmoke.com
    sendInternalNotification(data, bookingId);

    // 4. Send styled confirmation email to the customer
    sendCustomerConfirmation(data, bookingId);

    // 5. Create QuickBooks invoice for $100 deposit (if configured)
    let paymentUrl = null;
    if (QBO_CLIENT_ID && QBO_CLIENT_SECRET && QBO_COMPANY_ID) {
      paymentUrl = createQuickBooksInvoice(data, bookingId);
    }

    return {
      success: true,
      bookingId: bookingId,
      paymentUrl: paymentUrl    // Frontend redirects here for the $100 deposit
    };
  } catch (error) {
    Logger.log('Booking submission error: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ═══ GOOGLE SHEETS ═══════════════════════════════════════════════════════════

function writeToSheet(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Booking ID', 'Status', 'Submitted',
      'First Name', 'Last Name', 'Email', 'Phone',
      'Event Type', 'Event Date', 'Start Time', 'End Time',
      'Guest Count', 'Service Type', 'Venue', 'Address',
      'Menu Tier', 'Combo', 'Meats', 'Sides', 'Sauces',
      'Additional Items', 'Custom Requests',
      'Subtotal', 'Tax', 'Service Fee', 'Estimated Total',
      'Contract Signed', 'Deposit Paid',
      'Lead Source', 'Notes'
    ]);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const bookingId = 'SS-' +
    Utilities.formatDate(new Date(), 'America/Chicago', 'yyyyMMdd') + '-' +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  const order = data.orderEstimate || {};
  const combo = data.selectedCombo
    ? data.selectedCombo.label + ' (' + data.selectedCombo.desc + ')'
    : 'A-La-Carte';
  const meats  = (data.selectedMeats  || []).join(', ');
  const sides  = (data.selectedSides  || []).join(', ');
  const sauces = (data.selectedSauces || []).join(', ');

  const extras = [];
  for (const [name, qty] of Object.entries(data.additionalMeats || {})) {
    if (qty > 0) extras.push(name + ' x' + qty);
  }
  for (const [name, qty] of Object.entries(data.addOnTrays || {})) {
    if (qty > 0) extras.push(name + ' x' + qty);
  }
  for (const [name, qty] of Object.entries(data.charcuterie || {})) {
    if (qty > 0) extras.push(name);
  }
  for (const [name, qty] of Object.entries(data.alacarteMeats || {})) {
    if (qty > 0) extras.push(name + ' x' + qty);
  }
  for (const [name, size] of Object.entries(data.alacarteSides || {})) {
    extras.push(name + ' (' + size + ' tray)');
  }

  sheet.appendRow([
    bookingId,
    'Pending',
    new Date(),
    data.firstName,
    data.lastName,
    data.email,
    data.phone,
    data.eventTypeLabel,
    data.eventDate,
    data.startTime,
    data.endTime || '',
    data.guestCount,
    data.serviceType,
    data.venueName,
    data.eventAddress,
    data.menuTier,
    combo,
    meats,
    sides,
    sauces,
    extras.join('; '),
    data.customRequests || '',
    order.subtotal    || 0,
    order.tax         || 0,
    order.serviceFee  || 0,
    order.total       || 0,
    data.contractAgreed ? 'Yes' : 'No',
    'No',               // Deposit Paid — updated manually after QBO payment received
    data.leadSource || '',
    data.notes      || ''
  ]);

  return bookingId;
}

// ═══ GOOGLE CALENDAR ═════════════════════════════════════════════════════════

function createCalendarEvent(data, bookingId) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);

  const eventDate = new Date(data.eventDate + 'T' + (data.startTime || '12:00') + ':00');
  const endDate = data.endTime
    ? new Date(data.eventDate + 'T' + data.endTime + ':00')
    : new Date(eventDate.getTime() + 4 * 60 * 60 * 1000); // default 4 hours

  const title = '[CATERING] ' + data.firstName + ' ' + data.lastName +
    ' — ' + data.eventTypeLabel + ' (' + data.guestCount + ' guests)';

  const description = [
    'Booking ID: ' + bookingId,
    'Status: PENDING DEPOSIT',
    '',
    'Contact: ' + data.firstName + ' ' + data.lastName,
    'Email: ' + data.email,
    'Phone: ' + data.phone,
    '',
    'Event: ' + data.eventTypeLabel,
    'Guests: ' + data.guestCount,
    'Service: ' + data.serviceType,
    'Venue: ' + data.venueName,
    '',
    'Menu: ' + (data.selectedCombo ? data.selectedCombo.label : 'A-La-Carte'),
    'Meats: ' + (data.selectedMeats || []).join(', '),
    'Sides: ' + (data.selectedSides || []).join(', '),
    '',
    'Estimated Total: $' + ((data.orderEstimate || {}).total || 0).toFixed(2),
    'Custom Requests: ' + (data.customRequests || 'None'),
    '',
    'Lead Source: ' + (data.leadSource || 'Not specified')
  ].join('\n');

  const event = calendar.createEvent(title, eventDate, endDate, {
    description: description,
    location: data.eventAddress || ''
  });

  event.setColor(CalendarApp.EventColor.RED); // Red = pending deposit
}

// ═══ EMAIL NOTIFICATIONS ══════════════════════════════════════════════════════

function sendInternalNotification(data, bookingId) {
  const order = data.orderEstimate || {};

  const subject = 'New Catering Inquiry: ' + data.firstName + ' ' + data.lastName +
    ' — ' + data.eventTypeLabel + ' on ' + data.eventDate;

  const body = [
    'NEW CATERING BOOKING REQUEST',
    '================================',
    '',
    'Booking ID: ' + bookingId,
    '',
    '--- CLIENT ---',
    'Name: ' + data.firstName + ' ' + data.lastName,
    'Email: ' + data.email,
    'Phone: ' + data.phone,
    '',
    '--- EVENT ---',
    'Type: ' + data.eventTypeLabel,
    'Date: ' + data.eventDate,
    'Time: ' + data.startTime + (data.endTime ? ' - ' + data.endTime : ''),
    'Guests: ' + data.guestCount,
    'Service: ' + data.serviceType,
    'Venue: ' + data.venueName,
    'Address: ' + data.eventAddress,
    '',
    '--- ORDER ---',
    'Menu: ' + (data.selectedCombo
      ? data.selectedCombo.label + ' (' + data.selectedCombo.desc + ')'
      : 'A-La-Carte'),
    'Meats: ' + (data.selectedMeats  || []).join(', '),
    'Sides: ' + (data.selectedSides  || []).join(', '),
    'Sauces: ' + (data.selectedSauces || []).join(', '),
    '',
    'Subtotal: $' + (order.subtotal   || 0).toFixed(2),
    'Tax: $'      + (order.tax        || 0).toFixed(2),
    'Service Fee: $' + (order.serviceFee || 0).toFixed(2),
    'ESTIMATED TOTAL: $' + (order.total  || 0).toFixed(2),
    '',
    'Custom Requests: ' + (data.customRequests || 'None'),
    'Lead Source: ' + (data.leadSource || 'Not specified'),
    '',
    '--- STATUS ---',
    'Contract Signed: ' + (data.contractAgreed ? 'YES' : 'NO'),
    'Deposit Paid: PENDING (QuickBooks invoice being generated)',
    '',
    '================================',
    'Action Required: Verify QBO invoice was created and confirm availability'
  ].join('\n');

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

function sendCustomerConfirmation(data, bookingId) {
  const subject = 'Your Catering Request — Saladino Smoke (#' + bookingId + ')';

  const htmlBody = `
<div style="font-family: 'Source Code Pro', Courier, monospace; max-width: 600px; margin: 0 auto;">
  <div style="background: #A74D4A; padding: 20px; text-align: center;">
    <h1 style="font-family: Abel, Arial, sans-serif; color: #F5F5F5; margin: 0; font-size: 24px;">SALADINO SMOKE</h1>
    <p style="color: rgba(245,245,245,0.8); margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">REAL PIT BARBECUE</p>
  </div>

  <div style="padding: 30px 20px; background: #F5F5F5;">
    <h2 style="font-family: Abel, Arial, sans-serif; color: #121212; margin: 0 0 10px;">Thank You, ${data.firstName}!</h2>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">
      We've received your catering request for <strong>${data.eventTypeLabel}</strong>
      on <strong>${data.eventDate}</strong>.
    </p>

    <div style="background: white; border-left: 4px solid #A74D4A; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.8;">
        <strong>Booking ID:</strong> ${bookingId}<br>
        <strong>Event:</strong> ${data.eventTypeLabel}<br>
        <strong>Date:</strong> ${data.eventDate}<br>
        <strong>Guests:</strong> ${data.guestCount}<br>
        <strong>Venue:</strong> ${data.venueName}
      </p>
    </div>

    <h3 style="font-family: Abel, Arial, sans-serif; color: #A74D4A; margin: 20px 0 10px;">What Happens Next</h3>
    <ol style="font-size: 13px; line-height: 2; color: #333; padding-left: 20px;">
      <li>Pay the <strong>$100 non-refundable deposit</strong> via the invoice link being sent to you</li>
      <li>We confirm your date is locked in within 24 hours</li>
      <li>14 days before your event, we confirm final details</li>
      <li>Balance is due upon arrival at your event</li>
    </ol>

    <div style="background: #121212; color: #F5F5F5; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; font-weight: bold;">
        Your date is not reserved until the contract is signed and the $100 deposit is paid.<br>
        <span style="color: #C46A67;">Dates are first come, first served.</span>
      </p>
    </div>

    <p style="font-size: 13px; color: #666; line-height: 1.6;">
      Questions? Call us at <strong>(616) 437-4488</strong> or reply to this email.
    </p>
  </div>

  <div style="background: #121212; padding: 15px; text-align: center;">
    <p style="color: #888; font-size: 11px; margin: 0;">
      Saladino Smoke LLC &bull; Alto, Michigan &bull; (616) 437-4488<br>
      <a href="https://www.saladinosmoke.com" style="color: #C46A67; text-decoration: none;">www.SaladinoSmoke.com</a>
    </p>
  </div>
</div>
  `;

  GmailApp.sendEmail(data.email, subject, '', {
    htmlBody: htmlBody,
    name: CUSTOMER_FROM_NAME,
    replyTo: NOTIFICATION_EMAIL
  });
}

// ═══ QUICKBOOKS ONLINE ═══════════════════════════════════════════════════════
//
// Uses the OAuth2 for Apps Script library (added in step 3 above).
// Run authorizeQBO() once after deploying to connect your QBO account.
//
// QuickBooks Payments must be enabled on your QBO account to generate
// customer-facing payment links from invoices.

function getQBOService() {
  const baseUrl = QBO_SANDBOX
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

  return OAuth2.createService('QuickBooks')
    .setAuthorizationBaseUrl('https://appcenter.intuit.com/connect/oauth2')
    .setTokenUrl('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer')
    .setClientId(QBO_CLIENT_ID)
    .setClientSecret(QBO_CLIENT_SECRET)
    .setScope('com.intuit.quickbooks.accounting com.intuit.quickbooks.payment')
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setParam('response_type', 'code');
}

// Handles the OAuth redirect from QuickBooks
function authCallback(request) {
  const service = getQBOService();
  const authorized = service.handleCallback(request);
  return HtmlService.createHtmlOutput(
    authorized
      ? '<h2 style="font-family:sans-serif;color:green">&#10003; QuickBooks connected! You can close this tab.</h2>'
      : '<h2 style="font-family:sans-serif;color:red">&#10007; Authorization failed. Check the Apps Script logs.</h2>'
  );
}

// Run this function once (from the Apps Script editor) to connect QuickBooks.
// Copy the URL from the logs and open it in your browser.
function authorizeQBO() {
  const service = getQBOService();
  if (service.hasAccess()) {
    Logger.log('✅ QuickBooks is already connected.');
    return;
  }
  const authUrl = service.getAuthorizationUrl({ state: 'saladino-smoke' });
  Logger.log('🔗 Open this URL in your browser to connect QuickBooks:\n\n' + authUrl);
}

// Run this to disconnect and re-authorize QuickBooks
function resetQBOAuth() {
  OAuth2.createService('QuickBooks')
    .setPropertyStore(PropertiesService.getUserProperties())
    .reset();
  Logger.log('QBO authorization cleared. Run authorizeQBO() to reconnect.');
}

// Find an existing QBO customer by email, or create a new one
function getOrCreateQBOCustomer(data, token) {
  const apiBase = QBO_SANDBOX
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
  const companyUrl = apiBase + '/v3/company/' + QBO_COMPANY_ID;

  // Query for existing customer
  const query = "SELECT * FROM Customer WHERE PrimaryEmailAddr = '" + data.email + "' MAXRESULTS 1";
  const queryResp = UrlFetchApp.fetch(
    companyUrl + '/query?query=' + encodeURIComponent(query) + '&minorversion=65',
    { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' } }
  );
  const queryResult = JSON.parse(queryResp.getContentText());
  const existing = (queryResult.QueryResponse || {}).Customer || [];
  if (existing.length > 0) return existing[0].Id;

  // Create new customer
  const customerPayload = {
    GivenName:         data.firstName,
    FamilyName:        data.lastName,
    DisplayName:       data.firstName + ' ' + data.lastName + ' — ' + data.email,
    PrimaryEmailAddr:  { Address: data.email },
    PrimaryPhone:      { FreeFormNumber: data.phone }
  };

  const createResp = UrlFetchApp.fetch(companyUrl + '/customer?minorversion=65', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json',
      'Accept':        'application/json'
    },
    payload: JSON.stringify(customerPayload),
    muteHttpExceptions: true
  });

  const created = JSON.parse(createResp.getContentText());
  if (!created.Customer) {
    Logger.log('QBO customer creation failed: ' + createResp.getContentText());
    throw new Error('Could not create QBO customer');
  }
  return created.Customer.Id;
}

// Create a $100 deposit invoice in QuickBooks and return the payment URL
function createQuickBooksInvoice(data, bookingId) {
  if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET || !QBO_COMPANY_ID) return null;

  try {
    const service = getQBOService();
    if (!service.hasAccess()) {
      Logger.log('QBO not authorized — invoice skipped. Run authorizeQBO().');
      return null;
    }

    const token = service.getAccessToken();
    const apiBase = QBO_SANDBOX
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
    const companyUrl = apiBase + '/v3/company/' + QBO_COMPANY_ID;

    const customerId = getOrCreateQBOCustomer(data, token);

    // Build invoice payload
    const invoicePayload = {
      CustomerRef: { value: customerId },
      DueDate: data.eventDate,   // Pay before event date
      Line: [{
        Amount: 100.00,
        DetailType: 'SalesItemLineDetail',
        Description: 'Non-refundable booking deposit — ' + data.eventTypeLabel +
                     ' on ' + data.eventDate + ' (' + data.guestCount + ' guests)' +
                     ' | Booking ID: ' + bookingId,
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: 100.00,
          TaxCodeRef: { value: 'NON' }
        }
      }],
      PrivateNote: [
        'Booking ID: ' + bookingId,
        'Event: ' + data.eventTypeLabel,
        'Date: ' + data.eventDate,
        'Time: ' + data.startTime + (data.endTime ? ' \u2013 ' + data.endTime : ''),
        'Guests: ' + data.guestCount,
        'Service: ' + data.serviceType,
        'Venue: ' + data.venueName,
        'Address: ' + data.eventAddress,
        'Menu: ' + (data.selectedCombo ? data.selectedCombo.label : 'A-La-Carte'),
        'Estimated Total: $' + ((data.orderEstimate || {}).total || 0).toFixed(2)
      ].join('\n'),
      CustomerMemo: { value: 'Thank you for choosing Saladino Smoke Catering! This invoice is for your $100 non-refundable deposit to reserve your date.' }
    };

    const invoiceResp = UrlFetchApp.fetch(companyUrl + '/invoice?minorversion=65', {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      },
      payload: JSON.stringify(invoicePayload),
      muteHttpExceptions: true
    });

    const result = JSON.parse(invoiceResp.getContentText());
    const invoice = result.Invoice;

    if (!invoice) {
      Logger.log('QBO invoice creation failed: ' + invoiceResp.getContentText());
      return null;
    }

    Logger.log('QBO invoice created: #' + invoice.DocNumber + ' (ID: ' + invoice.Id + ')');

    // InvoiceLink is the customer-facing payment URL (requires QBO Payments to be enabled)
    // If Payments is not enabled, return the QBO app link for you to send manually
    return invoice.InvoiceLink ||
           ('https://app.qbo.intuit.com/app/invoice?txnId=' + invoice.Id);

  } catch (error) {
    Logger.log('QBO invoice error: ' + error.message);
    return null; // Don't fail the booking submission if QBO invoice fails
  }
}

// ═══ UTILITY FUNCTIONS (run manually from editor) ═════════════════════════════

// Run this ONCE to create the "Saladino Smoke — Booking Dashboard" spreadsheet.
// Copy the logged ID and paste it into SHEET_ID above.
function createBookingSpreadsheet() {
  const ss = SpreadsheetApp.create('Saladino Smoke \u2014 Booking Dashboard');
  Logger.log('✅ Spreadsheet created! Paste this ID into SHEET_ID:\n\n' + ss.getId());
  Logger.log('Open it here: ' + ss.getUrl());
}

// Run this to verify your setup before going live
function testSetup() {
  Logger.log('=== Saladino Smoke Booking — Setup Check ===');

  // Calendar
  try {
    const cal = CalendarApp.getCalendarById(CALENDAR_ID);
    Logger.log('✅ Calendar: ' + cal.getName());
  } catch(e) {
    Logger.log('❌ Calendar error: ' + e.message + ' (check CALENDAR_ID)');
  }

  // Sheets
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log('✅ Spreadsheet: ' + ss.getName());
  } catch(e) {
    Logger.log('❌ Sheets error: ' + e.message + ' (check SHEET_ID or run createBookingSpreadsheet())');
  }

  // Gmail
  try {
    Logger.log('✅ Gmail: ' + Session.getActiveUser().getEmail() + ' (sends as this address)');
  } catch(e) {
    Logger.log('❌ Gmail error: ' + e.message);
  }

  // QuickBooks
  if (QBO_CLIENT_ID && QBO_CLIENT_SECRET && QBO_COMPANY_ID) {
    const service = getQBOService();
    Logger.log(service.hasAccess()
      ? '✅ QuickBooks: connected'
      : '❌ QuickBooks: not authorized — run authorizeQBO()');
  } else {
    Logger.log('⚠️  QuickBooks: credentials not filled in (QBO_CLIENT_ID / QBO_CLIENT_SECRET / QBO_COMPANY_ID)');
  }
}

// Initialize sheet with headers and formatting (alternative to auto-create on first booking)
function initializeSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  sheet.clear();
  sheet.appendRow([
    'Booking ID', 'Status', 'Submitted',
    'First Name', 'Last Name', 'Email', 'Phone',
    'Event Type', 'Event Date', 'Start Time', 'End Time',
    'Guest Count', 'Service Type', 'Venue', 'Address',
    'Menu Tier', 'Combo', 'Meats', 'Sides', 'Sauces',
    'Additional Items', 'Custom Requests',
    'Subtotal', 'Tax', 'Service Fee', 'Estimated Total',
    'Contract Signed', 'Deposit Paid',
    'Lead Source', 'Notes'
  ]);

  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#A74D4A');
  headerRange.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 150);   // Booking ID
  sheet.setColumnWidth(2, 100);   // Status
  sheet.setColumnWidth(3, 160);   // Submitted
  sheet.setColumnWidth(6, 220);   // Email
  sheet.setColumnWidth(14, 200);  // Venue
  sheet.setColumnWidth(15, 260);  // Address

  Logger.log('✅ Sheet initialized: ' + SHEET_NAME);
}
