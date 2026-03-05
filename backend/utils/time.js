function mnNowParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = fmt.formatToParts(date);
  const get = (t) => parts.find(p => p.type === t)?.value;

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mi = get("minute");
  const ss = get("second");

  // Ulaanbaatar is UTC+08:00
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`;

  return {
    work_date: `${yyyy}-${mm}-${dd}`,
    hhmm: `${hh}:${mi}`,
    iso_mn: iso
  };
}

function minutesWorkedFromISO(checkInISO, checkOutISO) {
  if (!checkInISO || !checkOutISO) return 0;
  const inMs = Date.parse(checkInISO);
  const outMs = Date.parse(checkOutISO);
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 0;
  return Math.max(0, Math.floor((outMs - inMs) / 60000));
}

/**
 * Paid minutes rule:
 * - still subtract 60 minutes (1 hour break)
 * - BUT if they worked at least 1 minute, pay at least 1 minute
 *   so salary is always estimated even for very short work.
 */
function paidMinutes(workedMinutes) {
  const w = Math.max(0, Math.floor(workedMinutes));
  if (w === 0) return 0;
  return Math.max(1, w - 60);
}

function roundTo2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { mnNowParts, minutesWorkedFromISO, paidMinutes, roundTo2 };