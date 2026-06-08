import prisma from '../src/lib/prisma';
prisma.organization.findMany({ select: { id: true, name: true, status: true }, take: 20 })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => prisma.$disconnect());
