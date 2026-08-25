import { bucketLatency } from "./buckets.js";
import { routePattern } from "./route-pattern.js";

/**
 * A minimal counter registry exposed in Prometheus text format.
 *
 * Deliberately not OpenTelemetry auto-instrumentation. The `pg` instrumentation
 * records `db.statement` — the SQL — and the HTTP instrumentation records full
 * paths including entity ids. `.docs/13-observability/observability.md` forbids
 * collecting both. Reaching for the standard library and then stripping most of
 * what it gathers would be more code and more risk than emitting the handful of
 * series the spec actually asks for.
 */
export type LabelValues = Readonly<Record<string, string>>;

interface Series {
  readonly name: string;
  readonly help: string;
  readonly labels: LabelValues;
  value: number;
}

/** Label values are constrained: no free text ever becomes a label. */
const SAFE_LABEL_VALUE = /^[A-Za-z0-9_:/<>+.-]{1,48}$/u;

function keyOf(name: string, labels: LabelValues): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k] ?? ""}`);
  return `${name}{${parts.join(",")}}`;
}

export class MetricsRegistry {
  private readonly series = new Map<string, Series>();

  /**
   * Rejects a label value that is not from a closed set of shapes. A caller
   * that tries to label a metric with a name, a query, or an id fails loudly
   * here rather than quietly publishing it on `/metrics`.
   */
  increment(name: string, help: string, labels: LabelValues = {}, by = 1): void {
    for (const [key, value] of Object.entries(labels)) {
      if (!SAFE_LABEL_VALUE.test(value)) {
        throw new Error(
          `Refusing to record metric "${name}": label "${key}" is not a permitted value. ` +
            `Labels carry bucketed or enumerated values only — never identifiers, names or free text.`,
        );
      }
    }
    const key = keyOf(name, labels);
    const existing = this.series.get(key);
    if (existing === undefined) {
      this.series.set(key, { name, help, labels, value: by });
    } else {
      existing.value += by;
    }
  }

  /** Records one served request. Path is reduced to its route pattern first. */
  recordRequest(path: string, status: number, durationMs: number): void {
    this.increment("lokdarpan_http_requests_total", "Requests served, by route and status.", {
      route: routePattern(path),
      status: String(status),
    });
    this.increment(
      "lokdarpan_http_request_duration_bucket_total",
      "Requests served, by route and latency bucket.",
      { route: routePattern(path), bucket: bucketLatency(durationMs) },
    );
  }

  /**
   * An integrity alarm, not a usage number. Every occurrence is a rule breach
   * in the making (`.docs/13-observability/observability.md` §Guardrail telemetry).
   */
  recordContractViolation(kind: "missing_provenance" | "mixed_dataset_version"): void {
    this.increment(
      "lokdarpan_contract_violation_total",
      "Contract violations detected while serving. Target zero; investigate any occurrence.",
      { kind },
    );
  }

  /** Prometheus text exposition format. */
  render(): string {
    const byName = new Map<string, Series[]>();
    for (const s of this.series.values()) {
      const list = byName.get(s.name);
      if (list === undefined) byName.set(s.name, [s]);
      else list.push(s);
    }

    const lines: string[] = [];
    for (const [name, all] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`# HELP ${name} ${all[0]?.help ?? ""}`);
      lines.push(`# TYPE ${name} counter`);
      for (const s of all) {
        const labels = Object.keys(s.labels)
          .sort()
          .map((k) => `${k}="${s.labels[k] ?? ""}"`)
          .join(",");
        lines.push(
          labels === "" ? `${name} ${String(s.value)}` : `${name}{${labels}} ${String(s.value)}`,
        );
      }
    }
    return `${lines.join("\n")}\n`;
  }

  reset(): void {
    this.series.clear();
  }
}

export const METRICS = Symbol.for("MetricsRegistry");
