function redirectByRole(role) {
  if (role === 'customer') return '/';
  if (role === 'staff') return '/staff/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/login';
}

module.exports = redirectByRole;
