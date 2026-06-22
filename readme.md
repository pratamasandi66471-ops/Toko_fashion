# S Fashion - Project Status & Development Guide

README ini adalah source of truth status project S Fashion. Tujuannya:

1. Menjelaskan fitur yang sudah benar-benar terimplementasi.
2. Menandai fitur yang masih placeholder, kosong, atau belum terintegrasi.
3. Memberi prioritas kerja berikutnya agar development tetap terarah.

## Executive Summary

Status global project saat ini: **core e-commerce flow, admin modules utama, staff workflow, email notification, audit trail, automated testing dasar, production preparation, dan UI/UX customer flow sudah berjalan**.

Yang sudah kuat:
- Auth, session, role guard, flash message, Helmet basic security, dan auth rate limit.
- Storefront `/`, `/shop`, dan `/shop/:slug` sudah data-driven dari database.
- Cart dan checkout core flow sudah transactional, termasuk voucher checkout.
- Admin dashboard analytics dan admin domain utama sudah aktif.
- Staff operational workflow sudah data-driven.
- Email notification untuk order placed dan payment verified sudah tersedia.
- Audit trail admin/staff sudah tersedia melalui migration `audit_logs`.
- Automated tests dasar sudah tersedia dan pernah lulus.
- UI/UX cart, checkout, order success, shop, product detail, staff dashboard, dan admin dashboard shell sudah distabilkan dengan CSS token global.
- Struktur CSS sudah dipisah ke folder `base`, `customer`, `admin`, `staff`, dan `auth`; file CSS root lama hanya legacy compatibility copy.

Yang masih belum selesai:
- Tidak ada admin placeholder utama yang tersisa di sidebar production modules.
- Admin Settings sudah editable di DB dan terintegrasi ke navbar, footer storefront, serta email template.
- Service layer sudah mulai diisi, tetapi belum dipakai luas di semua controller/model.
- Checkout shipping sudah membaca metode aktif dari tabel `shipping_methods`.
- Fresh setup, seed, dan migration perlu terus dijaga agar cocok dengan schema aktif.

## Runtime Architecture

```text
Express App -> Routes -> Controller -> Model/Service -> MySQL -> EJS Views + Public Assets
```

Source of truth:
- Entry server: `backend/server.js`
- Express app: `backend/app.js`
- Active route modules:
  - `backend/routes/auth.routes.js`
  - `backend/routes/web.routes.js`
  - `backend/routes/admin.routes.js`
  - `backend/routes/staff.routes.js`
- Existing but not mounted:
  - `backend/routes/customer.routes.js`
- Models: `backend/models/*.js`
- Services: `backend/services/*.js`
- Views: `backend/views/**/*.ejs`
- Static assets: `public/css`, `public/js`, `public/uploads`

## CSS Architecture

CSS aktif sekarang dipisah berdasarkan domain. Untuk UI baru, edit file di folder domain berikut, bukan file root legacy.

```text
public/css/
  base/
    variables.css
    reset.css
    utilities.css
  customer/
    navbar.css
    footer.css
    home.css
    shop.css
    product-detail.css
    cart.css
    checkout.css
    order-success.css
    profile.css
  admin/
    admin-tokens.css
    admin-layout.css
    admin-sidebar.css
    admin-topbar.css
    admin-components.css
    admin-dashboard.css
    pages/
      audit-logs.css
      categories.css
      coupons.css
      customers.css
      inventory.css
      orders.css
      payments.css
      profile.css
      products.css
      reports.css
      reviews.css
      settings.css
      shipping.css
      marketing-content.css
      notifications.css
      staff-management.css
      vouchers.css
  staff/
    staff-layout.css
  auth/
    auth.css
```

Important CSS notes:
- `backend/views/layouts/main.ejs` loads base + customer CSS.
- `backend/views/layouts/dashboard.ejs` loads base + admin CSS for admin pages, but skips admin CSS for staff pages.
- Staff pages pass `dashboardSkin: 'staff'` and load `/css/staff/staff-layout.css`.
- Auth layout loads base + `/css/auth/auth.css`.
- Root files like `public/css/dashboard.css`, `public/css/staff.css`, `public/css/cart.css`, and `public/css/auth.css` are legacy compatibility copies. They are kept temporarily for rollback/reference and should not be edited for new UI work.
- Admin dashboard sidebar collapse state is handled by `public/js/dashboard.js` and stored in `localStorage` key `sf-admin-sidebar-collapsed`.

## Feature Checklist

### Auth, Security & Session

- [x] Register customer.
- [x] Login multi-role: `customer`, `staff`, `admin`.
- [x] Logout.
- [x] Session via `express-session`.
- [x] Flash message via `connect-flash`.
- [x] Role-based redirect after login.
- [x] Server validation via `express-validator`.
- [x] Client auth validation via `public/js/auth.js`.
- [x] Admin/staff/customer route guard.
- [x] Auth rate limit for `POST /login` and `POST /register`.
- [x] Helmet basic security headers with CSP disabled for compatibility.
- [x] Production session cookie hardening: `httpOnly`, `sameSite`, production `secure`.

### Customer Storefront

- [x] Home page data-driven via `storefrontController.showHome`.
- [x] Home categories use active DB categories and link to `/shop?category=slug`.
- [x] Home new arrivals use active DB products.
- [x] Home featured picks use `products.is_featured`, with latest-product fallback.
- [x] Navbar dynamic by login state.
- [x] Cart badge from `res.locals.cartCount`.
- [x] `/shop` data-driven from active products.
- [x] Search/filter/sort/pagination on `/shop`.
- [x] Product card is clickable and links to `/shop/:slug`.
- [x] `/shop/:slug` data-driven from product, images, variants, and related products.
- [x] Product detail submits only `product_variant_id` and `quantity` to cart.
- [x] Product detail variant selector uses active/in-stock variants.
- [x] Shop and product detail CSS use shared S Fashion design tokens.
- [x] Fallback image asset exists at `/images/placeholder-product.jpg`.
- [~] Some public UI links such as lookbook/help/newsletter are still not backed by real routes.

