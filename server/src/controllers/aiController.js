const { success, error } = require('../utils/response');
const { diagnoseIssue, analyzeSentiment, recommendTechnicians } = require('../services/aiService');

//Phân tích AI và lưu kết quả
const diagnose = async (req, res) => {
  try {
    const { description, base64_image = null } = req.body;

    // Gọi AI service
    const result = await diagnoseIssue(description, base64_image);

    return success(res, {
      diagnosis: result,
    }, 'Phân tích sự cố thành công');
  } catch (err) {
    console.error('diagnose error:', err);
    if (err.message === 'SPAM_DETECTED') {
      return error(res, 'Nội dung bạn nhập không hợp lệ hoặc không liên quan đến dịch vụ sửa chữa nhà cửa. Vui lòng thử lại!', 400);
    }
    if (err.message === 'INVALID_IMAGE') {
      return error(res, 'Ảnh không hợp lệ. Vui lòng dùng ảnh JPG, PNG hoặc WEBP.', 400);
    }
    if (err.message === 'IMAGE_TOO_LARGE') {
      return error(res, 'Ảnh phân tích quá lớn. Vui lòng chọn ảnh nhỏ hơn.', 400);
    }
    if (err.code === 'GEMINI_NOT_CONFIGURED') {
      return error(res, 'Gemini API chưa được cấu hình. Vui lòng liên hệ quản trị viên.', 503);
    }
    if (err.code === 'GEMINI_QUOTA_EXCEEDED') {
      return error(res, 'Gemini API đã hết quota. Vui lòng kiểm tra quota/billing hoặc thay API key.', 429);
    }
    if (err.code === 'GEMINI_ACCESS_DENIED') {
      return error(res, 'Project Gemini bị từ chối quyền truy cập. Vui lòng kiểm tra API key và quyền của project.', 503);
    }
    if (err.code === 'GEMINI_CONNECTION_FAILED') {
      return error(res, 'Không thể kết nối Gemini API. Vui lòng thử lại sau.', 503);
    }
    return error(res, 'Không thể phân tích sự cố', 500);
  }
};

//Gợi ý thợ
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
