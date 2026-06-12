# Database Backup Guide

Panduan ini untuk backup dan restore database S Fashion sebelum deployment atau migration.

## Backup Database

Contoh XAMPP Windows:

```bash
C:\xampp\mysql\bin\mysqldump.exe -u root -p toko > backups\toko-YYYYMMDD-HHMM.sql
```

Jika user MySQL tidak memakai password, tetap jalankan command lalu tekan Enter saat diminta password.

## Restore Database

```bash
C:\xampp\mysql\bin\mysql.exe -u root -p toko < backups\toko-YYYYMMDD-HHMM.sql
```

Untuk restore ke database baru:

```sql
CREATE DATABASE toko_restore;
```

```bash
C:\xampp\mysql\bin\mysql.exe -u root -p toko_restore < backups\toko-YYYYMMDD-HHMM.sql
```

## Rekomendasi

- Selalu backup sebelum menjalankan migration, termasuk `audit_logs`.
- Simpan backup di folder `backups/` lokal atau storage aman.
- Jangan commit file backup ke GitHub.
- Uji restore secara berkala agar backup benar-benar bisa dipakai.
