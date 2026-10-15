export function globToRegExp(pattern: string) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export function isExcluded(path: string, name: string, excludes: string[]) {
  return excludes.some((raw) => {
    const pattern = String(raw || "").trim();
    if (!pattern) return false;
    const re = globToRegExp(pattern);
    return re.test(name) || re.test(path) || re.test(path.split("/").pop() || "");
  });
}

function fieldMatches(field: string, value: number) {
  if (field === "*") return true;
  return field.split(",").some((part) => {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isFinite(step) || step < 1) return false;
    if (range === "*") return value % step === 0;
    if (range.includes("-")) {
      const [start, end] = range.split("-").map(Number);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }
    const n = Number(range);
    return Number.isFinite(n) && value === n;
  });
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hour12: false,
    minute: "2-digit",
    hour: "2-digit",
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    year: "numeric",
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", options);
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  }
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function zonedParts(date: Date, timeZone = "UTC") {
  const parts = formatterFor(timeZone || "UTC").formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const weekday = WEEKDAYS.indexOf(read("weekday"));
  let hour = Number(read("hour"));
  if (hour === 24) hour = 0;
  return {
    minute: Number(read("minute")),
    hour,
    day: Number(read("day")),
    month: Number(read("month")),
    weekday: weekday < 0 ? date.getUTCDay() : weekday,
  };
}

export function cronMatches(expr: string, date: Date, timeZone = "UTC") {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  const local = zonedParts(date, timeZone);
  return (
    fieldMatches(minute, local.minute) &&
    fieldMatches(hour, local.hour) &&
    fieldMatches(dom, local.day) &&
    fieldMatches(month, local.month) &&
    fieldMatches(dow, local.weekday)
  );
}

export function nextRunAt(
  schedule: { kind: string; everyMinutes?: number; expr?: string; tz?: string },
  from: number
) {
  if (schedule.kind === "manual") return undefined;
  if (schedule.kind === "interval") {
    const minutes = Math.max(1, Number(schedule.everyMinutes) || 60);
    return from + minutes * 60_000;
  }
  if (schedule.kind === "cron" && schedule.expr) {
    const tz = schedule.tz || "UTC";
    const start = Math.ceil(from / 60_000) * 60_000;
    for (let i = 0; i < 60 * 24 * 370; i++) {
      const ts = start + i * 60_000;
      if (cronMatches(schedule.expr, new Date(ts), tz)) return ts;
    }
  }
  return undefined;
}
