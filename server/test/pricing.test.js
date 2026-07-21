const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePayableAmount, calculateVoucherDiscount } = require('../src/utils/pricing');

test('voucher phan tram ton trong muc giam toi da', () => {
  const voucher = {
    discount_type: 'PERCENTAGE',
    discount_value: 20,
    min_order_amount: 100000,
    max_discount: 50000,
  };
  assert.equal(calculateVoucherDiscount(voucher, 400000), 50000);
});

test('voucher co dinh khong the lam tong tien am', () => {
  const voucher = {
    discount_type: 'FIXED',
    discount_value: 500000,
    min_order_amount: 0,
  };
  const discount = calculateVoucherDiscount(voucher, 180000);
  assert.equal(discount, 180000);
  assert.equal(calculatePayableAmount(180000, discount), 0);
});

test('voucher khong ap dung khi chua dat don toi thieu', () => {
  const voucher = {
    discount_type: 'FIXED',
    discount_value: 50000,
    min_order_amount: 300000,
  };
  assert.equal(calculateVoucherDiscount(voucher, 299999), 0);
});
