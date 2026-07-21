// ============================================================
// HOMEFIX AI — Address Controller
// CRUD Quản lý sổ địa chỉ của Customer
// ============================================================

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { BUSINESS_RULES } = require('../config/constants');

// ========================
// GET ALL ADDRESSES — Lấy danh sách địa chỉ của user đang đăng nhập
// ========================
const getMyAddresses = async (req, res) => {
  try {
    const addresses = await prisma.customerAddress.findMany({
      where: { customer_id: req.user.id },
      include: {
        district: { select: { id: true, name: true, province_code: true, province_name: true } },
        ward: { select: { id: true, name: true, type: true } },
      },
      orderBy: [
        { is_default: 'desc' }, // Địa chỉ mặc định lên đầu
        { created_at: 'desc' },
      ],
    });

    return success(res, addresses);
  } catch (err) {
    console.error('Get addresses error:', err);
    return error(res, 'Không thể tải danh sách địa chỉ', 500);
  }
};

// ========================
// CREATE ADDRESS — Thêm địa chỉ mới
// ========================
const createAddress = async (req, res) => {
  try {
    const { district_id, ward_id, address_detail, label, is_default } = req.body;

    // Kiểm tra giới hạn số địa chỉ
    const count = await prisma.customerAddress.count({
      where: { customer_id: req.user.id },
    });

    if (count >= BUSINESS_RULES.MAX_ADDRESSES_PER_USER) {
      return error(res, `Bạn chỉ được lưu tối đa ${BUSINESS_RULES.MAX_ADDRESSES_PER_USER} địa chỉ`, 400);
    }

    // Kiểm tra ward thuộc district
    const ward = await prisma.ward.findUnique({
      where: { id: ward_id },
      include: { district: { select: { is_active: true } } },
    });
    if (!ward || ward.district_id !== district_id) {
      return error(res, 'Phường/xã không thuộc khu vực phục vụ đã chọn', 400);
    }
    if (!ward.is_active || !ward.district.is_active) {
      return error(res, 'Khu vực hoặc phường/xã này đang tạm ngừng phục vụ', 400);
    }

    // Nếu chưa có địa chỉ nào thì tự động set mặc định
    const shouldBeDefault = is_default || count === 0;

    const address = await prisma.$transaction(async (tx) => {
      // Nếu đặt làm mặc định, reset tất cả địa chỉ cũ
      if (shouldBeDefault) {
        await tx.customerAddress.updateMany({
          where: { customer_id: req.user.id, is_default: true },
          data: { is_default: false },
        });
      }

      return await tx.customerAddress.create({
        data: {
          customer_id: req.user.id,
          district_id,
          ward_id,
          address_detail,
          label: label || 'Nhà',
          is_default: shouldBeDefault,
        },
        include: {
          district: { select: { id: true, name: true, province_code: true, province_name: true } },
          ward: { select: { id: true, name: true, type: true } },
        },
      });
    });

    return success(res, address, 'Thêm địa chỉ thành công', 201);
  } catch (err) {
    console.error('Create address error:', err);
    return error(res, 'Thêm địa chỉ thất bại', 500);
  }
};