### Cart, Checkout & Voucher

- [x] Add to cart via `/cart/add`.
- [x] Cart item uses `product_variant_id`.
- [x] Quantity validation.
- [x] Update cart quantity.
- [x] Delete cart item.
- [x] Render cart summary from DB.
- [x] Checkout page.
- [x] Save customer address.
- [x] Shipping method is DB-driven through `shipping_methods`.
- [x] Default shipping seed includes `regular` and `express`.
- [x] Payment method: `bank_transfer`, `cod`.
- [x] Place order in DB transaction.
- [x] Reduce variant stock on successful checkout.
- [x] Create payment record.
- [x] Clear cart after successful order.
- [x] Order success page.
- [x] Checkout hardening for empty cart, invalid address, and stock changes.
- [x] Voucher validation through existing `vouchers` table.
- [x] Voucher discount applied server-side inside checkout transaction.
- [x] Voucher `used_count` increments only after successful order transaction.
- [x] Cart, checkout, and order success UI stabilized with `public/css/customer/cart.css`, `public/css/customer/checkout.css`, and global tokens.

### Admin Dashboard

- [x] `/admin/dashboard` UI.
- [x] Admin dashboard shell uses modular CSS under `public/css/admin/`.
- [x] Admin sidebar is fixed on desktop and drawer-based on tablet/mobile.
- [x] Admin sidebar supports desktop collapse/expand with persisted localStorage state.
- [x] `/admin/dashboard/data?range=day|week|month` JSON endpoint.
- [x] KPI revenue/orders/customers/products.
- [x] Sales series.
- [x] Order status distribution.
- [x] Customer growth.
- [x] Category revenue.
- [x] Recent orders/customers/reviews.
- [x] Low stock and best selling product widgets.
- [x] Schema compatibility fallback in dashboard model.

### Admin Category Management

- [x] Category list.
- [x] Create category.
- [x] Edit/update category.
- [x] Toggle category status.
- [x] Search/filter style UI through admin CRUD layout.
- [x] Uses `backend/models/category.model.js`.
- [x] Uses `backend/controllers/adminCategory.controller.js`.

### Admin Product Management

- [x] Product list with filters.
- [x] Create product.
- [x] Edit/update product.
- [x] Toggle product status.
- [x] Variant add/update/delete.
- [x] Product image add/delete/set-primary.
- [x] Product image upload with Multer.
- [x] Uploaded product images are stored under `public/uploads/products`.
- [x] Image URLs are saved as public paths like `/uploads/products/...`.
- [x] Upload hardening: JPG/PNG/WEBP only, max 2MB, sanitized filename.
- [x] Uses `backend/models/product.model.js`.
- [x] Uses `backend/controllers/adminProduct.controller.js`.

### Admin Order Management

- [x] `/admin/orders` list.
- [x] Search by invoice, order code, customer name, customer email.
- [x] Filter by order status.
- [x] Filter by payment status.
- [x] Pagination.
- [x] `/admin/orders/:id` detail.
- [x] Detail includes summary, customer, address, payment, and order items.
- [x] Update order status.
- [x] Update courier/tracking number.
- [x] Cancel order when not completed/cancelled.
- [x] Uses `orders.status` as main admin status.
- [x] Syncs `orders.order_status` mapping:
  - `pending -> pending`
  - `processing -> confirmed`
  - `shipped -> shipped`
  - `completed -> completed`
  - `cancelled -> cancelled`
- [!] Cancel order does not restock automatically in MVP.

### Admin Inventory Management

- [x] `/admin/inventory` list.
- [x] Search by product name, product SKU, variant SKU.
- [x] Filter by category, stock level, and variant status.
- [x] Summary cards for total variants, total stock, low stock, out of stock.
- [x] Inline variant stock update.
- [x] Toggle variant status.
- [x] Uses `product_variants.stock`; no `products.stock`.
- [x] Uses `backend/models/adminInventory.model.js`.
- [x] Uses `backend/controllers/adminInventory.controller.js`.

### Admin Payment Verification

- [x] `/admin/payments` list.
- [x] Search by order code, invoice, customer name/email.
- [x] Filter by payment status and method.
- [x] Payment detail page.
- [x] Verify payment transaction.
- [x] Reject payment transaction.
- [x] Verify uses `payments.status = 'paid'`.
- [x] Verify updates `orders.payment_status = 'paid'`.
- [x] Pending order moves to `orders.status = 'processing'` and `orders.order_status = 'confirmed'`.
- [x] Reject updates payment/order payment status to `failed`.
- [x] Uses `backend/models/adminPayment.model.js`.
- [x] Uses `backend/controllers/adminPayment.controller.js`.

### Admin Customer & Staff Management

- [x] `/admin/customers` list.
- [x] Customer search/filter/pagination.
- [x] Customer detail with profile, addresses, recent orders, and order summary.
- [x] Customer status update with role guard.
- [x] `/admin/staff` list.
- [x] Staff search/filter/pagination.
- [x] Create staff account with bcrypt password.
- [x] Edit staff profile.
- [x] Optional staff password update.
- [x] Staff status update with role guard.
- [x] Admin accounts are not managed through staff module.
- [x] Uses `backend/models/adminUser.model.js`.
- [x] Uses `backend/controllers/adminCustomer.controller.js`.
- [x] Uses `backend/controllers/adminStaff.controller.js`.

