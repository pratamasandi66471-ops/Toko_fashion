const { loginAsCustomer } = require('./helpers/auth.helper');
const {
  cleanupCustomerCart,
  cleanupOrdersByMarker,
  cleanupVoucherByCode,
  closePool,
  createTestMarker,
  createTestVoucher,
  ensureTestShippingMethods,
  ensureTestAddress,
  getActiveVariantWithStock,
  getOrderByMarker,
  getOrderItems,
  getPaymentByOrderId,
  getTestCustomer,
  getVariantById,
  getVoucherByCode,
  restoreVariantStock,
  setVariantStock,
} = require('./helpers/db.helper');

async function getCheckoutFixture(stock = 20) {
  await ensureTestShippingMethods();

  const customer = await getTestCustomer();
  expect(customer).toBeTruthy();

  const address = await ensureTestAddress(customer.id);
  expect(address).toBeTruthy();

  const variant = await getActiveVariantWithStock();
  if (!variant) {
    console.warn('Skipping checkout test: no active variant with stock in toko_test.');
    return null;
  }

  const originalVariant = await getVariantById(variant.id);
  expect(originalVariant).toBeTruthy();

  await cleanupCustomerCart(customer.id);
  await setVariantStock(variant.id, stock);

  return {
    customer,
    address,
    variant,
    originalStock: Number(originalVariant.stock),
  };
}

async function addVariantToCart(agent, variantId, quantity = 1) {
  const response = await agent
    .post('/cart/add')
    .type('form')
    .send({ product_variant_id: variantId, quantity });

  expect(response.status).toBe(302);
  expect(response.headers.location).toBe('/cart');
}

function checkoutPayload(addressId, marker, extra = {}) {
  return {
    address_id: addressId,
    shipping_method: 'regular',
    payment_method: 'bank_transfer',
    notes: marker,
    ...extra,
  };
}

async function expectSuccessfulCheckoutState({
  marker,
  customerId,
  variantId,
  expectedQuantity,
  expectedDiscount = null,
}) {
  const order = await getOrderByMarker(marker);
  expect(order).toBeTruthy();
  expect(Number(order.customer_id)).toBe(Number(customerId));

  if (expectedDiscount !== null) {
    expect(Number(order.discount_amount)).toBe(Number(expectedDiscount));
  }

  const items = await getOrderItems(order.id);
  expect(items.length).toBeGreaterThan(0);
  expect(items.some((item) => Number(item.product_variant_id) === Number(variantId))).toBe(true);

  const payment = await getPaymentByOrderId(order.id);
  expect(payment).toBeTruthy();
  expect(Number(payment.amount)).toBe(Number(order.total_amount));

  const variantAfter = await getVariantById(variantId);
  expect(Number(variantAfter.stock)).toBe(20 - expectedQuantity);

  return order;
}

afterAll(async () => {
  await closePool();
});

describe('checkout integration flow', () => {
  test('checkout success without voucher creates order, payment, items, clears cart, and decreases stock', async () => {
    const marker = createTestMarker('CHECKOUT_SUCCESS');
    const fixture = await getCheckoutFixture(20);
    if (!fixture) return;

    const { customer, address, variant, originalStock } = fixture;

    try {
      const agent = await loginAsCustomer();
      await addVariantToCart(agent, variant.id, 2);

      const response = await agent
        .post('/checkout')
        .type('form')
        .send(checkoutPayload(address.id, marker));

      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/^\/checkout\/success\//);

      await expectSuccessfulCheckoutState({
        marker,
        customerId: customer.id,
        variantId: variant.id,
        expectedQuantity: 2,
      });

      const cartAfter = await getActiveCustomerCartCount(customer.id);
      expect(cartAfter).toBe(0);
    } finally {
      await cleanupOrdersByMarker(marker);
      await cleanupCustomerCart(customer.id);
      await restoreVariantStock(variant.id, originalStock);
    }
  });

  test('checkout success with fixed voucher applies discount and increments usage', async () => {
    const marker = createTestMarker('CHECKOUT_VOUCHER');
    const voucherCode = createTestMarker('VOUCHER').replace(/_/g, '').slice(0, 32);
    const fixture = await getCheckoutFixture(20);
    if (!fixture) return;

    const { customer, address, variant, originalStock } = fixture;
    const discountValue = 1000;

    try {
      await createTestVoucher({
        code: voucherCode,
        type: 'fixed',
        value: discountValue,
        minPurchase: 0,
        status: 'active',
      });

      const agent = await loginAsCustomer();
      await addVariantToCart(agent, variant.id, 1);

      const response = await agent
        .post('/checkout')
        .type('form')
        .send(checkoutPayload(address.id, marker, { voucher_code: voucherCode }));

      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/^\/checkout\/success\//);

      const order = await expectSuccessfulCheckoutState({
        marker,
        customerId: customer.id,
        variantId: variant.id,
        expectedQuantity: 1,
        expectedDiscount: Math.min(discountValue, Number((await getOrderByMarker(marker)).subtotal)),
      });

      expect(Number(order.total_amount)).toBe(
        Number(order.subtotal) + Number(order.shipping_cost) - Number(order.discount_amount)
      );

      const voucherAfter = await getVoucherByCode(voucherCode);
      expect(voucherAfter).toBeTruthy();
      expect(Number(voucherAfter.used_count)).toBe(1);

      const cartAfter = await getActiveCustomerCartCount(customer.id);
      expect(cartAfter).toBe(0);
    } finally {
      await cleanupVoucherByCode(voucherCode);
      await cleanupOrdersByMarker(marker);
      await cleanupCustomerCart(customer.id);
      await restoreVariantStock(variant.id, originalStock);
    }
  });

  test('checkout rejects order when stock becomes insufficient before transaction', async () => {
    const marker = createTestMarker('CHECKOUT_STOCK_REJECT');
    const fixture = await getCheckoutFixture(1);
    if (!fixture) return;

    const { customer, address, variant, originalStock } = fixture;

    try {
      const agent = await loginAsCustomer();
      await addVariantToCart(agent, variant.id, 1);
      await setVariantStock(variant.id, 0);

      const response = await agent
        .post('/checkout')
        .type('form')
        .send(checkoutPayload(address.id, marker));

      expect([302, 422]).toContain(response.status);

      const order = await getOrderByMarker(marker);
      expect(order).toBeNull();

      const variantAfter = await getVariantById(variant.id);
      expect(Number(variantAfter.stock)).toBeGreaterThanOrEqual(0);
    } finally {
      await cleanupOrdersByMarker(marker);
      await cleanupCustomerCart(customer.id);
      await restoreVariantStock(variant.id, originalStock);
    }
  });
});

async function getActiveCustomerCartCount(customerId) {
  const { queryOne } = require('./helpers/db.helper');
  const row = await queryOne(
    `SELECT COUNT(*) AS total
     FROM carts c
     WHERE c.user_id = ?`,
    [customerId]
  );

  return Number(row?.total || 0);
}
