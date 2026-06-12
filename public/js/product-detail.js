const variantData = document.getElementById('variantData');
let variants = [];

try {
  variants = variantData ? JSON.parse(variantData.textContent || '[]') : [];
} catch (error) {
  variants = [];
}

const thumbs = document.querySelectorAll('.thumb');
const mainImage = document.getElementById('mainProductImage');

thumbs.forEach((thumb) => {
  thumb.addEventListener('click', () => {
    thumbs.forEach((item) => item.classList.remove('active'));
    thumb.classList.add('active');

    const newImage = thumb.getAttribute('data-image');
    if (mainImage && newImage) mainImage.src = newImage;
  });
});

const colorButtons = document.querySelectorAll('.color-dot');
const sizeButtons = document.querySelectorAll('.size-options button');
const selectedColorText = document.getElementById('selectedColor');
const selectedSizeText = document.getElementById('selectedSize');
const variantStockText = document.getElementById('variantStockText');
const variantIdInput = document.getElementById('variantIdInput');
const addToCartButton = document.getElementById('addToCartButton');
const qtyMinus = document.getElementById('qtyMinus');
const qtyPlus = document.getElementById('qtyPlus');
const quantityInput = document.getElementById('quantityInput');
const quantityHiddenInput = document.getElementById('quantityHiddenInput');

let selectedColor = '';
let selectedSize = '';

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function setQuantity(value, max) {
  const safeMax = Math.max(1, Number(max || 1));
  const parsedValue = Number(value || 1);
  const safeValue = Math.min(Math.max(1, parsedValue), safeMax);

  if (quantityInput) {
    quantityInput.value = String(safeValue);
    quantityInput.max = String(safeMax);
  }

  if (quantityHiddenInput) {
    quantityHiddenInput.value = String(safeValue);
  }
}

function clearSelectedVariant(message) {
  if (variantIdInput) variantIdInput.value = '';
  if (variantStockText) variantStockText.textContent = message;
  if (addToCartButton) addToCartButton.disabled = true;
  setQuantity(1, 1);
}

function findSelectedVariant() {
  const normalizedColor = normalizeValue(selectedColor);
  const normalizedSize = normalizeValue(selectedSize);

  if (!normalizedColor || !normalizedSize || !Array.isArray(variants) || variants.length === 0) {
    return null;
  }

  return variants.find((variant) => (
    normalizeValue(variant.color) === normalizedColor
    && normalizeValue(variant.size) === normalizedSize
    && normalizeValue(variant.status || 'active') === 'active'
  )) || null;
}

function updateVariantState() {
  if (!selectedColor || !selectedSize) {
    clearSelectedVariant('Select a variant first');
    return;
  }

  const variant = findSelectedVariant();

  if (!variant) {
    clearSelectedVariant('Variant not available');
    return;
  }

  const stock = Number(variant.stock || 0);

  if (stock <= 0) {
    clearSelectedVariant('Out of stock');
    return;
  }

  if (variantIdInput) variantIdInput.value = String(variant.id);
  if (variantStockText) variantStockText.textContent = `${stock} available`;
  if (addToCartButton) addToCartButton.disabled = false;
  setQuantity(quantityInput ? quantityInput.value : 1, stock);
}

colorButtons.forEach((button) => {
  button.addEventListener('click', () => {
    colorButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');

    selectedColor = button.getAttribute('data-color') || '';
    if (selectedColorText) selectedColorText.textContent = selectedColor || 'Choose color';
    updateVariantState();
  });
});

sizeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    sizeButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');

    selectedSize = button.getAttribute('data-size') || '';
    if (selectedSizeText) selectedSizeText.textContent = selectedSize || 'Choose size';
    updateVariantState();
  });
});

if (qtyMinus && quantityInput) {
  qtyMinus.addEventListener('click', () => {
    setQuantity(Number(quantityInput.value) - 1, quantityInput.max);
  });
}

if (qtyPlus && quantityInput) {
  qtyPlus.addEventListener('click', () => {
    setQuantity(Number(quantityInput.value) + 1, quantityInput.max);
  });
}

if (quantityInput) {
  quantityInput.addEventListener('change', () => {
    setQuantity(quantityInput.value, quantityInput.max);
  });
}
