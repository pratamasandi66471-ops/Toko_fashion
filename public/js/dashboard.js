(() => {
  const adminShell = document.querySelector('.admin-dashboard');
  const sidebar = document.querySelector('.admin-sidebar');
  const toggleButtons = document.querySelectorAll('[data-admin-sidebar-toggle]');
  const collapseButtons = document.querySelectorAll('[data-admin-sidebar-collapse]');
  const collapseStorageKey = 'sf-admin-sidebar-collapsed';
  const desktopQuery = window.matchMedia('(min-width: 1200px)');

  if (!adminShell || !sidebar) return;

  function isDesktop() {
    return desktopQuery.matches;
  }

  function closeSidebar() {
    document.body.classList.remove('admin-sidebar-open');
    sidebar.classList.remove('is-open');
  }

  function setCollapsed(isCollapsed, persist = true) {
    if (!isDesktop()) {
      document.body.classList.remove('admin-sidebar-collapsed');
      collapseButtons.forEach((button) => {
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-label', 'Collapse sidebar');
      });
      return;
    }

    document.body.classList.toggle('admin-sidebar-collapsed', isCollapsed);
    collapseButtons.forEach((button) => {
      button.setAttribute('aria-expanded', String(!isCollapsed));
      button.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });

    if (persist) {
      window.localStorage.setItem(collapseStorageKey, isCollapsed ? 'true' : 'false');
    }
  }

  function restoreCollapsedState() {
    const stored = window.localStorage.getItem(collapseStorageKey) === 'true';
    setCollapsed(stored, false);
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('is-open');
      document.body.classList.toggle('admin-sidebar-open', isOpen);
    });
  });

  collapseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!isDesktop()) return;
      setCollapsed(!document.body.classList.contains('admin-sidebar-collapsed'));
      closeSidebar();
    });
  });

  document.addEventListener('click', (event) => {
    const clickedToggle = event.target.closest('[data-admin-sidebar-toggle]');
    const clickedCollapse = event.target.closest('[data-admin-sidebar-collapse]');
    const clickedSidebar = event.target.closest('.admin-sidebar');

    if (!clickedToggle && !clickedCollapse && !clickedSidebar) {
      closeSidebar();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSidebar();
    }
  });

  desktopQuery.addEventListener('change', restoreCollapsedState);
  restoreCollapsedState();
})();
