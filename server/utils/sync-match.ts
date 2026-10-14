export function globToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
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

export function cronMatches(expr: string, date: Date) {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    fieldMatches(minute, date.getUTCMinutes()) &&
    fieldMatches(hour, date.getUTCHours()) &&
    fieldMatches(dom, date.getUTCDate()) &&
    fieldMatches(month, date.getUTCMonth() + 1) &&
    fieldMatches(dow, date.getUTCDay())
  );
}

export function nextRunAt(
  schedule: { kind: string; everyMinutes?: number; expr?: string },
  from: number
) {
  if (schedule.kind === "manual") return undefined;
  if (schedule.kind === "interval") {
    const minutes = Math.max(1, Number(schedule.everyMinutes) || 60);
    return from + minutes * 60_000;
  }
  if (schedule.kind === "cron" && schedule.expr) {
    const start = Math.ceil(from / 60_000) * 60_000;
    for (let i = 0; i < 60 * 24 * 8; i++) {
      const ts = start + i * 60_000;
      if (cronMatches(schedule.expr, new Date(ts))) return ts;
    }
  }
  return undefined;
}
