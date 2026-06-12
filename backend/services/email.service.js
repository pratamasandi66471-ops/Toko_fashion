const nodemailer = require('nodemailer');

const formatCurrency = require('../helper/formatCurrency');
const settingsModel = require('../models/settings.model');

const DEFAULT_FROM = '"S Fashion" <no-reply@sfashion.test>';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createTransporter() {
  if (process.env.NODE_ENV === 'test') {
    console.warn('[email] NODE_ENV=test, email sending skipped.');
    return null;
  }

  if (!process.env.MAIL_HOST) {
    console.warn('[email] MAIL_HOST is not configured, email sending skipped.');
    return null;
  }

  const port = Number(process.env.MAIL_PORT || 587);
  const auth = process.env.MAIL_USER && process.env.MAIL_PASS
    ? {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      }
    : undefined;

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure: port === 465,
    auth,
  });
}

async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    console.warn('[email] Recipient is missing, email sending skipped.');
    return { skipped: true, reason: 'missing_recipient' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { skipped: true, reason: 'not_configured' };
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || DEFAULT_FROM,
    to,
    subject,
    text,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.info(`[email] Preview URL: ${previewUrl}`);
  }

  return info;
}

async function getEmailStoreSettings() {
  try {
    return await settingsModel.getStoreSettings();
  } catch (error) {
    console.error('[email] Failed to load store settings:', error);
    return settingsModel.toStoreSettings(settingsModel.DEFAULT_PUBLIC_SETTINGS);
  }
}

function buildEmailShell(title, bodyHtml, store = {}) {
  const storeName = store.name || 'S Fashion';
  const contactRows = [
    store.email ? `<p style="margin:4px 0;color:#5f5871;">Email: ${escapeHtml(store.email)}</p>` : '',
    store.phone ? `<p style="margin:4px 0;color:#5f5871;">Phone: ${escapeHtml(store.phone)}</p>` : '',
    store.address ? `<p style="margin:4px 0;color:#5f5871;">Address: ${escapeHtml(store.address)}</p>` : '',
  ].filter(Boolean).join('');

  return `
    <div style="margin:0;padding:24px;background:#f8f3f4;font-family:Arial,sans-serif;color:#1C1531;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F4E1E1;">
        <div style="padding:24px;background:#1C1531;color:#fff;">
          <p style="margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#F4E1E1;">${escapeHtml(storeName)}</p>
          <h1 style="margin:0;font-size:24px;line-height:1.3;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:24px;">
          ${bodyHtml}
        </div>
        ${contactRows ? `<div style="padding:18px 24px;border-top:1px solid #F4E1E1;background:#fff8fa;">${contactRows}</div>` : ''}
      </div>
    </div>
  `;
}

