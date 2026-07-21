// ============================================================
// HOMEFIX AI — Seed Complaints (Dữ liệu mẫu để test chức năng Khiếu nại)
// Chạy: node prisma/seed-complaints.js
// ============================================================
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu mẫu cho Complaints...\n');

  // ─── 1. Xóa dữ liệu test cũ (complaints only) ────────────
  await prisma.complaint.deleteMany();
  await prisma.notification.deleteMany({ where: { type: 'COMPLAINT' } });
  console.log('✅ Đã xóa complaints cũ.');

  // ─── 2. Lấy users, bookings, services đã có ──────────────
  const [customers, admin, allBookings, allServices, districts, wards] = await Promise.all([
    prisma.user.findMany({ where: { role: 'CUSTOMER' }, orderBy: { id: 'asc' } }),
    prisma.user.findFirst({ where: { role: 'ADMIN' } }),
    prisma.booking.findMany({
      orderBy: { id: 'asc' },
      include: { service: true, customer: true },
    }),
    prisma.service.findMany({ orderBy: { id: 'asc' } }),
    prisma.district.findMany({ orderBy: { id: 'asc' } }),
    prisma.ward.findMany({ orderBy: { id: 'asc' } }),
  ]);

  if (customers.length === 0) {
    throw new Error('❌ Không tìm thấy khách hàng. Hãy chạy seed.js trước.');
  }
  if (!admin) {
    throw new Error('❌ Không tìm thấy admin. Hãy chạy seed.js trước.');
  }
  if (allServices.length === 0) {
    throw new Error('❌ Không tìm thấy dịch vụ. Hãy chạy seed.js trước.');
  }

  const passwordHash = await bcrypt.hash('123456', 10);

  // ─── 3. Thêm khách hàng mẫu nếu chưa đủ ─────────────────
  const ensureCustomer = async (email, fullName, phone) => {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, password_hash: passwordHash, role: 'CUSTOMER', full_name: fullName, phone },
      });
      console.log(`  ➕ Tạo mới khách hàng: ${fullName} (${email})`);
    }
    return user;
  };

  const c1 = customers[0] || await ensureCustomer('khach1@gmail.com', 'Khách Hàng 1', '0901234561');
  const c2 = customers[1] || await ensureCustomer('khach2@gmail.com', 'Khách Hàng 2', '0901234562');
  const c3 = customers[2] || await ensureCustomer('khach3@gmail.com', 'Khách Hàng 3', '0901234563');

  // Thêm thêm 2 khách mẫu
  const c4 = await ensureCustomer('nguyenthia@gmail.com', 'Nguyễn Thị A', '0912345670');
  const c5 = await ensureCustomer('tranbinhb@gmail.com', 'Trần Bình B', '0923456781');

  console.log('✅ Khách hàng sẵn sàng.\n');

  // ─── 4. Đảm bảo mỗi khách có địa chỉ ───────────────────
  const district = districts[0];
  const ward = wards[0];

  const ensureAddress = async (customerId) => {
    let addr = await prisma.customerAddress.findFirst({ where: { customer_id: customerId } });
    if (!addr) {
      addr = await prisma.customerAddress.create({
        data: {
          customer_id: customerId,
          district_id: district.id,
          ward_id: ward.id,
          address_detail: '12 Nguyễn Trãi, khu dân cư',
          label: 'Nhà',
          is_default: true,
        },
      });
    }
    return addr;
  };

  const [addr1, addr2, addr3, addr4, addr5] = await Promise.all([
    ensureAddress(c1.id),
    ensureAddress(c2.id),
    ensureAddress(c3.id),
    ensureAddress(c4.id),
    ensureAddress(c5.id),
  ]);

  console.log('✅ Địa chỉ sẵn sàng.\n');

  // ─── 5. Tạo các booking COMPLETED / CANCELLED để test ────
  const createBookingIfNeeded = async (customerId, addrId, serviceIdx, status, daysAgo) => {
    const svc = allServices[serviceIdx % allServices.length];
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    return prisma.booking.create({
      data: {
        customer_id: customerId,
        service_id: svc.id,
        description: `Đơn test cho khiếu nại — ${svc.name}`,
        customer_address_id: addrId,
        district_id: district.id,
        ward_id: ward.id,
        address_detail: '12 Nguyễn Trãi',
        booking_date: date,
        time_slot_start: '09:00',
        time_slot_end: '11:00',
        status,
        estimated_price: svc.base_price,
        final_price: status === 'COMPLETED' ? svc.base_price : null,
        payment_method: 'CASH',
        payment: {
          create: {
            amount: svc.base_price,
            method: 'CASH',
            status: status === 'COMPLETED' ? 'PAID' : 'UNPAID',
            paid_at: status === 'COMPLETED' ? date : null,
          },
        },
        statusHistories: {
          create: [{ from_status: null, to_status: status, changed_by: customerId, note: 'Seed test' }],
        },
      },
    });
  };

  console.log('📦 Tạo các booking COMPLETED / CANCELLED...');

  // Lấy booking COMPLETED và CANCELLED hiện có
  const existingCompleted = allBookings.filter(b => b.status === 'COMPLETED');
  const existingCancelled = allBookings.filter(b => b.status === 'CANCELLED');

  // Tạo thêm nhiều booking để cover đủ test case
  const b_c1_comp1 = existingCompleted.find(b => b.customer_id === c1.id)
    || await createBookingIfNeeded(c1.id, addr1.id, 0, 'COMPLETED', 10);
  const b_c1_comp2 = await createBookingIfNeeded(c1.id, addr1.id, 4, 'COMPLETED', 7);
  const b_c1_canc  = await createBookingIfNeeded(c1.id, addr1.id, 12, 'CANCELLED', 5);

  const b_c2_comp1 = existingCompleted.find(b => b.customer_id === c2.id)
    || await createBookingIfNeeded(c2.id, addr2.id, 8, 'COMPLETED', 15);
  const b_c2_comp2 = await createBookingIfNeeded(c2.id, addr2.id, 2, 'COMPLETED', 3);
  const b_c2_canc  = await createBookingIfNeeded(c2.id, addr2.id, 16, 'CANCELLED', 8);

  const b_c3_comp1 = existingCompleted.find(b => b.customer_id === c3.id)
    || await createBookingIfNeeded(c3.id, addr3.id, 8, 'COMPLETED', 12);
  const b_c3_comp2 = await createBookingIfNeeded(c3.id, addr3.id, 6, 'COMPLETED', 6);

  const b_c4_comp1 = await createBookingIfNeeded(c4.id, addr4.id, 1, 'COMPLETED', 20);
  const b_c4_comp2 = await createBookingIfNeeded(c4.id, addr4.id, 9, 'COMPLETED', 4);
  const b_c4_canc  = await createBookingIfNeeded(c4.id, addr4.id, 13, 'CANCELLED', 2);

  const b_c5_comp1 = await createBookingIfNeeded(c5.id, addr5.id, 3, 'COMPLETED', 18);
  const b_c5_comp2 = await createBookingIfNeeded(c5.id, addr5.id, 11, 'COMPLETED', 9);
  const b_c5_canc  = await createBookingIfNeeded(c5.id, addr5.id, 15, 'CANCELLED', 1);

  console.log('✅ Bookings sẵn sàng.\n');

  // ─── 6. Seed Complaints ───────────────────────────────────
  console.log('📝 Tạo dữ liệu khiếu nại mẫu...\n');

  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  const complaintsData = [
    // ════ OPEN — Mới gửi (chưa xử lý) ════
    {
      booking_id: b_c1_comp1.id,
      customer_id: c1.id,
      subject: 'Thợ làm việc không đúng giờ hẹn',
      description: 'Tôi hẹn thợ lúc 9 giờ sáng nhưng thợ đến lúc 11 giờ. Việc này khiến tôi mất cả buổi sáng chờ đợi và ảnh hưởng đến lịch làm việc. Đề nghị có biện pháp xử lý với thợ.',
      status: 'OPEN',
      ai_sentiment: 'NEGATIVE',
      created_at: daysAgo(1),
    },
    {
      booking_id: b_c4_comp1.id,
      customer_id: c4.id,
      subject: 'Máy lạnh vẫn chảy nước sau khi sửa',
      description: 'Tôi đã gọi thợ sửa máy lạnh chảy nước, nhưng sau khi thợ làm xong và về, máy vẫn tiếp tục chảy nước như cũ. Tôi cảm thấy dịch vụ không được đảm bảo chất lượng.',
      status: 'OPEN',
      ai_sentiment: 'NEGATIVE',
      created_at: daysAgo(2),
    },
    {
      booking_id: b_c5_comp1.id,
      customer_id: c5.id,
      subject: 'Hỏi về chính sách bảo hành dịch vụ',
      description: 'Tôi muốn hỏi sau khi sửa máy giặt, nếu máy bị hỏng lại trong vòng 30 ngày thì có được bảo hành miễn phí không? Tôi thấy trên website có đề cập đến bảo hành nhưng không rõ chi tiết.',
      status: 'OPEN',
      ai_sentiment: 'NEUTRAL',
      created_at: daysAgo(3),
    },

    // ════ IN_REVIEW — Đang xem xét ════
    {
      booking_id: b_c2_comp1.id,
      customer_id: c2.id,
      subject: 'Thợ thái độ không tốt, nói chuyện thiếu tôn trọng',
      description: 'Trong quá trình sửa chữa, thợ đã có thái độ khó chịu, nói chuyện trống không và bực bội khi tôi hỏi về tiến độ công việc. Đây là lần thứ 2 tôi gặp vấn đề với thợ này. Đề nghị phản ánh lên cấp trên.',
      status: 'IN_REVIEW',
      ai_sentiment: 'NEGATIVE',
      created_at: daysAgo(5),
    },
    {
      booking_id: b_c3_comp1.id,
      customer_id: c3.id,
      subject: 'Tủ lạnh sửa xong nhưng tiếng ồn vẫn còn',
      description: 'Sau khi thợ sửa xong tủ lạnh, tủ đã lạnh trở lại nhưng vẫn còn tiếng kêu nhỏ vào ban đêm. Mặc dù không quá nghiêm trọng nhưng tôi vẫn muốn phản ánh để cải thiện chất lượng dịch vụ.',
      status: 'IN_REVIEW',
      ai_sentiment: 'NEUTRAL',
      created_at: daysAgo(4),
    },
    {
      booking_id: b_c1_canc.id,
      customer_id: c1.id,
      subject: 'Đơn bị hủy nhưng không nhận được thông báo',
      description: 'Đơn của tôi bị hủy mà không có bất kỳ thông báo nào. Tôi đã chờ thợ suốt 2 tiếng mới biết đơn bị hủy. Mong admin xem xét và có giải pháp cải thiện hệ thống thông báo.',
      status: 'IN_REVIEW',
      ai_sentiment: 'NEGATIVE',
      created_at: daysAgo(6),
    },

    // ════ RESOLVED — Đã giải quyết ════
    {
      booking_id: b_c2_comp2.id,
      customer_id: c2.id,
      subject: 'Sửa máy giặt xong nhưng bị tính thêm phí không rõ lý do',
      description: 'Hóa đơn cuối cùng cao hơn báo giá ban đầu 150.000đ mà thợ không giải thích rõ lý do. Tôi đã thanh toán nhưng muốn được giải thích về khoản phát sinh này.',
      status: 'RESOLVED',
      admin_response: 'Chúng tôi đã xác nhận với kỹ thuật viên. Phần phụ thu là do phải thay thêm linh kiện phụ (dây curoa máy giặt) không nằm trong báo giá ban đầu. Chúng tôi xin lỗi vì đã không thông báo rõ ràng trước khi thực hiện. Chúng tôi đã gửi email giải thích chi tiết và hoàn tiền 50.000đ vào tài khoản của bạn như khoản bồi thường cho sự bất tiện này.',
      ai_sentiment: 'NEGATIVE',
      resolved_at: daysAgo(1),
      created_at: daysAgo(8),
    },
    {
      booking_id: b_c3_comp2.id,
      customer_id: c3.id,
      subject: 'Kỹ thuật viên đến muộn 30 phút',
      description: 'Thợ đến muộn hơn giờ hẹn 30 phút. Dù không ảnh hưởng quá lớn nhưng tôi muốn phản ánh để cải thiện dịch vụ. Nhìn chung thợ làm việc tốt sau khi đến.',
      status: 'RESOLVED',
      admin_response: 'Cảm ơn bạn đã phản ánh. Chúng tôi đã nhắc nhở kỹ thuật viên và yêu cầu thông báo sớm nếu có sự cố giao thông. Bạn sẽ được ưu tiên đặt lịch và nhận mã giảm giá 50.000đ cho lần sử dụng tiếp theo.',
      ai_sentiment: 'NEUTRAL',
      resolved_at: daysAgo(2),
      created_at: daysAgo(9),
    },
    {
      booking_id: b_c4_comp2.id,
      customer_id: c4.id,
      subject: 'Dịch vụ rất tốt, muốn đặt lại thợ cụ thể',
      description: 'Tôi muốn phản ánh tích cực về thợ đã sửa nhà. Thợ làm việc nhanh, sạch sẽ và đúng giờ. Tôi muốn biết có thể yêu cầu cùng thợ cho lần sau không? Cảm ơn HomeFix rất nhiều!',
      status: 'RESOLVED',
      admin_response: 'Cảm ơn bạn đã có phản hồi tích cực! Chúng tôi đã ghi nhận và sẽ chuyển lời khen đến kỹ thuật viên. Bạn hoàn toàn có thể yêu cầu cùng kỹ thuật viên bằng cách nhắn tin trong phần ghi chú khi đặt đơn. Chúng tôi sẽ cố gắng sắp xếp phù hợp nhất.',
      ai_sentiment: 'POSITIVE',
      resolved_at: daysAgo(1),
      created_at: daysAgo(7),
    },
    {
      booking_id: b_c5_comp2.id,
      customer_id: c5.id,
      subject: 'Sản phẩm thay thế không đúng thương hiệu yêu cầu',
      description: 'Tôi có yêu cầu thay bộ lọc máy lọc nước bằng hàng chính hãng của nhà sản xuất, nhưng thợ đã thay bằng hàng tương đương không cùng thương hiệu. Mặc dù chất lượng tương tự nhưng tôi muốn được thông báo trước.',
      status: 'RESOLVED',
      admin_response: 'Chúng tôi ghi nhận và xin lỗi về sự việc này. Kỹ thuật viên cần thông báo rõ trước khi thay thế linh kiện khác thương hiệu. Chúng tôi đã nhắc nhở và sẽ đảm bảo điều này không tái diễn. Nếu bạn muốn thay lại đúng thương hiệu, chúng tôi sẽ hỗ trợ với chi phí chỉ bằng giá linh kiện, không tính phí công.',
      ai_sentiment: 'NEUTRAL',
      resolved_at: daysAgo(3),
      created_at: daysAgo(12),
    },

    // ════ REJECTED — Đã từ chối ════
    {
      booking_id: b_c1_comp2.id,
      customer_id: c1.id,
      subject: 'Yêu cầu hoàn tiền toàn bộ vì không hài lòng',
      description: 'Tôi không hài lòng với dịch vụ và yêu cầu hoàn tiền 100% dù thợ đã hoàn thành công việc đúng theo báo giá. Tôi nghĩ giá quá cao so với thị trường.',
      status: 'REJECTED',
      admin_response: 'Sau khi xem xét, khiếu nại của bạn không đủ căn cứ để hoàn tiền. Kỹ thuật viên đã hoàn thành đúng theo phạm vi công việc và báo giá đã được bạn xác nhận trước khi thực hiện. Mức giá của chúng tôi bao gồm chi phí nhân công, dụng cụ và bảo hành 30 ngày. Nếu bạn có thắc mắc cụ thể về từng hạng mục, vui lòng liên hệ hotline để được hỗ trợ thêm.',
      ai_sentiment: 'NEGATIVE',
      resolved_at: daysAgo(2),
      created_at: daysAgo(11),
    },
    {
      booking_id: b_c2_canc.id,
      customer_id: c2.id,
      subject: 'Muốn hủy đơn và yêu cầu hoàn tiền dù đã đặt cọc',
      description: 'Tôi muốn hủy đơn hàng và yêu cầu hoàn lại toàn bộ tiền cọc. Theo tôi hiểu thì khi hủy đơn sẽ không mất phí.',
      status: 'REJECTED',
      admin_response: 'Khiếu nại của bạn không được chấp nhận vì đơn đã bị hủy trong thời gian dưới 2 giờ trước giờ hẹn — theo chính sách của HomeFix, trường hợp này sẽ bị mất 30% phí đặt cọc. Điều này đã được nêu rõ trong điều khoản dịch vụ khi bạn đặt đơn. Chúng tôi xin lỗi vì sự bất tiện.',
      ai_sentiment: 'NEGATIVE',
      resolved_at: daysAgo(4),
      created_at: daysAgo(14),
    },
    {
      booking_id: b_c4_canc.id,
      customer_id: c4.id,
      subject: 'Phàn nàn về chính sách hủy đơn không rõ ràng',
      description: 'Tôi thấy chính sách hủy đơn không được hiển thị rõ ràng trong ứng dụng. Đề nghị cải thiện giao diện để hiển thị thông tin này nổi bật hơn.',
      status: 'REJECTED',
      admin_response: 'Cảm ơn bạn đã góp ý. Tuy nhiên đây là ý kiến cải thiện sản phẩm, không phải khiếu nại có thể bồi thường. Chúng tôi đã ghi nhận góp ý và sẽ chuyển đến đội phát triển sản phẩm để cải thiện giao diện trong các phiên bản tới.',
      ai_sentiment: 'NEUTRAL',
      resolved_at: daysAgo(1),
      created_at: daysAgo(5),
    },
    {
      booking_id: b_c5_canc.id,
      customer_id: c5.id,
      subject: 'Phàn nàn nhưng sau đó rút lại vì đã được giải quyết',
      description: 'Ban đầu tôi muốn khiếu nại về việc đặt lịch nhưng sau khi gọi hotline thì đã được giải quyết. Tôi muốn rút lại khiếu nại này.',
      status: 'REJECTED',
      admin_response: 'Chúng tôi đã xác nhận với bộ phận CSKH rằng vấn đề của bạn đã được giải quyết qua hotline. Khiếu nại này được đóng theo yêu cầu của bạn. Cảm ơn bạn đã sử dụng dịch vụ HomeFix!',
      ai_sentiment: 'POSITIVE',
      resolved_at: daysAgo(0),
      created_at: daysAgo(2),
    },
  ];

  // ─── 7. Tạo complaints vào database ──────────────────────
  let count = 0;
  for (const c of complaintsData) {
    await prisma.complaint.create({
      data: {
        booking_id:     c.booking_id,
        customer_id:    c.customer_id,
        subject:        c.subject,
        description:    c.description,
        status:         c.status,
        admin_response: c.admin_response || null,
        ai_sentiment:   c.ai_sentiment,
        resolved_at:    c.resolved_at || null,
        created_at:     c.created_at,
      },
    });
    count++;
    console.log(`  ✅ [${c.status}] [${c.ai_sentiment}] ${c.subject.substring(0, 60)}...`);
  }

  console.log(`\n🎉 Đã tạo ${count} khiếu nại mẫu thành công!\n`);

  // ─── 8. Tóm tắt ─────────────────────────────────────────
  const summary = await prisma.complaint.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const sentimentSummary = await prisma.complaint.groupBy({
    by: ['ai_sentiment'],
    _count: { id: true },
  });

  console.log('📊 Thống kê dữ liệu mẫu:');
  console.log('─'.repeat(40));

  const statusEmoji = { OPEN: '🔵', IN_REVIEW: '🟡', RESOLVED: '🟢', REJECTED: '🔴' };
  for (const s of summary) {
    console.log(`  ${statusEmoji[s.status] || '⚪'} ${s.status}: ${s._count.id} khiếu nại`);
  }

  console.log('\n  AI Sentiment:');
  const sentimentEmoji = { NEGATIVE: '😠', NEUTRAL: '😐', POSITIVE: '😊' };
  for (const s of sentimentSummary) {
    console.log(`  ${sentimentEmoji[s.ai_sentiment] || '❓'} ${s.ai_sentiment}: ${s._count.id} khiếu nại`);
  }

  console.log('\n─'.repeat(40));
  console.log('📋 Tài khoản đăng nhập để test:');
  console.log('  👤 CUSTOMER 1 : khach1@gmail.com / 123456');
  console.log('  👤 CUSTOMER 2 : khach2@gmail.com / 123456');
  console.log('  👤 CUSTOMER 3 : khach3@gmail.com / 123456');
  console.log('  👤 CUSTOMER 4 : nguyenthia@gmail.com / 123456');
  console.log('  👤 CUSTOMER 5 : tranbinhb@gmail.com / 123456');
  console.log('  🔧 ADMIN      : admin@homefix.vn / 123456');
  console.log('─'.repeat(40));
  console.log('\n✨ Seeding hoàn tất!\n');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
