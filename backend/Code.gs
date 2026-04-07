/**
 * Saladino Smoke Catering — Google Apps Script Backend
 *
 * Deploy as Web App:
 *   1. Open Google Apps Script (script.google.com)
 *   2. Paste this code
 *   3. Set the CALENDAR_ID, SHEET_ID, and NOTIFICATION_EMAIL below
 *   4. Deploy > New Deployment > Web App
 *   5. Execute as: Me, Access: Anyone
 *   6. Copy the URL and paste it into app.js CONFIG.BACKEND_URL
 *
 * This script handles:
 *   - Date availability checks (Google Calendar)
 *   - Booking submissions (Google Sheets + Calendar + Email)
 */

// ═══ CONFIGURATION ═══════════════════════════════════════════
const CALENDAR_ID = 'primary';  // Or a specific calendar ID for catering bookings
const SHEET_ID = '';             // Google Sheets ID for the booking dashboard
const SHEET_NAME = 'Bookings';
const NOTIFICATION_EMAIL = 'catering@saladinosmoke.com';
const CUSTOMER_FROM_NAME = 'Saladino Smoke Catering';

// Stripe (optional — if using Stripe for $100 deposit)
const STRIPE_SECRET_KEY = '';    // sk_live_... or sk_test_...
const STRIPE_PRICE_ID = '';      // price_... for the $100 deposit product

// ═══ WEB APP ENTRY POINTS ════════════════════════════════════

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
      result = { error: 'Unknown action' };
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

// ═══ DATE AVAILABILITY CHECK ═════════════════════════════════

function checkDateAvailability(data) {
  try {
    const date = new Date(data.date + 'T00:00:00');
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const events = calendar.getEvents(startOfDay, endOfDay);

    // Check if any existing event looks like a catering booking
    const hasBooking = events.some(event => {
      const title = event.getTitle().toLowerCase();
      return title.includes('catering') ||
             title.includes('booking') ||
             title.includes('event') ||
             title.includes('saladino');
    });

    return { available: !hasBooking };
  } catch (error) {
    Logger.log('Date check error: ' + error.message);
    return { available: true, warning: 'Could not verify. Please call to confirm.' };
  }
}

// ═══ BOOKING SUBMISSION ══════════════════════════════════════

function submitBooking(data) {
  try {
    // 1. Write to Google Sheets
    const bookingId = writeToSheet(data);

    // 2. Create Google Calendar event
    createCalendarEvent(data, bookingId);

    // 3. Send internal notification email
    sendInternalNotification(data, bookingId);

    // 4. Send customer confirmation email
    sendCustomerConfirmation(data, bookingId);

    // 5. Create Stripe checkout session (if configured)
    let stripeUrl = null;
    if (STRIPE_SECRET_KEY && STRIPE_PRICE_ID) {
      stripeUrl = createStripeCheckout(data, bookingId);
    }

    return {
      success: true,
      bookingId: bookingId,
      stripeUrl: stripeUrl
    };
  } catch (error) {
    Logger.log('Booking error: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ═══ GOOGLE SHEETS ═══════════════════════════════════════════

function writeToSheet(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  // Create sheet with headers if it doesn't exist
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
    // Bold headers
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const bookingId = 'SS-' + Utilities.formatDate(new Date(), 'America/New_York', 'yyyyMMdd') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

  const order = data.orderEstimate || {};
  const combo = data.selectedCombo ? data.selectedCombo.label + ' (' + data.selectedCombo.desc + ')' : 'A-La-Carte';
  const meats = (data.selectedMeats || []).join(', ');
  const sides = (data.selectedSides || []).join(', ');
  const sauces = (data.selectedSauces || []).join(', ');

  // Compile additional items
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
    order.subtotal || 0,
    order.tax || 0,
    order.serviceFee || 0,
    order.total || 0,
    data.contractAgreed ? 'Yes' : 'No',
    'No',  // Deposit not yet paid at this point
    data.leadSource || '',
    data.notes || ''
  ]);

  return bookingId;
}

// ═══ GOOGLE CALENDAR ═════════════════════════════════════════

function createCalendarEvent(data, bookingId) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);

  const eventDate = new Date(data.eventDate + 'T' + (data.startTime || '12:00') + ':00');
  let endDate;
  if (data.endTime) {
    endDate = new Date(data.eventDate + 'T' + data.endTime + ':00');
  } else {
    endDate = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000); // Default 4 hours
  }

  const title = '[CATERING] ' + data.firstName + ' ' + data.lastName + ' - ' +
                data.eventTypeLabel + ' (' + data.guestCount + ' guests)';

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

  // Color code: Red for pending
  event.setColor(CalendarApp.EventColor.RED);
}

