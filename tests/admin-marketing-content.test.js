const { loginAsAdmin } = require('./helpers/auth.helper');
const {
  cleanupMarketingContentByTitle,
  closePool,
  createTestMarker,
  ensureTestMarketingContentsTable,
  getMarketingContentByTitle,
} = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

describe('admin marketing content management', () => {
  beforeAll(async () => {
    await ensureTestMarketingContentsTable();
  });

  test('admin can create, edit, and toggle promotion', async () => {
    const title = createTestMarker('Promo Title');
    const updatedTitle = `${title} Updated`;
    const agent = await loginAsAdmin();

    try {
      const createResponse = await agent
        .post('/admin/promotions')
        .type('form')
        .send({
          title,
          subtitle: 'Automated promotion',
          body: 'Promotion body',
          image_url: '',
          cta_label: 'Shop Now',
          cta_url: 'https://example.com/shop',
          placement: 'homepage',
          status: 'active',
          sort_order: '10',
          starts_at: '',
          ends_at: '',
        });

      expect(createResponse.status).toBe(302);
      expect(createResponse.headers.location).toBe('/admin/promotions');

      let content = await getMarketingContentByTitle(title);
      expect(content).toBeTruthy();
      expect(content.content_type).toBe('promotion');
      expect(content.status).toBe('active');

      const updateResponse = await agent
        .post(`/admin/promotions/${content.id}/update`)
        .type('form')
        .send({
          title: updatedTitle,
          subtitle: 'Updated promotion',
          body: 'Updated body',
          image_url: '',
          cta_label: 'Explore',
          cta_url: 'https://example.com/explore',
          placement: 'shop',
          status: 'active',
          sort_order: '11',
          starts_at: '',
          ends_at: '',
        });

      expect(updateResponse.status).toBe(302);
      expect(updateResponse.headers.location).toBe('/admin/promotions');

      content = await getMarketingContentByTitle(updatedTitle);
      expect(content).toBeTruthy();
      expect(content.subtitle).toBe('Updated promotion');
      expect(content.placement).toBe('shop');

      const toggleResponse = await agent.post(`/admin/promotions/${content.id}/toggle-status`);
      expect(toggleResponse.status).toBe(302);

      content = await getMarketingContentByTitle(updatedTitle);
      expect(content.status).toBe('inactive');
    } finally {
      await cleanupMarketingContentByTitle(title);
      await cleanupMarketingContentByTitle(updatedTitle);
    }
  });

  test('admin can create content banner with selectable type', async () => {
    const title = createTestMarker('Banner Title');
    const agent = await loginAsAdmin();

    try {
      const response = await agent
        .post('/admin/content')
        .type('form')
        .send({
          content_type: 'banner',
          title,
          subtitle: 'Automated banner',
          body: '',
          image_url: 'https://example.com/banner.jpg',
          cta_label: 'See Collection',
          cta_url: 'https://example.com/collection',
          placement: 'homepage',
          status: 'active',
          sort_order: '5',
          starts_at: '',
          ends_at: '',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/content');

      const content = await getMarketingContentByTitle(title);
      expect(content).toBeTruthy();
      expect(content.content_type).toBe('banner');
      expect(content.image_url).toBe('https://example.com/banner.jpg');
    } finally {
      await cleanupMarketingContentByTitle(title);
    }
  });

  test('invalid CTA URL is rejected', async () => {
    const agent = await loginAsAdmin();

    const response = await agent
      .post('/admin/promotions')
      .type('form')
      .send({
        title: 'Invalid URL Promo',
        subtitle: '',
        body: '',
        image_url: '',
        cta_label: 'Bad Link',
        cta_url: 'not-a-url',
        placement: 'homepage',
        status: 'active',
        sort_order: '0',
        starts_at: '',
        ends_at: '',
      });

    expect(response.status).toBe(422);
    expect(response.text).toContain('CTA URL harus diawali http:// atau https://.');
  });
});
