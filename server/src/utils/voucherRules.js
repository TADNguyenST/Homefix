const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IMMUTABLE_AFTER_USE_FIELDS = [
  'code',
  'discount_type',
  'discount_value',
  'min_order_amount',
  'max_discount',
  'start_date',
];

const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
};

const toDateOnlyString = (value) => {
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const getVietnamDateString = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const normalizeComparableValue = (field, value) => {
  if (field === 'start_date') return toDateOnlyString(value);
  if (['discount_value', 'min_order_amount', 'max_discount'].includes(field)) {
    return value === null || value === undefined ? null : Number(value);
  }
  return value;
};

const getChangedLockedFields = (existingVoucher, input) => {
  if (!existingVoucher || Number(existingVoucher.used_count || 0) === 0) return [];
  return IMMUTABLE_AFTER_USE_FIELDS.filter((field) => (
    Object.prototype.hasOwnProperty.call(input, field)
    && normalizeComparableValue(field, input[field]) !== normalizeComparableValue(field, existingVoucher[field])
  ));
};

const validateVoucherBusinessRules = (input, options = {}) => {
  const { existingVoucher = null, now = new Date() } = options;
  const errors = [];
  const today = getVietnamDateString(now);
  const startDate = parseDateOnly(input.start_date);
  const endDate = parseDateOnly(input.end_date);

  if (!startDate) errors.push({ field: 'start_date', message: 'Ngày bắt đầu không hợp lệ' });
  if (!endDate) errors.push({ field: 'end_date', message: 'Ngày kết thúc không hợp lệ' });

  if (startDate && endDate && input.end_date < input.start_date) {
    errors.push({ field: 'end_date', message: 'Ngày kết thúc không được trước ngày bắt đầu' });
  }

  const existingStartDate = toDateOnlyString(existingVoucher?.start_date);
  if (startDate && input.start_date < today && input.start_date !== existingStartDate) {
    errors.push({ field: 'start_date', message: 'Ngày bắt đầu không được nằm trong quá khứ' });
  }

  const usedCount = Number(existingVoucher?.used_count || 0);
  if (existingVoucher && Number(input.usage_limit) < usedCount) {
    errors.push({
      field: 'usage_limit',
      message: `Giới hạn sử dụng không được nhỏ hơn ${usedCount} lượt đã dùng`,
    });
  }

  if (input.is_active && endDate && input.end_date < today) {
    errors.push({ field: 'end_date', message: 'Không thể kích hoạt voucher đã hết hạn' });
  }

  if (input.is_active && Number(input.usage_limit) <= usedCount && existingVoucher) {
    errors.push({ field: 'usage_limit', message: 'Voucher đang hoạt động phải còn ít nhất một lượt sử dụng' });
  }

  const lockedFields = getChangedLockedFields(existingVoucher, input);
  if (lockedFields.length) {
    errors.push({
      field: lockedFields[0],
      message: 'Voucher đã được sử dụng; chỉ được gia hạn ngày kết thúc, tăng giới hạn lượt dùng hoặc thay đổi trạng thái',
    });
  }

  return errors;
};

const validateVoucherActivation = (voucher, now = new Date()) => {
  const today = getVietnamDateString(now);
  const endDate = toDateOnlyString(voucher.end_date);
  if (endDate && endDate < today) return 'Không thể kích hoạt voucher đã hết hạn';
  if (Number(voucher.used_count || 0) >= Number(voucher.usage_limit || 0)) {
    return 'Không thể kích hoạt voucher đã hết lượt sử dụng';
  }
  return null;
};

module.exports = {
  DATE_ONLY_PATTERN,
  parseDateOnly,
  toDateOnlyString,
  getVietnamDateString,
  getChangedLockedFields,
  validateVoucherBusinessRules,
  validateVoucherActivation,
};
