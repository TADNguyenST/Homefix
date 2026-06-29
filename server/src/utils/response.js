// ============================================================
// HOMEFIX AI — Response Helpers
// Chuẩn hóa format response cho toàn bộ API
// ============================================================

/**
 * Trả về response thành công
 * @param {object} res - Express response
 * @param {object} data - Dữ liệu trả về
 * @param {string} message - Thông báo
 * @param {number} statusCode - HTTP status code (default 200)
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

/**
 * Trả về response lỗi
 * @param {object} res - Express response
 * @param {string} message - Thông báo lỗi
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {object} errors - Chi tiết lỗi (validation errors)
 */
const error = (res, message = 'Something went wrong', statusCode = 400, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

/**
 * Trả về response có pagination
 * @param {object} res - Express response
 * @param {Array} data - Dữ liệu trang hiện tại
 * @param {number} total - Tổng số bản ghi
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số bản ghi mỗi trang
 */
const paginated = (res, data, total, page, limit, metadata = {}) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    ...metadata,
  });
};

module.exports = { success, error, paginated };
