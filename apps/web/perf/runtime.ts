#!/usr/bin/env tsx
/**
 * The explorer's runtime, measured the way GEV's QA harnesses measure theirs
 * (ADR-062): cold and warm apart, several runs, medians and p75s, and the live
 * counts beside every number so a change in data is not mistaken for a change
 * in speed.
 *
 * Needs a running production server (`next build && next start`) and the local
 * ledger. Runtime numbers depend on the machine, so this warns and never fails
 * a build unless asked to with --strict.
 *
 *   pnpm --filter @lokdarpan/web perf:runtime -- --base=http://127.0.0.1:3000 --cold=9 --warm=7
 *
 * Profiles:
 * - desktop: 1440 × 900, no throttling.
 * - mobile: 412 × 915, 4× CPU slowdown, ~9 Mbps down / 150 ms round trip. A
 *   reader on an Indian mobile connection, not a flagship on Wi-Fi.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { MARK } from "../src/lib/perf-marks";
import { budgetsFor, formatValue, judge, summarise, type Profile, type Unit } from "./budgets";

interface Options {
  readonly base: string;
  readonly cold: number;
  readonly warm: number;
  readonly interactions: number;
  readonly profiles: readonly Profile[];
  readonly state: string;
  /** Where units are selected: a state whose districts hold boundaries of their own. */
  readonly interactState: string;
  readonly strict: boolean;
}

function options(argv: readonly string[]): Options {
  const get = (name: string): string | undefined =>
    argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const count = (name: string, fallback: number): number => {
    const value = Number(get(name) ?? fallback);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
  const profile = get("profile");
  return {
    base: get("base") ?? "http://127.0.0.1:3000",
    cold: count("cold", 9),
    warm: count("warm", 7),
    interactions: count("interactions", 7),
    profiles: profile === "desktop" || profile === "mobile" ? [profile] : ["desktop", "mobile"],
    // Madhya Pradesh: a collected state, so tender shading is part of the page.
    state: get("state") ?? "23",
    // Maharashtra: its districts hold talukas, so selecting one draws a level.
    interactState: get("interact-state") ?? "27",
    strict: argv.includes("--strict"),
  };
}

const VIEWPORT: Record<Profile, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 412, height: 915 },
};

async function newContext(browser: Browser, profile: Profile): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: VIEWPORT[profile],
    ...(profile === "mobile" ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  // Outside the test runner Playwright actions never time out. A harness that
  // hangs reports nothing, which is worse than one that fails.
  context.setDefaultTimeout(60_000);
  return context;
}

async function throttle(page: Page, profile: Profile, cacheDisabled: boolean): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled });
  if (profile === "mobile") {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (9 * 1024 * 1024) / 8,
      uploadThroughput: (2 * 1024 * 1024) / 8,
    });
  }
}

/** Mark start times, relative to navigation start. */
async function marks(page: Page): Promise<Record<string, number[]>> {
  return page.evaluate(() => {
    const out: Record<string, number[]> = {};
    for (const entry of performance.getEntriesByType("mark")) {
      (out[entry.name] ??= []).push(entry.startTime);
    }
    return out;
  });
}

async function waitForMark(page: Page, name: string, after = 0, timeout = 30_000): Promise<number> {
  const handle = await page.waitForFunction(
    ([markName, since]) =>
      performance.getEntriesByName(markName, "mark").find((entry) => entry.startTime > since)
        ?.startTime ?? false,
    [name, after] as const,
    { timeout, polling: 50 },
  );
  return (await handle.jsonValue()) as number;
}

type Samples = Record<string, number[]>;

function push(samples: Samples, id: string, value: number | undefined): void {
  if (value !== undefined && Number.isFinite(value)) (samples[id] ??= []).push(value);
}

async function loadOnce(page: Page, url: string, samples: Samples, prefix: "cold" | "warm") {
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  const firstDrawn = await waitForMark(page, MARK.boundariesDrawn);
  const m = await marks(page);
  const load = m[MARK.mapLoad]?.[0];
  push(samples, `map.load.${prefix}`, load);
  if (prefix === "cold") {
    push(samples, "rail.usable", m[MARK.hydrated]?.[0]);
    if (load !== undefined) push(samples, "map.first-boundaries", firstDrawn - load);
  }
}

async function interact(page: Page, samples: Samples, runs: number): Promise<void> {
  const select = page.getByLabel(/^Inside/);
  // On a narrow screen the rail is folded behind a button.
  if (!(await select.isVisible())) {
    await page.getByRole("button", { name: /Places & records/ }).click();
  }
  const values = await select
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ""),
    );
  const up = page.getByRole("button", { name: /Up one level/ });
  for (let i = 0; i < runs && i < values.length; i++) {
    const before = await page.evaluate(() => performance.now());
    await select.selectOption(values[i] ?? "");
    const drawn = await waitForMark(page, MARK.boundariesDrawn, before).catch(() => undefined);
    // A unit with no children draws nothing; that is not a slow draw.
    if (drawn !== undefined) push(samples, "select.boundaries-drawn", drawn - before);
    await up.click();
    await waitForMark(
      page,
      MARK.boundariesDrawn,
      (await page.evaluate(() => performance.now())) - 1,
    ).catch(() => undefined);
  }
}

