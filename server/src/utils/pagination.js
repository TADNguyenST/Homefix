// ============================================================
// HOMEFIX AI — Pagination Helper
// ============================================================

const { BUSINESS_RULES } = require('../config/constants');

/**
 * Parse query params thành Prisma pagination args
 * @param {object} query - req.query
 * @returns {{ skip: number, take: number, page: number, limit: number }}
 */
const getPagination = (query) => {
  let page = parseInt(query.page) || 1;
  let limit = parseInt(query.limit) || BUSINESS_RULES.DEFAULT_PAGE_SIZE;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > BUSINESS_RULES.MAX_PAGE_SIZE) limit = BUSINESS_RULES.MAX_PAGE_SIZE;

  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
};

module.exports = { getPagination };
