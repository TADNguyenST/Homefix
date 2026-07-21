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

  // 3. Seed tỉnh/thành và phường/xã theo API địa giới hành chính v2.
  const districts = [];
  const wards = [];
  const district = await prisma.district.create({
    data: {
      name: 'Cần Thơ',
      province_code: 92,
      province_name: 'Thành phố Cần Thơ',
      is_active: true,
    },
  });
  districts.push(district);
  const wardResponse = await fetch('https://provinces.open-api.vn/api/v2/w/?province=92');
  if (!wardResponse.ok) throw new Error('Không thể tải dữ liệu phường/xã Cần Thơ từ API hành chính');
  const apiWards = await wardResponse.json();
  for (const item of apiWards) {
    const normalizedType = item.division_type.toLowerCase().includes('phường')
      ? 'PHUONG'
      : item.division_type.toLowerCase().includes('đặc khu') ? 'DAC_KHU' : 'XA';
    const ward = await prisma.ward.create({
      data: {
        district_id: district.id,
        external_code: item.code,
        name: item.name,
        type: normalizedType,
      },
    });
    wards.push(ward);
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
        { name: 'Khảo sát điện lạnh', price: 150000, duration: 45 },
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
        { name: 'Khảo sát thiết bị giặt sấy', price: 150000, duration: 45 },
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
        { name: 'Khảo sát thiết bị bếp', price: 150000, duration: 45 },
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
        { name: 'Khảo sát điện gia dụng', price: 150000, duration: 45 },
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
        { name: 'Khảo sát cấp thoát nước', price: 150000, duration: 45 },
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
  const deviceTypes = [];
  for (const dt of deviceTypesData) {
    const deviceType = await prisma.deviceType.create({
      data: {
        name: dt.name,
        category_id: allCategories[dt.category]?.id || null,
      },
    });
    deviceTypes.push(deviceType);
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

  const voucherGiam50k = await prisma.voucher.findUnique({ where: { code: 'GIAM50K' } });

  // 8. Seed Customer Addresses
  const customerAddresses = [];
  for (let i = 0; i < customers.length; i++) {
    customerAddresses.push(
      await prisma.customerAddress.create({
        data: {
          customer_id: customers[i].id,
          district_id: districts[i % districts.length].id,
          ward_id: wards[i * 2]?.id || wards[0].id,
          address_detail: `Số ${10 + i}, đường Nguyễn Văn ${i + 1}`,
          label: 'Nhà',
          is_default: true,
        },
      })
    );
  }

  // 9. Seed Bookings + Payments + Status History
  const bookingsData = [
    {
      customer: customers[0],
      technicianProfile: null,
      service: allServices[0],
      deviceType: deviceTypes[0],
      address: customerAddresses[0],
      district: districts[0],
      ward: wards[0],
      description: 'Máy lạnh treo tường không lạnh và nước chảy ra.',
      booking_date: new Date(new Date().setDate(new Date().getDate() + 2)),
      time_slot_start: '09:00',
      time_slot_end: '11:00',
      status: 'PENDING',
      estimated_price: Number(allServices[0].base_price),
      final_price: null,
      payment_method: 'VNPAY',
      voucher: voucherGiam50k,
      discount_amount: voucherGiam50k ? Number(voucherGiam50k.discount_value) : 0,
      payment: { amount: Number(allServices[0].base_price) - (voucherGiam50k ? Number(voucherGiam50k.discount_value) : 0), method: 'VNPAY', status: 'UNPAID' },
      histories: [{ from_status: null, to_status: 'PENDING', changed_by: customers[0].id, note: 'Khách hàng đặt lịch' }],
    },
    {
      customer: customers[1],
      technicianProfile: technicians[1] ? await prisma.technicianProfile.findUnique({ where: { user_id: technicians[1].id } }) : null,
      service: allServices[4],
      deviceType: deviceTypes[2],
      address: customerAddresses[1],
      district: districts[0],
      ward: wards[4],
      description: 'Máy giặt không xả nước và kêu to.',
      booking_date: new Date(new Date().setDate(new Date().getDate() + 1)),
      time_slot_start: '10:00',
      time_slot_end: '12:00',
      status: 'ASSIGNED',
      estimated_price: Number(allServices[4].base_price),
      final_price: null,
      payment_method: 'CASH',
      payment: { amount: Number(allServices[4].base_price), method: 'CASH', status: 'UNPAID' },
      histories: [{ from_status: null, to_status: 'ASSIGNED', changed_by: customers[1].id, note: 'Đơn đã được gán thợ' }],
    },
    {
      customer: customers[2],
      technicianProfile: technicians[2] ? await prisma.technicianProfile.findUnique({ where: { user_id: technicians[2].id } }) : null,
      service: allServices[8],
      deviceType: deviceTypes[5],
      address: customerAddresses[2],
      district: districts[0],
      ward: wards[8],
      description: 'Tủ lạnh chạy nhưng không lạnh, có tiếng ồn lớn.',
      booking_date: new Date(new Date().setDate(new Date().getDate() - 1)),
      time_slot_start: '14:00',
      time_slot_end: '16:00',
      status: 'COMPLETED',
      estimated_price: Number(allServices[8].base_price),
      final_price: Number(allServices[8].base_price),
      payment_method: 'VNPAY',
      payment: {
        amount: Number(allServices[8].base_price),
        method: 'VNPAY',
        status: 'PAID',
        transaction_code: 'TXN123456',
        vnpay_txn_ref: 'VNPAYREF123',
        vnpay_response_code: '00',
        paid_at: new Date(new Date().setDate(new Date().getDate() - 1)),
      },
      histories: [
        { from_status: null, to_status: 'COMPLETED', changed_by: customers[2].id, note: 'Đơn đã hoàn thành' },
      ],
    },
  ];

  const bookings = [];
  for (const data of bookingsData) {
    const booking = await prisma.booking.create({
      data: {
        customer_id: data.customer.id,
        technician_profile_id: data.technicianProfile?.id || null,
        service_id: data.service.id,
        device_type_id: data.deviceType?.id || null,
        description: data.description,
        customer_address_id: data.address.id,
        district_id: data.district.id,
        ward_id: data.ward.id,
        address_detail: data.address.address_detail,
        booking_date: data.booking_date,
        time_slot_start: data.time_slot_start,
        time_slot_end: data.time_slot_end,
        status: data.status,
        estimated_price: data.estimated_price,
        final_price: data.final_price,
        payment_method: data.payment_method,
        voucher_id: data.voucher?.id || null,
        discount_amount: data.discount_amount || 0,
        payment: { create: data.payment },
        statusHistories: { create: data.histories.map((history) => ({ ...history, created_at: new Date() })) },
      },
      include: { payment: true },
    });
    bookings.push(booking);
  }

  // 10. Seed Quotations
  await prisma.quotation.create({
    data: {
      booking_id: bookings[1].id,
      total_extra_price: 320000,
      note: 'Báo giá sửa máy giặt không xả nước.',
      status: 'PENDING',
      created_by: technicians[1].id,
      items: {
        create: [
          { item_name: 'Thay bơm xả', quantity: 1, unit_price: 250000 },
          { item_name: 'Phí công', quantity: 1, unit_price: 70000 },
        ],
      },
    },
  });

  await prisma.quotation.create({
    data: {
      booking_id: bookings[2].id,
      total_extra_price: 380000,
      note: 'Báo giá sửa tủ lạnh không lạnh.',
      status: 'ACCEPTED',
      created_by: technicians[2].id,
      responded_by: customers[2].id,
      responded_at: new Date(new Date().setDate(new Date().getDate() - 2)),
      items: {
        create: [
          { item_name: 'Thay block', quantity: 1, unit_price: 280000 },
          { item_name: 'Phí công', quantity: 1, unit_price: 100000 },
        ],
      },
    },
  });

  // 11. Seed Reviews
  await prisma.review.create({
    data: {
      booking_id: bookings[2].id,
      customer_id: customers[2].id,
      technician_profile_id: technicians[2] ? await prisma.technicianProfile.findUnique({ where: { user_id: technicians[2].id } }).then((x) => x.id) : null,
      rating: 5,
      comment: 'Thợ làm nhanh, nhiệt tình, dịch vụ rất tốt.',
    },
  });

  // 12. Seed Complaints
  await prisma.complaint.create({
    data: {
      booking_id: bookings[1].id,
      customer_id: customers[1].id,
      subject: 'Booking chưa có kỹ thuật viên xác nhận',
      description: 'Tôi đã đặt lịch nhưng chưa thấy kỹ thuật viên xác nhận lại.',
      status: 'OPEN',
      admin_response: null,
      ai_sentiment: 'NEUTRAL',
    },
  });

  // 13. Seed Notifications
  await prisma.notification.createMany({
    data: [
      { user_id: admin.id, title: 'Có đơn hàng mới', message: 'Khách hàng vừa tạo đơn mới.', type: 'BOOKING' },
      { user_id: customers[0].id, title: 'Đơn hàng đã được tạo', message: 'Bạn đã tạo đơn mới thành công.', type: 'BOOKING' },
      { user_id: technicians[1].id, title: 'Bạn được gán đơn', message: 'Bạn vừa được gán đơn sửa máy giặt.', type: 'BOOKING' },
      { user_id: customers[2].id, title: 'Thanh toán thành công', message: 'Bạn đã thanh toán đơn hàng thành công.', type: 'PAYMENT' },
      { user_id: customers[1].id, title: 'Đơn đang chờ báo giá', message: 'Kỹ thuật viên đã báo giá cho đơn của bạn.', type: 'QUOTATION' },
    ],
  });

  // 14. Seed Booking Images
  await prisma.bookingImage.createMany({
    data: [
      { booking_id: bookings[0].id, image_url: 'https://example.com/images/booking-1.jpg', uploaded_by: 'CUSTOMER' },
      { booking_id: bookings[2].id, image_url: 'https://example.com/images/booking-3.jpg', uploaded_by: 'TECHNICIAN' },
    ],
  });

  // 15. Seed Voucher Usage
  if (voucherGiam50k) {
    await prisma.voucherUsage.create({
      data: {
        voucher_id: voucherGiam50k.id,
        user_id: customers[0].id,
        booking_id: bookings[0].id,
      },
    });

    await prisma.voucher.update({
      where: { id: voucherGiam50k.id },
      data: { used_count: { increment: 1 } },
    });
  }

  // 16. Seed Password Reset Token
  await prisma.passwordResetToken.create({
    data: {
      user_id: customers[0].id,
      otp_code: '123456',
      expires_at: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // 17. Seed AI analysis sample
  await prisma.aiAnalysis.create({
    data: {
      booking_id: bookings[1].id,
      input_text: 'Máy giặt không xả nước, lồng máy vẫn quay.',
      suggested_services: { reasons: ['Kiểm tra bơm xả', 'Vệ sinh bộ lọc', 'Thay van xả'] },
      severity: 'MEDIUM',
      tech_summary: 'Có khả năng bơm xả hoặc đường ống thoát bị tắc.',
      raw_response: { analysis: 'pump_or_drainage_issue' },
    },
  });

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
