START TRANSACTION;

SET @admin_id = (
  SELECT id
  FROM users
  WHERE role = 'admin' AND status = 'active'
  ORDER BY id
  LIMIT 1
);

INSERT INTO categories (name, slug, description, image, status)
VALUES
  ('Women', 'women', 'Elegant daily wear and refined staples for women.', '/images/categories/women.jpg', 'active'),
  ('Men', 'men', 'Clean menswear essentials with a modern fit.', '/images/categories/men.jpg', 'active'),
  ('Dresses', 'dresses', 'Soft silhouettes, occasion dresses, and everyday pieces.', '/images/categories/dresses.jpg', 'active'),
  ('Tops', 'tops', 'Premium tees, tanks, shirts, and polished layers.', '/images/categories/tops.jpg', 'active'),
  ('Bottoms', 'bottoms', 'Jeans, trousers, and tailored daily essentials.', '/images/categories/bottoms.jpg', 'active'),
  ('Outerwear', 'outerwear', 'Blazers, jackets, hoodies, and seasonal layers.', '/images/categories/outerwear.jpg', 'active'),
  ('Accessories', 'accessories', 'Finishing touches for every S Fashion look.', '/images/categories/accessories.jpg', 'active'),
  ('Sale', 'sale', 'Selected styles with limited-time special prices.', '/images/categories/sale.jpg', 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  image = VALUES(image),
  status = VALUES(status);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Floral Midi Dress', 'floral-midi-dress', 'A romantic floral midi dress with a soft drape, tie waist, and elegant movement.', 799000, 719000, 'SFD-001', 'active', 1, @admin_id
FROM categories c WHERE c.slug = 'dresses'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Basic Cotton T-Shirt', 'basic-cotton-t-shirt', 'A soft cotton tee with a clean silhouette for everyday layering.', 145000, NULL, 'SFT-001', 'active', 0, @admin_id
FROM categories c WHERE c.slug = 'tops'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Premium Oversized Tee', 'premium-oversized-tee', 'A premium oversized tee with structured comfort and a relaxed boutique fit.', 189000, NULL, 'SFT-002', 'active', 1, @admin_id
FROM categories c WHERE c.slug = 'tops'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Linen Blend Blazer', 'linen-blend-blazer', 'A lightweight linen blend blazer designed for polished layering.', 899000, NULL, 'SFO-001', 'active', 1, @admin_id
FROM categories c WHERE c.slug = 'outerwear'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'High Waist Jeans', 'high-waist-jeans', 'High waist denim with a flattering cut and soft stretch finish.', 699000, 629000, 'SFB-001', 'active', 1, @admin_id
FROM categories c WHERE c.slug = 'bottoms'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Slim Fit Jeans', 'slim-fit-jeans', 'Classic slim fit jeans with a clean denim wash and everyday comfort.', 350000, NULL, 'SFB-002', 'active', 0, @admin_id
FROM categories c WHERE c.slug = 'bottoms'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Denim Jacket', 'denim-jacket', 'A timeless denim jacket with structured seams and a soft blue wash.', 550000, NULL, 'SFO-002', 'active', 0, @admin_id
FROM categories c WHERE c.slug = 'outerwear'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Oversize Hoodie', 'oversize-hoodie', 'A soft oversized hoodie for relaxed days and effortless layering.', 465000, NULL, 'SFO-003', 'active', 0, @admin_id
FROM categories c WHERE c.slug = 'outerwear'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Ribbed Tank Top', 'ribbed-tank-top', 'A refined ribbed tank with a close fit and soft stretch texture.', 299000, NULL, 'SFT-003', 'active', 0, @admin_id
FROM categories c WHERE c.slug = 'tops'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Tailored Trousers', 'tailored-trousers', 'Elegant tailored trousers with a clean line and versatile styling.', 699000, NULL, 'SFB-003', 'active', 1, @admin_id
FROM categories c WHERE c.slug = 'bottoms'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Canvas Sneakers', 'canvas-sneakers', 'Minimal canvas sneakers with a clean low-profile silhouette.', 549000, NULL, 'SFA-001', 'active', 0, @admin_id
FROM categories c WHERE c.slug = 'accessories'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, status, is_featured, created_by)
SELECT c.id, 'Cap Classic', 'cap-classic', 'A classic cap with a soft curved brim and embroidered S Fashion mark.', 125000, 99000, 'SFA-002', 'active', 0, @admin_id
FROM categories c WHERE c.slug = 'accessories'
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), description = VALUES(description), price = VALUES(price), discount_price = VALUES(discount_price), status = VALUES(status), is_featured = VALUES(is_featured), created_by = VALUES(created_by);

