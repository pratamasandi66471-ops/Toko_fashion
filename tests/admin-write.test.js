const { loginAsAdmin, loginAsCustomer } = require('./helpers/auth.helper');
const {
  cleanupAuditLogById,
  cleanupCustomerCart,
  cleanupOrdersByMarker,
  closePool,
  createTestMarker,
  ensureTestShippingMethods,
  ensureTestAddress,
  getActiveVariantWithStock,
  getLatestAuditLog,
  getOrderByMarker,
  getPaymentByOrderId,
  getTestCustomer,
  getVariantById,
  restoreVariantStock,
  setVariantStock,
} = require('./helpers/db.helper');

async function createCheckoutOrderFixture({ marker, quantity = 1, stock = 20 }) {
  await ensureTestShippingMethods();

  const customer = await getTestCustomer();
  expect(customer).toBeTruthy();

  const address = await ensureTestAddress(customer.id);
  expect(address).toBeTruthy();

  const variant = await getActiveVariantWithStock();
  if (!variant) {
    console.warn('Skipping admin write test: no active variant with stock in toko_test.');
    return null;
  }

  const originalVariant = await getVariantById(variant.id);
  expect(originalVariant).toBeTruthy();

  await cleanupCustomerCart(customer.id);
  await setVariantStock(variant.id, stock);

  const customerAgent = await loginAsCustomer();
  const cartResponse = await customerAgent
    .post('/cart/add')
    .type('form')
    .send({ product_variant_id: variant.id, quantity });

  expect(cartResponse.status).toBe(302);
  expect(cartResponse.headers.location).toBe('/cart');

  const checkoutResponse = await customerAgent
    .post('/checkout')
    .type('form')
    .send({
      address_id: address.id,
      shipping_method: 'regular',
      payment_method: 'bank_transfer',
      notes: marker,
    });

  expect(checkoutResponse.status).toBe(302);
  expect(checkoutResponse.headers.location).toMatch(/^\/checkout\/success\//);

  const order = await getOrderByMarker(marker);
  expect(order).toBeTruthy();

  const payment = await getPaymentByOrderId(order.id);
  expect(payment).toBeTruthy();

  return {
    customer,
    variant,
    originalStock: Number(originalVariant.stock),
    order,
    payment,
  };
}

afterAll(async () => {
  await closePool();
});

describe('admin write actions', () => {
  test('admin can verify payment and audit log is created', async () => {
    const marker = createTestMarker('ADMIN_PAYMENT_VERIFY');
    const fixture = await createCheckoutOrderFixture({ marker, quantity: 1, stock: 20 });
    if (!fixture) return;

    const { customer, variant, originalStock, order, payment } = fixture;
    let auditLogId = null;

    try {
      expect(payment.status).toBe('pending_verification');
      expect(order.payment_status).toBe('pending_verification');
      expect(order.status).toBe('pending');

      const adminAgent = await loginAsAdmin();
      const response = await adminAgent.post(`/admin/payments/${payment.id}/verify`).type('form').send({});

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`/admin/payments/${payment.id}`);

      const updatedOrder = await getOrderByMarker(marker);
      const updatedPayment = await getPaymentByOrderId(order.id);

      expect(updatedPayment).toBeTruthy();
      expect(updatedPayment.status).toBe('paid');
      expect(updatedPayment.paid_at).toBeTruthy();
      expect(updatedOrder.payment_status).toBe('paid');
      expect(updatedOrder.status).toBe('processing');
      expect(updatedOrder.order_status).toBe('confirmed');

      const auditLog = await getLatestAuditLog({
        action: 'PAYMENT_VERIFIED',
        entityType: 'payment',
        entityId: payment.id,
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.action).toBe('PAYMENT_VERIFIED');
      expect(auditLog.entity_type).toBe('payment');
      expect(Number(auditLog.entity_id)).toBe(Number(payment.id));
      expect(auditLog.role).toBe('admin');
      expect(auditLog.new_values).toContain('paid');
      auditLogId = auditLog.id;
    } finally {
      if (auditLogId) await cleanupAuditLogById(auditLogId);
      await cleanupOrdersByMarker(marker);
      await cleanupCustomerCart(customer.id);
      await restoreVariantStock(variant.id, originalStock);
    }
  });

  test('admin can update inventory stock and audit log is created', async () => {
    const variant = await getActiveVariantWithStock();
    if (!variant) {
      console.warn('Skipping inventory write test: no active variant with stock in toko_test.');
      return;
    }

    const originalVariant = await getVariantById(variant.id);
    expect(originalVariant).toBeTruthy();

    const originalStock = Number(originalVariant.stock);
    const nextStock = originalStock === 12 ? 13 : 12;
    let auditLogId = null;

    try {
      const adminAgent = await loginAsAdmin();
      const response = await adminAgent
        .post(`/admin/inventory/${variant.id}/update-stock`)
        .set('Referer', '/admin/inventory')
        .type('form')
        .send({ stock: nextStock });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/inventory');

      const updatedVariant = await getVariantById(variant.id);
      expect(Number(updatedVariant.stock)).toBe(nextStock);

      const auditLog = await getLatestAuditLog({
        action: 'STOCK_UPDATED',
        entityType: 'product_variant',
        entityId: variant.id,
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.action).toBe('STOCK_UPDATED');
      expect(auditLog.entity_type).toBe('product_variant');
      expect(Number(auditLog.entity_id)).toBe(Number(variant.id));
      expect(auditLog.role).toBe('admin');
      expect(auditLog.new_values).toContain(`"stock":${nextStock}`);
      auditLogId = auditLog.id;
    } finally {
      if (auditLogId) await cleanupAuditLogById(auditLogId);
      await restoreVariantStock(variant.id, originalStock);
    }
  });
});
