// Short number names for big numbers: 1.23 M, 4.56 Qa, then e-notation.

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", "OcDc", "NoDc", "Vg"];

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (n < 0) return "-" + formatNumber(-n);
  if (n < 1000) {
    if (n < 10 && n % 1 !== 0) return n.toFixed(1).replace(/\.0$/, "");
    return Math.floor(n).toString();
  }
  // log10 can land just under a whole number (1e12 gives 11.999...), and
  // rounding can carry 999.96 up to 1000, so settle the tier from the digits.
  let tier = Math.floor(Math.log10(n) / 3);
  if (n / Math.pow(1000, tier) < 1) tier--;
  const scaled = n / Math.pow(1000, tier);
  const digits = scaled >= 100 ? 1 : scaled >= 10 ? 2 : 3;
  let text = scaled.toFixed(digits);
  if (Number(text) >= 1000) {
    tier++;
    text = (n / Math.pow(1000, tier)).toFixed(3);
  }
  if (tier >= SUFFIXES.length) return n.toExponential(2).replace("+", "");
  // Trailing zeros add nothing: "1 T", "56.7 M".
  return `${text.replace(/\.?0+$/, "")} ${SUFFIXES[tier]}`;
}

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
