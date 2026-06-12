const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenu = document.getElementById("mobileMenu");
const accountMenuBtn = document.getElementById("accountMenuBtn");
const accountDropdown = document.getElementById("accountDropdown");

if (mobileMenuBtn && mobileMenu) {
  mobileMenuBtn.setAttribute("aria-expanded", "false");

  function closeMobileMenu() {
    mobileMenu.classList.remove("active");
    mobileMenuBtn.setAttribute("aria-expanded", "false");
  }

  mobileMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = mobileMenu.classList.toggle("active");
    mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
      closeMobileMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });
}

if (accountMenuBtn && accountDropdown) {
  accountMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = accountDropdown.classList.toggle("active");
    accountMenuBtn.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!accountDropdown.contains(event.target) && !accountMenuBtn.contains(event.target)) {
      accountDropdown.classList.remove("active");
      accountMenuBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      accountDropdown.classList.remove("active");
      accountMenuBtn.setAttribute("aria-expanded", "false");
    }
  });
}
