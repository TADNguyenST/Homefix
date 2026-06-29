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
