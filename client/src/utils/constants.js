// ============================================================
// HOMEFIX AI — Constants
// ============================================================

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  INSPECTING: 'INSPECTING',
  QUOTED: 'QUOTED',
  COMPLETING: 'COMPLETING',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  ASSIGNED: 'Đã gán thợ',
  IN_PROGRESS: 'Đang thực hiện',
  INSPECTING: 'Đang khảo sát',
  QUOTED: 'Đã báo giá',
  COMPLETING: 'Đang sửa chữa',
  AWAITING_PAYMENT: 'Chờ thanh toán',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const BOOKING_STATUS_COLORS = {
  PENDING: { color: '#f59e0b', bg: '#fef3c7' },
  CONFIRMED: { color: '#3b82f6', bg: '#dbeafe' },
  ASSIGNED: { color: '#6366f1', bg: '#e0e7ff' },
  IN_PROGRESS: { color: '#06b6d4', bg: '#cffafe' },
  INSPECTING: { color: '#8b5cf6', bg: '#ede9fe' },
  QUOTED: { color: '#f97316', bg: '#ffedd5' },
  COMPLETING: { color: '#14b8a6', bg: '#ccfbf1' },
  AWAITING_PAYMENT: { color: '#d97706', bg: '#fef3c7' },
  COMPLETED: { color: '#22c55e', bg: '#dcfce7' },
  CANCELLED: { color: '#ef4444', bg: '#fee2e2' },
};

export const BOOKING_STATUS_STEPS = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.ASSIGNED,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.INSPECTING,
  BOOKING_STATUS.QUOTED,
  BOOKING_STATUS.COMPLETING,
  BOOKING_STATUS.AWAITING_PAYMENT,
  BOOKING_STATUS.COMPLETED,
];

export const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Chưa thanh toán',
  PENDING: 'Đang xử lý',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
};

export const PAYMENT_METHOD_LABELS = {
  VNPAY: 'VNPAY',
  CASH: 'Tiền mặt',
};

export const COMPLAINT_STATUS_LABELS = {
  OPEN: 'Mở',
  IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã giải quyết',
  REJECTED: 'Đã từ chối',
};

export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  TECHNICIAN: 'TECHNICIAN',
  ADMIN: 'ADMIN',
};

export const ROLE_LABELS = {
  CUSTOMER: 'Khách hàng',
  TECHNICIAN: 'Kỹ thuật viên',
  ADMIN: 'Quản trị viên',
};

// Customer-cancellable statuses
export const CUSTOMER_CANCELLABLE = ['PENDING', 'CONFIRMED'];

export const BOOKING_TIME_SLOTS = [
  { value: '08:00-10:00', start: '08:00', end: '10:00', label: '08:00 - 10:00' },
  { value: '10:00-12:00', start: '10:00', end: '12:00', label: '10:00 - 12:00' },
  { value: '13:00-15:00', start: '13:00', end: '15:00', label: '13:00 - 15:00' },
  { value: '15:00-17:00', start: '15:00', end: '17:00', label: '15:00 - 17:00' },
];
