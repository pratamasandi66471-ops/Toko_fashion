const slugifyPackage = require('slugify');

function makeSlug(value, options = {}) {
  return slugifyPackage(String(value || ''), {
    lower: true,
    strict: true,
    trim: true,
    ...options,
  });
}

module.exports = makeSlug;
module.exports.makeSlug = makeSlug;