### Admin Profile

- [x] `/admin/profile` real admin account page.
- [x] Admin can view own name, email, phone, role, status, and account metadata.
- [x] Admin can update own name and phone.
- [x] Email, role, and status are read-only.
- [x] Admin can change password with current password verification.
- [x] Password hash is never rendered.
- [x] Profile/password updates are audited without password data.
- [x] Uses `backend/models/adminProfile.model.js`.
- [x] Uses `backend/controllers/adminProfile.controller.js`.

### Admin Settings

- [x] `/admin/settings` real editable settings page.
- [x] Store identity settings: store name, email, phone, and address.
- [x] Social link settings: Instagram, Facebook, and TikTok.
- [x] Settings are stored in the `settings` table.
- [x] Migration `database/migrations/create_settings_table.sql`.
- [x] Allowed setting keys are hardcoded; arbitrary keys from request body are ignored.
- [x] Admin-only access through existing admin route guard.
- [x] Public footer reads store identity and social links from DB settings.
- [x] Public navbar branding reads store name from DB settings.
- [x] Email templates read store identity/contact from DB settings with safe fallback.
- [x] Uses `backend/models/adminSettings.model.js`.
- [x] Uses `backend/controllers/adminSettings.controller.js`.
- [!] Settings are not yet wired into logo upload or maintenance mode.

### Admin Shipping Management

- [x] `/admin/shipping` real shipping management page.
- [x] Admin can list, search, create, edit, and toggle shipping methods.
- [x] Shipping methods are stored in the `shipping_methods` table.
- [x] Migration `database/migrations/create_shipping_methods_table.sql`.
- [x] `database/schema.sql` includes `shipping_methods` for fresh setup.
- [x] Checkout reads active shipping methods from DB.
- [x] Shipping updates are audited after successful admin actions.
- [x] Uses `backend/models/shipping.model.js`.
- [x] Uses `backend/controllers/adminShipping.controller.js`.
- [!] Shipping rates are still flat per method; no region/courier API integration yet.

### Admin Returns / Refunds

- [x] `/admin/returns` real returns/refunds management page.
- [x] Admin can list and search return requests.
- [x] Admin can create a manual return request from a shipped/completed order.
- [x] Admin can update return status and internal refund note.
- [x] Return requests are stored in the `return_requests` table.
- [x] Migration `database/migrations/create_return_requests_table.sql`.
- [x] `database/schema.sql` includes `return_requests` for fresh setup.
- [x] Return updates are audited after successful admin actions.
- [x] Uses `backend/models/adminReturn.model.js`.
- [x] Uses `backend/controllers/adminReturn.controller.js`.
- [!] MVP does not auto-restock inventory or execute real payment refunds.

### Admin Promotions & Content

- [x] `/admin/promotions` real promotions management page.
- [x] `/admin/content` real banners/content management page.
- [x] Admin can list, search, create, edit, and toggle marketing content.
- [x] Content types: `promotion`, `banner`, and `announcement`.
- [x] Placement support: `homepage`, `shop`, `product_detail`, and `global`.
- [x] Marketing content is stored in the `marketing_contents` table.
- [x] Migration `database/migrations/create_marketing_contents_table.sql`.
- [x] `database/schema.sql` includes `marketing_contents` for fresh setup.
- [x] Marketing content changes are audited after successful admin actions.
- [x] Uses `backend/models/adminMarketingContent.model.js`.
- [x] Uses `backend/controllers/adminMarketingContent.controller.js`.
- [!] Storefront rendering integration is intentionally staged for a later step.

### Admin Notifications

- [x] `/admin/notifications` real notifications center page.
- [x] Admin can list, search, create, edit, publish, and archive notifications.
- [x] Notification types: `info`, `success`, `warning`, and `danger`.
- [x] Notification audiences: `admin`, `staff`, `customer`, and `all`.
- [x] Notifications are stored in the `notifications` table.
- [x] Migration `database/migrations/create_notifications_table.sql`.
- [x] `database/schema.sql` includes `notifications` for fresh setup.
- [x] Notification changes are audited after successful admin actions.
- [x] Uses `backend/models/adminNotification.model.js`.
- [x] Uses `backend/controllers/adminNotification.controller.js`.
- [!] Email/push delivery and per-user read tracking are intentionally staged for a later step.

### Admin Review Management

- [x] `/admin/reviews` list.
- [x] Search/filter by rating/product.
- [x] Review detail.
- [x] Delete review.
- [x] Supports active schema compatibility with `message/comment` and `customer_id/user_id`.
- [x] Uses `backend/models/adminReview.model.js`.
- [x] Uses `backend/controllers/adminReview.controller.js`.

### Admin Coupon/Voucher Management

- [x] `/admin/coupons` list.
- [x] Create coupon/voucher.
- [x] Edit coupon/voucher.
- [x] Toggle status.
- [x] Duplicate code validation.
- [x] Fixed and percentage voucher validation.
- [x] Stores data in existing `vouchers` table.
- [x] `/admin/vouchers` redirects to `/admin/coupons`.
- [x] Uses `backend/models/adminVoucher.model.js`.
- [x] Uses `backend/controllers/adminVoucher.controller.js`.

### Admin Reports

- [x] `/admin/reports` read-only reports page.
- [x] Date range filter.
- [x] Sales summary.
- [x] Revenue by date.
- [x] Orders by status.
- [x] Best selling products.
- [x] Inventory snapshot.
- [x] Top customers.
- [x] Revenue and spending count paid orders only.
- [x] Uses `backend/models/adminReport.model.js`.
- [x] Uses `backend/controllers/adminReport.controller.js`.

