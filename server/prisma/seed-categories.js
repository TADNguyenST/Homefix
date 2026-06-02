require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const catalog = [
  {
    name: 'Điện lạnh',
    icon_url: 'Snowflake',
    description: 'Vệ sinh, nạp gas và sửa các sự cố máy lạnh.',
    services: [
      ['Vệ sinh máy lạnh treo tường', 180000, 60],
      ['Sửa máy lạnh không lạnh', 350000, 90],
      ['Sửa máy lạnh chảy nước', 300000, 75],
      ['Nạp gas máy lạnh R32/R410A', 320000, 60],
    ],
  },
  {
    name: 'Thiết bị giặt sấy',
    icon_url: 'RefreshCw',
    description: 'Sửa chữa và vệ sinh máy giặt, máy sấy gia đình.',
    services: [
      ['Sửa máy giặt không xả nước', 300000, 90],
      ['Sửa máy giặt không vắt', 320000, 90],
      ['Vệ sinh lồng máy giặt', 220000, 75],
      ['Sửa máy sấy không nóng', 350000, 90],
    ],
  },
  {
    name: 'Thiết bị bếp',
    icon_url: 'CookingPot',
    description: 'Sửa tủ lạnh, bếp từ, bếp gas và máy hút mùi.',
    services: [
      ['Sửa tủ lạnh không lạnh', 400000, 120],
      ['Sửa tủ lạnh chảy nước', 320000, 90],
      ['Sửa bếp từ không lên nguồn', 350000, 90],
      ['Sửa máy hút mùi kêu to', 280000, 75],
    ],
  },
  {
    name: 'Điện gia dụng',
    icon_url: 'Zap',
    description: 'Xử lý sự cố điện trong nhà và thiết bị điện dân dụng.',
    services: [
      ['Sửa chập điện trong nhà', 400000, 120],
      ['Thay ổ cắm hoặc công tắc điện', 150000, 45],
      ['Sửa quạt điện không quay', 220000, 60],
      ['Sửa bình nóng lạnh không nóng', 350000, 90],
    ],
  },
  {
    name: 'Cấp thoát nước',
    icon_url: 'Droplets',
    description: 'Sửa rò rỉ, thay vòi và thông nghẹt thiết bị vệ sinh.',
    services: [
      ['Sửa rò rỉ đường ống nước', 350000, 90],
      ['Thay vòi nước hoặc vòi sen', 180000, 45],
      ['Thông nghẹt lavabo', 220000, 60],
      ['Sửa bồn cầu xả yếu hoặc rò nước', 280000, 75],
    ],
  },
];

async function main() {
  console.log('Cập nhật danh mục và dịch vụ chuẩn HomeFix...');

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
  await prisma.technicianSkill.deleteMany();
  await prisma.service.deleteMany();
  await prisma.deviceType.deleteMany();
  await prisma.serviceCategory.deleteMany();

  const services = [];
  for (const category of catalog) {
    const createdCategory = await prisma.serviceCategory.create({
      data: {
        name: category.name,
        icon_url: category.icon_url,
        description: category.description,
      },
    });

    for (const [name, base_price, estimated_duration] of category.services) {
      services.push(
        await prisma.service.create({
          data: {
            category_id: createdCategory.id,
            name,
            base_price,
            estimated_duration,
            is_active: true,
          },
        })
      );
    }
  }

  const techProfiles = await prisma.technicianProfile.findMany();
  for (let i = 0; i < techProfiles.length; i += 1) {
    const primary = services[i % services.length];
    const secondary = services[(i + Math.ceil(services.length / 2)) % services.length];

    await prisma.technicianSkill.createMany({
      data: [
        {
          technician_profile_id: techProfiles[i].id,
          service_id: primary.id,
          skill_level: 'EXPERT',
        },
        {
          technician_profile_id: techProfiles[i].id,
          service_id: secondary.id,
          skill_level: 'INTERMEDIATE',
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log(`Hoàn tất: ${catalog.length} danh mục, ${services.length} dịch vụ.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
