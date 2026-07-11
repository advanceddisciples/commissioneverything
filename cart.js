/* ============================================================
   Dylan Jo — Shared Shopping Cart (localStorage-based)
   Include on every page: <script src="cart.js"></script>
   ============================================================ */

const CART_KEY = 'dylanjo_cart_v1';

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
      id: i.id,
      name: i.name,
      variant: i.variant || null,
      unit_price_usd: i.price,
      quantity: i.qty
    })),
    subtotal_usd: cartGetSubtotal(),
    currency: 'usd',
    created_at: new Date().toISOString()
  };
}

/**
 * Placeholder for the future Stripe integration.
 * TODO: POST cartBuildCheckoutPayload() to a backend endpoint
 * (e.g. /api/create-checkout-session), which creates a Stripe
 * Checkout Session server-side and returns a redirect URL.
 * For now this just logs the payload so the shape can be verified.
 */
function cartSubmitToCheckout() {
  const payload = cartBuildCheckoutPayload();
  console.log('Checkout payload (ready for backend):', payload);
  return payload;
}

document.addEventListener('DOMContentLoaded', cartUpdateBadge);
