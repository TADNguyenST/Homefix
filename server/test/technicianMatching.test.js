const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isSkillEligibleForService,
  getBookingDayOfWeek,
  calculateBusinessRecommendation,
  combineRecommendationScores,
} = require('../src/utils/technicianMatching');

test('dịch vụ thường chỉ chấp nhận đúng kỹ năng dịch vụ', () => {
  const service = { id: 10, name: 'Sửa máy lạnh chảy nước', category_id: 2 };
  assert.equal(isSkillEligibleForService({ service_id: 10 }, service), true);
  assert.equal(isSkillEligibleForService({ service_id: 11, service: { category_id: 2 } }, service), false);
});

test('dịch vụ khảo sát chấp nhận kỹ năng đang hoạt động trong cùng danh mục', () => {
  const service = { id: 20, name: 'Khảo sát điện lạnh', category_id: 2 };
  assert.equal(isSkillEligibleForService({
    service_id: 11,
    service: { category_id: 2, is_active: true },
  }, service), true);
  assert.equal(isSkillEligibleForService({
    service_id: 12,
    service: { category_id: 3, is_active: true },
  }, service), false);
});

test('tính thứ trong tuần theo ngày UTC lưu ở cột Date của PostgreSQL', () => {
  assert.equal(getBookingDayOfWeek(new Date('2026-07-20T00:00:00.000Z')), 1);
  assert.equal(getBookingDayOfWeek('invalid-date'), null);
});

test('điểm nghiệp vụ ưu tiên đúng khu vực và ít việc đang xử lý', () => {
  const booking = {
    district_id: 5,
    service: { id: 10, name: 'Sửa máy lạnh chảy nước', category_id: 2 },
  };
  const baseTechnician = {
    district_id: 5,
    avg_rating: 4.5,
    years_of_experience: 5,
    total_completed_jobs: 60,
    skills: [{ service_id: 10, skill_level: 'EXPERT' }],
  };
  const available = calculateBusinessRecommendation({ ...baseTechnician, active_jobs: 0 }, booking);
  const busy = calculateBusinessRecommendation({ ...baseTechnician, active_jobs: 3 }, booking);
  const allAreas = calculateBusinessRecommendation({ ...baseTechnician, district_id: null, active_jobs: 0 }, booking);

  assert.ok(available.score > busy.score);
  assert.ok(available.score > allAreas.score);
  assert.match(available.reason, /đúng khu vực/);
});

test('Gemini chỉ bổ sung một phần điểm, không vượt khỏi khoảng hợp lệ', () => {
  assert.equal(combineRecommendationScores(80, 100), 85);
  assert.equal(combineRecommendationScores(80, null), 80);
  assert.equal(combineRecommendationScores(100, 200), 100);
});
