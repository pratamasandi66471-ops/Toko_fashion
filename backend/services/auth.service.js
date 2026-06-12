const bcrypt = require('bcrypt');

const DEFAULT_SALT_ROUNDS = 10;
const ACTIVE_USER_STATUS = 'active';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isActiveUser(user) {
  return normalizeStatus(user?.status) === ACTIVE_USER_STATUS;
}

function canAuthenticate(user) {
  return Boolean(user && isActiveUser(user) && user.password);
}

async function hashPassword(password, saltRounds = DEFAULT_SALT_ROUNDS) {
  return bcrypt.hash(String(password || ''), saltRounds);
}

async function verifyPassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(String(plainPassword), hashedPassword);
}

function buildSessionUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
  };
}

module.exports = {
  DEFAULT_SALT_ROUNDS,
  ACTIVE_USER_STATUS,
  normalizeEmail,
  normalizeRole,
  normalizeStatus,
  isActiveUser,
  canAuthenticate,
  hashPassword,
  verifyPassword,
  buildSessionUser,
};
