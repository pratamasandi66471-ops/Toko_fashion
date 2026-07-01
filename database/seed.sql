START TRANSACTION;

-- Default password for seeded users: Welcome123!
-- Bcrypt  generated with cost 10.'$2b$10$dfUpvnVWVU8nh9PKSSwHduvCkoOs25SP9CKamQS/dx80UVkb3epIy'
SET @seed_password = '$2b$10$dfUpvnVWVU8nh9PKSSwHduvCkoOs25SP9CKamQS/dx80UVkb3epIy';

SET @seed_password = '$2b$10$dfUpvnVWVU8nh9PKSSwHduvCkoOs25SP9CKamQS/dx80UVkb3epIy';

INSERT INTO users (name, email, phone, password, role, status, created_at)
VALUES
  ('Staff Demo', 'staff@sfashion.com', '081200000002', @seed_password, 'staff', 'active', DATE_SUB(NOW(), INTERVAL 25 DAY)),
  ('Admin Demo', 'admin@sfashion.com', '081200000003', @seed_password, 'admin', 'active', DATE_SUB(NOW(), INTERVAL 25 DAY)),
  ('Dinda Permata', 'dinda.permata@email.com', '081200000101', @seed_password, 'customer', 'active', DATE_SUB(NOW(), INTERVAL 22 DAY)),
  ('Rizal Maulana', 'rizal.maulana@email.com', '081200000102', @seed_password, 'customer', 'active', DATE_SUB(NOW(), INTERVAL 18 DAY)),
  ('Siti Aisyah', 'siti.aisyah@email.com', '081200000103', @seed_password, 'customer', 'active', DATE_SUB(NOW(), INTERVAL 14 DAY)),
  ('Budi Santoso', 'budi.santoso@email.com', '081200000104', @seed_password, 'customer', 'active', DATE_SUB(NOW(), INTERVAL 10 DAY)),
  ('Ananda Putri', 'ananda.putri@email.com', '081200000105', @seed_password, 'customer', 'active', DATE_SUB(NOW(), INTERVAL 6 DAY)),
  ('Kevin Wijaya', 'kevin.wijaya@email.com', '081200000106', @seed_password, 'customer', 'active', DATE_SUB(NOW(), INTERVAL 3 DAY)),
  ('Maya Lestari', 'maya.lestari@email.com', '081200000107', @seed_password, 'customer', 'active', DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  phone = VALUES(phone),
  password = VALUES(password),
  role = VALUES(role),
  status = VALUES(status);

INSERT INTO categories (name, slug)
VALUES
  ('T-Shirts', 't-shirts'),
  ('Dresses', 'dresses'),
  ('Jeans', 'jeans'),
  ('Jackets', 'jackets'),
  ('Accessories', 'accessories')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  slug = VALUES(slug);

INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 1, c.id, 'TS-001', 'Basic Cotton T-Shirt', 'basic-cotton-t-shirt', 145000, 'active'
FROM categories c WHERE c.slug = 't-shirts'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 2, c.id, 'TS-002', 'Premium Oversized Tee', 'premium-oversized-tee', 189000, 'active'
FROM categories c WHERE c.slug = 't-shirts'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 3, c.id, 'DR-001', 'Floral Dress', 'floral-dress', 385000, 'active'
FROM categories c WHERE c.slug = 'dresses'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 4, c.id, 'DR-002', 'Midi Satin Dress', 'midi-satin-dress', 425000, 'active'
FROM categories c WHERE c.slug = 'dresses'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 5, c.id, 'JN-001', 'Slim Fit Jeans', 'slim-fit-jeans', 350000, 'active'
FROM categories c WHERE c.slug = 'jeans'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 6, c.id, 'JN-002', 'Straight Cut Jeans', 'straight-cut-jeans', 375000, 'active'
FROM categories c WHERE c.slug = 'jeans'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 7, c.id, 'JK-001', 'Oversize Hoodie', 'oversize-hoodie', 465000, 'active'
FROM categories c WHERE c.slug = 'jackets'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 8, c.id, 'JK-002', 'Denim Jacket', 'denim-jacket', 550000, 'active'
FROM categories c WHERE c.slug = 'jackets'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 9, c.id, 'AC-001', 'Sneakers Classic', 'sneakers-classic', 450000, 'active'
FROM categories c WHERE c.slug = 'accessories'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;
INSERT INTO products (id, category_id, sku, name, slug, price, status)
SELECT 10, c.id, 'AC-002', 'Cap Classic', 'cap-classic', 125000, 'active'
FROM categories c WHERE c.slug = 'accessories'
ON DUPLICATE KEY UPDATE price = VALUES(price), status = VALUES(status)
;

INSERT INTO product_images (product_id, image_url, is_primary)
VALUES
  (1, '/images/products/tshirt-1.jpg', TRUE),
  (2, '/images/products/tshirt-2.jpg', TRUE),
  (3, '/images/products/dress-1.jpg', TRUE),
  (4, '/images/products/dress-2.jpg', TRUE),
  (5, '/images/products/jeans-1.jpg', TRUE),
  (6, '/images/products/jeans-2.jpg', TRUE),
  (7, '/images/products/jacket-1.jpg', TRUE),
  (8, '/images/products/jacket-2.jpg', TRUE),
  (9, '/images/products/accessory-1.jpg', TRUE),
  (10, '/images/products/accessory-2.jpg', TRUE)
ON DUPLICATE KEY UPDATE
  image_url = VALUES(image_url),
  is_primary = VALUES(is_primary);

  INSERT INTO product_variants (product_id, size, color, stock, variant_sku)
VALUES
  (1, 'S', 'White', 5, 'TS-001-WHT-S'),
  (1, 'M', 'White', 5, 'TS-001-WHT-M'),

  (2, 'M', 'Black', 9, 'TS-002-BLK-M'),
  (2, 'L', 'Black', 9, 'TS-002-BLK-L'),

  (3, 'S', 'Floral Blue', 7, 'DR-001-BLU-S'),
  (3, 'M', 'Floral Blue', 7, 'DR-001-BLU-M'),

  (4, 'M', 'Satin Pink', 4, 'DR-002-PNK-M'),

  (5, '30', 'Blue Denim', 4, 'JN-001-BLU-30'),
  (6, '32', 'Blue Denim', 6, 'JN-002-BLU-32'),

  (7, 'L', 'Grey', 3, 'JK-001-GRY-L'),
  (8, 'L', 'Denim Blue', 5, 'JK-002-BLU-L'),

  (9, '42', 'White', 8, 'AC-001-WHT-42'),
  (10, 'ALL', 'Black', 2, 'AC-002-BLK-ALL')
ON DUPLICATE KEY UPDATE
  stock = VALUES(stock);

  INSERT INTO addresses (user_id, recipient_name, phone, province, city, district, postal_code, full_address, is_default)
SELECT id, name, phone, 'DKI Jakarta', 'Jakarta Selatan', 'Kebayoran Baru', '12110', 'Jl. Fashion Demo No. 1', TRUE
FROM users
WHERE role = 'customer'
ON DUPLICATE KEY UPDATE
  recipient_name = VALUES(recipient_name);

INSERT INTO orders (
  order_code,
  customer_id,
  address_id,
  total_amount,
  status,
  order_status,
  payment_status,
  ordered_at
)
SELECT 
  t.order_code,
  u.id,
  a.id,
  t.total_amount,
  t.status,
  CASE
    WHEN t.status = 'processing' THEN 'confirmed'
    WHEN t.status = 'shipped' THEN 'shipped'
    WHEN t.status = 'completed' THEN 'completed'
    WHEN t.status = 'cancelled' THEN 'cancelled'
    ELSE 'pending'
  END AS order_status,
  CASE
    WHEN t.payment_status = 'pending' THEN 'unpaid'
    ELSE t.payment_status
  END AS payment_status,
  DATE_SUB(NOW(), INTERVAL t.days_ago DAY) + INTERVAL t.hour_offset HOUR
FROM (
  SELECT 'ORD-2001' AS order_code, 'dinda.permata@email.com' AS email, 289000 AS total_amount, 'pending' AS status, 'pending' AS payment_status, 0 AS days_ago, 10 AS hour_offset
  UNION ALL SELECT 'ORD-2002', 'rizal.maulana@email.com', 175000, 'processing', 'paid', 0, 8
  UNION ALL SELECT 'ORD-2003', 'siti.aisyah@email.com', 350000, 'shipped', 'paid', 1, 15
  UNION ALL SELECT 'ORD-2004', 'budi.santoso@email.com', 125000, 'pending', 'pending', 1, 9
  UNION ALL SELECT 'ORD-2005', 'ananda.putri@email.com', 465000, 'completed', 'paid', 2, 11
  UNION ALL SELECT 'ORD-2006', 'kevin.wijaya@email.com', 425000, 'completed', 'paid', 3, 13
  UNION ALL SELECT 'ORD-2007', 'maya.lestari@email.com', 740000, 'completed', 'paid', 4, 14
  UNION ALL SELECT 'ORD-2008', 'dinda.permata@email.com', 285000, 'processing', 'paid', 5, 16
  UNION ALL SELECT 'ORD-2009', 'rizal.maulana@email.com', 910000, 'shipped', 'paid', 6, 17
  UNION ALL SELECT 'ORD-2010', 'siti.aisyah@email.com', 145000, 'completed', 'paid', 7, 12
  UNION ALL SELECT 'ORD-2011', 'budi.santoso@email.com', 550000, 'cancelled', 'failed', 8, 10
  UNION ALL SELECT 'ORD-2012', 'ananda.putri@email.com', 625000, 'completed', 'paid', 9, 14
  UNION ALL SELECT 'ORD-2013', 'kevin.wijaya@email.com', 499000, 'completed', 'paid', 10, 9
  UNION ALL SELECT 'ORD-2014', 'maya.lestari@email.com', 570000, 'processing', 'paid', 11, 16
  UNION ALL SELECT 'ORD-2015', 'dinda.permata@email.com', 330000, 'pending', 'pending', 12, 8
  UNION ALL SELECT 'ORD-2016', 'rizal.maulana@email.com', 820000, 'completed', 'paid', 13, 12
  UNION ALL SELECT 'ORD-2017', 'siti.aisyah@email.com', 450000, 'shipped', 'paid', 14, 13
  UNION ALL SELECT 'ORD-2018', 'budi.santoso@email.com', 275000, 'completed', 'paid', 15, 11
  UNION ALL SELECT 'ORD-2019', 'ananda.putri@email.com', 520000, 'completed', 'paid', 16, 15
  UNION ALL SELECT 'ORD-2020', 'kevin.wijaya@email.com', 305000, 'processing', 'paid', 17, 10
  UNION ALL SELECT 'ORD-2021', 'maya.lestari@email.com', 785000, 'completed', 'paid', 20, 14
  UNION ALL SELECT 'ORD-2022', 'dinda.permata@email.com', 210000, 'pending', 'pending', 22, 9
  UNION ALL SELECT 'ORD-2023', 'rizal.maulana@email.com', 650000, 'completed', 'paid', 24, 12
  UNION ALL SELECT 'ORD-2024', 'siti.aisyah@email.com', 990000, 'shipped', 'paid', 27, 16
  UNION ALL SELECT 'ORD-2025', 'budi.santoso@email.com', 430000, 'completed', 'paid', 29, 11
  UNION ALL SELECT 'ORD-2026', 'ananda.putri@email.com', 515000, 'processing', 'paid', 30, 13
) t
JOIN users u ON u.email = t.email
JOIN addresses a ON a.user_id = u.id
ON DUPLICATE KEY UPDATE
  customer_id = VALUES(customer_id),
  address_id = VALUES(address_id),
  total_amount = VALUES(total_amount),
  status = VALUES(status),
  payment_status = VALUES(payment_status),
  ordered_at = VALUES(ordered_at);

INSERT INTO order_items (
  order_id,
  product_id,
  product_variant_id,
  product_name,
  size,
  color,
  variant_sku,
  price,
  quantity,
  total,
  unit_price,
  subtotal
)
SELECT 
  o.id,
  p.id,
  pv.id,
  p.name,
  pv.size,
  pv.color,
  pv.variant_sku,
  p.price,
  t.quantity,
  p.price * t.quantity,
  p.price,
  p.price * t.quantity
FROM (
  SELECT 'ORD-2001' AS order_code, 'JK-001' AS sku, 1 AS quantity
  UNION ALL SELECT 'ORD-2002', 'TS-001', 1
  UNION ALL SELECT 'ORD-2003', 'JN-001', 1
  UNION ALL SELECT 'ORD-2004', 'AC-002', 1
  UNION ALL SELECT 'ORD-2005', 'JK-001', 1
  UNION ALL SELECT 'ORD-2006', 'DR-002', 1
  UNION ALL SELECT 'ORD-2007', 'JK-002', 1
  UNION ALL SELECT 'ORD-2007', 'AC-002', 1
  UNION ALL SELECT 'ORD-2008', 'TS-002', 1
  UNION ALL SELECT 'ORD-2008', 'AC-002', 1
  UNION ALL SELECT 'ORD-2009', 'AC-001', 1
  UNION ALL SELECT 'ORD-2009', 'DR-001', 1
  UNION ALL SELECT 'ORD-2010', 'TS-001', 1
  UNION ALL SELECT 'ORD-2011', 'JK-002', 1
  UNION ALL SELECT 'ORD-2012', 'JK-001', 1
  UNION ALL SELECT 'ORD-2012', 'TS-001', 1
  UNION ALL SELECT 'ORD-2013', 'JN-001', 1
  UNION ALL SELECT 'ORD-2013', 'AC-002', 1
  UNION ALL SELECT 'ORD-2014', 'DR-001', 1
  UNION ALL SELECT 'ORD-2014', 'TS-001', 1
  UNION ALL SELECT 'ORD-2015', 'TS-002', 1
  UNION ALL SELECT 'ORD-2015', 'AC-002', 1
  UNION ALL SELECT 'ORD-2016', 'AC-001', 1
  UNION ALL SELECT 'ORD-2016', 'TS-002', 1
  UNION ALL SELECT 'ORD-2017', 'AC-001', 1
  UNION ALL SELECT 'ORD-2018', 'JN-001', 1
  UNION ALL SELECT 'ORD-2019', 'JK-002', 1
  UNION ALL SELECT 'ORD-2020', 'TS-002', 1
  UNION ALL SELECT 'ORD-2021', 'DR-002', 1
  UNION ALL SELECT 'ORD-2021', 'AC-002', 1
  UNION ALL SELECT 'ORD-2022', 'TS-001', 1
  UNION ALL SELECT 'ORD-2023', 'JK-001', 1
  UNION ALL SELECT 'ORD-2024', 'AC-001', 1
  UNION ALL SELECT 'ORD-2024', 'DR-002', 1
  UNION ALL SELECT 'ORD-2025', 'JN-002', 1
  UNION ALL SELECT 'ORD-2026', 'JK-001', 1
) t
JOIN orders o ON o.order_code = t.order_code
JOIN products p ON p.sku = t.sku
JOIN product_variants pv ON pv.id = (
  SELECT pv2.id
  FROM product_variants pv2
  WHERE pv2.product_id = p.id
  ORDER BY pv2.id ASC
  LIMIT 1
)
ON DUPLICATE KEY UPDATE
  quantity = VALUES(quantity),
   price = VALUES(price),
  total = VALUES(total),
  unit_price = VALUES(unit_price),
  subtotal = VALUES(subtotal);

INSERT INTO payments (order_id, method, payment_method, amount, status, paid_at)
SELECT o.id,
       CASE
         WHEN o.order_code IN ('ORD-2009', 'ORD-2016', 'ORD-2024') THEN 'bank_transfer'
         WHEN o.order_code IN ('ORD-2004', 'ORD-2015', 'ORD-2022') THEN 'cod'
         ELSE 'bank_transfer'
       END AS method,
       CASE
         WHEN o.order_code IN ('ORD-2009', 'ORD-2016', 'ORD-2024') THEN 'bank_transfer'
         WHEN o.order_code IN ('ORD-2004', 'ORD-2015', 'ORD-2022') THEN 'cod'
         ELSE 'bank_transfer'
       END AS payment_method,
       o.total_amount,
       o.payment_status,
       CASE
         WHEN o.payment_status = 'paid' THEN DATE_ADD(o.ordered_at, INTERVAL 2 HOUR)
         ELSE NULL
       END AS paid_at
FROM orders o
ON DUPLICATE KEY UPDATE
  method = VALUES(method),
  payment_method = VALUES(payment_method),
  amount = VALUES(amount),
  status = VALUES(status),
  paid_at = VALUES(paid_at);

INSERT INTO reviews (product_id, customer_id, user_id, order_id, rating, message, comment, created_at)
SELECT 
  p.id,
  u.id,
  u.id,
  o.id,
  t.rating,
  t.message,
  t.message,
  DATE_SUB(NOW(), INTERVAL t.days_ago DAY)
FROM (
  SELECT 'JK-001' AS sku, 'dinda.permata@email.com' AS email, 5 AS rating, 'Hoodie premium dan nyaman dipakai seharian.' AS message, 1 AS days_ago
  UNION ALL SELECT 'JK-002', 'rizal.maulana@email.com', 5, 'Denim jacket premium, jahitan rapi.', 2
  UNION ALL SELECT 'DR-001', 'siti.aisyah@email.com', 4, 'Dress cantik, pas di badan.', 3
  UNION ALL SELECT 'AC-001', 'kevin.wijaya@email.com', 5, 'Sneakers nyaman buat harian.', 4
  UNION ALL SELECT 'TS-001', 'ananda.putri@email.com', 4, 'Bahan lembut dan adem.', 5
) t
JOIN products p ON p.sku = t.sku
JOIN users u ON u.email = t.email
JOIN orders o ON o.id = (
  SELECT o2.id
  FROM orders o2
  WHERE o2.customer_id = u.id
    AND o2.status IN ('completed', 'shipped')
  ORDER BY o2.ordered_at DESC, o2.id DESC
  LIMIT 1
)
ON DUPLICATE KEY UPDATE
  rating = VALUES(rating),
  message = VALUES(message),
  comment = VALUES(comment),
  created_at = VALUES(created_at);

COMMIT;
