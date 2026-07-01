const prisma = require('../utils/prisma');

// Khởi tạo Gemini model (lazy init, chỉ khi có API key)
let genAI = null;
let model = null;

/**
 * Khởi tạo Gemini client. Gọi lazy khi cần.
 * @returns {boolean} true nếu sẵn sàng, false nếu không có API key
 */
const initGemini = () => {
  if (model) return true;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY không được cấu hình. Sử dụng mock data.');
    return false;
  }
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    return true;
  } catch (err) {
    console.error('[AI Service] Lỗi khởi tạo Gemini:', err.message);
    return false;
  }
};

// ========================
// MOCK DATA — Fallback khi không có API key
// ========================

const MOCK_DIAGNOSIS = {
  severity: 'MEDIUM',
  suggested_services: ['Kiểm tra tổng quát', 'Sửa chữa cơ bản'],
  diagnosis_error: 'Lỗi chưa xác định do thiếu thông tin hoặc hình ảnh.',
  diagnosis_solution: 'Cần kỹ thuật viên đến kiểm tra trực tiếp để xác định chính xác nguyên nhân và phương án xử lý.',
};

const MOCK_SENTIMENT = 'NEUTRAL';

// ========================
// SMART MOCK LOGIC (Fallback)
// ========================
const getSmartMockDiagnosis = async (description) => {
  try {
    const descLower = description.toLowerCase();

    // Tìm các dịch vụ trong DB để map chính xác tên
    const allServices = await prisma.service.findMany({
      select: { id: true, name: true, base_price: true }
    });

    let matchedServices = [];
    let errorDesc = 'Sự cố cần kiểm tra thực tế để xác định chính xác.';
    let solution = 'Kỹ thuật viên sẽ đến tận nơi đo đạc và đưa ra phương án sửa chữa.';
    let severity = 'MEDIUM';
    let safetyTips = [
      "Tạm thời ngắt nguồn cấp điện hoặc nước kết nối với thiết bị hư hỏng.",
      "Hạn chế sử dụng thiết bị gặp sự cố để tránh hư hại lan rộng.",
      "Di dời các vật dụng đắt tiền ra xa khu vực phát sinh sự cố rò rỉ."
    ];

    if (descLower.includes('máy lạnh') || descLower.includes('điều hòa') || descLower.includes('lạnh')) {
      matchedServices = allServices.filter(s => s.name.toLowerCase().includes('máy lạnh') || s.name.toLowerCase().includes('điều hòa') || s.name.toLowerCase().includes('lạnh'));
      safetyTips = [
        "Tắt Aptomat riêng của máy lạnh trước khi thợ tiến hành mở vỏ máy.",
        "Nếu điều hòa có mùi khét, cần ngắt điện ngay lập tức để phòng ngừa chập cháy cuộn dây quạt.",
        "Đảm bảo khu vực cục nóng ngoài trời có không gian thoáng mát để giải nhiệt tốt."
      ];
      if (descLower.includes('nước') || descLower.includes('chảy')) {
        errorDesc = 'Máy lạnh bị chảy nước thường do máng nước bị nghẹt bụi bẩn hoặc thiếu gas gây bám tuyết dàn lạnh.';
        solution = 'Cần vệ sinh tổng thể dàn lạnh, thông máng thoát nước và kiểm tra lại áp suất gas.';
      } else if (descLower.includes('không mát') || descLower.includes('nóng')) {
        errorDesc = 'Máy lạnh chạy nhưng không lạnh có thể do hết gas, block không chạy hoặc hỏng tụ điện.';
        solution = 'Kỹ thuật viên sẽ kiểm tra áp suất gas và linh kiện bo mạch/tụ điện để khắc phục.';
      }
    } else if (descLower.includes('nước') || descLower.includes('vòi') || descLower.includes('ống') || descLower.includes('bồn') || descLower.includes('toilet')) {
      matchedServices = allServices.filter(s => s.name.toLowerCase().includes('nước') || s.name.toLowerCase().includes('ống') || s.name.toLowerCase().includes('bồn') || s.name.toLowerCase().includes('vòi'));
      errorDesc = 'Hệ thống nước bị rò rỉ hoặc tắc nghẽn cục bộ.';
      solution = 'Kiểm tra đường ống, thay thế các khớp nối bị hở hoặc thông tắc đường ống.';
      safetyTips = [
        "Khóa ngay van nước tổng dẫn vào căn hộ hoặc khu vực sự cố để cô lập nguồn.",
        "Đặt chậu hoặc khăn lau dưới điểm rò rỉ để hạn chế tràn nước ra sàn gây hư hại.",
        "Không đổ các chất hóa học thông cống cực mạnh tự ý vì có thể làm biến dạng đường ống PVC mỏng."
      ];
    } else if (descLower.includes('điện') || descLower.includes('chập') || descLower.includes('cháy') || descLower.includes('cắm') || descLower.includes('ổ')) {
      matchedServices = allServices.filter(s => s.name.toLowerCase().includes('điện') || s.name.toLowerCase().includes('ổ cắm'));
      severity = 'HIGH';
      errorDesc = 'Sự cố chập cháy điện cực kỳ nguy hiểm, có thể do quá tải hoặc dây điện bị hở/chuột cắn.';
      solution = 'Tuyệt đối không tự ý bật cầu dao lại. Thợ sẽ dùng đồng hồ đo điện để dò tìm vị trí chập và thay thế đường dây an toàn.';
      safetyTips = [
        "Ngắt ngay Aptomat (cầu dao) tổng của khu vực bị xẹt điện hoặc chập chờn.",
        "Tuyệt đối không dùng tay ẩm ướt rờ vào các công tắc điện hoặc ổ cắm.",
        "Dùng bút thử điện kiểm tra vỏ thiết bị nếu cần tiếp xúc trực tiếp."
      ];
    } else if (descLower.includes('máy giặt') || descLower.includes('máy sấy') || descLower.includes('vắt') || descLower.includes('xả nước')) {
      matchedServices = allServices.filter(s => s.name.toLowerCase().includes('máy giặt') || s.name.toLowerCase().includes('máy sấy') || s.name.toLowerCase().includes('lồng máy giặt'));
      errorDesc = 'Thiết bị giặt sấy có thể gặp lỗi bơm xả, dây curoa, cảm biến nước hoặc mô-tơ lồng giặt.';
      solution = 'Kỹ thuật viên sẽ kiểm tra bơm xả, đường thoát nước, mô-tơ và cảm biến trước khi báo giá sửa chữa.';
    } else if (descLower.includes('tủ lạnh') || descLower.includes('bếp') || descLower.includes('hút mùi')) {
      matchedServices = allServices.filter(s => s.name.toLowerCase().includes('tủ lạnh') || s.name.toLowerCase().includes('bếp') || s.name.toLowerCase().includes('hút mùi'));
      errorDesc = 'Thiết bị bếp có thể gặp lỗi nguồn, bo mạch, cảm biến nhiệt hoặc hệ thống làm lạnh/hút mùi.';
      solution = 'Cần kiểm tra nguồn điện, linh kiện điều khiển và tình trạng vận hành thực tế của thiết bị.';
    }

    // Nếu không match được, lấy random 1 dịch vụ Khác
    if (matchedServices.length === 0 && allServices.length > 0) {
      matchedServices = allServices.slice(0, 1);
    }

    const suggestedServiceNames = matchedServices.map(s => s.name).slice(0, 2);
    const serviceId = matchedServices[0]?.id || null;

    return {
      severity,
      service_id: serviceId,
      suggested_services: suggestedServiceNames,
      diagnosis_error: errorDesc,
      diagnosis_solution: solution,
      predicted_cause: errorDesc,
      suggested_action: solution,
      safety_tips: safetyTips,
      summary: `${errorDesc} ${solution}`,
      _mock: true,
      _reason: 'smart_fallback'
    };
  } catch (e) {
    return {
      ...MOCK_DIAGNOSIS,
      safety_tips: [
        "Ngắt nguồn điện cấp cho thiết bị để đảm bảo an toàn.",
        "Hạn chế sử dụng thiết bị cho đến khi được kỹ thuật viên kiểm tra."
      ],
      predicted_cause: 'Lỗi chưa xác định do thiếu thông tin hoặc hình ảnh.',
      suggested_action: 'Cần kỹ thuật viên đến kiểm tra trực tiếp.',
      safety_tips: []
    };
  }
};

