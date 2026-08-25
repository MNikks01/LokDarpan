/**
 * `.docs/13-observability/observability.md` §The bucketing rule: every numeric
 * value is bucketed at the source. Raw values enable re-identification through
 * combination; buckets answer every product question we actually have.
 *
 * Bucketing at the source — not at the dashboard — is what makes the guarantee
 * hold, because the raw value then never leaves the process.
 */

export const LATENCY_BUCKETS = ["<300ms", "<1s", "<3s", "<8s", "8s+"] as const;
export type LatencyBucket = (typeof LATENCY_BUCKETS)[number];

export function bucketLatency(milliseconds: number): LatencyBucket {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "8s+";
  if (milliseconds < 300) return "<300ms";
  if (milliseconds < 1_000) return "<1s";
  if (milliseconds < 3_000) return "<3s";
  if (milliseconds < 8_000) return "<8s";
  return "8s+";
}

export const COUNT_BUCKETS = ["0", "1-3", "4-10", "11-50", "51+"] as const;
export type CountBucket = (typeof COUNT_BUCKETS)[number];

export function bucketCount(value: number): CountBucket {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value <= 3) return "1-3";
  if (value <= 10) return "4-10";
  if (value <= 50) return "11-50";
  return "51+";
}

export const BYTE_BUCKETS = ["<100KB", "<1MB", "<10MB", "10MB+"] as const;
export type ByteBucket = (typeof BYTE_BUCKETS)[number];

export function bucketBytes(bytes: number): ByteBucket {
  if (!Number.isFinite(bytes) || bytes < 100_000) return "<100KB";
  if (bytes < 1_000_000) return "<1MB";
  if (bytes < 10_000_000) return "<10MB";
  return "10MB+";
}
