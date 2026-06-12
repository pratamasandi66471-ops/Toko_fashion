const express = require('express');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  res.redirect('/profile');
});

module.exports = router;