### Admin Audit Logs

- [x] Migration `database/migrations/create_audit_logs.sql`.
- [x] `/admin/audit-logs` list.
- [x] Filter by search, action, entity type, and user id.
- [x] Audit service is non-fatal; audit failure does not break main action.
- [x] Payment, order, inventory, product, category, customer/staff, and staff workflow actions are audited.
- [x] No password/token/session data stored in audit payloads.
- [x] Uses `backend/models/auditLog.model.js`.
- [x] Uses `backend/services/audit.service.js`.
- [x] Uses `backend/controllers/adminAudit.controller.js`.

### Staff Workflow

- [x] Staff routes protected by staff role.
- [x] `/staff/dashboard` data-driven summary.
- [x] `/staff/orders` data-driven order queue.
- [x] `/staff/orders/:id` detail.
- [x] Staff update order status with forward-only transitions.
- [x] Staff update courier/tracking number.
- [x] `/staff/stocks` data-driven stock list.
- [x] Staff update variant stock.
- [x] `/staff/products` read-only product list.
- [x] Staff cannot cancel orders.
- [x] Staff cannot verify/reject payments.
- [x] Staff cannot access admin routes.
- [x] Uses `backend/models/staff.model.js`.
- [x] Uses `backend/controllers/staff.controller.js`.

### Email Notification

- [x] Nodemailer service.
- [x] Environment-driven SMTP config.
- [x] Order placed email.
- [x] Payment verified email.
- [x] Order shipped email stub/function.
- [x] Email send skips safely when `MAIL_HOST` is missing.
- [x] Email send skips in `NODE_ENV=test`.
- [x] Email failure does not fail checkout/payment verification.
- [x] Uses `backend/services/email.service.js`.

### Quality, Tests & Production Prep

- [x] Jest config.
- [x] Supertest app import from `backend/app.js`.
- [x] DB safety guard for `toko_test`.
- [x] Auth tests.
- [x] Storefront tests.
- [x] Cart tests.
- [x] Checkout transaction tests.
- [x] Admin smoke tests.
- [x] Admin write tests for payment/inventory/audit basics.
- [x] Production env example.
- [x] `.gitignore` for `.env`, backups, logs, node_modules, upload tmp.
- [x] `database/README-backup.md`.
- [x] `docs/PRODUCTION_CHECKLIST.md`.
- [x] Centralized error middleware mounted in `backend/app.js`.
- [x] HTML/JSON error handling through `backend/middleware/error.middleware.js`.
- [x] Error views: `backend/views/errors/404.ejs` and `backend/views/errors/error.ejs`.
- [~] Service layer exists only partially; several service files are still empty.

### UI/UX Stabilization

- [x] Global design tokens in `public/css/base/variables.css`.
- [x] Global reset in `public/css/base/reset.css`.
- [x] Shared utility components in `public/css/base/utilities.css`.
- [x] `public/css/main.css` is now a lightweight app layer.
- [x] Shared customer UI components: card, button, input, select, textarea, badge, empty state.
- [x] Cart page premium responsive layout.
- [x] Checkout page premium responsive layout.
- [x] Order success card.
- [x] Shop/product detail aligned with S Fashion tokens.
- [x] Customer navbar/footer links aligned to active storefront routes.
- [x] Mobile navbar interaction improved with accessible open/close behavior.
- [x] Admin CRUD base UI polished for responsive modern table/card/filter layout.
- [x] Admin CSS split into modular files: tokens, layout, sidebar, topbar, components, dashboard, and page CSS.
- [x] Admin dashboard sidebar supports desktop collapsed mode through `public/js/dashboard.js`.
- [x] Staff dashboard/workflow UI aligned with admin color system and lighter premium typography.
- [x] Customer CSS split under `public/css/customer/`.
- [x] Staff CSS active under `public/css/staff/staff-layout.css`.
- [x] Auth CSS active under `public/css/auth/auth.css`.
- [x] Root CSS files under `public/css/*.css` are retained as legacy compatibility copies, not active development targets.

### Admin Modules Still Placeholder

- [x] No main admin sidebar placeholder remains.

### Backend Files Still Empty / Not Fully Integrated

- [ ] `backend/controllers/payment.controller.js`
- [ ] `backend/controllers/product.controller.js`
- [ ] `backend/models/payment.model.js`
- [ ] `backend/models/review.model.js`
- [~] `backend/services/auth.service.js` tersedia sebagai helper auth, belum terintegrasi penuh ke controller.
- [x] `backend/services/order.service.js`
- [x] `backend/services/payment.service.js`
- [~] `backend/services/product.service.js` tersedia sebagai helper normalisasi/validasi produk, belum terintegrasi penuh ke controller.
- [x] `backend/services/stock.service.js`

### Helper Utilities

- [x] `backend/helper/redirectByRole.js`
- [x] `backend/helper/formatCurrency.js`
- [x] `backend/helper/generateInvoice.js`
- [x] `backend/helper/slugify.js`

### Frontend Assets

- [x] `public/js/auth.js`
- [x] `public/js/admin-dashboard.js`
- [x] `public/js/admin-products.js`
- [x] `public/js/dashboard.js` handles admin mobile drawer and desktop collapsible sidebar.
- [x] `public/js/shop.js`
- [x] `public/js/product-detail.js`
- [x] `public/js/navbar.js`
- [x] `public/css/base/variables.css`
- [x] `public/css/base/reset.css`
- [x] `public/css/base/utilities.css`
- [x] `public/css/main.css`
- [x] `public/css/customer/*`
- [x] `public/css/admin/*`
- [x] `public/css/admin/pages/*`
- [x] `public/css/staff/staff-layout.css`
- [x] `public/css/auth/auth.css`
- [~] `public/js/cart.js` exists but is empty.
- [~] `public/js/main.js` exists but is empty.

