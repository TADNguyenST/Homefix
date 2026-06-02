// ============================================================
// HOMEFIX AI — AI Controller
// Endpoints: chẩn đoán sự cố, gợi ý thợ, phân tích sentiment
// ============================================================

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { diagnoseIssue, analyzeSentiment, recommendTechnicians } = require('../services/aiService');

/**
 * POST /ai/diagnose
 * Auth required. Phân tích sự cố bằng AI và lưu kết quả.
 * Body: { description, base64_image?, booking_id? }
 */
const diagnose = async (req, res) => {
  try {
    const { description, base64_image = null, booking_id } = req.body;

    // Gọi AI service
    const result = await diagnoseIssue(description, base64_image);

    // Lưu kết quả vào bảng ai_analysis nếu có booking_id
    let savedAnalysis = null;
    if (booking_id) {
      // Kiểm tra booking tồn tại
      const booking = await prisma.booking.findUnique({ where: { id: booking_id } });
      if (!booking) return error(res, 'Không tìm thấy đơn hàng', 404);

      savedAnalysis = await prisma.aiAnalysis.create({
        data: {
          booking_id,
          input_text: description,
          severity: result.severity,
          suggested_services: result.suggested_services,
          tech_summary: result.summary,
          raw_response: result,
        },
      });

      // Cập nhật ai_severity và ai_summary trên booking
      await prisma.booking.update({
        where: { id: booking_id },
        data: {
          ai_severity: result.severity,
          ai_summary: result.summary,
        },
      });
    }

    return success(res, {
      diagnosis: result,
      saved: savedAnalysis,
    }, 'Phân tích sự cố thành công');
  } catch (err) {
    console.error('diagnose error:', err);
    return error(res, 'Không thể phân tích sự cố', 500);
  }
};

/**
 * GET /ai/recommend-tech/:bookingId
 * ADMIN only. Gợi ý kỹ thuật viên phù hợp cho booking.
 */
const getRecommendedTechnicians = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const recommendations = await recommendTechnicians(parseInt(bookingId));

    return success(res, recommendations, `Tìm thấy ${recommendations.length} kỹ thuật viên phù hợp`);
  } catch (err) {
    console.error('getRecommendedTechnicians error:', err);
    return error(res, err.message || 'Không thể gợi ý kỹ thuật viên', 500);
  }
};

/**
 * POST /ai/sentiment
 * Internal use (được gọi từ review module).
 * Body: { text }
 */
const sentiment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return error(res, 'Vui lòng cung cấp nội dung cần phân tích', 400);
    }

    const result = await analyzeSentiment(text);
    return success(res, { sentiment: result }, 'Phân tích cảm xúc thành công');
  } catch (err) {
    console.error('sentiment error:', err);
    return error(res, 'Không thể phân tích cảm xúc', 500);
  }
};

module.exports = { diagnose, getRecommendedTechnicians, sentiment };
