import { DeviceType, PrismaClient } from "@prisma/client";
import logger from "../utils/logger";

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

/**
 * Extract user-friendly device info from User-Agent
 */
export function getDeviceInfo(userAgent?: string | null): {
  deviceType: DeviceType;
  browser: string;
  os: string;
  deviceName: string;
} {
  const ua = (userAgent || "").toLowerCase();
  
  // Detect browser
  let browser = "Unknown Browser";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";
  
  // Detect OS
  let os = "Unknown OS";
  if (ua.includes("windows nt 10")) os = "Windows 10/11";
  else if (ua.includes("windows nt 6.3")) os = "Windows 8.1";
  else if (ua.includes("windows nt 6.1")) os = "Windows 7";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os x")) {
    const macMatch = ua.match(/mac os x (\d+_\d+)/);
    os = macMatch ? `macOS ${macMatch[1].replace(/_/g, ".")}` : "macOS";
  }
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) {
    const androidMatch = ua.match(/android (\d+\.?\d*)/);
    os = androidMatch ? `Android ${androidMatch[1]}` : "Android";
  }
  else if (ua.includes("iphone") || ua.includes("ipad")) {
    const iosMatch = ua.match(/os (\d+_\d+)/);
    os = iosMatch ? `iOS ${iosMatch[1].replace(/_/g, ".")}` : "iOS";
  }
  
  const deviceType = detectDeviceType(userAgent || undefined);
  
  // Generate friendly device name
  let deviceName = "";
  if (deviceType === "MOBILE") {
    if (ua.includes("iphone")) deviceName = "iPhone";
    else if (ua.includes("ipad")) deviceName = "iPad";
    else if (ua.includes("android")) deviceName = "Android Device";
    else deviceName = "Mobile Device";
  } else if (deviceType === "DESKTOP") {
    if (os.includes("Windows")) deviceName = "Windows Computer";
    else if (os.includes("macOS")) deviceName = "Mac";
    else if (os.includes("Linux")) deviceName = "Linux Computer";
    else deviceName = "Desktop Computer";
  } else {
    deviceName = `${browser} Browser`;
  }
  
  return { deviceType, browser, os, deviceName };
}

/**
 * Get approximate location from IP address (city/country level only)
 * This would typically use a GeoIP service like MaxMind
 */
function getApproximateLocation(ipAddress?: string | null): string {
  // For now, return generic location
  // In production, you'd integrate with a GeoIP service
  if (!ipAddress) return "Unknown Location";
  
  // This is a placeholder - you'd implement actual GeoIP lookup here
  // Example: const location = await geoip.lookup(ipAddress);
  // return `${location.city}, ${location.country}`;
  
  return "Unknown Location";
}

/**
 * Create a device fingerprint for session deduplication
 */
function createDeviceFingerprint(userAgent?: string | null, ipAddress?: string | null): string {
  const ua = (userAgent || "").toLowerCase();
  const ip = ipAddress || "unknown";
  
  // Extract browser and OS info for fingerprinting
  const browserMatch = ua.match(/(chrome|firefox|safari|edge)\/(\d+)/);
  const osMatch = ua.match(/(windows|mac|linux|android|ios)/);
  
  const browser = browserMatch ? `${browserMatch[1]}_${browserMatch[2]}` : "unknown";
  const os = osMatch ? osMatch[1] : "unknown";
  
  return `${ip}_${browser}_${os}`;
}

/**
 * Find or create a user session, with intelligent deduplication
 */
export async function findOrCreateUserSession(
  prisma: PrismaClient,
  params: {
    userId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }
) {
  const deviceType = detectDeviceType(params.userAgent || undefined);
  const fingerprint = createDeviceFingerprint(params.userAgent, params.ipAddress);
  
  // Look for recent active sessions from the same device
  const recentSessions = await prisma.userSession.findMany({
    where: {
      userId: params.userId,
      revokedAt: null,
      deviceType,
      // Sessions created in the last 7 days
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { lastSeenAt: "desc" }
  });

  // Check if we have a matching session based on fingerprint
  for (const session of recentSessions) {
    const sessionFingerprint = createDeviceFingerprint(session.userAgent, session.ipAddress);
    if (sessionFingerprint === fingerprint) {
      // Update last seen and return existing session
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      });
      
      logger.info("Reusing existing session", { 
        sessionId: session.id, 
        userId: params.userId,
        deviceType,
        fingerprint: fingerprint.substring(0, 20) + "..."
      });
      
      return session;
    }
  }

  // No matching session found, create new one
  logger.info("Creating new session", { 
    userId: params.userId, 
    deviceType,
    fingerprint: fingerprint.substring(0, 20) + "...",
    existingSessions: recentSessions.length
  });
  
  const session = await prisma.userSession.create({
    data: {
      userId: params.userId,
      deviceType,
      userAgent: params.userAgent || undefined,
      ipAddress: params.ipAddress || undefined,
      lastSeenAt: new Date()
    },
  });
  
  return session;
}

/**
 * Legacy function - now wraps findOrCreateUserSession
 * @deprecated Use findOrCreateUserSession instead
 */
export async function createUserSession(
  prisma: PrismaClient,
  params: {
    userId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }
) {
  return findOrCreateUserSession(prisma, params);
}

export async function updateSessionLastSeen(
  prisma: PrismaClient,
  sessionId: string
) {
  try {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  } catch (error) {
    // Session might have been deleted, log but don't throw
    logger.warn("Failed to update session lastSeenAt", { sessionId, error });
  }
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
  
  logger.info("Session revoked", { sessionId: session.id, userId: params.userId });
  
  return { ok: true } as const;
}

/**
 * Revoke all sessions for a user except the current one
 */
export async function revokeAllOtherSessions(
  prisma: PrismaClient,
  params: { userId: string; currentSessionId?: string }
) {
  const whereClause: any = {
    userId: params.userId,
    revokedAt: null
  };
  
  if (params.currentSessionId) {
    whereClause.id = { not: params.currentSessionId };
  }
  
  const result = await prisma.userSession.updateMany({
    where: whereClause,
    data: { revokedAt: new Date() }
  });
  
  logger.info("Revoked all other sessions", { 
    userId: params.userId, 
    currentSessionId: params.currentSessionId,
    revokedCount: result.count
  });
  
  return { revokedCount: result.count };
}

export async function listActiveUserSessions(
  prisma: PrismaClient,
  userId: string
) {
  const sessions = await prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
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

  // Transform to user-friendly format
  return sessions.map(session => {
    const deviceInfo = getDeviceInfo(session.userAgent);
    const location = getApproximateLocation(session.ipAddress);
    
    return {
      id: session.id,
      deviceName: deviceInfo.deviceName,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      location,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt || session.createdAt,
      isCurrent: false // Will be set by the controller if this is the current session
    };
  });
}

/**
 * Remove only revoked sessions older than 90 days (user privacy)
 * Never auto-delete active sessions - that's the user's choice
 */
export async function cleanupRevokedSessions(
  prisma: PrismaClient,
  userId?: string
) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  const whereClause: any = {
    revokedAt: { 
      not: null,
      lt: ninetyDaysAgo 
    }
  };
  
  if (userId) {
    whereClause.userId = userId;
  }
  
  const deleted = await prisma.userSession.deleteMany({
    where: whereClause
  });

  logger.info("Revoked session cleanup completed", {
    userId: userId || "all",
    deletedCount: deleted.count
  });

  return { deletedCount: deleted.count };
}