INSERT INTO product_images (id, product_id, image_url, is_primary)
VALUES
  (1001, (SELECT id FROM products WHERE slug = 'floral-midi-dress'), '/images/products/floral-midi-dress.jpg', 1),
  (1002, (SELECT id FROM products WHERE slug = 'basic-cotton-t-shirt'), '/images/products/basic-cotton-t-shirt.jpg', 1),
  (1003, (SELECT id FROM products WHERE slug = 'premium-oversized-tee'), '/images/products/premium-oversized-tee.jpg', 1),
  (1004, (SELECT id FROM products WHERE slug = 'linen-blend-blazer'), '/images/products/linen-blend-blazer.jpg', 1),
  (1005, (SELECT id FROM products WHERE slug = 'high-waist-jeans'), '/images/products/high-waist-jeans.jpg', 1),
  (1006, (SELECT id FROM products WHERE slug = 'slim-fit-jeans'), '/images/products/slim-fit-jeans.jpg', 1),
  (1007, (SELECT id FROM products WHERE slug = 'denim-jacket'), '/images/products/denim-jacket.jpg', 1),
  (1008, (SELECT id FROM products WHERE slug = 'oversize-hoodie'), '/images/products/oversize-hoodie.jpg', 1),
  (1009, (SELECT id FROM products WHERE slug = 'ribbed-tank-top'), '/images/products/ribbed-tank-top.jpg', 1),
  (1010, (SELECT id FROM products WHERE slug = 'tailored-trousers'), '/images/products/tailored-trousers.jpg', 1),
  (1011, (SELECT id FROM products WHERE slug = 'canvas-sneakers'), '/images/products/canvas-sneakers.jpg', 1),
  (1012, (SELECT id FROM products WHERE slug = 'cap-classic'), '/images/products/cap-classic.jpg', 1)
ON DUPLICATE KEY UPDATE
  product_id = VALUES(product_id),
  image_url = VALUES(image_url),
  is_primary = VALUES(is_primary);

