function toFiniteNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value, options = {}) {
  const {
    locale = 'id-ID',
    currency = 'IDR',
    maximumFractionDigits = 0,
  } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(toFiniteNumber(value));
}

function formatRupiah(value) {
  return formatCurrency(value, { currency: 'IDR', maximumFractionDigits: 0 });
}

function formatNumber(value, options = {}) {
  const {
    locale = 'id-ID',
    maximumFractionDigits = 0,
  } = options;

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(toFiniteNumber(value));
}

module.exports = formatCurrency;
module.exports.formatCurrency = formatCurrency;
module.exports.formatRupiah = formatRupiah;
module.exports.formatNumber = formatNumber;
module.exports.toFiniteNumber = toFiniteNumber;
