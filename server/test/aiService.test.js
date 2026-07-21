const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../src/services/aiService');

test('đọc đúng MIME type từ ảnh base64', () => {
  const image = _test.parseBase64Image('data:image/webp;base64,YWJjZA==');
  assert.deepEqual(image, { data: 'YWJjZA==', mimeType: 'image/webp' });
});

test('từ chối dữ liệu không phải ảnh được hỗ trợ', () => {
  assert.throws(
    () => _test.parseBase64Image('data:image/svg+xml;base64,YWJjZA=='),
    /INVALID_IMAGE/
  );
});

test('loại bỏ ID do AI bịa và chuẩn hóa dữ liệu đầu ra', () => {
  const result = _test.normalizeDiagnosis({
    severity: 'urgent',
    service_id: 999,
    device_type_id: 888,
    suggested_services: ['Dịch vụ không tồn tại'],
    diagnosis_error: '  Hỏng tụ điện.  ',
    diagnosis_solution: '  Kiểm tra tụ.  ',
    safety_tips: ['Ngắt điện', '', 123, 'Không tự tháo máy'],
  }, [{ id: 1, category_id: 10, name: 'Sửa máy lạnh không lạnh' }], []);

  assert.equal(result.severity, 'MEDIUM');
  assert.equal(result.service_id, null);
  assert.equal(result.device_type_id, null);
  assert.deepEqual(result.suggested_services, []);
  assert.deepEqual(result.safety_tips, ['Ngắt điện', 'Không tự tháo máy']);
});

test('không ghép loại thiết bị khác danh mục với dịch vụ', () => {
  const result = _test.normalizeDiagnosis({
    severity: 'HIGH',
    service_id: 1,
    device_type_id: 2,
    diagnosis_error: 'Chập điện.',
    diagnosis_solution: 'Ngắt aptomat.',
  }, [{ id: 1, category_id: 10, name: 'Sửa chập điện trong nhà' }], [
    { id: 2, category_id: 20, name: 'Máy giặt cửa trước' },
  ]);

  assert.equal(result.service_id, 1);
  assert.equal(result.device_type_id, null);
  assert.deepEqual(result.suggested_services, ['Sửa chập điện trong nhà']);
});

test('phân loại lỗi quota Gemini để không âm thầm dùng kết quả giả', () => {
  const error = _test.classifyGeminiError(new Error('[429 Too Many Requests] quota exceeded'));
  assert.equal(error.code, 'GEMINI_QUOTA_EXCEEDED');
});

test('phân loại project Gemini bị từ chối truy cập', () => {
  const error = _test.classifyGeminiError(new Error('[403 Forbidden] project has been denied access'));
  assert.equal(error.code, 'GEMINI_ACCESS_DENIED');
});

test('tự ánh xạ sang dịch vụ khảo sát đúng danh mục khi thiếu dịch vụ sửa', () => {
  const result = _test.normalizeDiagnosis({
    severity: 'MEDIUM',
    service_id: null,
    device_type_id: 16,
    category_id: 5,
    requires_inspection: true,
    diagnosis_error: 'Sự cố chưa có trong danh mục sửa chữa.',
    diagnosis_solution: 'Cần khảo sát thực tế trước khi báo giá.',
  }, [
    { id: 17, category_id: 5, name: 'Sửa rò rỉ đường ống nước' },
    { id: 22, category_id: 5, name: 'Khảo sát cấp thoát nước' },
    { id: 23, category_id: 4, name: 'Khảo sát điện gia dụng' },
  ], [{ id: 16, category_id: 5, name: 'Bồn cầu' }]);

  assert.equal(result.service_id, 22);
  assert.equal(result.category_id, 5);
  assert.equal(result.requires_inspection, true);
  assert.deepEqual(result.suggested_services, ['Khảo sát cấp thoát nước']);
});

test('giữ dịch vụ sửa chính xác khi không cần khảo sát', () => {
  const result = _test.normalizeDiagnosis({
    severity: 'LOW',
    service_id: 20,
    device_type_id: 16,
    category_id: 5,
    requires_inspection: false,
    diagnosis_error: 'Bồn cầu rò nước.',
    diagnosis_solution: 'Thay gioăng.',
  }, [{ id: 20, category_id: 5, name: 'Sửa bồn cầu xả yếu hoặc rò nước' }], [
    { id: 16, category_id: 5, name: 'Bồn cầu' },
  ]);

  assert.equal(result.service_id, 20);
  assert.equal(result.requires_inspection, false);
});
