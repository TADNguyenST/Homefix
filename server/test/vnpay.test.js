const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stringifyVnpParams,
  formatVnpDate,
  normalizeVnpIp,
  createVnpTxnRef,
} = require('../src/utils/vnpay');

test('tham so VNPAY duoc sap xep va chi ma hoa mot lan', () => {
  const query = stringifyVnpParams({
    vnp_TxnRef: 'HF1_123',
    vnp_OrderInfo: 'Thanh toan don #1',
    vnp_Amount: 18000000,
  });
  assert.equal(
    query,
    'vnp_Amount=18000000&vnp_OrderInfo=Thanh+toan+don+%231&vnp_TxnRef=HF1_123',
  );
  assert.equal(query.includes('%2523'), false);
});

test('ngay VNPAY dung mui gio Viet Nam va dinh dang 14 chu so', () => {
  assert.equal(formatVnpDate(new Date('2026-07-19T00:30:45.000Z')), '20260719073045');
});

test('IP loopback va IPv4 mapped duoc chuan hoa cho VNPAY', () => {
  assert.equal(normalizeVnpIp('::1'), '127.0.0.1');
  assert.equal(normalizeVnpIp('::ffff:192.168.1.10'), '192.168.1.10');
  assert.equal(normalizeVnpIp('10.0.0.1, 10.0.0.2'), '10.0.0.1');
});

test('ma giao dich VNPAY chi gom chu va so', () => {
  const txnRef = createVnpTxnRef(10, 1784481594272);
  assert.equal(txnRef, 'HF101784481594272');
  assert.match(txnRef, /^[A-Za-z0-9]+$/);
});
