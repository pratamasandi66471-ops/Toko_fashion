# S Fashion Production Checklist

Gunakan checklist ini sebelum deploy production.

## Environment

- [ ] `.env` production lengkap dan tidak di-commit.
- [ ] `NODE_ENV=production`.
- [ ] `PORT` sesuai hosting/runtime.
- [ ] `SESSION_SECRET` panjang, acak, dan berbeda dari development.
- [ ] Database production tidak memakai user `root`.
- [ ] `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, dan `DB_NAME` sudah benar.
- [ ] SMTP production aktif: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`.

## Security

- [ ] HTTPS aktif di reverse proxy/hosting.
- [ ] Secure cookie aktif saat `NODE_ENV=production`.
- [ ] `helmet` aktif dengan CSP dimatikan sementara agar CSS/JS/EJS existing tetap aman berjalan.
- [ ] Rate limit aktif untuk `POST /login` dan `POST /register`.
- [ ] Upload image dibatasi 2MB.
- [ ] Upload image hanya menerima JPG, PNG, atau WEBP.

## Database

- [ ] Backup database dibuat sebelum migration.
- [ ] Migration `audit_logs` sudah dijalankan.
- [ ] Aplikasi bisa connect ke database production.
- [ ] Akun admin production sudah aman.

## Verification

- [ ] `npm test` lulus.
- [ ] Login/register sudah dites.
- [ ] `/shop` dan product detail sudah dites.
- [ ] Cart dan checkout sudah dites.
- [ ] Upload image produk sudah dites.
- [ ] Email order/payment sudah dites.
- [ ] Admin route utama sudah dites.
- [ ] Staff workflow sudah dites.
- [ ] Audit logs muncul untuk action admin/staff.
