import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function getOrgId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHORIZED");

  const member = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });

  if (!member) throw new Error("NO_ORGANIZATION");
  return member.organizationId;
}

export async function getOrgIdSafe(): Promise<string | null> {
  try {
    return await getOrgId();
  } catch {
    return null;
  }
}