## Runtime Endpoints

### Auth Routes

| Method | Path | Access | Handler | Status |
|---|---|---|---|---|
| GET | `/register` | Guest | `authController.showRegister` | Active |
| POST | `/register` | Guest | `authController.register` | Active |
| GET | `/login` | Guest | `authController.showLogin` | Active |
| POST | `/login` | Guest | `authController.login` | Active |
| POST | `/logout` | Logged user | `authController.logout` | Active |

### Public / Customer Routes

| Method | Path | Access | Handler | Status |
|---|---|---|---|---|
| GET | `/` | Public | `storefrontController.showHome` | Active |
| GET | `/shop` | Public | `storefrontController.showShop` | Active |
| GET | `/shop/:slug` | Public | `storefrontController.showProductDetail` | Active |
| GET | `/profile` | Customer | Render profile | Active |
| GET | `/cart` | Customer | `cartController.showCart` | Active |
| POST | `/cart/add` | Customer | `cartController.addItem` | Active |
| PATCH | `/cart/items/:id` | Customer | `cartController.updateQuantity` | Active |
| DELETE | `/cart/items/:id` | Customer | `cartController.removeItem` | Active |
| GET | `/checkout` | Customer | `orderController.showCheckout` | Active |
| POST | `/checkout/address` | Customer | `orderController.saveAddress` | Active |
| POST | `/checkout` | Customer | `orderController.placeOrder` | Active |
| GET | `/checkout/success/:invoiceNumber` | Customer | `orderController.showOrderSuccess` | Active |

### Admin Routes

| Method | Path | Status |
|---|---|---|
| GET | `/admin/dashboard` | Active |
| GET | `/admin/dashboard/data` | Active |
| GET | `/admin/orders` | Active |
| GET | `/admin/orders/:id` | Active |
| POST | `/admin/orders/:id/status` | Active |
| POST | `/admin/orders/:id/tracking` | Active |
| POST | `/admin/orders/:id/cancel` | Active |
| GET | `/admin/products` | Active |
| GET | `/admin/products/create` | Active |
| POST | `/admin/products` | Active |
| GET | `/admin/products/:id/edit` | Active |
| POST | `/admin/products/:id/update` | Active |
| POST | `/admin/products/:id/toggle-status` | Active |
| POST | `/admin/products/:id/variants` | Active |
| POST | `/admin/products/variants/:variantId/update` | Active |
| POST | `/admin/products/variants/:variantId/delete` | Active |
| POST | `/admin/products/:id/images` | Active |
| POST | `/admin/products/images/:imageId/delete` | Active |
| POST | `/admin/products/images/:imageId/set-primary` | Active |
| GET | `/admin/categories` | Active |
| GET | `/admin/categories/create` | Active |
| POST | `/admin/categories` | Active |
| GET | `/admin/categories/:id/edit` | Active |
| POST | `/admin/categories/:id/update` | Active |
| POST | `/admin/categories/:id/toggle-status` | Active |
| GET | `/admin/inventory` | Active |
| POST | `/admin/inventory/:variantId/update-stock` | Active |
| POST | `/admin/inventory/:variantId/toggle-status` | Active |
| GET | `/admin/customers` | Active |
| GET | `/admin/customers/:id` | Active |
| POST | `/admin/customers/:id/status` | Active |
| GET | `/admin/staff` | Active |
| GET | `/admin/staff/create` | Active |
| POST | `/admin/staff` | Active |
| GET | `/admin/staff/:id/edit` | Active |
| POST | `/admin/staff/:id/update` | Active |
| POST | `/admin/staff/:id/status` | Active |
| GET | `/admin/payments` | Active |
| GET | `/admin/payments/:id` | Active |
| POST | `/admin/payments/:id/verify` | Active |
| POST | `/admin/payments/:id/reject` | Active |
| GET | `/admin/reviews` | Active |
| GET | `/admin/reviews/:id` | Active |
| POST | `/admin/reviews/:id/delete` | Active |
| GET | `/admin/coupons` | Active |
| GET | `/admin/coupons/create` | Active |
| POST | `/admin/coupons` | Active |
| GET | `/admin/coupons/:id/edit` | Active |
| POST | `/admin/coupons/:id/update` | Active |
| POST | `/admin/coupons/:id/toggle-status` | Active |
| GET | `/admin/reports` | Active |
| GET | `/admin/audit-logs` | Active |
| GET | `/admin/profile` | Active |
| POST | `/admin/profile` | Active |
| POST | `/admin/profile/password` | Active |
| GET | `/admin/settings` | Active |
| POST | `/admin/settings` | Active |
| GET | `/admin/shipping` | Active |
| GET | `/admin/shipping/create` | Active |
| POST | `/admin/shipping` | Active |
| GET | `/admin/shipping/:id/edit` | Active |
| POST | `/admin/shipping/:id/update` | Active |
| POST | `/admin/shipping/:id/toggle-status` | Active |
| GET | `/admin/returns` | Active |
| GET | `/admin/returns/create` | Active |
| POST | `/admin/returns` | Active |
| GET | `/admin/returns/:id` | Active |
| POST | `/admin/returns/:id/status` | Active |
| POST | `/admin/returns/:id/note` | Active |
| GET | `/admin/promotions` | Active |
| GET | `/admin/promotions/create` | Active |
| POST | `/admin/promotions` | Active |
| GET | `/admin/promotions/:id/edit` | Active |
| POST | `/admin/promotions/:id/update` | Active |
| POST | `/admin/promotions/:id/toggle-status` | Active |
| GET | `/admin/content` | Active |
| GET | `/admin/content/create` | Active |
| POST | `/admin/content` | Active |
| GET | `/admin/content/:id/edit` | Active |
| POST | `/admin/content/:id/update` | Active |
| POST | `/admin/content/:id/toggle-status` | Active |
| GET | `/admin/notifications` | Active |
| GET | `/admin/notifications/create` | Active |
| POST | `/admin/notifications` | Active |
| GET | `/admin/notifications/:id/edit` | Active |
| POST | `/admin/notifications/:id/update` | Active |
| POST | `/admin/notifications/:id/publish` | Active |
| POST | `/admin/notifications/:id/archive` | Active |

