import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cx } from "@/ui/cx";
import { homeCopy } from "@/copy/home";
import styles from "@/components/home/home.module.css";
import { SiteFooter, SiteHeader } from "@/components/home/parts";
import {
  AudienceSection,
  CoverageSection,
  FinalSection,
  FlowSection,
  HeroSection,
  HoldingsStrip,
  LimitsSection,
  MatrixSection,
  PlacesSection,
  PreviewSection,
  TrailSection,
} from "@/components/home/sections";
import { loadHomeSummary } from "@/server/home-summary";
import { loadIndiaOutline, loadStateCloseUp } from "@/server/india-map";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: homeCopy.metaTitle,
  description: homeCopy.metaDescription,
  openGraph: {
    title: homeCopy.metaTitle,
    description: homeCopy.metaDescription,
    type: "website",
    siteName: "LokDarpan",
  },
  twitter: {
    card: "summary_large_image",
    title: homeCopy.metaTitle,
    description: homeCopy.metaDescription,
  },
};

/**
 * Rebuilt at most hourly, by timer.
 *
 * The architecture revalidates entity pages by `datasetVersion` tag, but no
 * webhook fires that tag yet, and this page is the one most visitors load
 * first. An hour bounds how stale its counts can be, each count states the
 * dataset version and date it was read at, and the ledger answers one query an
 * hour however many people arrive — which matters on a database whose monthly
 * transfer allowance ran out on 29 September 2026.
 */
export const revalidate = 3600;

/**
 * The homepage: what LokDarpan is, what it holds today, and the way into the map.
 *
 * Every number is read from the ledger (`server/home-summary.ts`). When the
 * ledger cannot be read the page still renders — the map as boundaries only,
 * and a plain statement in place of each count — because this is the page a
 * reader arriving from a search engine sees first.
 */
export default async function Home(): Promise<React.JSX.Element> {
  const [summary, outline] = await Promise.all([loadHomeSummary(), loadIndiaOutline()]);
  const held = summary.status === "held" ? summary : null;
  const ov = held === null ? null : held.overview;

  // The preview shows the first state, in LGD-code order, that holds reports.
  const previewState = ov?.holdingsByState[0] ?? null;
  const closeUp = previewState === null ? null : await loadStateCloseUp(previewState.stateLgdCode);

  return (
    <div className={cx(styles.page, inter.className)} data-page="home">
      <SiteHeader />
      <HeroSection outline={outline} ov={ov} />
      <HoldingsStrip
        ov={ov}
        datasetVersion={held === null ? null : held.datasetVersion}
        asOf={held === null ? null : held.asOf}
      />
      <FlowSection ov={ov} />
      <PreviewSection ov={ov} state={previewState} closeUp={closeUp} />
      <TrailSection ov={ov} />
      <MatrixSection ov={ov} />
      <PlacesSection ov={ov} outline={outline} />
      <AudienceSection />
      <LimitsSection />
      <CoverageSection ov={ov} />
      <FinalSection />
      <SiteFooter />
    </div>
  );
}
