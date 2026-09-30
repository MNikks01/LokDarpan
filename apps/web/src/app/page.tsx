import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cx } from "@/ui/cx";
import { homeCopy } from "@/copy/home";
import styles from "@/components/home/home.module.css";
import {
  ABOUT_HREF,
  EXPLORE_HREF,
  HeroSchematic,
  ISSUE_HREF,
  SiteFooter,
  SiteHeader,
  StatusMark,
} from "@/components/home/parts";

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
 * The homepage: what LokDarpan is, what it holds today, and the way into the map.
 *
 * Static by design. It reads nothing from the ledger, so it stays up when the
 * database does not — as it did not on 29 September 2026 — and it states no
 * number it would have to keep current by hand. What it says it holds is
 * reviewed in `copy/home.ts`, beside the claim that every planned step is
 * marked as planned.
 */
export default function Home(): React.JSX.Element {
  const { hero, what, features, journey, how, audience, transparency, today, final } = homeCopy;

  return (
    <div className={styles.page} data-page="home">
      <SiteHeader />

      <div className={styles.wrap}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.fadeIn}>
            <p className={styles.eyebrow}>{hero.eyebrow}</p>
            <h1 id="home-title" className={styles.h1}>
              {hero.headline}
            </h1>
            <p className={styles.heroLead}>{hero.lead}</p>
            <p className={styles.heroDirection}>{hero.direction}</p>
            <div className={styles.ctas}>
              <Link href={EXPLORE_HREF} className={styles.primary}>
                {hero.primary} <span aria-hidden="true">→</span>
              </Link>
              <a href="#how-it-works" className={styles.secondary}>
                {hero.secondary}
              </a>
            </div>
            <p className={styles.micro}>{hero.micro}</p>
          </div>
          <HeroSchematic label={hero.visualLabel} />
        </section>
      </div>

      <section className={styles.section} aria-labelledby="home-what">
        <div className={cx(styles.wrap, styles.twoCol)}>
          <div>
            <h2 id="home-what" className={styles.h2}>
              {what.heading}
            </h2>
            <p className={styles.lead}>{what.body}</p>
            <p className={styles.note}>{what.chainNote}</p>
          </div>
          <div className={styles.chainBox}>
            <h3 className={styles.chainTitle}>{what.chainHeading}</h3>
            <ol className={styles.chain}>
              {what.chain.map((step) => (
                <li key={step.label} data-status={step.status}>
                  <span>{step.label}</span>
                  <StatusMark status={step.status} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="home-features">
        <div className={styles.wrap}>
          <h2 id="home-features" className={styles.h2}>
            {features.heading}
          </h2>
          <ul className={styles.grid3} style={{ listStyle: "none", padding: 0 }}>
            {features.cards.map((card) => (
              <li key={card.title} className={styles.card}>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <StatusMark status={card.status} />
                </div>
                <p className={styles.cardBody}>{card.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="home-journey">
        <div className={styles.wrap}>
          <h2 id="home-journey" className={styles.h2}>
            {journey.heading}
          </h2>
          <p className={styles.lead}>{journey.body}</p>
          <div className={styles.journey}>
            <div className={styles.journeyRow}>
              <span className={styles.journeyLabel}>{journey.nowLabel}</span>
              <ol className={styles.steps}>
                {journey.now.map((step) => (
                  <li key={step}>
                    <span className={styles.stepNow}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.journeyRow}>
              <span className={styles.journeyLabel}>{journey.laterLabel}</span>
              <ol className={styles.steps}>
                {journey.later.map((step) => (
                  <li key={step}>
                    <span className={styles.stepLater}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.section} aria-labelledby="home-how">
        <div className={styles.wrap}>
          <h2 id="home-how" className={styles.h2}>
            {how.heading}
          </h2>
          <ol className={styles.grid3} style={{ listStyle: "none", padding: 0 }}>
            {how.steps.map((step, index) => (
              <li key={step.title} className={styles.card}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <h3 className={styles.cardTitle} style={{ marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p className={styles.cardBody}>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className={styles.ctas} style={{ marginTop: 28 }}>
            <Link href={EXPLORE_HREF} className={styles.primary}>
              {how.cta} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="home-audience">
        <div className={styles.wrap}>
          <h2 id="home-audience" className={styles.h2}>
            {audience.heading}
          </h2>
          <ul className={styles.grid5} style={{ listStyle: "none", padding: 0 }}>
            {audience.groups.map((group) => (
              <li key={group.title} className={styles.card}>
                <h3 className={styles.cardTitle} style={{ marginBottom: 8 }}>
                  {group.title}
                </h3>
                <p className={styles.cardBody}>{group.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="home-transparency">
        <div className={cx(styles.wrap, styles.twoCol)}>
          <div>
            <h2 id="home-transparency" className={styles.h2}>
              {transparency.heading}
            </h2>
            <p className={styles.lead}>{transparency.body}</p>
            <p className={styles.note}>{transparency.limits}</p>
          </div>
          <div className={styles.notBox}>
            <h3>{transparency.notHeading}</h3>
            <p>{transparency.not}</p>
            <a href={ISSUE_HREF} rel="noopener noreferrer" className={styles.textLink}>
              {transparency.reportIssue} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="home-today">
        <div className={styles.wrap}>
          <h2 id="home-today" className={styles.h2}>
            {today.heading}
          </h2>
          <p className={styles.lead}>{today.body}</p>
          <ul className={styles.todayList}>
            {today.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={styles.note}>{today.next}</p>
        </div>
      </section>

      <section className={styles.final} aria-labelledby="home-final">
        <div className={styles.wrap}>
          <h2 id="home-final" className={styles.h2}>
            {final.heading}
          </h2>
          <p className={styles.lead}>{final.body}</p>
          <div className={styles.ctas}>
            <Link href={EXPLORE_HREF} className={styles.primary}>
              {final.primary} <span aria-hidden="true">→</span>
            </Link>
            <Link href={ABOUT_HREF} className={styles.secondary}>
              {final.secondary}
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
