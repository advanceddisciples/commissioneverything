/* ============================================================
   Dylan Jo — Shared Shopping Cart (localStorage-based)
   Include on every page: <script src="cart.js"></script>
   ============================================================ */

const CART_KEY = 'dylanjo_cart_v1';

// ---- Supabase / Stripe backend config ----
// Public project URL + anon key — safe to expose in client-side code.
// Storage upload policy only allows INSERT (no read/list), and the
// checkout edge function re-validates every price server-side.
const SUPABASE_URL = 'https://veossvhvxgmstmiijmkw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlb3Nzdmh2eGdtc3RtaWlqbWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MzUyOTcsImV4cCI6MjA5OTMxMTI5N30.0Babo_KeQ7J4OMZLydm7jqaWjsOdrSTcOt_E7h4kXi0';
const FUNCTIONS_URL = SUPABASE_URL + '/functions/v1';

/**
 * Uploads a reference photo (e.g. a pet photo) straight to Supabase Storage
 * so it's never lost. Returns the storage path to save on the cart item, or
 * null if there was no file or the upload failed (failure never blocks
 * adding the item to the cart — we don't want a flaky upload to lose a sale).
 */
async function cartUploadPhoto(file) {
  if (!file) return null;
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/reference-photos/${path}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });
    if (!res.ok) {
      console.error('Photo upload failed:', await res.text());
      return null;
    }
    return path;
  } catch (e) {
    console.error('Photo upload error:', e);
    return null;
  }
}

function cartGetItems() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Cart read error:', e);
    return [];
  }
}

function cartSaveItems(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Cart save error:', e);
  }
  cartUpdateBadge();
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
}

/**
 * Add an item to the cart.
 * item: { id (string, stable per variant), name, variant, price (number), qty (number), image (optional data URI or emoji) }
 * If an item with the same id already exists, quantities are combined.
 */
function cartAddItem(item) {
  const items = cartGetItems();
  const existing = items.find(i => i.id === item.id);
  if (existing) {
    existing.qty += item.qty || 1;
  } else {
    items.push(Object.assign({ qty: 1 }, item));
  }
  cartSaveItems(items);
  return items;
}

function cartUpdateQty(id, qty) {
  let items = cartGetItems();
  qty = Math.max(1, parseInt(qty, 10) || 1);
  items = items.map(i => (i.id === id ? Object.assign({}, i, { qty }) : i));
  cartSaveItems(items);
  return items;
}

function cartRemoveItem(id) {
  const items = cartGetItems().filter(i => i.id !== id);
  cartSaveItems(items);
  return items;
}

function cartClear() {
  cartSaveItems([]);
}

function cartGetCount() {
  return cartGetItems().reduce((sum, i) => sum + i.qty, 0);
}

function cartGetSubtotal() {
  return cartGetItems().reduce((sum, i) => sum + i.price * i.qty, 0);
}

function cartFormatPrice(n) {
  return '$' + n.toFixed(2);
}

function cartUpdateBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) badge.textContent = String(cartGetCount());
}

/**
 * Builds the payload structure that will later be sent to a backend
 * endpoint to create a Stripe Checkout Session. Not sent anywhere yet —
 * this just shapes the data so that step is a drop-in later.
 */
function cartBuildCheckoutPayload() {
  const items = cartGetItems();
  return {
    items: items.map(i => ({
      name: i.name,
      variant: i.variant || null,
      price: i.price,
      qty: i.qty,
      customization: i.customization || null,
      photo_path: i.photo_path || null
    })),
    subtotal_usd: cartGetSubtotal(),
    currency: 'usd',
    created_at: new Date().toISOString()
  };
}

/**
 * Sends the cart to the create-checkout-session edge function, which
 * validates pricing, records the order, creates a Stripe Checkout Session,
 * and returns a URL to redirect the customer to.
 * Throws on failure so callers can show an error instead of redirecting.
 */
async function cartCheckout(customerEmail) {
  const payload = cartBuildCheckoutPayload();
  payload.customer_email = customerEmail || null;
  payload.origin = window.location.origin;

  const res = await fetch(`${FUNCTIONS_URL}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Checkout could not be started. Please try again.');
  }
  window.location.href = data.url;
}

document.addEventListener('DOMContentLoaded', cartUpdateBadge);
