const toMoneyNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculatePayableAmount = (subtotal, discountAmount = 0) => {
  return Math.max(0, toMoneyNumber(subtotal) - toMoneyNumber(discountAmount));
};

module.exports = {
  toMoneyNumber,
  calculatePayableAmount,
};
