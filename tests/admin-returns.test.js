const { loginAsAdmin, loginAsCustomer } = require('./helpers/auth.helper');
const {
  cleanupCustomerCart,
  cleanupOrdersByMarker,
  cleanupReturnsByOrderId,
  closePool,
  createTestMarker,
  ensureTestAddress,
  ensureTestReturnRequestsTable,
  ensureTestShippingMethods,
  getActiveVariantWithStock,
  getOrderByMarker,
  getReturnByOrderId,
  getTestCustomer,
  getVariantById,
  query,
  restoreVariantStock,
  setVariantStock,
} = require('./helpers/db.helper');

async function createEligibleOrder() {
  await ensureTestShippingMethods();
  await ensureTestReturnRequestsTable();

  const marker = createTestMarker('RETURN_ORDER');
  const customer = await getTestCustomer();
  expect(customer).toBeTruthy();

  const address = await ensureTestAddress(customer.id);
  expect(address).toBeTruthy();

  const variant = await getActiveVariantWithStock();
  if (!variant) {
    console.warn('Skipping returns test: no active variant with stock in toko_test.');
    return null;
  }

  const originalVariant = await getVariantById(variant.id);
  await cleanupCustomerCart(customer.id);
  await setVariantStock(variant.id, 20);

  const customerAgent = await loginAsCustomer();
  await customerAgent
    .post('/cart/add')
    .type('form')
    .send({ product_variant_id: variant.id, quantity: 1 });

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

  const order = await getOrderByMarker(marker);
  expect(order).toBeTruthy();

  await query(
    `UPDATE orders o
     SET o.status = 'completed',
         o.order_status = 'completed',
         o.payment_status = 'paid'
     WHERE o.id = ?`,
    [order.id]
  );

  return {
    marker,
    customer,
    variant,
    originalStock: Number(originalVariant.stock),
    order: await getOrderByMarker(marker),
  };
}

afterAll(async () => {
  await closePool();
});

describe('admin returns management', () => {
  test('admin can create return request, update status, and update note', async () => {
    const fixture = await createEligibleOrder();
    if (!fixture) return;

    const { marker, customer, variant, originalStock, order } = fixture;
    const agent = await loginAsAdmin();

    try {
      const createResponse = await agent
        .post('/admin/returns')
        .type('form')
        .send({
          order_lookup: order.order_code,
          reason: 'Automated test return reason',
          admin_note: 'Initial admin note',
          refund_amount: '1000',
          status: 'requested',
        });

      expect(createResponse.status).toBe(302);
      expect(createResponse.headers.location).toMatch(/^\/admin\/returns\/\d+$/);

      let returnRequest = await getReturnByOrderId(order.id);
      expect(returnRequest).toBeTruthy();
      expect(returnRequest.reason).toContain('Automated test');
      expect(returnRequest.status).toBe('requested');
      expect(Number(returnRequest.refund_amount)).toBe(1000);

      const detailPage = await agent.get(`/admin/returns/${returnRequest.id}`);
      expect(detailPage.status).toBe(200);
      expect(detailPage.text).toContain(returnRequest.return_code);

      const statusResponse = await agent
        .post(`/admin/returns/${returnRequest.id}/status`)
        .type('form')
        .send({ status: 'approved' });

      expect(statusResponse.status).toBe(302);
      returnRequest = await getReturnByOrderId(order.id);
      expect(returnRequest.status).toBe('approved');

      const noteResponse = await agent
        .post(`/admin/returns/${returnRequest.id}/note`)
        .type('form')
        .send({
          admin_note: 'Updated note',
          refund_amount: '2000',
        });

      expect(noteResponse.status).toBe(302);
      returnRequest = await getReturnByOrderId(order.id);
      expect(returnRequest.admin_note).toBe('Updated note');
      expect(Number(returnRequest.refund_amount)).toBe(2000);
    } finally {
      await cleanupReturnsByOrderId(order.id);
      await cleanupOrdersByMarker(marker);
      await cleanupCustomerCart(customer.id);
      await restoreVariantStock(variant.id, originalStock);
    }
  });
});
