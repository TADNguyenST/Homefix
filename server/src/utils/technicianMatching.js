const ACTIVE_TECHNICIAN_JOB_STATUSES = [
  'ASSIGNED',
  'IN_PROGRESS',
  'INSPECTING',
  'QUOTED',
  'COMPLETING',
];

const SKILL_LEVEL_ORDER = {
  EXPERT: 3,
  INTERMEDIATE: 2,
  BEGINNER: 1,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const isInspectionService = (service) => (
  typeof service?.name === 'string' && service.name.trim().toLowerCase().startsWith('khảo sát')
);

const isSkillEligibleForService = (skill, service) => {
  if (!skill || !service) return false;
  if (Number(skill.service_id) === Number(service.id)) return true;
  return isInspectionService(service) &&
    Number(skill.service?.category_id) === Number(service.category_id) &&
    skill.service?.is_active !== false;
};

const getBestMatchingSkill = (skills, service) => (
  (Array.isArray(skills) ? skills : [])
    .filter((skill) => isSkillEligibleForService(skill, service))
    .sort((a, b) => (
      (SKILL_LEVEL_ORDER[b.skill_level] || 0) - (SKILL_LEVEL_ORDER[a.skill_level] || 0)
    ))[0] || null
);

const getBookingDayOfWeek = (bookingDate) => {
  const date = bookingDate instanceof Date ? bookingDate : new Date(bookingDate);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
};

const calculateBusinessRecommendation = (technician, booking) => {
  const matchingSkill = getBestMatchingSkill(technician.skills, booking.service);
  const skillOrder = SKILL_LEVEL_ORDER[matchingSkill?.skill_level] || 0;
  const sameDistrict = Number(technician.district_id) === Number(booking.district_id);
  const coversAllAreas = technician.district_id === null;
  const rating = clamp(Number(technician.avg_rating || 0), 0, 5);
  const experience = clamp(Number(technician.years_of_experience || 0), 0, 10);
  const completedJobs = Math.max(0, Number(technician.total_completed_jobs || 0));
  const activeJobs = Math.max(0, Number(technician.active_jobs ?? technician._count?.bookings ?? 0));

  const skillScore = { 3: 30, 2: 24, 1: 18 }[skillOrder] || 0;
  const locationScore = sameDistrict ? 15 : coversAllAreas ? 10 : 0;
  const ratingScore = Math.round((rating / 5) * 20);
  const experienceScore = Math.round(experience);
  const completedScore = Math.min(10, Math.round(completedJobs / 10));
  const workloadScore = Math.max(0, 15 - activeJobs * 4);
  const score = clamp(
    skillScore + locationScore + ratingScore + experienceScore + completedScore + workloadScore,
    0,
    100
  );

  const skillLabel = {
    EXPERT: 'chuyên gia',
    INTERMEDIATE: 'khá',
    BEGINNER: 'cơ bản',
  }[matchingSkill?.skill_level] || 'phù hợp';
  const areaLabel = sameDistrict ? 'đúng khu vực' : 'nhận việc toàn khu vực';
  const workloadLabel = activeJobs === 0 ? 'chưa có việc đang xử lý' : `đang xử lý ${activeJobs} việc`;

  return {
    score,
    matchingSkill,
    skillOrder,
    sameDistrict,
    activeJobs,
    reason: `Kỹ năng ${skillLabel}, ${areaLabel}, đánh giá ${rating.toFixed(1)} sao và ${workloadLabel}.`,
  };
};

const combineRecommendationScores = (businessScore, geminiScore) => {
  if (geminiScore === null || geminiScore === undefined || geminiScore === '' || !Number.isFinite(Number(geminiScore))) {
    return Math.round(businessScore);
  }
  return clamp(Math.round(Number(businessScore) * 0.75 + Number(geminiScore) * 0.25), 0, 100);
};

module.exports = {
  ACTIVE_TECHNICIAN_JOB_STATUSES,
  SKILL_LEVEL_ORDER,
  isInspectionService,
  isSkillEligibleForService,
  getBestMatchingSkill,
  getBookingDayOfWeek,
  calculateBusinessRecommendation,
  combineRecommendationScores,
};
