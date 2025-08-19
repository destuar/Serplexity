/**
 * @file reportScheduleService.ts
 * @description Service layer for managing company report schedules and deciding if a report should run today.
 */
import { PrismaClient } from "@prisma/client";

export type ReportScheduleMode = "MANUAL" | "DAILY" | "WEEKLY" | "CUSTOM";

export interface ReportScheduleDTO {
  mode: ReportScheduleMode;
  timezone?: string | null;
  weeklyDays: number[]; // 0 (Sun) - 6 (Sat)
  dates: string[]; // ISO date strings (YYYY-MM-DD)
}

function getLocalDateParts(
  dateUtc: Date,
  timezone?: string | null
): {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
  dow: number; // 0-6
} {
  const tz = timezone || "UTC";
  // Convert to local time string in the specified timezone
  const locale = "en-CA"; // produces YYYY-MM-DD format
  const dateStr = dateUtc.toLocaleString("en-US", { timeZone: tz });
  const local = new Date(dateStr);

  const y = parseInt(
    local.toLocaleDateString(locale, { timeZone: tz, year: "numeric" }),
    10
  );
  const m = parseInt(
    local.toLocaleDateString(locale, { timeZone: tz, month: "2-digit" }),
    10
  );
  const d = parseInt(
    local.toLocaleDateString(locale, { timeZone: tz, day: "2-digit" }),
    10
  );
  // Get day of week (0=Sunday, 1=Monday, etc.) using timezone
  const localDate = new Date(dateUtc.toLocaleString("en-US", { timeZone: tz }));
  const dayOfWeek = localDate.getDay();
  return { y, m, d, dow: dayOfWeek };
}

export async function getCompanyReportSchedule(
  prisma: PrismaClient,
  companyId: string
): Promise<ReportScheduleDTO> {
  const schedule = await prisma.reportSchedule.findUnique({
    where: { companyId },
  });

  if (!schedule) {
    // Default behavior: DAILY with no specific weekly days or dates
    return { mode: "DAILY", timezone: "UTC", weeklyDays: [], dates: [] };
  }

  const dateRows = await prisma.reportScheduleDate.findMany({
    where: { companyId },
    select: { date: true },
  });
  const dates = dateRows
    .map((d) => new Date(d.date))
    .map((d) => d.toISOString().slice(0, 10));

  return {
    mode: schedule.mode as ReportScheduleMode,
    timezone: schedule.timezone ?? "UTC",
    weeklyDays: schedule.weeklyDays ?? [],
    dates,
  };
}

export async function upsertCompanyReportSchedule(
  prisma: PrismaClient,
  companyId: string,
  data: ReportScheduleDTO
): Promise<ReportScheduleDTO> {
  // Normalize dates to midnight UTC for storage
  const normalizedDates = (data.dates || []).map((iso) => {
    const d = new Date(iso);
    // normalize to YYYY-MM-DD at 00:00:00Z
    const utc = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );
    return utc;
  });

  const existing = await prisma.reportSchedule.findUnique({
    where: { companyId },
  });

  if (!existing) {
    await prisma.reportSchedule.create({
      data: {
        companyId,
        mode: data.mode,
        timezone: data.timezone || "UTC",
        weeklyDays: data.weeklyDays || [],
      },
    });
  } else {
    await prisma.reportSchedule.update({
      where: { companyId },
      data: {
        mode: data.mode,
        timezone: data.timezone || "UTC",
        weeklyDays: data.weeklyDays || [],
      },
    });
  }

  // Replace all dates for this company
  await prisma.reportScheduleDate.deleteMany({ where: { companyId } });
  if (normalizedDates.length > 0) {
    await prisma.reportScheduleDate.createMany({
      data: normalizedDates.map((date) => ({ companyId, date })),
      skipDuplicates: true,
    });
  }

  return getCompanyReportSchedule(prisma, companyId);
}

export async function shouldGenerateToday(
  prisma: PrismaClient,
  companyId: string,
  nowUtc: Date = new Date()
): Promise<boolean> {
  const schedule = await prisma.reportSchedule.findUnique({
    where: { companyId },
  });

  // Default = DAILY if no schedule
  if (!schedule) return true;

  const { y, m, d, dow } = getLocalDateParts(
    nowUtc,
    schedule.timezone || "UTC"
  );
  const todayKey = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  switch (schedule.mode) {
    case "MANUAL":
      return false;
    case "DAILY":
      return true;
    case "WEEKLY": {
      const days = schedule.weeklyDays || [];
      return days.includes(dow);
    }
    case "CUSTOM": {
      const match = await prisma.reportScheduleDate.findFirst({
        where: {
          companyId,
          // Compare on date (UTC). We stored at 00:00:00Z
          date: new Date(`${todayKey}T00:00:00.000Z`),
        },
        select: { id: true },
      });
      return !!match;
    }
    default:
      return true;
  }
}
