const openShopFilter = document.getElementById("openShopFilter");
const closeShopFilter = document.getElementById("closeShopFilter");
const shopFilterPanel = document.getElementById("shopFilterPanel");
const clearEmptyState = document.getElementById("clearEmptyState");
const shopBackdrop = document.createElement("div");

shopBackdrop.className = "shop-filter-backdrop";
document.body.appendChild(shopBackdrop);

const openFilter = () => {
  if (!shopFilterPanel) return;
  shopFilterPanel.classList.add("open");
  shopBackdrop.classList.add("show");
  document.body.style.overflow = "hidden";
};

const closeFilter = () => {
  if (!shopFilterPanel) return;
  shopFilterPanel.classList.remove("open");
  shopBackdrop.classList.remove("show");
  document.body.style.overflow = "";
};

if (openShopFilter && closeShopFilter && shopFilterPanel) {
  openShopFilter.addEventListener("click", openFilter);
  closeShopFilter.addEventListener("click", closeFilter);
  shopBackdrop.addEventListener("click", closeFilter);
}

if (clearEmptyState) {
  clearEmptyState.addEventListener("click", () => {
    closeFilter();
  });
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 1024) {
    closeFilter();
  }
});
