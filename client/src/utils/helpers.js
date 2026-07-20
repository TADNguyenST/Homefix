// ============================================================
// HOMEFIX AI — Helper Functions
// ============================================================

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

/**
 * Format số tiền VND
 * @param {number} amount
 * @returns {string} "1,200,000đ"
 */
export const formatVND = (amount) => {
  if (!amount && amount !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
};

/**
 * Format ngày tiếng Việt
 * @param {string} date
 * @returns {string} "25/05/2026"
 */
export const formatDate = (date) => {
  if (!date) return '';
  return dayjs(date).format('DD/MM/YYYY');
};

/**
 * Format ngày giờ
 * @param {string} datetime
 * @returns {string} "25/05/2026 14:30"
 */
export const formatDateTime = (datetime) => {
  if (!datetime) return '';
  return dayjs(datetime).format('DD/MM/YYYY HH:mm');
};

/**
 * Thời gian tương đối: "5 phút trước"
 */
export const timeAgo = (datetime) => {
  if (!datetime) return '';
  return dayjs(datetime).fromNow();
};

/**
 * Format phút → giờ phút: 90 → "1 giờ 30 phút"
 */
export const formatDuration = (minutes) => {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
};

export const getBookingSlotDateTime = (date, slot) => {
  if (!date || !slot) return null;
  const [hour, minute] = slot.start.split(':').map(Number);
  return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0);
};

export const isBookingSlotAvailable = (date, slot, minAdvanceHours = 24) => {
  const slotDateTime = getBookingSlotDateTime(date, slot);
  return Boolean(slotDateTime && !slotDateTime.isBefore(dayjs().add(minAdvanceHours, 'hour')));
};

/**
 * Truncate text
 */
export const truncate = (text, maxLen = 100) => {
  if (!text || text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
};

/**
 * Get initials from name: "Nguyễn Văn A" → "NA"
 */
export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const stripHtmlAndTruncate = (html, maxLength = 150) => {
  if (!html) return '';
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Trả về URL chi tiết tương ứng với thông báo
 * @param {object} notification 
 * @param {string} userRole - CUSTOMER | TECHNICIAN | ADMIN
 * @returns {string|null} Đường dẫn cần chuyển hướng
 */
export const getNotificationRedirectUrl = (notification, userRole) => {
  const { type, reference_id } = notification;
  if (!reference_id) return null;

  switch (type) {
    case 'BOOKING':
    case 'PAYMENT':
      if (userRole === 'CUSTOMER') {
        if (notification.title === 'Sửa chữa hoàn thành' || (notification.message && notification.message.includes('đánh giá'))) {
          return `/customer/reviews/new/${reference_id}`;
        }
        return `/customer/bookings/${reference_id}`;
      }
      if (userRole === 'TECHNICIAN') return `/technician/jobs/${reference_id}`;
      if (userRole === 'ADMIN') {
        // Payment notifications currently store booking_id as reference_id.
        if (type === 'PAYMENT') return '/admin/payments';
        return `/admin/bookings`;
      }
      break;

    case 'QUOTATION':
      // Quotation notifications currently store booking_id as reference_id.
      if (userRole === 'CUSTOMER') return `/customer/bookings/${reference_id}`;
      if (userRole === 'TECHNICIAN') return `/technician/jobs/${reference_id}`;
      break;

    case 'REVIEW':
      if (userRole === 'TECHNICIAN') return `/technician/rating`;
      if (userRole === 'ADMIN') return `/admin/bookings`;
      break;

    case 'COMPLAINT':
      if (userRole === 'CUSTOMER') return `/customer/complaints`;
      if (userRole === 'ADMIN') return `/admin/complaints`;
      break;

    default:
      return null;
  }
  return null;
};

