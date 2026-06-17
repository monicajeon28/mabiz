const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  const rows = await p.organizationMember.findMany({
    where: {
      OR: [
        { displayName: { contains: "윤미" } },
        { displayName: { contains: "원준" } },
        { displayName: { contains: "근영" } },
        { displayName: { contains: "저스틴" } },
        { displayName: { contains: "모니카" } },
        { displayName: { contains: "Justin" } },
        { displayName: { contains: "Monica" } },
        { phone: { startsWith: "boss" } },
        { phone: { startsWith: "pre" } },
        { phone: { startsWith: "sales" } },
      ]
    },
    include: { organization: { select: { name: true, id: true } } },
  });
  console.log(JSON.stringify(rows.map(m => ({
    id: m.id,
    name: m.displayName,
    phone: m.phone,
    role: m.role,
    active: m.isActive,
    orgId: m.organizationId,
    org: m.organization ? m.organization.name : null,
    managerId: m.managerId,
  })), null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
