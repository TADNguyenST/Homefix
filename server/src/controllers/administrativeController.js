const { success, error } = require('../utils/response');

const API_BASE_URL = process.env.ADMINISTRATIVE_API_URL || 'https://provinces.open-api.vn/api/v2';
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();

const getCached = (key) => {
  const item = cache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
};

const setCached = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
};

const fetchJson = async (path) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Administrative API returned ${response.status}`);
  }
  return response.json();
};

const normalizeWardType = (divisionType = '') => {
  const normalized = divisionType.toLocaleLowerCase('vi');
  if (normalized.includes('phường')) return 'PHUONG';
  if (normalized.includes('đặc khu')) return 'DAC_KHU';
  return 'XA';
};

const loadProvinces = async () => {
  const cached = getCached('provinces');
  if (cached) return cached;
  const data = await fetchJson('/p/');
  return setCached('provinces', (Array.isArray(data) ? data : []).map((province) => ({
    code: Number(province.code),
    name: province.name,
    type: province.division_type,
  })));
};

const loadProvinceWards = async (provinceCode) => {
  const cacheKey = `wards:${provinceCode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchJson(`/w/?province=${provinceCode}`);
  return setCached(cacheKey, (Array.isArray(data) ? data : []).map((ward) => ({
    code: Number(ward.code),
    name: ward.name,
    type: normalizeWardType(ward.division_type),
    province_code: Number(ward.province_code),
  })));
};

const getProvinces = async (req, res) => {
  try {
    return success(res, await loadProvinces());
  } catch (err) {
    console.error('getAdministrativeProvinces error:', err);
    return error(res, 'Không thể tải danh sách tỉnh/thành. Vui lòng thử lại sau.', 502);
  }
};

const getProvinceWards = async (req, res) => {
  try {
    const provinceCode = Number(req.params.code);
    if (!Number.isInteger(provinceCode) || provinceCode <= 0) {
      return error(res, 'Mã tỉnh/thành không hợp lệ', 400);
    }

    return success(res, await loadProvinceWards(provinceCode));
  } catch (err) {
    console.error('getAdministrativeWards error:', err);
    return error(res, 'Không thể tải danh sách phường/xã. Vui lòng thử lại sau.', 502);
  }
};

module.exports = { getProvinces, getProvinceWards, loadProvinces, loadProvinceWards };
