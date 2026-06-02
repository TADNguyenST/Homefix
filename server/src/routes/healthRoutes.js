const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'HomeFix API is ready',
  });
});

module.exports = router;

