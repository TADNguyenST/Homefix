const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.blog.count();
    console.log('Blog count:', count);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