// ═══ EMAIL NOTIFICATIONS ═════════════════════════════════════

function sendInternalNotification(data, bookingId) {
  const order = data.orderEstimate || {};

  const subject = 'New Catering Inquiry: ' + data.firstName + ' ' + data.lastName +
                  ' - ' + data.eventTypeLabel + ' on ' + data.eventDate;

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
    'Menu: ' + (data.selectedCombo ? data.selectedCombo.label + ' (' + data.selectedCombo.desc + ')' : 'A-La-Carte'),
    'Meats: ' + (data.selectedMeats || []).join(', '),
    'Sides: ' + (data.selectedSides || []).join(', '),
    'Sauces: ' + (data.selectedSauces || []).join(', '),
    '',
    'Subtotal: $' + (order.subtotal || 0).toFixed(2),
    'Tax: $' + (order.tax || 0).toFixed(2),
    'Service Fee: $' + (order.serviceFee || 0).toFixed(2),
    'ESTIMATED TOTAL: $' + (order.total || 0).toFixed(2),
    '',
    'Custom Requests: ' + (data.customRequests || 'None'),
    'Lead Source: ' + (data.leadSource || 'Not specified'),
    'Notes: ' + (data.notes || 'None'),
    '',
    '--- STATUS ---',
    'Contract Signed: ' + (data.contractAgreed ? 'YES' : 'NO'),
    'Deposit Paid: PENDING',
    '',
    '================================',
    'Action Required: Confirm availability and collect $100 deposit'
  ].join('\n');

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

function sendCustomerConfirmation(data, bookingId) {
  const subject = 'Your Catering Request - Saladino Smoke (#' + bookingId + ')';

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
          <li>We review your request and confirm availability (within 24 hours)</li>
          <li>We collect the $100 non-refundable deposit to lock in your date</li>
          <li>14 days before your event, we confirm final details</li>
          <li>Balance due upon arrival</li>
        </ol>

        <div style="background: #121212; color: #F5F5F5; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px; font-weight: bold;">
            Your date is not reserved until both the contract is signed and the $100 deposit is paid.<br>
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

// ═══ STRIPE CHECKOUT (OPTIONAL) ══════════════════════════════

function createStripeCheckout(data, bookingId) {
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) return null;

  const payload = {
    'payment_method_types[]': 'card',
    'line_items[0][price]': STRIPE_PRICE_ID,
    'line_items[0][quantity]': 1,
    'mode': 'payment',
    'success_url': 'https://www.saladinosmoke.com/booking-confirmed?id=' + bookingId,
    'cancel_url': 'https://www.saladinosmoke.com/plan-your-next-event',
    'customer_email': data.email,
    'metadata[booking_id]': bookingId,
    'metadata[event_date]': data.eventDate,
    'metadata[guest_count]': data.guestCount.toString()
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + STRIPE_SECRET_KEY
    },
    payload: payload,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions', options);
  const session = JSON.parse(response.getContentText());

  return session.url || null;
}

// ═══ UTILITY: Initialize Sheet (run manually once) ═══════════

function initializeSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Clear and set headers
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

  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Set column widths for readability
  sheet.setColumnWidth(1, 140);  // Booking ID
  sheet.setColumnWidth(2, 100);  // Status
  sheet.setColumnWidth(6, 200);  // Email
  sheet.setColumnWidth(14, 200); // Venue
  sheet.setColumnWidth(15, 250); // Address

  Logger.log('Sheet initialized successfully');
}
