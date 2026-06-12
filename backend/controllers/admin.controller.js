const adminDashboardModel = require('../models/adminDashboard.model');

const menuMeta = {
  dashboard: { title: 'Admin Dashboard', heading: 'Overview Dashboard' },
  orders: { title: 'Orders', heading: 'Order Management' },
  products: { title: 'Products', heading: 'Product Management' },
  categories: { title: 'Categories', heading: 'Category Management' },
  inventory: { title: 'Inventory / Stock', heading: 'Inventory Management' },
  customers: { title: 'Customers', heading: 'Customer Management' },
  staff: { title: 'Staff Management', heading: 'Staff Management' },
  payments: { title: 'Payments', heading: 'Payment Management' },
  shipping: { title: 'Shipping', heading: 'Shipping Management' },
  returns: { title: 'Returns / Refunds', heading: 'Return & Refund Management' },
  reviews: { title: 'Reviews', heading: 'Review Management' },
  promotions: { title: 'Promotions', heading: 'Promotions Management' },
  coupons: { title: 'Coupons', heading: 'Coupon Management' },
  content: { title: 'Banners / Content', heading: 'Content Management' },
  reports: { title: 'Reports / Analytics', heading: 'Reports & Analytics' },
  notifications: { title: 'Notifications', heading: 'Notifications Center' },
  settings: { title: 'Website Settings', heading: 'Website Settings' },
  profile: { title: 'Account / Profile', heading: 'Account Profile' },
};

function getWibDateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

async function showDashboard(req, res, next) {
  try {
    const data = await adminDashboardModel.getDashboardData('month');

    return res.render('admin/dashboard', {
      layout: 'layouts/dashboard',
      pageTitle: 'Admin Dashboard',
      activeMenu: 'dashboard',
      dashboardData: data,
      currentDateWib: getWibDateLabel(),
    });
  } catch (error) {
    return next(error);
  }
}

async function getDashboardData(req, res, next) {
  try {
    const range = adminDashboardModel.safeRange(req.query.range);
    const data = await adminDashboardModel.getDashboardData(range);

    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

function renderPlaceholder(activeMenu) {
  return (req, res) => {
    const info = menuMeta[activeMenu] || {
      title: 'Admin Page',
      heading: 'Admin Page',
    };

    return res.render('admin/placeholder', {
      layout: 'layouts/dashboard',
      pageTitle: info.title,
      activeMenu,
      heading: info.heading,
      description: 'Halaman ini sudah aktif sebagai route admin dan siap diisi fitur berikutnya.',
      currentDateWib: getWibDateLabel(),
    });
  };
}

module.exports = {
  showDashboard,
  getDashboardData,
  renderPlaceholder,
};
