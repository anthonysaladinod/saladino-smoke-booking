/**
 * Saladino Smoke Catering — Menu Data
 *
 * Update prices here. The app reads from this file.
 * All prices are in USD. "MV" = Market Value (quote required).
 */

const MENU_DATA = {

  // ── Event Types → Menu Tier Mapping ──────────────────────────
  eventTypes: [
    { id: "wedding",     label: "Wedding",                    menuTier: "standard",   serviceFee: 0.25, minGuests: 75 },
    { id: "rehearsal",   label: "Rehearsal Dinner",           menuTier: "rehearsal",  serviceFee: 0.20, minGuests: 45 },
    { id: "corporate",   label: "Corporate Event",            menuTier: "corporate",  serviceFee: 0.20, minGuests: null },
    { id: "graduation",  label: "Graduation Party",           menuTier: "graduation", serviceFee: 0.20, minGuests: null },
    { id: "birthday",    label: "Birthday / Private Party",   menuTier: "standard",   serviceFee: 0.25, minGuests: null },
    { id: "fundraiser",  label: "Fundraiser / Charity Event", menuTier: "corporate",  serviceFee: 0.20, minGuests: null },
    { id: "alacarte",    label: "A-La-Carte (Pick Up or Delivery)", menuTier: "alacarte", serviceFee: 0, minGuests: null },
    { id: "other",       label: "Other",                      menuTier: "standard",   serviceFee: 0.25, minGuests: null }
  ],

  // ── Buffet Combos (per person) ───────────────────────────────
  combos: {
    standard: [
      { id: "combo1", label: "Combo 1", desc: "1 Meat, 2 Sides", price: 27, meats: 1, sides: 2 },
      { id: "combo2", label: "Combo 2", desc: "2 Meats, 2 Sides", price: 28, meats: 2, sides: 2 },
      { id: "combo3", label: "Combo 3", desc: "3 Meats, 3 Sides", price: 29, meats: 3, sides: 3 }
    ],
    rehearsal: [
      { id: "combo1", label: "Combo 1", desc: "1 Meat, 2 Sides", price: 27, meats: 1, sides: 2 },
      { id: "combo2", label: "Combo 2", desc: "2 Meats, 2 Sides", price: 28, meats: 2, sides: 2 },
      { id: "combo3", label: "Combo 3", desc: "3 Meats, 3 Sides", price: 29, meats: 3, sides: 3 }
    ],
    corporate: [
      { id: "combo1", label: "Combo 1", desc: "1 Meat, 2 Sides", price: 17, meats: 1, sides: 2 },
      { id: "combo2", label: "Combo 2", desc: "2 Meats, 2 Sides", price: 18, meats: 2, sides: 2 },
      { id: "combo3", label: "Combo 3", desc: "3 Meats, 3 Sides", price: 19, meats: 3, sides: 3 }
    ],
    graduation: [
      { id: "combo1", label: "Combo 1", desc: "1 Meat, 2 Sides", price: 15, meats: 1, sides: 2 },
      { id: "combo2", label: "Combo 2", desc: "2 Meats, 2 Sides", price: 16, meats: 2, sides: 2 },
      { id: "combo3", label: "Combo 3", desc: "3 Meats, 3 Sides", price: 17, meats: 3, sides: 3 }
    ]
  },

  // ── Buffet Meat Options ──────────────────────────────────────
  meats: ["Pulled Pork", "Beef Brisket", "Pulled Chicken", "Chicken Wings"],

  // ── Buffet Side Options ──────────────────────────────────────
  sides: ["Cole Slaw", "Cornbread Casserole", "Baked Beans", "Mac-N-Cheese", "Cheesy Potatoes", "Street Corn", "Southwest Corn"],

  // ── Sauces (included with all buffet orders) ─────────────────
  sauces: ["Kansas City", "Sweet", "Pit Heat", "Carolina", "Alabama White", "Horseradish Peppercorn"],

  // ── Additional Meat Options (per-unit pricing) ───────────────
  additionalMeats: [
    { name: "Tri-Tip",           price: null,  unit: "per lb",   note: "Market Value" },
    { name: "Beef Tenderloin",   price: null,  unit: "per lb",   note: "Market Value" },
    { name: "Pork Ribs",         price: 25,    unit: "per slab", note: "" },
    { name: "Hamburger",         price: 5,     unit: "each",     note: "" },
    { name: "Sausage",           price: 4.50,  unit: "per link", note: "" },
    { name: "Hot Dog",           price: 3,     unit: "each",     note: "" },
    { name: "Brats",             price: 4,     unit: "each",     note: "" },
    { name: "Impossible Burger", price: 5,     unit: "each",     note: "" }
  ],

  // ── Add-On Trays (buffet events) ────────────────────────────
  addOnTrays: [
    { name: "House Salad",    price: 60, unit: "per tray" },
    { name: "Seasonal Salad", price: 60, unit: "per tray" },
    { name: "Grilled Veggies", price: 70, unit: "per tray" }
  ],

  // ── Charcuterie Boards (per person, standard + rehearsal only)
  charcuterie: [
    { name: "Veggie Board",         price: 16, unit: "per person", desc: "Cheese, crackers, olives, grapes, dips and veggies" },
    { name: "Meat & Veggie Board",  price: 18, unit: "per person", desc: "Cheese, crackers, olives, grapes, dips, veggies, assorted meats, chicken wings, meatballs" }
  ],

  // ── Desserts (varies by menu tier) ──────────────────────────
  desserts: {
    standard:  [{ name: "Seasonal Dessert", price: null, unit: "", note: "Ask for current options" }],
    rehearsal: [{ name: "Seasonal Dessert", price: null, unit: "", note: "Ask for current options" }],
    corporate: [
      { name: "Brownie Bites", price: 1, unit: "per person", note: "" },
      { name: "Cookies",       price: 2, unit: "per person", note: "" }
    ],
    graduation: [
      { name: "Brownie Bites", price: 1, unit: "per person", note: "" },
      { name: "Cookies",       price: 2, unit: "per person", note: "" }
    ]
  },

  // ── Tiers that include charcuterie boards ───────────────────
  charcuterieTiers: ["standard", "rehearsal"],

  // ── A-La-Carte Menu (pick-up / delivery only) ───────────────
  alacarte: {
    meats: [
      { name: "Pulled Pork",    price: 8.55,  unit: "per lb" },
      { name: "Pulled Chicken", price: 8.55,  unit: "per lb" },
      { name: "Beef Brisket",   price: 18.00, unit: "per lb" },
      { name: "Sausage Link",   price: 4.50,  unit: "per link" },
      { name: "Chicken Wings",  price: 8.55,  unit: "per lb" },
      { name: "Pork Ribs",      price: 25.00, unit: "per slab" },
      { name: "Beef Ribs",      price: null,  unit: "per lb", note: "Market Value" }
    ],
    sides: [
      { name: "Cole Slaw",            halfTray: 25, fullTray: 50 },
      { name: "Cornbread Casserole",   halfTray: 30, fullTray: 60 },
      { name: "Baked Beans",           halfTray: 30, fullTray: 60 },
      { name: "Mac-N-Cheese",          halfTray: 30, fullTray: 60 },
      { name: "Cheesy Potatoes",       halfTray: 30, fullTray: 60 },
      { name: "Street Corn",           halfTray: 30, fullTray: 60 },
      { name: "Grilled Veggies",       halfTray: 35, fullTray: 70 },
      { name: "Southwest Corn",        halfTray: 30, fullTray: 60 }
    ],
    addOns: [
      { name: "Fresh Yeasty Rolls (24ct)",          price: 12, unit: "per package" },
      { name: "Disposable Wire Rack with Sterno",   price: 12, unit: "each" },
      { name: "Sauce Bottle (24oz)",                price: 15, unit: "per bottle" },
      { name: "Disposable Serving Utensils",        price: 5,  unit: "flat fee" },
      { name: "Paper Plate, Utensils, Napkins",     price: 5,  unit: "per person" },
      { name: "Impossible Burger",                  price: 8,  unit: "each" }
    ],
    portionNotes: [
      "1 lb pulled meat feeds approximately 3 people",
      "1 lb beef brisket feeds approximately 2 people",
      "Half tray serves 9-14 people",
      "Full tray serves 30-35 people"
    ]
  },

  // ── Service Types by Tier ───────────────────────────────────
  serviceTypes: {
    standard:   ["On-Site Full Service", "Delivery", "Pick-Up"],
    rehearsal:  ["On-Site Full Service", "Delivery", "Pick-Up"],
    corporate:  ["On-Site Full Service", "Delivery", "Pick-Up"],
    graduation: ["On-Site Full Service", "Delivery", "Pick-Up"],
    alacarte:   ["Pick-Up", "Delivery"]
  },

  // ── Full Service Includes ───────────────────────────────────
  fullServiceIncludes: [
    "Buns / Rolls",
    "Utensils",
    "Plates / Napkins",
    "Chafing Dishes",
    "Table Cloths",
    "Staff On Site"
  ],

  // ── Dietary / Gluten Friendly Items ─────────────────────────
  glutenFriendly: [
    "All Meats", "All Rubs", "All Sauces (Except Carolina)",
    "Cheesy Potatoes", "Tater Tots", "Street Corn",
    "Baked Beans", "Cole Slaw", "House Salad", "Seasonal Salad"
  ],

  // ── Business Rules ──────────────────────────────────────────
  TAX_RATE: 0.06,
  DEPOSIT_AMOUNT: 100,
  ON_SITE_MIN_GUESTS: 75,
  REHEARSAL_MIN_GUESTS: 45,
  TRAVEL_FREE_RADIUS_MILES: 25,
  TRAVEL_FEE_PER_MILE: 0.75,
  ON_SITE_GRILLING_SURCHARGE: 175,
  ADVANCE_NOTICE_DAYS: 14,
  LATE_GUEST_ADD_FEE: 25,
  LATE_GUEST_ADD_WINDOW_DAYS: 5,

  // ── Contact Info ────────────────────────────────────────────
  contact: {
    email: "Saladinosmoke@gmail.com",
    cateringEmail: "catering@saladinosmoke.com",
    phone: "(616) 437-4488",
    address: "7419 Snow Ave SE, Alto, MI 49302",
    website: "www.SaladinoSmoke.com",
    facebook: "https://facebook.com/saladino.smoke",
    instagram: "https://instagram.com/saladinosmoke"
  }
};