// ========================
// UPDATE ADDRESS — Sửa địa chỉ
// ========================
const updateAddress = async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);
    const { district_id, ward_id, address_detail, label, is_default } = req.body;

    // Kiểm tra địa chỉ tồn tại và thuộc về user
    const existing = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!existing || existing.customer_id !== req.user.id) {
      return error(res, 'Không tìm thấy địa chỉ', 404);
    }

    // Nếu thay đổi ward/district thì validate lại
    if (ward_id || district_id) {
      const effectiveWardId = ward_id ?? existing.ward_id;
      const effectiveDistrictId = district_id ?? existing.district_id;

      const ward = await prisma.ward.findUnique({
        where: { id: effectiveWardId },
        include: { district: { select: { is_active: true } } },
      });
      if (!ward || ward.district_id !== effectiveDistrictId) {
        return error(res, 'Phường/xã không thuộc khu vực phục vụ đã chọn', 400);
      }
      if (!ward.is_active || !ward.district.is_active) {
        return error(res, 'Khu vực hoặc phường/xã này đang tạm ngừng phục vụ', 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (is_default === true) {
        await tx.customerAddress.updateMany({
          where: { customer_id: req.user.id, is_default: true },
          data: { is_default: false },
        });
      }

      return tx.customerAddress.update({
        where: { id: addressId },
        data: {
          ...(district_id !== undefined && { district_id }),
          ...(ward_id !== undefined && { ward_id }),
          ...(address_detail !== undefined && { address_detail }),
          ...(label !== undefined && { label }),
          ...(is_default === true && { is_default: true }),
        },
        include: {
          district: { select: { id: true, name: true, province_code: true, province_name: true } },
          ward: { select: { id: true, name: true, type: true } },
        },
      });
    });

    return success(res, updated, 'Cập nhật địa chỉ thành công');
  } catch (err) {
    console.error('Update address error:', err);
    return error(res, 'Cập nhật địa chỉ thất bại', 500);
  }
};

// ========================
// DELETE ADDRESS — Xóa địa chỉ
// ========================
const deleteAddress = async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);

    const existing = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!existing || existing.customer_id !== req.user.id) {
      return error(res, 'Không tìm thấy địa chỉ', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerAddress.delete({ where: { id: addressId } });

      // Nếu xóa địa chỉ mặc định, set cái đầu tiên còn lại làm mặc định
      if (existing.is_default) {
        const firstRemaining = await tx.customerAddress.findFirst({
          where: { customer_id: req.user.id },
          orderBy: { created_at: 'asc' },
        });
        if (firstRemaining) {
          await tx.customerAddress.update({
            where: { id: firstRemaining.id },
            data: { is_default: true },
          });
        }
      }
    });

    return success(res, null, 'Xóa địa chỉ thành công');
  } catch (err) {
    console.error('Delete address error:', err);
    return error(res, 'Xóa địa chỉ thất bại', 500);
  }
};

// ========================
// SET DEFAULT ADDRESS — Đặt làm mặc định
// ========================
const setDefaultAddress = async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);

    const existing = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!existing || existing.customer_id !== req.user.id) {
      return error(res, 'Không tìm thấy địa chỉ', 404);
    }

    // Transaction: bỏ mặc định cũ + đặt mặc định mới
    await prisma.$transaction([
      prisma.customerAddress.updateMany({
        where: { customer_id: req.user.id, is_default: true },
        data: { is_default: false },
      }),
      prisma.customerAddress.update({
        where: { id: addressId },
        data: { is_default: true },
      }),
    ]);

    return success(res, null, 'Đặt địa chỉ mặc định thành công');
  } catch (err) {
    console.error('Set default address error:', err);
    return error(res, 'Đặt mặc định thất bại', 500);
  }
};

// ========================
// GET DISTRICTS (Public)
// ========================
const getDistricts = async (req, res) => {
  try {
    const districts = await prisma.district.findMany({
      where: { is_active: true },
      orderBy: { id: 'asc' },
    });
    return success(res, districts);
  } catch (err) {
    console.error('Get districts error:', err);
    return error(res, 'Không thể tải danh sách khu vực phục vụ', 500);
  }
};

// ========================
// GET WARDS BY DISTRICT (Public)
// ========================
const getWards = async (req, res) => {
  try {
    const districtId = parseInt(req.params.districtId);
    if (!districtId) return error(res, 'Thiếu ID khu vực phục vụ', 400);

    const wards = await prisma.ward.findMany({
      where: { district_id: districtId, is_active: true, district: { is_active: true } },
      orderBy: { id: 'asc' },
    });
    return success(res, wards);
  } catch (err) {
    console.error('Get wards error:', err);
    return error(res, 'Không thể tải danh sách phường/xã', 500);
  }
};

module.exports = {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDistricts,
  getWards,
};