// ========================
// 1. DIAGNOSE ISSUE
// ========================

/**
 * Phân tích sự cố bằng AI (Real Integration with Database & Gemini Vision).
 * @param {string} description - Mô tả sự cố từ khách hàng
 * @param {string} base64Image - Ảnh sự cố (base64 string)
 * @returns {object} { severity, service_id, suggested_services, diagnosis_error, diagnosis_solution, safety_tips, predicted_cause, suggested_action, summary }
 */
const diagnoseIssue = async (description, base64Image = null) => {
  const isReady = initGemini();
  if (!isReady) {
    return await getSmartMockDiagnosis(description);
  }

  try {
    // 1. Fetch toàn bộ danh sách dịch vụ từ DB làm Context
    const services = await prisma.service.findMany({
      select: { id: true, name: true, description: true }
    });

    const servicesContext = services.map(s => `- ID: ${s.id} | Tên: ${s.name}`).join('\n');

    // 2. Xây dựng Prompt
    const promptText = `Bạn là CHUYÊN GIA KỸ THUẬT ĐIỆN LẠNH VÀ ĐIỆN GIA DỤNG với 15 năm kinh nghiệm.
Nhiệm vụ của bạn là chẩn đoán sự cố dựa trên mô tả của khách hàng và hình ảnh (nếu có).

DANH SÁCH DỊCH VỤ HIỆN CÓ CỦA CHÚNG TÔI:
${servicesContext}

YÊU CẦU TRẢ VỀ JSON CÓ CẤU TRÚC SAU:
1. Phân tích nguyên nhân lỗi (diagnosis_error / predicted_cause) chuyên nghiệp.
2. Đề xuất hướng xử lý của thợ sửa chữa (diagnosis_solution / suggested_action).
3. Đánh giá mức độ nghiêm trọng (severity: LOW, MEDIUM, HIGH, CRITICAL).
4. Lời khuyên an toàn khẩn cấp lập tức cho chủ nhà (safety_tips): Một danh sách gồm 2-3 lời khuyên ngắn gọn ví dụ: "Ngắt aptomat", "Khóa van nước tổng".
5. Gợi ý 1-2 dịch vụ phù hợp trong hệ thống của chúng tôi (suggested_services).
6. QUAN TRỌNG: Hãy chọn RA 1 DỊCH VỤ PHÙ HỢP NHẤT từ danh sách trên để xử lý lỗi này. Trả về đúng ID của dịch vụ đó vào trường "service_id". Nếu không có dịch vụ nào phù hợp, trả về null.
7. BẢO MẬT & SPAM: Nếu nội dung của khách hàng là rác, trêu đùa, hoặc KHÔNG LIÊN QUAN ĐẾN CÁC SỰ CỐ NHÀ CỬA (điện, nước, gia dụng...), hãy đặt "is_spam": true. Ngược lại đặt "is_spam": false.

MÔ TẢ SỰ CỐ CỦA KHÁCH HÀNG:
"${description}"`;

    // 3. Chuẩn bị Payload cho Gemini (Text + Image nếu có)
    const promptParts = [{ text: promptText }];

    if (base64Image) {
      // Xử lý chuỗi base64 (cắt bỏ phần prefix "data:image/jpeg;base64," nếu có)
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      promptParts.push({
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      });
    }

    // 4. Cấu hình Gemini trả về chuẩn JSON
    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          is_spam: { type: "BOOLEAN" },
          severity: { type: "STRING" },
          service_id: { type: "INTEGER" },
          suggested_services: { type: "ARRAY", items: { type: "STRING" } },
          diagnosis_error: { type: "STRING" },
          diagnosis_solution: { type: "STRING" },
          safety_tips: { type: "ARRAY", items: { type: "STRING" } },
          predicted_cause: { type: "STRING" },
          suggested_action: { type: "STRING" }
        },
        required: ["is_spam", "severity", "diagnosis_error", "diagnosis_solution", "safety_tips", "predicted_cause", "suggested_action"]
      }
    };

    // 5. Gọi AI
    const result = await model.generateContent({
      contents: [{ role: "user", parts: promptParts }],
      generationConfig,
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    if (parsed.is_spam) {
      throw new Error('SPAM_DETECTED');
    }

    return {
      severity: parsed.severity || 'MEDIUM',
      service_id: parsed.service_id || null,
      suggested_services: parsed.suggested_services || [],
      diagnosis_error: parsed.diagnosis_error || 'Không thể xác định lỗi chi tiết.',
      diagnosis_solution: parsed.diagnosis_solution || 'Vui lòng chờ kỹ thuật viên đến kiểm tra.',
      safety_tips: parsed.safety_tips || [],
      predicted_cause: parsed.predicted_cause || parsed.diagnosis_error || 'Đang xác định nguyên nhân...',
      suggested_action: parsed.suggested_action || parsed.diagnosis_solution || 'Đang đề xuất giải pháp...',
      summary: (parsed.diagnosis_error || '') + ' ' + (parsed.diagnosis_solution || '')
    };
  } catch (err) {
    console.error('[AI Service] diagnoseIssue error:', err.message);
    if (err.message === 'SPAM_DETECTED') {
      throw err;
    }
    // Fallback nếu API lỗi
    return await getSmartMockDiagnosis(description);
  }
};

