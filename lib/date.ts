import { startOfDay, startOfMonth, startOfYear, subDays, subMonths, subYears } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const WIB_TZ = "Asia/Jakarta";

export type Granularity = "day" | "month" | "year";

export function defaultRangeForGranularity(granularity: Granularity) {
  const now = new Date();
  const nowWib = toZonedTime(now, WIB_TZ);

  if (granularity === "day") {
    const startWib = startOfDay(subDays(nowWib, 6));
    return {
      from: fromZonedTime(startWib, WIB_TZ),
      to: now,
    };
  }

  if (granularity === "month") {
    const startWib = startOfMonth(subMonths(nowWib, 11));
    return {
      from: fromZonedTime(startWib, WIB_TZ),
      to: now,
    };
  }

  const startWib = startOfYear(subYears(nowWib, 4));
  return {
    from: fromZonedTime(startWib, WIB_TZ),
    to: now,
  };
}
