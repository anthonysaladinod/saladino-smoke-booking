/**
 * Saladino Smoke Catering — Booking Wizard
 * Standalone app. No external dependencies beyond menu-data.js.
 */

(function () {
  'use strict';

  // ── Config (set these before deploying) ─────────────────────
  const CONFIG = {
    // Google Apps Script web app URL (handles date check + booking submission)
    BACKEND_URL: '',
    // Stripe publishable key (for $100 deposit)
    STRIPE_PK: '',
    // Set to true to skip backend calls during development
    DEV_MODE: true
  };

  // ── State ───────────────────────────────────────────────────
  const state = {
    currentStep: 1,
    inquiry: {},
    eventType: null,
    menuTier: null,
    serviceFee: 0,
    serviceType: '',
    guestCount: 0,
    // Buffet selections
    selectedCombo: null,
    selectedMeats: [],
    selectedSides: [],
    selectedSauces: [],
    additionalMeats: {},    // { name: qty }
    addOnTrays: {},         // { name: qty }
    charcuterie: {},        // { name: qty }
    desserts: {},           // { name: qty }
    // A-la-carte selections
    alacarteMeats: {},      // { name: qty }
    alacarteSides: {},      // { name: "half"|"full"|null }
    alacarteAddOns: {},     // { name: qty }
    // Custom
    customRequests: '',
    // Contract
    signatureData: null,
    contractAgreed: false
  };

  // ── DOM Ready ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    renderStep1();
    bindNavigation();
    initSignaturePad();
  }

  // ── Navigation ──────────────────────────────────────────────
  function bindNavigation() {
    on('click', '#btnCheckAvailability', handleCheckAvailability);
    on('click', '#btnToMenu', () => goToStep(2));
    on('click', '#btnBackToInquiry', () => goToStep(1));
    on('click', '#btnToReview', handleGoToReview);
    on('click', '#btnBackToMenu', () => goToStep(2));
    on('click', '#btnSubmitBooking', handleSubmitBooking);
  }

  function goToStep(step) {
    state.currentStep = step;
    $$('.step-panel').forEach(p => p.classList.remove('active'));
    $(`#step${step}`).classList.add('active');
    updateProgressBar();

    if (step === 2) renderStep2();
    if (step === 3) renderStep3();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgressBar() {
    for (let i = 1; i <= 3; i++) {
      const stepEl = $(`.progress-step[data-step="${i}"]`);
      const connector = $(`.step-connector[data-after="${i}"]`);

      stepEl.classList.remove('active', 'completed');
      if (connector) connector.classList.remove('active', 'completed');

      if (i < state.currentStep) {
        stepEl.classList.add('completed');
        if (connector) connector.classList.add('completed');
      } else if (i === state.currentStep) {
        stepEl.classList.add('active');
        if (connector) connector.classList.add('active');
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  STEP 1 — Event Inquiry
  // ════════════════════════════════════════════════════════════

  function renderStep1() {
    const eventOptions = MENU_DATA.eventTypes
      .map(et => `<option value="${et.id}">${et.label}</option>`)
      .join('');

    $('#step1-form').innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label>First Name <span class="required">*</span></label>
          <input type="text" id="firstName" required>
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>Last Name <span class="required">*</span></label>
          <input type="text" id="lastName" required>
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>Email <span class="required">*</span></label>
          <input type="email" id="email" required>
          <span class="error-message">Valid email required</span>
        </div>
        <div class="form-group">
          <label>Phone <span class="required">*</span></label>
          <input type="tel" id="phone" required>
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>Event Type <span class="required">*</span></label>
          <select id="eventType" required>
            <option value="">Select your event type...</option>
            ${eventOptions}
          </select>
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>Number of Guests <span class="required">*</span></label>
          <input type="number" id="guestCount" min="1" required placeholder="Expected guest count">
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>Event Date <span class="required">*</span></label>
          <input type="date" id="eventDate" required>
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>Event Start Time <span class="required">*</span></label>
          <input type="time" id="startTime" required>
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>Event End Time</label>
          <input type="time" id="endTime">
        </div>
        <div class="form-group">
          <label>Venue Name <span class="required">*</span></label>
          <input type="text" id="venueName" required placeholder="Name of venue or location">
          <span class="error-message">Required</span>
        </div>
        <div class="form-group full-width">
          <label>Event Address <span class="required">*</span></label>
          <input type="text" id="eventAddress" required placeholder="Full address (street, city, state, ZIP)">
          <span class="error-message">Required</span>
        </div>
        <div class="form-group">
          <label>How Did You Hear About Us?</label>
          <select id="leadSource">
            <option value="">Select...</option>
            <option value="referral">Referral / Word of Mouth</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="google">Google Search</option>
            <option value="food-truck">Saw the Food Truck</option>
            <option value="event">Attended an Event</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>Anything Else We Should Know?</label>
          <textarea id="notes" placeholder="Special requests, dietary needs, event details..."></textarea>
        </div>
      </div>
    `;

    // Set min date to 14 days from now
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + MENU_DATA.ADVANCE_NOTICE_DAYS);
    $('#eventDate').min = minDate.toISOString().split('T')[0];

    // Show guest minimum warning on event type change
    $('#eventType').addEventListener('change', function () {
      const et = MENU_DATA.eventTypes.find(e => e.id === this.value);
      const existing = $('#guestMinWarning');
      if (existing) existing.remove();

      if (et && et.minGuests) {
        const warning = document.createElement('div');
        warning.id = 'guestMinWarning';
        warning.className = 'info-box warning';
        warning.innerHTML = `<span class="info-icon">&#9888;</span>
          <span>${et.label} events require a minimum of <strong>${et.minGuests} guests</strong> for on-site service.</span>`;
        this.closest('.form-group').after(warning);
      }
    });
  }

  function handleCheckAvailability() {
    if (!validateStep1()) return;
    collectStep1Data();

    const btn = $('#btnCheckAvailability');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Checking...';

    const resultEl = $('#availabilityResult');
    resultEl.classList.remove('show');

    if (CONFIG.DEV_MODE || !CONFIG.BACKEND_URL) {
      // Dev mode: simulate available
      setTimeout(() => {
        showAvailabilityResult(true);
        btn.disabled = false;
        btn.textContent = 'Check Availability';
      }, 1000);
      return;
    }

    fetch(CONFIG.BACKEND_URL + '?action=checkDate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.inquiry.eventDate,
        startTime: state.inquiry.startTime,
        endTime: state.inquiry.endTime
      })
    })
      .then(r => r.json())
      .then(data => {
        showAvailabilityResult(data.available);
      })
      .catch(() => {
        showAvailabilityResult(true); // Fail open: let them continue
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Check Availability';
      });
  }

  function showAvailabilityResult(available) {
    const resultEl = $('#availabilityResult');
    if (available) {
      resultEl.innerHTML = `
        <div class="availability-available">
          <h3>&#10003; Great News!</h3>
          <p>Your date is currently available. Dates go quickly, so let's get your menu selected and lock it in.</p>
          <button class="btn btn-primary btn-lg mt-2" id="btnToMenu">Continue to Menu Selection</button>
        </div>
      `;
      on('click', '#btnToMenu', () => goToStep(2));
    } else {
      resultEl.innerHTML = `
        <div class="availability-unavailable">
          <h3>&#10007; Date Not Available</h3>
          <p>Sorry, that date is already booked. Please try a different date above and check again.</p>
        </div>
      `;
    }
    resultEl.classList.add('show');
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function validateStep1() {
    const required = ['firstName', 'lastName', 'email', 'phone', 'eventType', 'guestCount', 'eventDate', 'startTime', 'venueName', 'eventAddress'];
    let valid = true;

    required.forEach(id => {
      const el = $(`#${id}`);
      const group = el.closest('.form-group');
      if (!el.value.trim()) {
        group.classList.add('has-error');
        valid = false;
      } else {
        group.classList.remove('has-error');
      }
    });

    // Email validation
    const emailEl = $('#email');
    if (emailEl.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
      emailEl.closest('.form-group').classList.add('has-error');
      valid = false;
    }

    // Guest count vs event minimum
    const et = MENU_DATA.eventTypes.find(e => e.id === $('#eventType').value);
    const guests = parseInt($('#guestCount').value) || 0;
    if (et && et.minGuests && guests < et.minGuests) {
      const gcGroup = $('#guestCount').closest('.form-group');
      gcGroup.classList.add('has-error');
      gcGroup.querySelector('.error-message').textContent = `Minimum ${et.minGuests} guests for ${et.label}`;
      valid = false;
    }

    return valid;
  }

  function collectStep1Data() {
    const et = MENU_DATA.eventTypes.find(e => e.id === $('#eventType').value);
    state.inquiry = {
      firstName: v('firstName'),
      lastName: v('lastName'),
      email: v('email'),
      phone: v('phone'),
      eventType: $('#eventType').value,
      eventTypeLabel: et.label,
      guestCount: parseInt(v('guestCount')),
      eventDate: v('eventDate'),
      startTime: v('startTime'),
      endTime: v('endTime'),
      venueName: v('venueName'),
      eventAddress: v('eventAddress'),
      leadSource: v('leadSource'),
      notes: v('notes')
    };
    state.eventType = et;
    state.menuTier = et.menuTier;
    state.serviceFee = et.serviceFee;
    state.guestCount = state.inquiry.guestCount;
  }

  // ════════════════════════════════════════════════════════════
  //  STEP 2 — Menu Builder
  // ════════════════════════════════════════════════════════════

  function renderStep2() {
    const container = $('#step2-content');
    const isAlaCarte = state.menuTier === 'alacarte';

    let html = `
      <div class="card card-highlight mb-2">
        <strong>${state.inquiry.eventTypeLabel}</strong> for
        <strong>${state.guestCount} guests</strong> on
        <strong>${formatDate(state.inquiry.eventDate)}</strong>
      </div>
    `;

    if (isAlaCarte) {
      html += renderAlaCarteMenu();
    } else {
      html += renderBuffetMenu();
    }

    html += `
      <div class="section-divider">Custom Requests</div>
      <textarea id="customRequests" placeholder="Anything outside the standard menu? Special dietary needs? Let us know..."
        style="width:100%; min-height:80px;">${state.customRequests}</textarea>
    `;

    container.innerHTML = `
      <div class="menu-layout">
        <div class="menu-selections">${html}</div>
        <div class="summary-sidebar">
          <div class="order-summary" id="orderSummary">
            <h3>Order Estimate</h3>
            <div id="summaryLines"></div>
          </div>
        </div>
      </div>
    `;

    if (isAlaCarte) {
      bindAlaCarteEvents();
    } else {
      bindBuffetEvents();
    }

    updateOrderSummary();
  }

  // ── Buffet Menu ─────────────────────────────────────────────

  function renderBuffetMenu() {
    const tier = state.menuTier;
    const combos = MENU_DATA.combos[tier];
    const hasCharcuterie = MENU_DATA.charcuterieTiers.includes(tier);
    const desserts = MENU_DATA.desserts[tier] || [];

    // Service type
    const serviceTypes = MENU_DATA.serviceTypes[tier];
    const serviceHtml = serviceTypes.map(st => {
      const sel = state.serviceType === st ? 'selected' : '';
      return `<div class="selection-item ${sel}" data-service="${st}">
        <input type="radio" name="serviceType" value="${st}" ${sel ? 'checked' : ''}>
        <span>${st}</span>
      </div>`;
    }).join('');

    // Combos
    const comboHtml = combos.map(c => {
      const sel = state.selectedCombo && state.selectedCombo.id === c.id ? 'selected' : '';
      return `<div class="combo-card ${sel}" data-combo="${c.id}">
        <div class="combo-name">${c.label}</div>
        <div class="combo-desc">${c.desc}</div>
        <div class="combo-price">$${c.price}<span>/person</span></div>
      </div>`;
    }).join('');

    // Meats
    const meatHtml = MENU_DATA.meats.map(m => {
      const sel = state.selectedMeats.includes(m) ? 'selected' : '';
      return `<div class="selection-item ${sel}" data-meat="${m}">
        <input type="checkbox" ${sel ? 'checked' : ''}>
        <span>${m}</span>
      </div>`;
    }).join('');

    // Sides
    const sideHtml = MENU_DATA.sides.map(s => {
      const sel = state.selectedSides.includes(s) ? 'selected' : '';
      return `<div class="selection-item ${sel}" data-side="${s}">
        <input type="checkbox" ${sel ? 'checked' : ''}>
        <span>${s}</span>
      </div>`;
    }).join('');

    // Sauces
    const sauceHtml = MENU_DATA.sauces.map(s => {
      const sel = state.selectedSauces.includes(s) ? 'selected' : '';
      return `<div class="selection-item ${sel}" data-sauce="${s}">
        <input type="checkbox" ${sel ? 'checked' : ''}>
        <span>${s}</span>
      </div>`;
    }).join('');

    // Additional meats
    const addMeatHtml = MENU_DATA.additionalMeats.map(m => {
      const qty = state.additionalMeats[m.name] || 0;
      const priceLabel = m.price ? `$${m.price} ${m.unit}` : `${m.note}`;
      return `<div class="qty-row">
        <div class="item-info">
          <div class="item-name">${m.name}</div>
          <div class="item-price">${priceLabel}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-item="${m.name}" data-group="additionalMeats">-</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-action="inc" data-item="${m.name}" data-group="additionalMeats">+</button>
        </div>
      </div>`;
    }).join('');

    // Add-on trays
    const addOnHtml = MENU_DATA.addOnTrays.map(t => {
      const qty = state.addOnTrays[t.name] || 0;
      return `<div class="qty-row">
        <div class="item-info">
          <div class="item-name">${t.name}</div>
          <div class="item-price">$${t.price} ${t.unit}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-item="${t.name}" data-group="addOnTrays">-</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-action="inc" data-item="${t.name}" data-group="addOnTrays">+</button>
        </div>
      </div>`;
    }).join('');

    // Charcuterie
    let charcHtml = '';
    if (hasCharcuterie) {
      charcHtml = `<div class="section-divider">Charcuterie Boards</div>` +
        MENU_DATA.charcuterie.map(c => {
          const qty = state.charcuterie[c.name] || 0;
          return `<div class="qty-row">
            <div class="item-info">
              <div class="item-name">${c.name}</div>
              <div class="item-price">$${c.price}/person — ${c.desc}</div>
            </div>
            <div class="qty-controls">
              <button class="qty-btn" data-action="dec" data-item="${c.name}" data-group="charcuterie">-</button>
              <span class="qty-value">${qty}</span>
              <button class="qty-btn" data-action="inc" data-item="${c.name}" data-group="charcuterie">+</button>
            </div>
          </div>`;
        }).join('');
    }

    // Desserts
    let dessertHtml = '';
    if (desserts.length > 0) {
      dessertHtml = `<div class="section-divider">Desserts</div>`;
      if (desserts[0].price === null) {
        dessertHtml += `<div class="info-box info"><span class="info-icon">&#9432;</span>
          <span>Seasonal desserts available. We'll discuss options when confirming your booking.</span></div>`;
      } else {
        dessertHtml += desserts.map(d => {
          const qty = state.desserts[d.name] || 0;
          return `<div class="qty-row">
            <div class="item-info">
              <div class="item-name">${d.name}</div>
              <div class="item-price">$${d.price} ${d.unit}</div>
            </div>
            <div class="qty-controls">
              <button class="qty-btn" data-action="dec" data-item="${d.name}" data-group="desserts">-</button>
              <span class="qty-value">${qty}</span>
              <button class="qty-btn" data-action="inc" data-item="${d.name}" data-group="desserts">+</button>
            </div>
          </div>`;
        }).join('');
      }
    }

    // Full service includes
    const includesHtml = MENU_DATA.fullServiceIncludes.map(i => `<li>${i}</li>`).join('');

    return `
      <div class="section-divider">Service Type</div>
      <div class="selection-grid" id="serviceTypeGrid">${serviceHtml}</div>
      <div class="info-box info mt-1" id="fullServiceNote" style="display:none">
        <span class="info-icon">&#9432;</span>
        <div>
          <strong>Full Service includes:</strong>
          <ul style="margin:0.25rem 0 0 1rem; font-size:0.75rem;">${includesHtml}</ul>
        </div>
      </div>

      <div class="section-divider">Choose Your Combo</div>
      <div class="combo-grid" id="comboGrid">${comboHtml}</div>

      <div class="section-divider">Select Your Meats</div>
      <div class="selection-count" id="meatCount">Selected: <span class="count-current">0</span> / <span class="count-max">0</span></div>
      <div class="selection-grid" id="meatGrid">${meatHtml}</div>

      <div class="section-divider">Select Your Sides</div>
      <div class="selection-count" id="sideCount">Selected: <span class="count-current">0</span> / <span class="count-max">0</span></div>
      <div class="selection-grid" id="sideGrid">${sideHtml}</div>

      <div class="section-divider">Choose Your Sauces</div>
      <p class="text-small text-muted mb-1">Select as many as you'd like. Sauces are included.</p>
      <div class="selection-grid" id="sauceGrid">${sauceHtml}</div>

      <div class="section-divider">Additional Menu Options</div>
      <div class="qty-grid" id="addMeatGrid">${addMeatHtml}</div>

      <div class="section-divider">Add-On Trays</div>
      <div class="qty-grid" id="addOnGrid">${addOnHtml}</div>

      ${charcHtml}
      ${dessertHtml}
    `;
  }

  function bindBuffetEvents() {
    // Service type
    $$('#serviceTypeGrid .selection-item').forEach(el => {
      el.addEventListener('click', function () {
        $$('#serviceTypeGrid .selection-item').forEach(s => s.classList.remove('selected'));
        this.classList.add('selected');
        this.querySelector('input').checked = true;
        state.serviceType = this.dataset.service;

        const note = $('#fullServiceNote');
        if (state.serviceType.includes('Full Service')) {
          note.style.display = 'flex';
        } else {
          note.style.display = 'none';
        }
        updateOrderSummary();
      });
    });

    // Combos
    $$('#comboGrid .combo-card').forEach(el => {
      el.addEventListener('click', function () {
        $$('#comboGrid .combo-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        const tier = state.menuTier;
        state.selectedCombo = MENU_DATA.combos[tier].find(c => c.id === this.dataset.combo);
        state.selectedMeats = [];
        state.selectedSides = [];
        updateMeatSideCounters();
        resetMeatSideSelections();
        updateOrderSummary();
      });
    });

    // Meats
    $$('#meatGrid .selection-item').forEach(el => {
      el.addEventListener('click', function () {
        if (!state.selectedCombo) return;
        const meat = this.dataset.meat;
        const max = state.selectedCombo.meats;

        if (state.selectedMeats.includes(meat)) {
          state.selectedMeats = state.selectedMeats.filter(m => m !== meat);
          this.classList.remove('selected');
          this.querySelector('input').checked = false;
        } else if (state.selectedMeats.length < max) {
          state.selectedMeats.push(meat);
          this.classList.add('selected');
          this.querySelector('input').checked = true;
        }
        updateMeatSideCounters();
        updateMeatSideDisabled();
        updateOrderSummary();
      });
    });

    // Sides
    $$('#sideGrid .selection-item').forEach(el => {
      el.addEventListener('click', function () {
        if (!state.selectedCombo) return;
        const side = this.dataset.side;
        const max = state.selectedCombo.sides;

        if (state.selectedSides.includes(side)) {
          state.selectedSides = state.selectedSides.filter(s => s !== side);
          this.classList.remove('selected');
          this.querySelector('input').checked = false;
        } else if (state.selectedSides.length < max) {
          state.selectedSides.push(side);
          this.classList.add('selected');
          this.querySelector('input').checked = true;
        }
        updateMeatSideCounters();
        updateMeatSideDisabled();
        updateOrderSummary();
      });
    });

    // Sauces
    $$('#sauceGrid .selection-item').forEach(el => {
      el.addEventListener('click', function () {
        const sauce = this.dataset.sauce;
        if (state.selectedSauces.includes(sauce)) {
          state.selectedSauces = state.selectedSauces.filter(s => s !== sauce);
          this.classList.remove('selected');
          this.querySelector('input').checked = false;
        } else {
          state.selectedSauces.push(sauce);
          this.classList.add('selected');
          this.querySelector('input').checked = true;
        }
      });
    });

    // Quantity buttons (additional meats, add-ons, charcuterie, desserts)
    bindQtyButtons();
  }

  function updateMeatSideCounters() {
    if (!state.selectedCombo) return;
    const mc = $('#meatCount');
    const sc = $('#sideCount');
    mc.querySelector('.count-current').textContent = state.selectedMeats.length;
    mc.querySelector('.count-max').textContent = state.selectedCombo.meats;
    sc.querySelector('.count-current').textContent = state.selectedSides.length;
    sc.querySelector('.count-max').textContent = state.selectedCombo.sides;
  }

  function updateMeatSideDisabled() {
    if (!state.selectedCombo) return;

    $$('#meatGrid .selection-item').forEach(el => {
      const meat = el.dataset.meat;
      if (!state.selectedMeats.includes(meat) && state.selectedMeats.length >= state.selectedCombo.meats) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });

    $$('#sideGrid .selection-item').forEach(el => {
      const side = el.dataset.side;
      if (!state.selectedSides.includes(side) && state.selectedSides.length >= state.selectedCombo.sides) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });
  }

  function resetMeatSideSelections() {
    $$('#meatGrid .selection-item').forEach(el => {
      el.classList.remove('selected', 'disabled');
      el.querySelector('input').checked = false;
    });
    $$('#sideGrid .selection-item').forEach(el => {
      el.classList.remove('selected', 'disabled');
      el.querySelector('input').checked = false;
    });
  }

  // ── A-La-Carte Menu ─────────────────────────────────────────

  function renderAlaCarteMenu() {
    const alc = MENU_DATA.alacarte;

    // Service type
    const serviceTypes = MENU_DATA.serviceTypes.alacarte;
    const serviceHtml = serviceTypes.map(st => {
      const sel = state.serviceType === st ? 'selected' : '';
      return `<div class="selection-item ${sel}" data-service="${st}">
        <input type="radio" name="serviceType" value="${st}" ${sel ? 'checked' : ''}>
        <span>${st}</span>
      </div>`;
    }).join('');

    // Portion notes
    const notesHtml = alc.portionNotes.map(n => `<li>${n}</li>`).join('');

    // Meats by the pound
    const meatHtml = alc.meats.map(m => {
      const qty = state.alacarteMeats[m.name] || 0;
      const priceLabel = m.price ? `$${m.price.toFixed(2)} ${m.unit}` : `${m.note} (${m.unit})`;
      return `<div class="qty-row">
        <div class="item-info">
          <div class="item-name">${m.name}</div>
          <div class="item-price">${priceLabel}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-item="${m.name}" data-group="alacarteMeats">-</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-action="inc" data-item="${m.name}" data-group="alacarteMeats">+</button>
        </div>
      </div>`;
    }).join('');

    // Sides by tray
    const sideHtml = alc.sides.map(s => {
      const selected = state.alacarteSides[s.name] || '';
      return `<div class="tray-row" data-side="${s.name}">
        <div class="item-name">${s.name}</div>
        <div class="tray-options">
          <div class="tray-option ${selected === '' ? '' : ''}" data-size="" data-side="${s.name}">
            <span class="tray-size">None</span>
          </div>
          <div class="tray-option ${selected === 'half' ? 'selected' : ''}" data-size="half" data-side="${s.name}">
            <span class="tray-size">Half Tray</span>
            <span class="tray-price">$${s.halfTray}</span>
          </div>
          <div class="tray-option ${selected === 'full' ? 'selected' : ''}" data-size="full" data-side="${s.name}">
            <span class="tray-size">Full Tray</span>
            <span class="tray-price">$${s.fullTray}</span>
          </div>
        </div>
      </div>`;
    }).join('');

    // Add-ons
    const addOnHtml = alc.addOns.map(a => {
      const qty = state.alacarteAddOns[a.name] || 0;
      return `<div class="qty-row">
        <div class="item-info">
          <div class="item-name">${a.name}</div>
          <div class="item-price">$${a.price} ${a.unit}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-item="${a.name}" data-group="alacarteAddOns">-</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-action="inc" data-item="${a.name}" data-group="alacarteAddOns">+</button>
        </div>
      </div>`;
    }).join('');

    return `
      <div class="section-divider">Service Type</div>
      <div class="selection-grid" id="serviceTypeGrid">${serviceHtml}</div>

      <div class="info-box info mt-1">
        <span class="info-icon">&#9432;</span>
        <div>
          <strong>Portion Guide:</strong>
          <ul style="margin:0.25rem 0 0 1rem; font-size:0.75rem;">${notesHtml}</ul>
        </div>
      </div>

      <div class="section-divider">Meats</div>
      <div class="qty-grid" id="alcMeatGrid">${meatHtml}</div>

      <div class="section-divider">Sides by Tray</div>
      <div class="qty-grid" id="alcSideGrid">${sideHtml}</div>

      <div class="section-divider">Add-Ons</div>
      <div class="qty-grid" id="alcAddOnGrid">${addOnHtml}</div>
    `;
  }

  function bindAlaCarteEvents() {
    // Service type
    $$('#serviceTypeGrid .selection-item').forEach(el => {
      el.addEventListener('click', function () {
        $$('#serviceTypeGrid .selection-item').forEach(s => s.classList.remove('selected'));
        this.classList.add('selected');
        this.querySelector('input').checked = true;
        state.serviceType = this.dataset.service;
        updateOrderSummary();
      });
    });

    // Tray size selectors
    $$('.tray-option').forEach(el => {
      el.addEventListener('click', function () {
        const sideName = this.dataset.side;
        const size = this.dataset.size;
        const row = this.closest('.tray-row');

        row.querySelectorAll('.tray-option').forEach(o => o.classList.remove('selected'));
        if (size) {
          this.classList.add('selected');
          state.alacarteSides[sideName] = size;
        } else {
          delete state.alacarteSides[sideName];
        }
        updateOrderSummary();
      });
    });

    bindQtyButtons();
  }

  // ── Shared Quantity Buttons ─────────────────────────────────

  function bindQtyButtons() {
    $$('.qty-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const action = this.dataset.action;
        const item = this.dataset.item;
        const group = this.dataset.group;
        const current = state[group][item] || 0;

        if (action === 'inc') {
          state[group][item] = current + 1;
        } else if (action === 'dec' && current > 0) {
          state[group][item] = current - 1;
          if (state[group][item] === 0) delete state[group][item];
        }

        this.parentElement.querySelector('.qty-value').textContent = state[group][item] || 0;
        updateOrderSummary();
      });
    });
  }

  // ── Order Summary Calculation ───────────────────────────────

  function calculateOrder() {
    const lines = [];
    let subtotal = 0;
    const guests = state.guestCount;
    const isAlaCarte = state.menuTier === 'alacarte';

    if (isAlaCarte) {
      // A-la-carte meats
      const alcMenuMeats = MENU_DATA.alacarte.meats;
      for (const [name, qty] of Object.entries(state.alacarteMeats)) {
        if (qty <= 0) continue;
        const item = alcMenuMeats.find(m => m.name === name);
        if (item && item.price) {
          const total = item.price * qty;
          lines.push({ label: `${name} x${qty}`, amount: total });
          subtotal += total;
        } else {
          lines.push({ label: `${name} x${qty}`, amount: null, note: 'Quote' });
        }
      }

      // A-la-carte sides
      const alcMenuSides = MENU_DATA.alacarte.sides;
      for (const [name, size] of Object.entries(state.alacarteSides)) {
        const item = alcMenuSides.find(s => s.name === name);
        if (item) {
          const price = size === 'half' ? item.halfTray : item.fullTray;
          lines.push({ label: `${name} (${size} tray)`, amount: price });
          subtotal += price;
        }
      }

      // A-la-carte add-ons
      const alcAddOns = MENU_DATA.alacarte.addOns;
      for (const [name, qty] of Object.entries(state.alacarteAddOns)) {
        if (qty <= 0) continue;
        const item = alcAddOns.find(a => a.name === name);
        if (item) {
          const total = item.price * qty;
          lines.push({ label: `${name} x${qty}`, amount: total });
          subtotal += total;
        }
      }
    } else {
      // Buffet combo
      if (state.selectedCombo) {
        const comboTotal = state.selectedCombo.price * guests;
        lines.push({ label: `${state.selectedCombo.label} x ${guests} guests`, amount: comboTotal });
        subtotal += comboTotal;
      }

      // Additional meats
      for (const [name, qty] of Object.entries(state.additionalMeats)) {
        if (qty <= 0) continue;
        const item = MENU_DATA.additionalMeats.find(m => m.name === name);
        if (item && item.price) {
          const total = item.price * qty;
          lines.push({ label: `${name} x${qty}`, amount: total });
          subtotal += total;
        } else {
          lines.push({ label: `${name} x${qty}`, amount: null, note: 'Quote' });
        }
      }

      // Add-on trays
      for (const [name, qty] of Object.entries(state.addOnTrays)) {
        if (qty <= 0) continue;
        const item = MENU_DATA.addOnTrays.find(t => t.name === name);
        if (item) {
          const total = item.price * qty;
          lines.push({ label: `${name} x${qty}`, amount: total });
          subtotal += total;
        }
      }

      // Charcuterie
      for (const [name, qty] of Object.entries(state.charcuterie)) {
        if (qty <= 0) continue;
        const item = MENU_DATA.charcuterie.find(c => c.name === name);
        if (item) {
          const total = item.price * guests; // per person
          lines.push({ label: `${name} (${guests} guests)`, amount: total });
          subtotal += total;
        }
      }

      // Desserts
      for (const [name, qty] of Object.entries(state.desserts)) {
        if (qty <= 0) continue;
        const tier = state.menuTier;
        const item = (MENU_DATA.desserts[tier] || []).find(d => d.name === name);
        if (item && item.price) {
          const total = item.price * guests; // per person
          lines.push({ label: `${name} (${guests} guests)`, amount: total });
          subtotal += total;
        }
      }
    }

    const tax = subtotal * MENU_DATA.TAX_RATE;
    const serviceFee = subtotal * state.serviceFee;
    const total = subtotal + tax + serviceFee;

    return { lines, subtotal, tax, serviceFee, total };
  }

  function updateOrderSummary() {
    const el = $('#summaryLines');
    if (!el) return;

    const order = calculateOrder();
    let html = '';

    order.lines.forEach(line => {
      const val = line.amount !== null ? `$${line.amount.toFixed(2)}` : line.note;
      html += `<div class="summary-line">
        <span class="label">${line.label}</span>
        <span class="value">${val}</span>
      </div>`;
    });

    if (order.lines.length === 0) {
      html = '<div class="summary-line"><span class="label">No items selected yet</span></div>';
    }

    html += `
      <div class="summary-line subtotal">
        <span class="label">Subtotal</span>
        <span class="value">$${order.subtotal.toFixed(2)}</span>
      </div>
      <div class="summary-line">
        <span class="label">Tax (6%)</span>
        <span class="value">$${order.tax.toFixed(2)}</span>
      </div>
    `;

    if (state.serviceFee > 0) {
      html += `<div class="summary-line">
        <span class="label">Service Fee (${(state.serviceFee * 100).toFixed(0)}%)</span>
        <span class="value">$${order.serviceFee.toFixed(2)}</span>
      </div>`;
    }

    html += `
      <div class="summary-line total">
        <span class="label">Estimated Total</span>
        <span class="value">$${order.total.toFixed(2)}</span>
      </div>
      <div class="summary-line" style="margin-top:0.5rem">
        <span class="label">Deposit Due Now</span>
        <span class="value" style="color:var(--red-light)">$${MENU_DATA.DEPOSIT_AMOUNT.toFixed(2)}</span>
      </div>
    `;

    el.innerHTML = html;
  }

  // ════════════════════════════════════════════════════════════
  //  STEP 3 — Review & Book
  // ════════════════════════════════════════════════════════════

  function handleGoToReview() {
    // Save custom requests
    const customEl = $('#customRequests');
    if (customEl) state.customRequests = customEl.value;

    // Validate minimum selections
    if (state.menuTier !== 'alacarte') {
      if (!state.selectedCombo) {
        alert('Please select a combo package before continuing.');
        return;
      }
      if (state.selectedMeats.length < state.selectedCombo.meats) {
        alert(`Please select ${state.selectedCombo.meats} meat(s) for your combo.`);
        return;
      }
      if (state.selectedSides.length < state.selectedCombo.sides) {
        alert(`Please select ${state.selectedCombo.sides} side(s) for your combo.`);
        return;
      }
    }

    if (!state.serviceType) {
      alert('Please select a service type (On-Site, Delivery, or Pick-Up).');
      return;
    }

    goToStep(3);
  }

  function renderStep3() {
    const order = calculateOrder();
    const container = $('#step3-content');

    // Build review table rows
    let tableRows = order.lines.map(line => {
      const val = line.amount !== null ? `$${line.amount.toFixed(2)}` : line.note;
      return `<tr><td>${line.label}</td><td class="text-right">${val}</td></tr>`;
    }).join('');

    // Event details summary
    const eventSummary = `
      <div class="card card-highlight">
        <h3 class="section-divider" style="margin-top:0">Event Details</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.85rem;">
          <div><strong>Name:</strong> ${state.inquiry.firstName} ${state.inquiry.lastName}</div>
          <div><strong>Email:</strong> ${state.inquiry.email}</div>
          <div><strong>Phone:</strong> ${state.inquiry.phone}</div>
          <div><strong>Event:</strong> ${state.inquiry.eventTypeLabel}</div>
          <div><strong>Date:</strong> ${formatDate(state.inquiry.eventDate)}</div>
          <div><strong>Time:</strong> ${formatTime(state.inquiry.startTime)}${state.inquiry.endTime ? ' - ' + formatTime(state.inquiry.endTime) : ''}</div>
          <div><strong>Guests:</strong> ${state.guestCount}</div>
          <div><strong>Service:</strong> ${state.serviceType}</div>
          <div style="grid-column:1/-1"><strong>Venue:</strong> ${state.inquiry.venueName}, ${state.inquiry.eventAddress}</div>
        </div>
      </div>
    `;

    // Menu selections summary
    let menuSummary = '';
    if (state.menuTier !== 'alacarte' && state.selectedCombo) {
      menuSummary = `
        <div class="card">
          <h3 class="section-divider" style="margin-top:0">Menu Selections</h3>
          <div style="font-size:0.85rem;">
            <p><strong>Package:</strong> ${state.selectedCombo.label} (${state.selectedCombo.desc})</p>
            <p><strong>Meats:</strong> ${state.selectedMeats.join(', ') || 'None'}</p>
            <p><strong>Sides:</strong> ${state.selectedSides.join(', ') || 'None'}</p>
            <p><strong>Sauces:</strong> ${state.selectedSauces.join(', ') || 'None selected'}</p>
            ${state.customRequests ? `<p><strong>Special Requests:</strong> ${state.customRequests}</p>` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      ${eventSummary}
      ${menuSummary}

      <div class="card">
        <h3 class="section-divider" style="margin-top:0">Order Estimate</h3>
        <table class="review-table">
          <thead><tr><th>Item</th><th class="text-right">Amount</th></tr></thead>
          <tbody>${tableRows}</tbody>
          <tfoot>
            <tr><td>Subtotal</td><td class="text-right">$${order.subtotal.toFixed(2)}</td></tr>
            <tr><td>Sales Tax (6%)</td><td class="text-right">$${order.tax.toFixed(2)}</td></tr>
            ${state.serviceFee > 0 ? `<tr><td>Service Fee (${(state.serviceFee * 100).toFixed(0)}%)</td><td class="text-right">$${order.serviceFee.toFixed(2)}</td></tr>` : ''}
            <tr class="grand-total"><td>Estimated Total</td><td class="text-right">$${order.total.toFixed(2)}</td></tr>
          </tfoot>
        </table>
        <p class="text-small text-muted mt-2">*Final pricing confirmed after booking. Market value items quoted separately. Balance due upon arrival to event.</p>
      </div>

      <div class="urgency-banner">
        <strong>Your date is not reserved until both the contract is signed and the $100 deposit is paid.</strong><br>
        Dates are first come, first served and they do go quickly.
      </div>

      <div class="card">
        <h3 class="section-divider" style="margin-top:0">Catering Agreement</h3>
        <div class="contract-box">
          <h4>SALADINO SMOKE CATERING AGREEMENT</h4>
          <p>Signing party hereby agrees that Saladino Smoke will provide the following Catering services for the event described above.</p>
          <p>Prices that are quoted in this Catering contract and the amount of food that will be prepared is for <strong>${state.guestCount}</strong> number of guests, not subject to reduction. If the number of guests does change, a new contract will need to be signed or the original number of guests stands.</p>
          <p>Any changes in the total number of guests will be required no later than ten days before the event. If there is no number received the original estimated count will be prepared and charged. Addition of guests within five days of the event will be charged a $25.00 per guest fee.</p>
          <p>The Caterer hereby reserves the right to discard any leftover food items where there is a reasonable risk for food borne illness to occur. By signing this contract, you agree to the risk of food being held at incorrect temperatures if refrigeration is not available on site and while transporting food from the event to your home.</p>
          <p>The Caterer will not be held liable for any loss that results from not fulfilling any terms or conditions of this Catering contract. If the Caterer is prevented or delayed from fulfilling in part or whole of this Catering contract due to war, riot, weather, or by any other act or condition that is not within the Caterer's control and which could not be prevented, the Caterer will not be held liable.</p>
          <p><strong>Deposit:</strong> $100.00 Non-Refundable booking fee to be paid in full when your event is scheduled. A deposit is required for all events.</p>
          <p><strong>On-Site Minimum:</strong> We require a minimum of 75 people at your event to serve on site. Any event within a 25-mile radius of Alto, MI there will be no charge for travel. 25 miles+ will cost an additional $0.75 per mile.</p>
          <p><strong>14 Days Prior:</strong> We will need the day of event, final menu, final head count, setup time, and address/contact number.</p>
          <p><strong>Payment:</strong> Payment in full is required upon arrival to your event. All pricing is subject to 6% sales tax, service fees, and gratuity.</p>
          <p>It is always our pleasure to serve you with our commitment of great service, quality, and customer satisfaction. If you have any questions, please don't hesitate to give us a call.</p>
        </div>

        <div class="form-group mt-2">
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; text-transform:none; letter-spacing:0;">
            <input type="checkbox" id="agreeContract" style="width:18px; height:18px; accent-color:var(--red);">
            I have read and agree to the Saladino Smoke Catering Agreement
          </label>
        </div>

        <div class="signature-pad-container mt-2">
          <label>Your Signature <span class="required">*</span></label>
          <canvas id="signaturePad" width="500" height="150"></canvas>
          <div class="signature-actions">
            <button id="clearSignature">Clear Signature</button>
          </div>
        </div>

        <div class="form-grid mt-2" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label>Printed Name <span class="required">*</span></label>
            <input type="text" id="printedName" value="${state.inquiry.firstName} ${state.inquiry.lastName}">
          </div>
          <div class="form-group">
            <label>Date</label>
            <input type="text" id="signDate" value="${new Date().toLocaleDateString()}" readonly style="background:#f5f5f5">
          </div>
        </div>
      </div>

      <div class="btn-group" style="justify-content:center">
        <button class="btn btn-secondary" id="btnBackToMenu">Back to Menu</button>
        <button class="btn btn-success btn-lg" id="btnSubmitBooking">
          Sign Agreement & Pay $100 Deposit
        </button>
      </div>
    `;

    // Re-bind events
    on('click', '#btnBackToMenu', () => goToStep(2));
    on('click', '#btnSubmitBooking', handleSubmitBooking);
    on('click', '#clearSignature', () => {
      clearSignaturePad();
      state.signatureData = null;
    });
    on('change', '#agreeContract', function () {
      state.contractAgreed = this.checked;
    });

    initSignaturePad();
  }

  // ── Submit Booking ──────────────────────────────────────────

  function handleSubmitBooking() {
    // Validate
    if (!state.contractAgreed) {
      alert('Please read and agree to the catering agreement before continuing.');
      return;
    }

    if (!state.signatureData) {
      alert('Please sign the agreement before continuing.');
      return;
    }

    const printedName = v('printedName');
    if (!printedName) {
      alert('Please enter your printed name.');
      return;
    }

    const order = calculateOrder();
    const btn = $('#btnSubmitBooking');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing...';

    const bookingData = {
      ...state.inquiry,
      serviceType: state.serviceType,
      menuTier: state.menuTier,
      selectedCombo: state.selectedCombo,
      selectedMeats: state.selectedMeats,
      selectedSides: state.selectedSides,
      selectedSauces: state.selectedSauces,
      additionalMeats: state.additionalMeats,
      addOnTrays: state.addOnTrays,
      charcuterie: state.charcuterie,
      desserts: state.desserts,
      alacarteMeats: state.alacarteMeats,
      alacarteSides: state.alacarteSides,
      alacarteAddOns: state.alacarteAddOns,
      customRequests: state.customRequests,
      orderEstimate: order,
      signatureData: state.signatureData,
      printedName: printedName,
      signDate: v('signDate'),
      contractAgreed: true
    };

    if (CONFIG.DEV_MODE || !CONFIG.BACKEND_URL) {
      // Dev mode: simulate success
      setTimeout(() => {
        showConfirmation(bookingData);
      }, 1500);
      return;
    }

    fetch(CONFIG.BACKEND_URL + '?action=submitBooking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          if (data.stripeUrl) {
            // Redirect to Stripe checkout for $100 deposit
            window.location.href = data.stripeUrl;
          } else {
            showConfirmation(bookingData);
          }
        } else {
          alert('Something went wrong. Please call us at ' + MENU_DATA.contact.phone);
          btn.disabled = false;
          btn.textContent = 'Sign Agreement & Pay $100 Deposit';
        }
      })
      .catch(() => {
        alert('Connection error. Please call us at ' + MENU_DATA.contact.phone);
        btn.disabled = false;
        btn.textContent = 'Sign Agreement & Pay $100 Deposit';
      });
  }

  function showConfirmation(booking) {
    const container = $('.main-container');
    container.innerHTML = `
      <div class="text-center" style="padding:2rem 0">
        <div class="confirmation-check">&#10003;</div>
        <h1 class="section-title">Booking Request Submitted!</h1>
        <p class="section-subtitle" style="max-width:500px; margin:0.5rem auto 2rem;">
          Thank you, ${booking.firstName}! We've received your catering request for
          <strong>${formatDate(booking.eventDate)}</strong>.
        </p>
      </div>

      <div class="card card-success">
        <h3 style="color:var(--success); margin-bottom:0.5rem;">What Happens Next</h3>
        <ol style="font-size:0.85rem; line-height:2; padding-left:1.25rem;">
          <li>We'll review your order and confirm availability within 24 hours</li>
          <li>You'll receive a confirmation email at <strong>${booking.email}</strong></li>
          <li>14 days before your event, we'll confirm final details (head count, menu, setup time)</li>
          <li>Balance is due upon arrival at your event</li>
        </ol>
      </div>

      <div class="card" style="text-align:center">
        <p style="font-size:0.9rem; margin-bottom:0.75rem;">Questions? We'd love to hear from you.</p>
        <p style="font-size:1.1rem; font-weight:700;">
          <a href="tel:${MENU_DATA.contact.phone}" style="color:var(--red); text-decoration:none;">${MENU_DATA.contact.phone}</a>
        </p>
        <p style="font-size:0.85rem; color:var(--gray-500);">
          <a href="mailto:${MENU_DATA.contact.email}" style="color:var(--sage);">${MENU_DATA.contact.email}</a>
        </p>
      </div>
    `;

    // Hide progress bar
    $('.progress-bar').style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ════════════════════════════════════════════════════════════
  //  SIGNATURE PAD
  // ════════════════════════════════════════════════════════════

  let sigCanvas, sigCtx, sigDrawing = false;

  function initSignaturePad() {
    sigCanvas = $('#signaturePad');
    if (!sigCanvas) return;

    sigCtx = sigCanvas.getContext('2d');
    sigCtx.strokeStyle = '#121212';
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';

    // Resize canvas for display vs actual pixels
    const rect = sigCanvas.getBoundingClientRect();
    if (rect.width > 0) {
      sigCanvas.width = rect.width;
      sigCanvas.height = 150;
    }

    const getPos = (e) => {
      const rect = sigCanvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      sigDrawing = true;
      const pos = getPos(e);
      sigCtx.beginPath();
      sigCtx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!sigDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      sigCtx.lineTo(pos.x, pos.y);
      sigCtx.stroke();
    };

    const endDraw = () => {
      sigDrawing = false;
      state.signatureData = sigCanvas.toDataURL();
    };

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', draw);
    sigCanvas.addEventListener('mouseup', endDraw);
    sigCanvas.addEventListener('mouseleave', endDraw);
    sigCanvas.addEventListener('touchstart', startDraw);
    sigCanvas.addEventListener('touchmove', draw);
    sigCanvas.addEventListener('touchend', endDraw);
  }

  function clearSignaturePad() {
    if (sigCanvas && sigCtx) {
      sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════════════════════

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function v(id) { const el = $(`#${id}`); return el ? el.value.trim() : ''; }

  function on(event, sel, handler) {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (el) el.addEventListener(event, handler);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

})();