// ========================
// 2. ANALYZE SENTIMENT
// ========================

/**
 * Phân tích cảm xúc review bằng AI.
 * @param {string} text - Nội dung review
 * @returns {string} POSITIVE | NEUTRAL | NEGATIVE
 */
const analyzeSentiment = async (text) => {
  const isReady = initGemini();
  if (!isReady) {
    return MOCK_SENTIMENT;
  }

  try {
    const prompt = `Phân tích cảm xúc của đánh giá tiếng Việt sau đây. Chỉ trả về đúng MỘT từ: POSITIVE, NEUTRAL, hoặc NEGATIVE.

Đánh giá: "${text}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().toUpperCase();

    // Validate response — chỉ chấp nhận 3 giá trị
    if (['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(responseText)) {
      return responseText;
    }

    // Cố gắng tìm keyword trong response
    if (responseText.includes('POSITIVE')) return 'POSITIVE';
    if (responseText.includes('NEGATIVE')) return 'NEGATIVE';
    return 'NEUTRAL';
  } catch (err) {
    console.error('[AI Service] analyzeSentiment error:', err.message);
    return MOCK_SENTIMENT;
  }
};

// ========================
// 3. RECOMMEND TECHNICIANS
// ========================

/**
 * Gợi ý kỹ thuật viên phù hợp cho booking.
 * Tiêu chí: matching skill, available, same district, schedule phù hợp.
 * Sắp xếp: skill_level DESC → avg_rating DESC → cùng quận ưu tiên.
 * @param {number} bookingId
 * @returns {Array} Top 5 kỹ thuật viên phù hợp
 */
const recommendTechnicians = async (bookingId) => {
  // Lấy thông tin booking kèm theo tên dịch vụ
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      service_id: true,
      district_id: true,
      booking_date: true,
      time_slot_start: true,
      time_slot_end: true,
      description: true,
      service: {
        select: { name: true }
      }
    },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn hàng');
  }

  const bookingDate = new Date(booking.booking_date);
  const dayOfWeek = bookingDate.getDay(); // 0=CN, 1=T2, ..., 6=T7

  // Tìm kỹ thuật viên có skill phù hợp, available, có lịch vào ngày booking
  const technicians = await prisma.technicianProfile.findMany({
    where: {
      is_available: true,
      user: { is_active: true, is_locked: false },
      OR: [
        { district_id: booking.district_id },
        { district_id: null },
      ],
      skills: {
        some: { service_id: booking.service_id },
      },
      schedules: {
        some: {
          day_of_week: dayOfWeek,
          start_time: { lte: booking.time_slot_start },
          end_time: { gte: booking.time_slot_end },
        },
      },
      bookings: {
        none: {
          id: { not: bookingId },
          booking_date: booking.booking_date,
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'INSPECTING', 'QUOTED', 'COMPLETING'] },
          time_slot_start: { lt: booking.time_slot_end },
          time_slot_end: { gt: booking.time_slot_start },
        },
      },
    },
    include: {
      user: { select: { id: true, full_name: true, phone: true, avatar_url: true } },
      district: { select: { id: true, name: true } },
      skills: {
        where: { service_id: booking.service_id },
        include: { service: { select: { id: true, name: true } } },
      },
      schedules: {
        where: { day_of_week: dayOfWeek },
      },
    },
  });

  // Ánh xạ skill_level sang số để dùng cho fallback hoặc kết hợp
  const skillLevelOrder = { EXPERT: 3, INTERMEDIATE: 2, BEGINNER: 1 };

  // Chuẩn bị danh sách thợ ban đầu kèm theo các trường bổ sung
  let candidates = technicians.map((tech) => {
    const matchingSkill = tech.skills[0];
    return {
      ...tech,
      _skill_level_order: skillLevelOrder[matchingSkill?.skill_level] || 0,
      _same_district: tech.district_id === booking.district_id || tech.district_id === null,
      ai_score: null,
      ai_reason: null,
    };
  });

  // Thử gọi Gemini AI nếu sẵn sàng và có danh sách ứng viên
  const isAiReady = initGemini();
  if (isAiReady && candidates.length > 0) {
    try {
      const techListString = candidates.map(t => {
        const matchingSkill = t.skills[0];
        return `- ID: ${t.id}
  Họ tên: ${t.user?.full_name || 'N/A'}
  Kinh nghiệm: ${t.years_of_experience} năm
  Cấp độ kỹ năng cho dịch vụ này: ${matchingSkill?.skill_level || 'N/A'}
  Đánh giá trung bình: ${t.avg_rating} sao
  Tổng số đơn đã làm: ${t.total_completed_jobs}
  Khu vực đăng ký: ${t.district?.name || 'Toàn thành phố'}
  Giới thiệu bản thân: ${t.bio || 'Không có'}`;
      }).join('\n\n');

      const promptText = `Bạn là trợ lý điều phối dịch vụ sửa chữa thông minh.
Nhiệm vụ của bạn là đánh giá sự phù hợp của các kỹ thuật viên đối với đơn đặt lịch dưới đây và xếp hạng họ.

THÔNG TIN ĐƠN ĐẶT LỊCH:
- Dịch vụ yêu cầu: ${booking.service?.name}
- Mô tả sự cố của khách hàng: "${booking.description}"
- Khu vực yêu cầu: Quận ${booking.district_id}

DANH SÁCH KỸ THUẬT VIÊN KHẢ DỤNG:
${techListString}

YÊU CẦU:
1. Đánh giá mức độ phù hợp của từng kỹ thuật viên với sự cố dựa trên kỹ năng, kinh nghiệm và bio của họ.
2. Cho điểm độ phù hợp (ai_score) từ 0 đến 100 cho mỗi người.
3. Viết một lý do ngắn gọn bằng tiếng Việt (ai_reason, tối đa 2 câu) giải thích tại sao thợ này phù hợp (ví dụ: kinh nghiệm dày dặn với loại lỗi này, đánh giá sao cao từ khách hàng trước...).
4. Trả về đúng định dạng JSON yêu cầu.`;

      const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            recommendations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  technician_id: { type: "INTEGER" },
                  ai_score: { type: "INTEGER" },
                  ai_reason: { type: "STRING" }
                },
                required: ["technician_id", "ai_score", "ai_reason"]
              }
            }
          },
          required: ["recommendations"]
        }
      };

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig,
      });

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);
      const recs = parsed.recommendations || [];

      // Map kết quả AI trả về vào danh sách ứng viên
      candidates = candidates.map(tech => {
        const match = recs.find(r => r.technician_id === tech.id);
        if (match) {
          return {
            ...tech,
            ai_score: match.ai_score,
            ai_reason: match.ai_reason
          };
        }
        return tech;
      });
    } catch (err) {
      console.error('[AI Service] recommendTechnicians AI error:', err.message);
      // Tiếp tục chạy để fallback xuống rule-based nếu AI bị lỗi
    }
  }

  // Sắp xếp: Ưu tiên thợ có điểm AI trước, sau đó là rule-based fallback
  const sorted = candidates.sort((a, b) => {
    // Nếu cả hai đều có điểm AI, sắp xếp theo điểm AI giảm dần
    if (a.ai_score !== null && b.ai_score !== null) {
      return b.ai_score - a.ai_score;
    }
    // Ưu tiên người có điểm AI hơn người không có (nếu có lỗi map)
    if (a.ai_score !== null) return -1;
    if (b.ai_score !== null) return 1;

    // Fallback sắp xếp theo luật cũ
    if (a._same_district && !b._same_district) return -1;
    if (!a._same_district && b._same_district) return 1;
    if (b._skill_level_order !== a._skill_level_order) return b._skill_level_order - a._skill_level_order;
    return Number(b.avg_rating) - Number(a.avg_rating);
  });

  // Nếu thợ không có điểm AI (do fallback), gán điểm và nhận xét mặc định
  const finalResult = sorted.map(tech => {
    if (tech.ai_score === null) {
      const calculatedScore = Math.min(60 + tech._skill_level_order * 10 + Math.round(Number(tech.avg_rating) * 5), 100);
      return {
        ...tech,
        ai_score: calculatedScore,
        ai_reason: `Gợi ý tự động dựa trên trình độ ${tech.skills[0]?.skill_level || 'khả dụng'} và đánh giá (${tech.avg_rating} sao).`
      };
    }
    return tech;
  });

  // Lấy Top 5 và làm sạch các trường temp
  return finalResult
    .slice(0, 5)
    .map(({ _skill_level_order, _same_district, ...tech }) => tech);
};

module.exports = {
  diagnoseIssue,
  analyzeSentiment,
  recommendTechnicians,
};