### Staff Routes

| Method | Path | Access | Status |
|---|---|---|---|
| GET | `/staff/dashboard` | Staff | Active |
| GET | `/staff/orders` | Staff | Active |
| GET | `/staff/orders/:id` | Staff | Active |
| POST | `/staff/orders/:id/status` | Staff | Active |
| POST | `/staff/orders/:id/tracking` | Staff | Active |
| GET | `/staff/stocks` | Staff | Active |
| POST | `/staff/stocks/:variantId/update` | Staff | Active |
| GET | `/staff/products` | Staff | Active |

## Data Layer & Database Notes

Main tables used by runtime:

- `users`
- `categories`
- `products`
- `product_images`
- `product_variants`
- `carts`
- `addresses`
- `orders`
- `order_items`
- `payments`
- `reviews`
- `vouchers`
- `settings`
- `marketing_contents`
- `notifications`
- `shipping_methods`
- `return_requests`
- `audit_logs` via migration

Important notes:
- `products` does not store stock or image URL directly. Stock lives in `product_variants.stock`; images live in `product_images.image_url`.
- Cart and product detail flow use `product_variant_id`.
- Checkout voucher logic uses `vouchers` and increments `used_count`.
- Checkout shipping logic uses active rows from `shipping_methods`; orders keep a snapshot through `shipping_cost` and `courier`.
- `orders.status` and `orders.order_status` both exist. Admin order management uses `orders.status` as the main editable status and syncs `orders.order_status`.
- `payments.status` and `orders.payment_status` can differ. Admin order/payment pages display payment record status first when available.
- `audit_logs` has no foreign key by design so logs survive user changes/deletion.
- `database/seed_products.sql` exists for product/category/image/variant seed data.
- `database/migration_hardening_cart_checkout.sql` exists for legacy hardening.
- `database/migrations/create_audit_logs.sql` must be run before using `/admin/audit-logs`.
- `database/migrations/create_settings_table.sql` creates DB-backed admin settings.
- `database/migrations/create_marketing_contents_table.sql` creates DB-backed promotions/content.
- `database/migrations/create_notifications_table.sql` creates DB-backed admin notifications.
- `database/migrations/create_shipping_methods_table.sql` creates DB-backed checkout shipping methods.
- `database/migrations/create_return_requests_table.sql` creates DB-backed return/refund requests.
- Back up DB before running migrations.

## Important Views

Implemented views include:

- Auth:
  - `backend/views/auth/login.ejs`
  - `backend/views/auth/register.ejs`
- Public/customer:
  - `backend/views/pages/home.ejs`
  - `backend/views/pages/shop.ejs`
  - `backend/views/pages/produk-detail.ejs`
  - `backend/views/pages/cart.ejs`
  - `backend/views/pages/checkout.ejs`
  - `backend/views/pages/order-success.ejs`
  - `backend/views/pages/profile.ejs`
- Admin:
  - `backend/views/admin/dashboard.ejs`
  - `backend/views/admin/products/*`
  - `backend/views/admin/categories/*`
  - `backend/views/admin/orders/*`
  - `backend/views/admin/inventory/index.ejs`
  - `backend/views/admin/payments/*`
  - `backend/views/admin/customers/*`
  - `backend/views/admin/staff/*`
  - `backend/views/admin/reviews/*`
  - `backend/views/admin/coupons/*`
  - `backend/views/admin/reports/index.ejs`
  - `backend/views/admin/audit-logs/index.ejs`
  - `backend/views/admin/settings/index.ejs`
  - `backend/views/admin/shipping/index.ejs`
  - `backend/views/admin/shipping/create.ejs`
  - `backend/views/admin/shipping/edit.ejs`
  - `backend/views/admin/returns/index.ejs`
  - `backend/views/admin/returns/create.ejs`
  - `backend/views/admin/returns/detail.ejs`
  - `backend/views/admin/marketing-content/index.ejs`
  - `backend/views/admin/marketing-content/create.ejs`
  - `backend/views/admin/marketing-content/edit.ejs`
  - `backend/views/admin/notifications/index.ejs`
  - `backend/views/admin/notifications/create.ejs`
  - `backend/views/admin/notifications/edit.ejs`
- Staff:
  - `backend/views/staff/dashboard.ejs`
  - `backend/views/staff/orders.ejs`
  - `backend/views/staff/order-detail.ejs`
  - `backend/views/staff/stocks.ejs`
  - `backend/views/staff/products.ejs`

Legacy/old admin views still present but not the main route target for implemented CRUD:

- `backend/views/admin/orders.ejs`
- `backend/views/admin/products.ejs`
- `backend/views/admin/categories.ejs`
- `backend/views/admin/users.ejs`
- `backend/views/admin/reports.ejs`
- `backend/views/admin/vochers.ejs`

## Known Gaps & Technical Debt

