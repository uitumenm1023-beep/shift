function mnNowParts(date = new Date()) {
  // Get Mongolia time parts (Asia/Ulaanbaatar) using Intl (works on any server location)
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

  // Mongolia (Ulaanbaatar) is UTC+08:00
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

// Fixed unpaid break: 60 minutes per completed shift
function paidMinutes(workedMinutes) {
  return Math.max(0, workedMinutes - 60);
}

function roundTo2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { mnNowParts, minutesWorkedFromISO, paidMinutes, roundTo2 };