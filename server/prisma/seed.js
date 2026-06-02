require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function main() {
  console.log('Start seeding...');

  // 1. Delete existing data (optional, useful for resetting)
  await prisma.aiAnalysis.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingImage.deleteMany();
  await prisma.voucherUsage.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.technicianSchedule.deleteMany();
  await prisma.technicianSkill.deleteMany();
  await prisma.technicianProfile.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.deviceType.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.ward.deleteMany();
  await prisma.district.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);

  // 2. Seed Users
  const admin = await prisma.user.create({
    data: { email: 'admin@homefix.vn', password_hash: passwordHash, role: 'ADMIN', full_name: 'Admin HomeFix' },
  });

  const customers = [];
  for (let i = 1; i <= 3; i++) {
    customers.push(
      await prisma.user.create({
        data: { email: `khach${i}@gmail.com`, password_hash: passwordHash, role: 'CUSTOMER', full_name: `Khách Hàng ${i}`, phone: `090123456${i}` },
      })
    );
  }

  const technicians = [];
  for (let i = 1; i <= 5; i++) {
    technicians.push(
      await prisma.user.create({
        data: { email: `tho${i}@homefix.vn`, password_hash: passwordHash, role: 'TECHNICIAN', full_name: `Kỹ Thuật Viên ${i}`, phone: `098765432${i}` },
      })
    );
  }

  // 3. Seed service areas & wards (Cần Thơ mới sau sắp xếp cấp xã năm 2025)
  // Schema hiện vẫn dùng District/Ward; District ở đây được hiểu là "khu vực phục vụ".
  const districtsData = [
    {
      name: 'Khu vực Cần Thơ trung tâm',
      type: 'QUAN',
      wards: [
        ['Ninh Kiều', 'PHUONG'], ['Cái Khế', 'PHUONG'], ['Tân An', 'PHUONG'], ['An Bình', 'PHUONG'],
        ['Thới An Đông', 'PHUONG'], ['Bình Thủy', 'PHUONG'], ['Long Tuyền', 'PHUONG'], ['Cái Răng', 'PHUONG'],
        ['Hưng Phú', 'PHUONG'], ['Ô Môn', 'PHUONG'], ['Phước Thới', 'PHUONG'], ['Thới Long', 'PHUONG'],
        ['Trung Nhứt', 'PHUONG'], ['Thuận Hưng', 'PHUONG'], ['Thốt Nốt', 'PHUONG'], ['Tân Lộc', 'PHUONG'],
        ['Phong Điền', 'XA'], ['Nhơn Ái', 'XA'], ['Thới Lai', 'XA'], ['Đông Thuận', 'XA'],
        ['Trường Xuân', 'XA'], ['Trường Thành', 'XA'], ['Cờ Đỏ', 'XA'], ['Đông Hiệp', 'XA'],
        ['Trung Hưng', 'XA'], ['Vĩnh Thạnh', 'XA'], ['Vĩnh Trinh', 'XA'], ['Thạnh An', 'XA'],
        ['Thạnh Quới', 'XA'], ['Trường Long', 'XA'],
      ],
    },
    {
      name: 'Khu vực Hậu Giang',
      type: 'HUYEN',
      wards: [
        ['Vị Thanh', 'PHUONG'], ['Vị Tân', 'PHUONG'], ['Long Bình', 'PHUONG'], ['Long Mỹ', 'PHUONG'],
        ['Long Phú 1', 'PHUONG'], ['Đại Thành', 'PHUONG'], ['Ngã Bảy', 'PHUONG'],
        ['Hỏa Lựu', 'XA'], ['Vị Thủy', 'XA'], ['Vĩnh Thuận Đông', 'XA'], ['Vị Thanh 1', 'XA'],
        ['Vĩnh Tường', 'XA'], ['Vĩnh Viễn', 'XA'], ['Xà Phiên', 'XA'], ['Lương Tâm', 'XA'],
        ['Thạnh Xuân', 'XA'], ['Tân Hòa', 'XA'], ['Trường Long Tây', 'XA'], ['Châu Thành', 'XA'],
        ['Đông Phước', 'XA'], ['Phú Hữu', 'XA'], ['Tân Bình', 'XA'], ['Hòa An', 'XA'],
        ['Phương Bình', 'XA'], ['Tân Phước Hưng', 'XA'], ['Hiệp Hưng', 'XA'], ['Phụng Hiệp', 'XA'],
        ['Thạnh Hòa', 'XA'], ['Thạnh Phú', 'XA'], ['Thới Hưng', 'XA'],
      ],
    },
    {
      name: 'Khu vực Sóc Trăng',
      type: 'HUYEN',
      wards: [
        ['Phú Lợi', 'PHUONG'], ['Sóc Trăng', 'PHUONG'], ['Mỹ Xuyên', 'PHUONG'], ['Vĩnh Phước', 'PHUONG'],
        ['Vĩnh Châu', 'PHUONG'], ['Khánh Hòa', 'PHUONG'], ['Ngã Năm', 'PHUONG'], ['Mỹ Quới', 'PHUONG'],
        ['Hòa Tú', 'XA'], ['Gia Hòa', 'XA'], ['Nhu Gia', 'XA'], ['Ngọc Tố', 'XA'],
        ['Trường Khánh', 'XA'], ['Đại Ngãi', 'XA'], ['Tân Thạnh', 'XA'], ['Long Phú', 'XA'],
        ['Nhơn Mỹ', 'XA'], ['An Lạc Thôn', 'XA'], ['Kế Sách', 'XA'], ['Thới An Hội', 'XA'],
        ['Đại Hải', 'XA'], ['Phú Tâm', 'XA'], ['An Ninh', 'XA'], ['Thuận Hòa', 'XA'],
        ['Hồ Đắc Kiện', 'XA'], ['Mỹ Tú', 'XA'], ['Long Hưng', 'XA'], ['Mỹ Hương', 'XA'],
        ['Tân Long', 'XA'], ['Phú Lộc', 'XA'], ['Vĩnh Lợi', 'XA'], ['Lâm Tân', 'XA'],
        ['Thạnh Thới An', 'XA'], ['Tài Văn', 'XA'], ['Liêu Tú', 'XA'], ['Lịch Hội Thượng', 'XA'],
        ['Trần Đề', 'XA'], ['An Thạnh', 'XA'], ['Cù Lao Dung', 'XA'], ['Phong Nẫm', 'XA'],
        ['Mỹ Phước', 'XA'], ['Lai Hòa', 'XA'], ['Vĩnh Hải', 'XA'],
      ],
    },
  ];

  const districts = [];
  for (const d of districtsData) {
    const district = await prisma.district.create({ data: { name: d.name, type: d.type } });
    districts.push(district);
    for (const [name, type] of d.wards) {
      await prisma.ward.create({ data: { district_id: district.id, name, type } });
    }
  }

  // 4. Seed Service Categories & Services
  const categoriesData = [
    {
      name: 'Điện lạnh',
      description: 'Máy lạnh và hệ thống làm mát trong gia đình',
      services: [
        { name: 'Vệ sinh máy lạnh treo tường', price: 180000, duration: 60 },
        { name: 'Sửa máy lạnh không lạnh', price: 300000, duration: 90 },
        { name: 'Sửa máy lạnh chảy nước', price: 250000, duration: 75 },
        { name: 'Nạp gas máy lạnh R32/R410A', price: 350000, duration: 60 },
      ],
    },
    {
      name: 'Thiết bị giặt sấy',
      description: 'Máy giặt, máy sấy và lỗi thoát nước/lồng giặt',
      services: [
        { name: 'Sửa máy giặt không xả nước', price: 280000, duration: 90 },
        { name: 'Sửa máy giặt không vắt', price: 300000, duration: 90 },
        { name: 'Vệ sinh lồng máy giặt', price: 220000, duration: 75 },
        { name: 'Sửa máy sấy không nóng', price: 320000, duration: 90 },
      ],
    },
    {
      name: 'Thiết bị bếp',
      description: 'Tủ lạnh, bếp từ, bếp gas và máy hút mùi',
      services: [
        { name: 'Sửa tủ lạnh không lạnh', price: 350000, duration: 90 },
        { name: 'Sửa tủ lạnh chảy nước', price: 280000, duration: 75 },
        { name: 'Sửa bếp từ không lên nguồn', price: 300000, duration: 90 },
        { name: 'Sửa máy hút mùi kêu to', price: 250000, duration: 75 },
      ],
    },
    {
      name: 'Điện gia dụng',
      description: 'Nguồn điện, quạt, ổ cắm và thiết bị điện nhỏ trong nhà',
      services: [
        { name: 'Sửa chập điện trong nhà', price: 350000, duration: 90 },
        { name: 'Thay ổ cắm hoặc công tắc điện', price: 150000, duration: 45 },
        { name: 'Sửa quạt điện không quay', price: 180000, duration: 60 },
        { name: 'Sửa bình nóng lạnh không nóng', price: 300000, duration: 90 },
      ],
    },
    {
      name: 'Cấp thoát nước',
      description: 'Vòi nước, lavabo, bồn cầu và đường ống gia đình',
      services: [
        { name: 'Sửa rò rỉ đường ống nước', price: 250000, duration: 75 },
        { name: 'Thay vòi nước hoặc vòi sen', price: 180000, duration: 60 },
        { name: 'Thông nghẹt lavabo', price: 220000, duration: 60 },
        { name: 'Sửa bồn cầu xả yếu hoặc rò nước', price: 280000, duration: 75 },
      ],
    },
  ];

  const allCategories = {};
  const allServices = [];
  for (const c of categoriesData) {
    const category = await prisma.serviceCategory.create({ data: { name: c.name, description: c.description } });
    allCategories[c.name] = category;
    for (const s of c.services) {
      const service = await prisma.service.create({
        data: { category_id: category.id, name: s.name, base_price: s.price, estimated_duration: s.duration },
      });
      allServices.push(service);
    }
  }

  // 5. Seed Device Types
  const deviceTypesData = [
    { name: 'Máy lạnh treo tường', category: 'Điện lạnh' },
    { name: 'Máy lạnh âm trần', category: 'Điện lạnh' },
    { name: 'Máy giặt cửa trước', category: 'Thiết bị giặt sấy' },
    { name: 'Máy giặt cửa trên', category: 'Thiết bị giặt sấy' },
    { name: 'Máy sấy quần áo', category: 'Thiết bị giặt sấy' },
    { name: 'Tủ lạnh', category: 'Thiết bị bếp' },
    { name: 'Bếp từ', category: 'Thiết bị bếp' },
    { name: 'Bếp gas', category: 'Thiết bị bếp' },
    { name: 'Máy hút mùi', category: 'Thiết bị bếp' },
    { name: 'Ổ cắm / công tắc', category: 'Điện gia dụng' },
    { name: 'Quạt điện', category: 'Điện gia dụng' },
    { name: 'Bình nóng lạnh', category: 'Điện gia dụng' },
    { name: 'Ống nước', category: 'Cấp thoát nước' },
    { name: 'Vòi nước / vòi sen', category: 'Cấp thoát nước' },
    { name: 'Lavabo', category: 'Cấp thoát nước' },
    { name: 'Bồn cầu', category: 'Cấp thoát nước' },
  ];
  for (const dt of deviceTypesData) {
    await prisma.deviceType.create({ 
      data: { 
        name: dt.name,
        category_id: allCategories[dt.category]?.id || null
      } 
    });
  }

  // 6. Seed Technician Profiles, Skills, Schedules
  for (let i = 0; i < technicians.length; i++) {
    const tech = technicians[i];
    const profile = await prisma.technicianProfile.create({
      data: {
        user_id: tech.id,
        district_id: districts[i % districts.length].id, // Assign to a random district
        years_of_experience: 2 + i,
        bio: `Kỹ thuật viên chuyên nghiệp với ${2 + i} năm kinh nghiệm.`,
        avg_rating: 4.5 + (i * 0.1),
        total_completed_jobs: 10 * (i + 1),
      },
    });

    // Assign 2-3 random skills
    for (let j = 0; j < 3; j++) {
      await prisma.technicianSkill.create({
        data: {
          technician_profile_id: profile.id,
          service_id: allServices[(i * 3 + j) % allServices.length].id,
          skill_level: j === 0 ? 'EXPERT' : 'INTERMEDIATE',
        },
      });
    }

    // Assign schedule T2-T6
    for (let day = 1; day <= 5; day++) {
      await prisma.technicianSchedule.create({
        data: {
          technician_profile_id: profile.id,
          day_of_week: day,
          start_time: '08:00',
          end_time: '17:00',
        },
      });
    }
  }

  // 7. Seed Vouchers
  const vouchersData = [
    { code: 'GIAM50K', type: 'FIXED', value: 50000, usage_limit: 100 },
    { code: 'GIAM10PCT', type: 'PERCENTAGE', value: 10, max_discount: 100000, usage_limit: 50 },
    { code: 'NEWUSER', type: 'FIXED', value: 100000, usage_limit: 500, min_order_amount: 300000 },
  ];

  for (const v of vouchersData) {
    await prisma.voucher.create({
      data: {
        code: v.code,
        discount_type: v.type,
        discount_value: v.value,
        max_discount: v.max_discount,
        min_order_amount: v.min_order_amount,
        usage_limit: v.usage_limit,
        start_date: new Date(),
        end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)), // 1 month valid
      },
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