1. **Placeholder admin modules**
   - No main admin sidebar module is still a placeholder.
   - Shipping is DB-backed for flat shipping methods, but does not yet support region-based rates, courier API sync, or tracking provider integration.
   - Returns/refunds are DB-backed, but do not yet auto-restock inventory or execute real payment gateway refunds.
   - Promotions/content are DB-backed, but storefront rendering per placement is intentionally staged for a later step.
   - Notifications are DB-backed, but email/push delivery and per-user read tracking are later steps.
   - Settings are DB-backed and used by navbar/footer/email templates; logo upload and maintenance mode are still later steps.

2. **Service layer cleanup**
   - `audit.service.js` and `email.service.js` are implemented.
   - `order.service.js`, `payment.service.js`, and `stock.service.js` exist and are partially integrated.
   - `auth.service.js` now contains auth helper functions for password/session/status handling.
   - `product.service.js` now contains product/variant normalization and validation helpers.
   - `auth.service.js` and `product.service.js` are intentionally not fully wired into controllers yet to avoid broad regressions.
   - Heavy business logic still mostly lives in controllers/models.

3. **Empty/legacy JS files**
   - `public/js/dashboard.js` is active for admin sidebar drawer/collapse.
   - `public/js/cart.js` and `public/js/main.js` exist but are empty.

4. **Unused/unmounted customer route**
   - `backend/routes/customer.routes.js` exists but is not mounted in `backend/app.js`.

5. **MVP limitations**
   - Admin cancel order does not restock automatically.
   - Voucher redemption only uses `used_count`; no per-user redemption history.
   - Audit logs are append-only and have no export feature yet.

6. **Automated test coverage still partial**
   - Existing tests cover auth, storefront, cart, checkout, admin smoke, and basic admin write actions.
   - Remaining useful coverage: order cancellation/restock decision, staff workflow writes, voucher edge cases, upload validation, and error middleware once mounted.

7. **CSS legacy cleanup**
   - Root CSS files in `public/css/*.css` are retained as legacy compatibility copies.
   - Active CSS lives under `public/css/base`, `customer`, `admin`, `staff`, and `auth`.
   - Delete legacy root CSS only after manual visual QA confirms all admin, staff, auth, and customer pages are safe.

## Roadmap

### Phase 1 - Current Stabilization

- [x] Storefront data-driven.
- [x] Cart and checkout transactional.
- [x] Voucher checkout integration.
- [x] Product image upload hardening.
- [x] UI/UX stabilization for cart/checkout/success/shop/detail.
- [x] CSS architecture split into base/customer/admin/staff/auth folders.
- [x] Admin dashboard sidebar collapse/expand on desktop.
- [x] Basic production preparation.
- [x] Add real asset for `/images/placeholder-product.jpg`.
- [ ] Re-test fresh setup from `schema.sql` + seed files + audit migration.

### Phase 2 - Remaining Admin Features

- [x] Product/category CRUD.
- [x] Admin order management.
- [x] Inventory management.
- [x] Payment verification.
- [x] Customer/staff management.
- [x] Review management.
- [x] Coupon/voucher management.
- [x] Reports.
- [x] Audit logs.
- [x] Admin profile page.
- [x] Website settings.
- [x] Shipping management.
- [x] Returns/refund workflow.
- [x] Promotions/content management.
- [x] Notifications center.

### Phase 3 - Quality & Hardening

- [x] Mount centralized error middleware.
- [x] Add `errors/404.ejs` and `errors/error.ejs`.
- [ ] Move heavy order/payment/stock logic into services gradually.
- [x] Add automated tests for checkout transaction and admin write actions.
- [ ] Expand tests for staff workflow, upload validation, voucher edge cases, and error middleware.
- [ ] Add structured logging for transaction errors.
- [ ] Add export/reporting utilities where needed.

## Next Development Backlog

Urutan ini adalah rekomendasi kerja berikutnya berdasarkan status runtime saat ini.

### Priority 1 - Service Layer Cleanup

Status: **sedang berjalan**.

Yang perlu dikerjakan:
- Integrasikan `backend/services/order.service.js` lebih luas jika ada status/generator order baru.
- Integrasikan `backend/services/stock.service.js` lebih luas jika ada flow restock/cancel order.
- Integrasikan `backend/services/payment.service.js` lebih luas jika payment gateway/webhook ditambahkan.
- Integrasikan `backend/services/auth.service.js` secara bertahap ke auth controller setelah auth tests aman.
- Integrasikan `backend/services/product.service.js` secara bertahap ke admin product controller setelah product CRUD QA aman.
- Integrasikan satu domain per tahap agar checkout/payment/inventory tetap aman.

Alasan prioritas:
- Helper dasar sudah tersedia.
- Business logic berat masih banyak berada di models/controllers.
- Service layer akan membuat checkout, payment verification, dan inventory lebih mudah dites dan dirawat.

### Priority 2 - Remaining Admin Production Modules

Status: **belum selesai**.

Route yang masih placeholder:
- Tidak ada route utama admin sidebar yang masih placeholder.

Rekomendasi urutan:
- Promotions/content storefront integration jika ingin banner/promo tampil otomatis di homepage/shop.
- Notifications lanjutan jika ingin bell dropdown global, per-user read tracking, atau email/push broadcast.
- Shipping lanjutan hanya jika butuh rate per wilayah, integrasi courier API, atau tracking provider.
- Returns lanjutan hanya jika butuh auto-restock, payment gateway refund, atau customer-submitted return request.
- Integrasi settings lanjutan ke logo upload dan maintenance mode.

### Priority 3 - Test Coverage Expansion

Status: **sebagian selesai**.

Sudah ada:
- Auth tests.
- Storefront tests.
- Cart tests.
- Checkout transaction tests.
- Admin smoke tests.
- Basic admin write tests.

