import { DeviceType, PrismaClient } from "@prisma/client";

export function detectDeviceType(userAgent?: string): DeviceType {
  const ua = (userAgent || "").toLowerCase();
  if (
    ua.includes("iphone") ||
    ua.includes("android") ||
    ua.includes("mobile")
  ) {
    return "MOBILE";
  }
  if (
    ua.includes("macintosh") ||
    ua.includes("windows nt") ||
    ua.includes("linux")
  ) {
    return "DESKTOP";
  }
  if (
    ua.includes("safari") ||
    ua.includes("chrome") ||
    ua.includes("firefox") ||
    ua.includes("edg")
  ) {
    return "WEB";
  }
  return "OTHER";
}

export async function createUserSession(
  prisma: PrismaClient,
  params: {
    userId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }
) {
  const deviceType = detectDeviceType(params.userAgent || undefined);
  const session = await prisma.userSession.create({
    data: {
      userId: params.userId,
      deviceType,
      userAgent: params.userAgent || undefined,
      ipAddress: params.ipAddress || undefined,
    },
  });
  return session;
}

export async function updateSessionLastSeen(
  prisma: PrismaClient,
  sessionId: string
) {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });
}

export async function revokeUserSession(
  prisma: PrismaClient,
  params: { userId: string; sessionId: string }
) {
  const session = await prisma.userSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session || session.userId !== params.userId) {
    return { ok: false, code: 404 as const };
  }
  if (session.revokedAt) {
    return { ok: true, already: true as const };
  }
  await prisma.userSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  return { ok: true } as const;
}

export async function listActiveUserSessions(
  prisma: PrismaClient,
  userId: string
) {
  return prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      deviceType: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
      revokedAt: true,
    },
  });
}

