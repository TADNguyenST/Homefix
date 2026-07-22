const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDateOnly,
  validateVoucherBusinessRules,
  validateVoucherActivation,
} = require('../src/utils/voucherRules');

const NOW = new Date('2026-07-22T02:00:00.000Z');
const baseVoucher = {
  code: 'HOMEFIX20',
  discount_type: 'PERCENTAGE',
  discount_value: 20,
  min_order_amount: 200000,
  max_discount: 100000,
  usage_limit: 100,
  start_date: '2026-07-22',
  end_date: '2026-07-31',
  is_active: true,
};

test('tu choi ngay khong ton tai tren lich', () => {
  assert.equal(parseDateOnly('2026-02-30'), null);
});

test('cho phep voucher co hieu luc trong mot ngay', () => {
  const input = { ...baseVoucher, end_date: baseVoucher.start_date };
  assert.deepEqual(validateVoucherBusinessRules(input, { now: NOW }), []);
});

test('khong cho tao voucher bat dau trong qua khu', () => {
  const input = { ...baseVoucher, start_date: '2026-07-21' };
  const errors = validateVoucherBusinessRules(input, { now: NOW });
  assert.equal(errors[0].field, 'start_date');
});

test('khong cho thay doi dieu khoan voucher da duoc su dung', () => {
  const existing = {
    ...baseVoucher,
    start_date: new Date('2026-07-22T00:00:00.000Z'),
    end_date: new Date('2026-07-31T00:00:00.000Z'),
    used_count: 2,
  };
  const errors = validateVoucherBusinessRules(
    { ...baseVoucher, discount_value: 30 },
    { existingVoucher: existing, now: NOW },
  );
  assert.match(errors[0].message, /đã được sử dụng/);
});

test('cho phep gia han voucher da duoc su dung', () => {
  const existing = {
    ...baseVoucher,
    start_date: new Date('2026-07-22T00:00:00.000Z'),
    end_date: new Date('2026-07-31T00:00:00.000Z'),
    used_count: 2,
  };
  const input = { ...baseVoucher, end_date: '2026-08-15', usage_limit: 120 };
  assert.deepEqual(validateVoucherBusinessRules(input, { existingVoucher: existing, now: NOW }), []);
});

test('khong cho bat voucher het han hoac het luot', () => {
  assert.match(validateVoucherActivation({ end_date: '2026-07-21', used_count: 0, usage_limit: 10 }, NOW), /hết hạn/);
  assert.match(validateVoucherActivation({ end_date: '2026-07-31', used_count: 10, usage_limit: 10 }, NOW), /hết lượt/);
});