INSERT INTO product_variants (product_id, size, color, color_code, stock, price_override, status, variant_sku)
VALUES
  ((SELECT id FROM products WHERE slug = 'floral-midi-dress'), 'S', 'Soft Pink', '#F4E1E1', 12, NULL, 'active', 'SFD-001-PNK-S'),
  ((SELECT id FROM products WHERE slug = 'floral-midi-dress'), 'M', 'Sky Blue', '#63A3BC', 10, NULL, 'active', 'SFD-001-BLU-M'),
  ((SELECT id FROM products WHERE slug = 'basic-cotton-t-shirt'), 'M', 'White', '#FFFFFF', 25, NULL, 'active', 'SFT-001-WHT-M'),
  ((SELECT id FROM products WHERE slug = 'basic-cotton-t-shirt'), 'L', 'Navy', '#1C1531', 20, NULL, 'active', 'SFT-001-NVY-L'),
  ((SELECT id FROM products WHERE slug = 'premium-oversized-tee'), 'M', 'Black', '#111111', 18, NULL, 'active', 'SFT-002-BLK-M'),
  ((SELECT id FROM products WHERE slug = 'premium-oversized-tee'), 'L', 'Soft Pink', '#F4E1E1', 14, NULL, 'active', 'SFT-002-PNK-L'),
  ((SELECT id FROM products WHERE slug = 'linen-blend-blazer'), 'M', 'Cream', '#F4E9DA', 8, NULL, 'active', 'SFO-001-CRM-M'),
  ((SELECT id FROM products WHERE slug = 'linen-blend-blazer'), 'L', 'Navy', '#1C1531', 7, NULL, 'active', 'SFO-001-NVY-L'),
  ((SELECT id FROM products WHERE slug = 'high-waist-jeans'), '28', 'Denim Blue', '#5B7DAF', 15, NULL, 'active', 'SFB-001-DNM-28'),
  ((SELECT id FROM products WHERE slug = 'high-waist-jeans'), '30', 'Dark Denim', '#243B64', 13, NULL, 'active', 'SFB-001-DDN-30'),
  ((SELECT id FROM products WHERE slug = 'slim-fit-jeans'), '30', 'Blue Denim', '#5B7DAF', 16, NULL, 'active', 'SFB-002-BLU-30'),
  ((SELECT id FROM products WHERE slug = 'slim-fit-jeans'), '32', 'Black Denim', '#202020', 12, NULL, 'active', 'SFB-002-BLK-32'),
  ((SELECT id FROM products WHERE slug = 'denim-jacket'), 'M', 'Denim Blue', '#5B7DAF', 11, NULL, 'active', 'SFO-002-BLU-M'),
  ((SELECT id FROM products WHERE slug = 'denim-jacket'), 'L', 'Light Denim', '#9BB4D2', 9, NULL, 'active', 'SFO-002-LDN-L'),
  ((SELECT id FROM products WHERE slug = 'oversize-hoodie'), 'M', 'Grey', '#A7A9AC', 10, NULL, 'active', 'SFO-003-GRY-M'),
  ((SELECT id FROM products WHERE slug = 'oversize-hoodie'), 'L', 'Navy', '#1C1531', 8, NULL, 'active', 'SFO-003-NVY-L'),
  ((SELECT id FROM products WHERE slug = 'ribbed-tank-top'), 'S', 'White', '#FFFFFF', 22, NULL, 'active', 'SFT-003-WHT-S'),
  ((SELECT id FROM products WHERE slug = 'ribbed-tank-top'), 'M', 'Accent Pink', '#E991A8', 18, NULL, 'active', 'SFT-003-PNK-M'),
  ((SELECT id FROM products WHERE slug = 'tailored-trousers'), 'M', 'Navy', '#1C1531', 10, NULL, 'active', 'SFB-003-NVY-M'),
  ((SELECT id FROM products WHERE slug = 'tailored-trousers'), 'L', 'Beige', '#D8C3A5', 9, NULL, 'active', 'SFB-003-BGE-L'),
  ((SELECT id FROM products WHERE slug = 'canvas-sneakers'), '41', 'White', '#FFFFFF', 17, NULL, 'active', 'SFA-001-WHT-41'),
  ((SELECT id FROM products WHERE slug = 'canvas-sneakers'), '42', 'Navy', '#1C1531', 15, NULL, 'active', 'SFA-001-NVY-42'),
  ((SELECT id FROM products WHERE slug = 'cap-classic'), 'ALL', 'Black', '#111111', 20, NULL, 'active', 'SFA-002-BLK-ALL'),
  ((SELECT id FROM products WHERE slug = 'cap-classic'), 'ALL', 'Denim Blue', '#5B7DAF', 18, NULL, 'active', 'SFA-002-BLU-ALL')
ON DUPLICATE KEY UPDATE
  color_code = VALUES(color_code),
  stock = VALUES(stock),
  price_override = VALUES(price_override),
  status = VALUES(status),
  variant_sku = VALUES(variant_sku);

COMMIT;
