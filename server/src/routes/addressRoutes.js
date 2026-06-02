// ============================================================
// HOMEFIX AI — Address Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { validate, createAddressSchema, updateAddressSchema } = require('../middlewares/validators');
const {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDistricts,
  getWards,
} = require('../controllers/addressController');

router.get('/districts', getDistricts);
router.get('/wards/:districtId', getWards);

// Tất cả routes dưới đây đều cần đăng nhập và là CUSTOMER
router.use(authMiddleware, roleMiddleware(['CUSTOMER']));

router.get('/', getMyAddresses);
router.post('/', validate(createAddressSchema), createAddress);
router.put('/:id', validate(updateAddressSchema), updateAddress);
router.delete('/:id', deleteAddress);
router.put('/:id/default', setDefaultAddress);

module.exports = router;