function buildItemsTable(items = []) {
  if (!items.length) {
    return '<p style="margin:16px 0;color:#5f5871;">Detail item belum tersedia.</p>';
  }

  const rows = items.map((item) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #F4E1E1;">
        <strong>${escapeHtml(item.productName || item.product_name)}</strong><br>
        <span style="font-size:12px;color:#5f5871;">${escapeHtml(item.size || '-')} / ${escapeHtml(item.color || '-')}</span>
      </td>
      <td style="padding:12px;border-bottom:1px solid #F4E1E1;text-align:center;">${Number(item.quantity || 0)}</td>
      <td style="padding:12px;border-bottom:1px solid #F4E1E1;text-align:right;">${formatCurrency(item.subtotal || item.total)}</td>
    </tr>
  `).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr>
          <th align="left" style="padding:12px;background:#F4E1E1;">Item</th>
          <th align="center" style="padding:12px;background:#F4E1E1;">Qty</th>
          <th align="right" style="padding:12px;background:#F4E1E1;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function sendOrderPlacedEmail({ customer, order, items = [] }) {
  const store = await getEmailStoreSettings();
  const customerName = customer?.name || 'Customer';
  const invoice = order?.invoiceNumber || order?.invoice_number || '-';
  const total = order?.totalAmount ?? order?.total_amount;
  const discount = Number(order?.discountAmount ?? order?.discount_amount ?? 0);

  const html = buildEmailShell('Order berhasil dibuat', `
    <p style="margin:0 0 12px;">Halo ${escapeHtml(customerName)},</p>
    <p style="margin:0 0 16px;color:#5f5871;">Terima kasih sudah belanja di ${escapeHtml(store.name || 'S Fashion')}. Pesanan kamu sudah kami terima.</p>
    <p style="margin:0;"><strong>Invoice:</strong> ${escapeHtml(invoice)}</p>
    <p style="margin:6px 0;"><strong>Total:</strong> ${formatCurrency(total)}</p>
    ${discount > 0 ? `<p style="margin:6px 0;"><strong>Diskon:</strong> -${formatCurrency(discount)}</p>` : ''}
    ${buildItemsTable(items)}
  `, store);

  const text = [
    `Halo ${customerName},`,
    `Pesanan kamu berhasil dibuat di ${store.name || 'S Fashion'}.`,
    `Invoice: ${invoice}`,
    `Total: ${formatCurrency(total)}`,
  ].join('\n');

  return sendEmail({
    to: customer?.email,
    subject: `Order S Fashion ${invoice}`,
    html,
    text,
  });
}

async function sendPaymentVerifiedEmail({ customer, order }) {
  const store = await getEmailStoreSettings();
  const customerName = customer?.name || 'Customer';
  const invoice = order?.invoiceNumber || order?.invoice_number || '-';
  const total = order?.totalAmount ?? order?.total_amount;

  const html = buildEmailShell('Payment berhasil diverifikasi', `
    <p style="margin:0 0 12px;">Halo ${escapeHtml(customerName)},</p>
    <p style="margin:0 0 16px;color:#5f5871;">Pembayaran untuk pesanan kamu sudah berhasil diverifikasi. Kami akan lanjut memproses pesananmu.</p>
    <p style="margin:0;"><strong>Invoice:</strong> ${escapeHtml(invoice)}</p>
    <p style="margin:6px 0;"><strong>Total:</strong> ${formatCurrency(total)}</p>
  `, store);

  const text = [
    `Halo ${customerName},`,
    `Pembayaran kamu sudah diverifikasi oleh ${store.name || 'S Fashion'}.`,
    `Invoice: ${invoice}`,
    `Total: ${formatCurrency(total)}`,
  ].join('\n');

  return sendEmail({
    to: customer?.email,
    subject: `Payment Verified ${invoice}`,
    html,
    text,
  });
}

async function sendOrderShippedEmail({ customer, order }) {
  const store = await getEmailStoreSettings();
  const customerName = customer?.name || 'Customer';
  const invoice = order?.invoiceNumber || order?.invoice_number || '-';
  const courier = order?.courier || '-';
  const trackingNumber = order?.trackingNumber || order?.tracking_number || '-';

  const html = buildEmailShell('Order sedang dikirim', `
    <p style="margin:0 0 12px;">Halo ${escapeHtml(customerName)},</p>
    <p style="margin:0 0 16px;color:#5f5871;">Pesanan kamu sudah dikirim.</p>
    <p style="margin:0;"><strong>Invoice:</strong> ${escapeHtml(invoice)}</p>
    <p style="margin:6px 0;"><strong>Courier:</strong> ${escapeHtml(courier)}</p>
    <p style="margin:6px 0;"><strong>Tracking:</strong> ${escapeHtml(trackingNumber)}</p>
  `, store);

  const text = [
    `Halo ${customerName},`,
    `Pesanan kamu dari ${store.name || 'S Fashion'} sudah dikirim.`,
    `Invoice: ${invoice}`,
    `Courier: ${courier}`,
    `Tracking: ${trackingNumber}`,
  ].join('\n');

  return sendEmail({
    to: customer?.email,
    subject: `Order Shipped ${invoice}`,
    html,
    text,
  });
}

module.exports = {
  createTransporter,
  sendEmail,
  sendOrderPlacedEmail,
  sendPaymentVerifiedEmail,
  sendOrderShippedEmail,
};
