# Saladino Smoke — Catering Booking App

A multi-step booking wizard for Saladino Smoke Catering. Customers select their event type, build their menu, sign the catering agreement, and pay the $100 deposit, all in one flow.

## What It Does

1. **Step 1 — Event Inquiry:** Customer fills out event details, date is checked against Google Calendar
2. **Step 2 — Menu Builder:** Dynamic menu loads based on event type (different pricing for corporate, graduation, wedding, rehearsal, a-la-carte) with a running total
3. **Step 3 — Lock It In:** Order review, digital contract signature, and $100 deposit payment

When a booking is submitted:
- Internal notification email sent to catering@saladinosmoke.com
- Customer confirmation email sent
- Booking logged to Google Sheets (operating dashboard)
- Event created on Google Calendar (marked as PENDING until deposit clears)

## Files

```
index.html          Frontend (open in any browser)
styles.css          Saladino Smoke branded styles
menu-data.js        All menu items, pricing, and business rules
app.js              Booking wizard logic
backend/Code.gs     Google Apps Script backend
.env.example        Required configuration values
```

## Quick Start (Development)

1. Open `index.html` in a browser. It runs in dev mode by default (no backend needed).
2. Walk through all 3 steps to test the flow.
3. Menu prices and items are in `menu-data.js`. Edit there to update.

## Deployment

### Frontend (Static Files)

The 4 frontend files (`index.html`, `styles.css`, `menu-data.js`, `app.js`) can be hosted anywhere:
- **Squarespace:** Add as a code block or custom page
- **Cloudflare Pages:** Push to a git repo, connect to Cloudflare Pages
- **Netlify:** Drag and drop the folder
- **Any web server:** Just serve the files

### Backend (Google Apps Script)

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Paste the contents of `backend/Code.gs`
3. Update the constants at the top:
   - `SHEET_ID` — Create a new Google Sheet and grab the ID from the URL
   - `NOTIFICATION_EMAIL` — Where booking alerts go
   - `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` — If using Stripe for deposits
4. Run `initializeSheet()` once to set up the spreadsheet headers
5. Deploy > New Deployment > Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployment URL

### Connect Frontend to Backend

In `app.js`, update the CONFIG object:

```javascript
const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  STRIPE_PK: 'pk_live_YOUR_KEY',  // Optional
  DEV_MODE: false                   // Set to false for production
};
```

### Stripe Setup (Optional)

For the $100 deposit:
1. Create a Stripe account
2. Create a Product called "Catering Deposit" at $100
3. Copy the Price ID (starts with `price_`)
4. Add keys to both the frontend CONFIG and backend Code.gs

## Menu Updates

All menu data is in `menu-data.js`. To update prices:
- Find the menu tier (standard, corporate, graduation, rehearsal)
- Update the price values
- Save and redeploy

No code changes needed. Just edit the numbers.

## Business Rules (Built In)

- 6% Michigan sales tax
- 25% service fee for standard/wedding events
- 20% service fee for corporate, graduation, and rehearsal events
- No service fee for a-la-carte (pick-up/delivery)
- $100 non-refundable deposit required
- 75 guest minimum for on-site service
- 45 guest minimum for rehearsal dinners
- 14 days advance notice required
- Date minimum set to 14 days from today automatically
- Guest count validated against event type minimums
- $25/guest surcharge for additions within 5 days of event
- 25-mile free travel radius from Alto, MI; $0.75/mile beyond

## Handoff Checklist

To transfer this to the client's own infrastructure:

- [ ] Host frontend files on their domain/subdomain
- [ ] Set up Google Apps Script on their Google account
- [ ] Create the Google Sheet on their account
- [ ] Connect their Google Calendar
- [ ] Set up their Stripe account (if using)
- [ ] Update CONFIG in app.js with their URLs/keys
- [ ] Update contact info in menu-data.js if changed
- [ ] Test the full flow end-to-end

No dependencies on any external accounts. Single .env swap.
