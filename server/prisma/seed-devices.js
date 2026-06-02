require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const deviceCatalog = [
  {
    category: 'Điện lạnh',
    devices: [
      ['Máy lạnh treo tường', 'Máy lạnh dân dụng phổ biến trong phòng ngủ, phòng khách.'],
      ['Máy lạnh âm trần', 'Máy lạnh âm trần cassette cho căn hộ, văn phòng nhỏ.'],
    ],
  },
  {
    category: 'Thiết bị giặt sấy',
    devices: [
      ['Máy giặt cửa trước', 'Máy giặt lồng ngang gia đình.'],
      ['Máy giặt cửa trên', 'Máy giặt lồng đứng gia đình.'],
      ['Máy sấy quần áo', 'Máy sấy dân dụng.'],
    ],
  },
  {
    category: 'Thiết bị bếp',
    devices: [
      ['Tủ lạnh', 'Tủ lạnh mini, tủ lạnh 1 cánh, 2 cánh hoặc side-by-side.'],
      ['Bếp từ', 'Bếp từ đơn hoặc bếp từ âm nhiều vùng nấu.'],
      ['Bếp gas', 'Bếp gas âm hoặc bếp gas dương.'],
      ['Máy hút mùi', 'Máy hút mùi bếp gia đình.'],
    ],
  },
  {
    category: 'Điện gia dụng',
    devices: [
      ['Ổ cắm / công tắc', 'Ổ cắm, công tắc, CB nhánh trong nhà.'],
      ['Quạt điện', 'Quạt đứng, quạt treo tường hoặc quạt trần dân dụng.'],
      ['Bình nóng lạnh', 'Bình nóng lạnh trực tiếp hoặc gián tiếp.'],
    ],
  },
  {
    category: 'Cấp thoát nước',
    devices: [
      ['Ống nước', 'Đường ống cấp nước hoặc thoát nước dân dụng.'],
      ['Vòi nước / vòi sen', 'Vòi lavabo, vòi bếp hoặc vòi sen.'],
      ['Lavabo', 'Chậu rửa mặt và hệ thống thoát nước lavabo.'],
      ['Bồn cầu', 'Bồn cầu xả yếu, rò nước hoặc nghẹt nhẹ.'],
    ],
  },
];

async function main() {
  console.log('Cập nhật loại thiết bị chuẩn HomeFix...');

  const categories = await prisma.serviceCategory.findMany();
  const categoryByName = new Map(categories.map((category) => [category.name, category]));

  await prisma.deviceType.deleteMany();

  let count = 0;
  for (const group of deviceCatalog) {
    const category = categoryByName.get(group.category);
    if (!category) {
      console.warn(`Bỏ qua nhóm "${group.category}" vì chưa có danh mục tương ứng.`);
      continue;
    }

    for (const [name, description] of group.devices) {
      await prisma.deviceType.create({
        data: {
          category_id: category.id,
          name,
          description,
        },
      });
      count += 1;
    }
  }

  console.log(`Hoàn tất: ${count} loại thiết bị.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