/** The level endpoint alone, from this process: one discarded, then seven timed. */
async function apiTimings(url: string): Promise<Samples> {
  const samples: Samples = {};
  await fetch(url).then((r) => r.arrayBuffer());
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    await fetch(url, { cache: "no-store" }).then((r) => r.arrayBuffer());
    push(samples, "level.api", performance.now() - start);
  }
  return samples;
}

async function gzipOf(url: string): Promise<number> {
  const response = await fetch(url);
  return gzipSync(Buffer.from(await response.arrayBuffer()), { level: 9 }).byteLength;
}

async function counts(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      gpu:
        gl !== null && debug != null
          ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : "unknown",
      labelNodes: document.querySelectorAll(".maplibregl-marker").length,
      insideOptions: document.querySelectorAll("select option").length,
    };
  });
}

interface Row {
  readonly profile: Profile | "any";
  readonly id: string;
  readonly unit: Unit;
  readonly n: number;
  readonly median: number;
  readonly p75: number;
  readonly verdict: string;
}

function judgeRows(profile: Profile | null, samples: Samples, unitOf: (id: string) => Unit): Row[] {
  return Object.entries(samples).map(([id, values]) => {
    const { n, median, p75 } = summarise(values);
    const verdicts = budgetsFor(id, profile).map((b) => judge(b, median));
    const verdict = verdicts.includes("over-ceiling")
      ? "over-ceiling"
      : verdicts.includes("over-target")
        ? "over-target"
        : verdicts.length === 0
          ? "no budget"
          : "within";
    return { profile: profile ?? "any", id, unit: unitOf(id), n, median, p75, verdict };
  });
}

async function main(): Promise<number> {
  const opts = options(process.argv.slice(2));
  const url = `${opts.base}/explore?state=${opts.state}`;
  const browser = await chromium.launch();
  const rows: Row[] = [];
  const context: Record<string, unknown> = { url, startedAt: new Date().toISOString() };

  // Bytes: measured once, they do not vary between runs.
  const bytes: Samples = {};
  push(bytes, "explore.html", await gzipOf(url));

  for (const profile of opts.profiles) {
    const samples: Samples = {};
    for (let i = 0; i < opts.cold; i++) {
      const ctx = await newContext(browser, profile);
      const page = await ctx.newPage();
      await throttle(page, profile, true);
      // The level payload is measured from the request the page itself makes,
      // so it is exactly what a reader downloads for this view.
      const level =
        i === 0 && profile === opts.profiles[0]
          ? page.waitForResponse((r) => /\/api\/v1\/geo\/units\/\d+\/level$/.test(r.url()))
          : null;
      await loadOnce(page, url, samples, "cold");
      if (level !== null) {
        const response = await level;
        push(bytes, "level.payload", gzipSync(await response.body(), { level: 9 }).byteLength);
        rows.push(...judgeRows(null, bytes, () => "bytes"));
        rows.push(...judgeRows(null, await apiTimings(response.url()), () => "ms"));
      }
      if (i === 0) context[`${profile}.counts`] = await counts(page);
      await ctx.close();
    }
    const ctx = await newContext(browser, profile);
    const page = await ctx.newPage();
    await throttle(page, profile, false);
    await loadOnce(page, url, {}, "warm"); // primes the cache; not recorded
    for (let i = 0; i < opts.warm; i++) await loadOnce(page, url, samples, "warm");
    await loadOnce(page, `${opts.base}/explore?state=${opts.interactState}`, {}, "warm");
    await interact(page, samples, opts.interactions);
    await ctx.close();
    rows.push(...judgeRows(profile, samples, () => "ms"));
  }
  await browser.close();

  for (const row of rows) {
    process.stdout.write(
      `${row.profile.padEnd(8)} ${row.id.padEnd(24)} n=${String(row.n).padStart(2)}  median ${formatValue(row.unit, row.median).padStart(9)}  p75 ${formatValue(row.unit, row.p75).padStart(9)}  ${row.verdict}\n`,
    );
  }
  process.stdout.write(`${JSON.stringify(context)}\n`);

  const outDir = join(import.meta.dirname, "results");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify({ context, rows }, null, 2)}\n`);
  process.stdout.write(`written ${file}\n`);

  return opts.strict && rows.some((r) => r.verdict === "over-ceiling") ? 1 : 0;
}

if (process.argv[1] === import.meta.filename) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
