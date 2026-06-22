const { loginAsAdmin } = require('./helpers/auth.helper');
const {
  cleanupNotificationByTitle,
  closePool,
  createTestMarker,
  ensureTestNotificationsTable,
  getNotificationByTitle,
} = require('./helpers/db.helper');

afterAll(async () => {
  await closePool();
});

describe('admin notifications management', () => {
  beforeAll(async () => {
    await ensureTestNotificationsTable();
  });

  test('admin can create, edit, publish, and archive notification', async () => {
    const title = createTestMarker('Notification Title');
    const updatedTitle = `${title} Updated`;
    const agent = await loginAsAdmin();

    try {
      const createResponse = await agent
        .post('/admin/notifications')
        .type('form')
        .send({
          title,
          message: 'Automated notification message',
          type: 'info',
          audience: 'admin',
          status: 'draft',
          action_label: 'Open Orders',
          action_url: '/admin/orders',
          is_pinned: 'on',
        });

      expect(createResponse.status).toBe(302);
      expect(createResponse.headers.location).toBe('/admin/notifications');

      let notification = await getNotificationByTitle(title);
      expect(notification).toBeTruthy();
      expect(notification.status).toBe('draft');
      expect(Number(notification.is_pinned)).toBe(1);

      const updateResponse = await agent
        .post(`/admin/notifications/${notification.id}/update`)
        .type('form')
        .send({
          title: updatedTitle,
          message: 'Updated automated notification message',
          type: 'success',
          audience: 'all',
          status: 'draft',
          action_label: 'Open Dashboard',
          action_url: '/admin/dashboard',
        });

      expect(updateResponse.status).toBe(302);
      expect(updateResponse.headers.location).toBe('/admin/notifications');

      notification = await getNotificationByTitle(updatedTitle);
      expect(notification).toBeTruthy();
      expect(notification.type).toBe('success');
      expect(notification.audience).toBe('all');
      expect(Number(notification.is_pinned)).toBe(0);

      const publishResponse = await agent.post(`/admin/notifications/${notification.id}/publish`);
      expect(publishResponse.status).toBe(302);

      notification = await getNotificationByTitle(updatedTitle);
      expect(notification.status).toBe('published');
      expect(notification.published_at).toBeTruthy();

      const archiveResponse = await agent.post(`/admin/notifications/${notification.id}/archive`);
      expect(archiveResponse.status).toBe(302);

      notification = await getNotificationByTitle(updatedTitle);
      expect(notification.status).toBe('archived');
    } finally {
      await cleanupNotificationByTitle(title);
      await cleanupNotificationByTitle(updatedTitle);
    }
  });

  test('invalid action url is rejected', async () => {
    const agent = await loginAsAdmin();

    const response = await agent
      .post('/admin/notifications')
      .type('form')
      .send({
        title: 'Invalid Notification URL',
        message: 'Invalid URL test',
        type: 'info',
        audience: 'admin',
        status: 'draft',
        action_label: 'Bad',
        action_url: 'not-a-url',
      });

    expect(response.status).toBe(422);
    expect(response.text).toContain('Action URL harus berupa path internal /... atau URL http:// / https://.');
  });
});