Yang masih bagus ditambahkan:
- Staff workflow write tests.
- Upload image validation tests.
- Voucher edge case tests.
- Error middleware tests.
- Notification read-tracking/email-broadcast tests jika fitur lanjutannya dibuat.

### Priority 4 - Optional Route/Frontend Cleanup

Status: **belum selesai**.

Yang bisa dibereskan setelah prioritas production:
- Evaluasi apakah `backend/routes/api.routes.js` perlu dipakai atau dihapus dari roadmap.
- Evaluasi `backend/routes/customer.routes.js` yang belum mounted.
- Isi atau hapus legacy empty JS sesuai kebutuhan UI.
- Hapus root CSS legacy bertahap setelah manual visual QA.
- Jika menghapus CSS legacy, pastikan tidak ada layout/controller yang masih merujuk `/css/*.css` root lama.

### Priority 5 - CSS Legacy Cleanup

Status: **menunggu manual visual QA**.

Langkah aman:
- QA `/admin/dashboard`, `/admin/products`, `/admin/orders`, `/admin/inventory`, `/admin/payments`, `/admin/reports`, dan `/admin/audit-logs`.
- QA sidebar admin desktop expanded/collapsed dan mobile drawer.
- QA `/staff/dashboard`, `/staff/orders`, `/staff/stocks`.
- QA `/`, `/shop`, `/shop/:slug`, `/cart`, `/checkout`, `/login`, dan `/register`.
- Setelah aman, hapus root CSS legacy satu per satu.
- Jalankan `npm test` setelah setiap batch penghapusan.

## Running The Project

### Requirements

- Node.js
- npm
- MySQL
- `.env` configured with:
  - `PORT`
  - `NODE_ENV`
  - `SESSION_SECRET`
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `MAIL_HOST`
  - `MAIL_PORT`
  - `MAIL_USER`
  - `MAIL_PASS`
  - `MAIL_FROM`

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Run Production-style Server

```bash
npm start
```

### Run Tests

Tests require database `toko_test`.

```bash
npm test
```

## Database Setup Notes

Recommended path:

1. Create/select the database.
2. Run `database/schema.sql`.
3. Review and run `database/seed.sql`.
4. If product catalog seed is needed, run `database/seed_products.sql`.
5. Run `database/migrations/create_audit_logs.sql` if audit logs are needed.
6. If working from a legacy DB, review `database/migration_hardening_cart_checkout.sql` before running it.

Backup:
- See `database/README-backup.md`.
- Do not run migrations blindly on production data.
- Back up DB before migration/hardening scripts.
- Verify active database name in `.env` matches the DB opened in phpMyAdmin/MySQL CLI.

## Manual QA Checklist

### Auth & Role

- [ ] Register customer succeeds.
- [ ] Login customer redirects to `/`.
- [ ] Login staff redirects to `/staff/dashboard`.
- [ ] Login admin redirects to `/admin/dashboard`.
- [ ] Customer cannot access `/admin/*`.
- [ ] Staff cannot access `/admin/*`.

### Storefront

- [ ] `/shop` renders products from DB.
- [ ] Search works.
- [ ] Category filter works.
- [ ] Sort works.
- [ ] Product card opens `/shop/:slug`.
- [ ] Product detail shows images and variants.
- [ ] Add to cart only works after selecting valid in-stock variant.

### Cart & Checkout

- [ ] Add item to cart succeeds.
- [ ] Quantity update works.
- [ ] Delete cart item works.
- [ ] Checkout with empty cart is rejected.
- [ ] Add address succeeds.
- [ ] Voucher applies when valid.
- [ ] Place order succeeds.
- [ ] Stock decreases after order.
- [ ] Payment record is created.
- [ ] Cart is cleared after checkout.
- [ ] Order placed email is sent/skipped safely depending on SMTP config.

### Admin

- [ ] Dashboard renders and `/admin/dashboard/data?range=day|week|month` returns JSON.
- [ ] Admin sidebar collapse/expand works on desktop and persists after refresh.
- [ ] Admin sidebar remains drawer-based on tablet/mobile.
- [ ] Products CRUD and image upload work.
- [ ] Categories CRUD works.
- [ ] Orders list/detail/status/tracking/cancel work.
- [ ] Inventory stock/status update works.
- [ ] Payment verify/reject works.
- [ ] Customers detail/status works.
- [ ] Staff create/edit/status works.
- [ ] Reviews list/detail/delete works.
- [ ] Coupons create/edit/toggle works.
- [ ] Shipping create/edit/toggle works and checkout shows active DB methods.
- [ ] Reports render with date filter.
- [ ] Audit logs capture admin/staff actions.

### Staff

- [ ] `/staff/dashboard` renders DB summary.
- [ ] Staff dashboard does not load admin collapsed-sidebar behavior visually.
- [ ] `/staff/orders` renders order queue.
- [ ] Staff can update allowed order status transitions.
- [ ] Staff can update tracking.
- [ ] `/staff/stocks` renders variant stock list.
- [ ] Staff can update stock.
- [ ] `/staff/products` renders read-only product list.

## Strategic Next Step

Fastest high-impact next step:

1. Fill and integrate service layer gradually, starting with `order.service.js`.

After that:

2. Move stock and payment helper logic into `stock.service.js` and `payment.service.js`.
3. Continue DB settings integration for logo upload and maintenance mode.
4. Integrate marketing content into storefront placements when ready.
5. Add notification read tracking or broadcast delivery when needed.
6. Expand tests for staff workflow, uploads, voucher edge cases, shipping/returns/marketing/notification edge cases, and error middleware.
