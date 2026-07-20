const toMoneyNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculatePayableAmount = (subtotal, discountAmount = 0) => {
  return Math.max(0, toMoneyNumber(subtotal) - toMoneyNumber(discountAmount));
};

const calculateVoucherDiscount = (voucher, subtotal) => {
  const amount = toMoneyNumber(subtotal);
  if (!voucher || amount <= 0 || amount < toMoneyNumber(voucher.min_order_amount)) return 0;

  let discount = voucher.discount_type === 'PERCENTAGE'
    ? Math.floor(amount * toMoneyNumber(voucher.discount_value) / 100)
    : toMoneyNumber(voucher.discount_value);

  if (voucher.discount_type === 'PERCENTAGE' && voucher.max_discount != null) {
    discount = Math.min(discount, toMoneyNumber(voucher.max_discount));
  }
  return Math.min(Math.max(0, discount), amount);
};

module.exports = {
  toMoneyNumber,
  calculatePayableAmount,
  calculateVoucherDiscount,
};
