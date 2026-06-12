const addVariantButton = document.getElementById('addVariantRow');
const variantRepeater = document.getElementById('variantRepeater');
const variantTemplate = document.getElementById('variantRowTemplate');

function reindexVariantRows() {
  if (!variantRepeater) return;

  variantRepeater.querySelectorAll('[data-variant-row]').forEach((row, index) => {
    row.querySelectorAll('[name]').forEach((field) => {
      field.name = field.name.replace(/variants\[[^\]]+\]/, `variants[${index}]`);
    });
  });
}

if (addVariantButton && variantRepeater && variantTemplate) {
  addVariantButton.addEventListener('click', () => {
    const index = variantRepeater.querySelectorAll('[data-variant-row]').length;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = variantTemplate.innerHTML.replaceAll('__INDEX__', String(index)).trim();
    variantRepeater.appendChild(wrapper.firstElementChild);
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.remove-variant-row');
  if (!button) return;

  const row = button.closest('[data-variant-row]');
  if (!row) return;

  const totalRows = variantRepeater ? variantRepeater.querySelectorAll('[data-variant-row]').length : 0;
  if (totalRows <= 1) {
    row.querySelectorAll('input').forEach((input) => {
      input.value = '';
    });
    return;
  }

  row.remove();
  reindexVariantRows();
});
