export type HolidaySuggestion = {
  date: string;
  label: string;
  needsConfirmation?: boolean;
};

// Vietnamese lunar-calendar conversion (UTC+7).  It deliberately has no
// external service dependency, so the yearly suggestions remain available
// when the Academy is running offline from external calendar providers.
const INT = Math.floor;

function julianDay(day: number, month: number, year: number) {
  const a = INT((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  let jd = day + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = day + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

function fromJulianDay(jd: number) {
  let b: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    const c = a - INT((b * 146097) / 4);
    const d = INT((4 * c + 3) / 1461);
    const e = c - INT((1461 * d) / 4);
    const m = INT((5 * e + 2) / 153);
    return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)] as const;
  }
  b = 0;
  const c = jd + 32082;
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)] as const;
}

function newMoonDay(k: number, timeZone: number) {
  const t = k / 1236.85;
  const t2 = t * t;
  const t3 = t2 * t;
  const dr = Math.PI / 180;
  let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
  jd += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);
  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
  const mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
  let correction = (0.1734 - 0.000393 * t) * Math.sin(m * dr) + 0.0021 * Math.sin(2 * dr * m);
  correction -= 0.4068 * Math.sin(mpr * dr) + 0.0161 * Math.sin(2 * mpr * dr) - 0.0004 * Math.sin(3 * mpr * dr);
  correction += 0.0104 * Math.sin(2 * f * dr) - 0.0051 * Math.sin((m + mpr) * dr) - 0.0074 * Math.sin((m - mpr) * dr);
  correction += 0.0004 * Math.sin((2 * f + m) * dr) - 0.0004 * Math.sin((2 * f - m) * dr) - 0.0006 * Math.sin((2 * f + mpr) * dr);
  correction += 0.001 * Math.sin((2 * f - mpr) * dr) + 0.0005 * Math.sin((2 * mpr + m) * dr);
  const deltaT = t < -11 ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3 : -0.000278 + 0.000265 * t + 0.000262 * t2;
  jd += correction - deltaT;
  return INT(jd + 0.5 + timeZone / 24);
}

function sunLongitude(dayNumber: number, timeZone: number) {
  const t = (dayNumber - 2451545.5 - timeZone / 24) / 36525;
  const t2 = t * t;
  const dr = Math.PI / 180;
  const m = 357.52910 + 35999.05030 * t - 0.0001559 * t2 - 0.00000048 * t * t2;
  const l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
  let dl = (1.914600 - 0.004817 * t - 0.000014 * t2) * Math.sin(dr * m);
  dl += (0.019993 - 0.000101 * t) * Math.sin(2 * dr * m) + 0.000290 * Math.sin(3 * dr * m);
  let longitude = (l0 + dl) * dr;
  longitude -= Math.PI * 2 * INT(longitude / (Math.PI * 2));
  return INT(longitude / Math.PI * 6);
}

function lunarMonth11(year: number, timeZone: number) {
  const off = julianDay(31, 12, year) - 2415021;
  const k = INT(off / 29.530588853);
  let monthStart = newMoonDay(k, timeZone);
  if (sunLongitude(monthStart, timeZone) >= 9) monthStart = newMoonDay(k - 1, timeZone);
  return monthStart;
}

function leapMonthOffset(a11: number, timeZone: number) {
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let last = 0;
  let i = 1;
  let arc = sunLongitude(newMoonDay(k + i, timeZone), timeZone);
  do { last = arc; i += 1; arc = sunLongitude(newMoonDay(k + i, timeZone), timeZone); } while (arc !== last && i < 15);
  return i - 1;
}

function lunarToSolar(day: number, month: number, year: number) {
  const timeZone = 7;
  const a11 = lunarMonth11(year - 1, timeZone);
  const b11 = lunarMonth11(year, timeZone);
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let offset = month - 11;
  if (offset < 0) offset += 12;
  if (b11 - a11 > 365) {
    const leapOffset = leapMonthOffset(a11, timeZone);
    if (offset >= leapOffset) offset += 1;
  }
  return fromJulianDay(newMoonDay(k + offset, timeZone) + day - 1);
}

function iso(day: number, month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Statutory Vietnamese holidays and a reviewable five-day Tết proposal for an academic year. */
export function getVietnamHolidaySuggestions(year: number): HolidaySuggestion[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return [];
  const tet = Array.from({ length: 5 }, (_, index) => {
    const [day, month, solarYear] = lunarToSolar(index + 1, 1, year);
    return { date: iso(day, month, solarYear), label: `Tết Nguyên Đán – mùng ${index + 1}`, needsConfirmation: true };
  });
  const [hungDay, hungMonth, hungYear] = lunarToSolar(10, 3, year);
  return [
    { date: iso(1, 1, year), label: "Tết Dương lịch" },
    ...tet,
    { date: iso(hungDay, hungMonth, hungYear), label: "Giỗ Tổ Hùng Vương (10/3 Âm lịch)" },
    { date: iso(30, 4, year), label: "Ngày Giải phóng miền Nam 30/4" },
    { date: iso(1, 5, year), label: "Ngày Quốc tế Lao động 1/5" },
    { date: iso(2, 9, year), label: "Quốc khánh 2/9" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}
