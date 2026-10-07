import type React from "react";
import Link from "next/link";
import { cx } from "@/ui/cx";
import { availabilityLabel, homeCopy, type Availability } from "@/copy/home";
import styles from "./home.module.css";

/**
 * Pieces the homepage is built from. Server Components throughout: the page
 * ships no JavaScript of its own, and the menu is a `<details>` element, which
 * opens and closes without any.
 */

/** Where every "Explore the map" goes. One constant, so no link can drift. */
export const EXPLORE_HREF = "/explore";
export const REPORTS_HREF = "/documents";
export const ABOUT_HREF = "/about";
export const METHODOLOGY_HREF = "/about/methodology";
export const GITHUB_HREF = "https://github.com/MNikks01/LokDarpan";
/** The visible way to report an error that `legal-ethical-rules.md` requires. */
/** The correction form, which needs no account (ADR-075). */
export const ISSUE_HREF = "/report";

const GLYPH: Readonly<Record<Availability, string>> = {
  available: "●",
  partial: "◐",
  planned: "○",
};

/** A status as a glyph and a word, so it never depends on colour alone. */
export function StatusMark({ status }: { readonly status: Availability }): React.JSX.Element {
  return (
    <span className={cx(styles.status, styles[status])}>
      <span aria-hidden="true">{GLYPH[status]}</span>
      {availabilityLabel[status]}
    </span>
  );
}

export function SiteHeader(): React.JSX.Element {
  const { nav } = homeCopy;
  const links = (
    <>
      <li>
        <Link href={EXPLORE_HREF}>{nav.explore}</Link>
      </li>
      <li>
        <Link href={REPORTS_HREF}>{nav.reports}</Link>
      </li>
      <li>
        <Link href={ABOUT_HREF}>{nav.sources}</Link>
      </li>
      <li>
        <a href={GITHUB_HREF} rel="noopener noreferrer">
          {nav.github}
        </a>
      </li>
    </>
  );
  return (
    <header className={styles.header} data-home-header="">
      <nav className={cx(styles.wrap, styles.headerInner)} aria-label="Main">
        <Link href="/" className={styles.brand}>
          Lok<span>Darpan</span>
        </Link>
        <ul className={styles.navLinks}>{links}</ul>
        <details className={styles.menu}>
          <summary>{nav.menu}</summary>
          <ul className={styles.menuPanel} style={{ listStyle: "none", margin: 0 }}>
            {links}
          </ul>
        </details>
        <Link href={EXPLORE_HREF} className={cx(styles.primary, styles.headerCta)}>
          {nav.cta}
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter(): React.JSX.Element {
  const { footer } = homeCopy;
  return (
    <footer className={styles.footer}>
      <div className={cx(styles.wrap, styles.footerGrid)}>
        <div>
          <Link href="/" className={styles.brand}>
            Lok<span>Darpan</span>
          </Link>
          <p className={styles.fine}>{footer.tagline}</p>
          <p className={styles.fine}>{footer.independence}</p>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.footerLinks}>
            <li>
              <Link href={EXPLORE_HREF}>{footer.links.explore}</Link>
            </li>
            <li>
              <Link href={REPORTS_HREF}>{footer.links.reports}</Link>
            </li>
            <li>
              <Link href={METHODOLOGY_HREF}>{footer.links.methodology}</Link>
            </li>
            <li>
              <a href={GITHUB_HREF} rel="noopener noreferrer">
                {footer.links.github}
              </a>
            </li>
            <li>
              <a href={ISSUE_HREF} rel="noopener noreferrer">
                {footer.links.issue}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className={cx(styles.wrap, styles.footerBase)}>
        <span>{footer.copyright}</span>
      </div>
    </footer>
  );
}

/**
 * A schematic, not a map.
 *
 * It shows how records connect — a place, the report about it, a page, a
 * figure — and draws the links LokDarpan does not hold yet as dashed. The cells
 * are abstract shapes, deliberately not the outline of India or any state: this
 * site claims no boundary it did not load from a source (ADR-066), and a
 * decorative one would be exactly that. Hidden from assistive technology, which
 * reads the caption instead.
 */
export function HeroSchematic({ label }: { readonly label: string }): React.JSX.Element {
  const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const cell = "var(--ld-raised)";
  const edge = "var(--ld-border-strong)";
  const ink = "var(--ld-text-secondary)";
  const accent = "var(--ld-accent)";
  return (
    <figure className={cx(styles.heroVisual, styles.fadeIn)} style={{ margin: 0 }}>
      <svg viewBox="0 0 480 380" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="home-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="var(--ld-hair)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="480" height="380" fill="url(#home-grid)" />

        {/* Abstract cells: places, not any real outline. */}
        <path d="M40 60 L150 40 L190 110 L130 170 L50 150 Z" fill={cell} stroke={edge} />
        <path d="M150 40 L260 50 L280 120 L190 110 Z" fill={cell} stroke={edge} />
        <path
          d="M190 110 L280 120 L300 200 L220 230 L130 170 Z"
          fill="var(--ld-accent-soft)"
          stroke={accent}
          strokeWidth="1.5"
        />
        <path d="M50 150 L130 170 L220 230 L170 300 L60 280 Z" fill={cell} stroke={edge} />
        <path d="M280 120 L380 100 L420 190 L300 200 Z" fill={cell} stroke={edge} />
        <path
          d="M220 230 L300 200 L420 190 L400 300 L260 320 L170 300 Z"
          fill={cell}
          stroke={edge}
        />

        {/* What is held: place → report → page → figure. */}
        <g fill="none" stroke={accent} strokeWidth="1.5">
          <path d="M235 170 L330 70" />
          <path d="M330 70 L420 70" />
          <path d="M420 70 L420 140" />
        </g>
        {/* What is planned: dashed, and moving slowly unless motion is reduced. */}
        <g fill="none" stroke={ink} strokeWidth="1.2" className={styles.drawn}>
          <path d="M235 170 L150 250" />
          <path d="M150 250 L80 330" />
          <path d="M235 170 L330 270" />
        </g>

        <g fontFamily={mono} fontSize="10" letterSpacing="1">
          <circle cx="235" cy="170" r="6" fill={accent} />
          <text x="225" y="158" fill={ink} textAnchor="end">
            PLACE
          </text>

          <rect
            x="300"
            y="56"
            width="60"
            height="28"
            rx="4"
            fill="var(--ld-surface)"
            stroke={accent}
          />
          <text x="307" y="74" fill={accent}>
            REPORT
          </text>

          <rect
            x="394"
            y="56"
            width="52"
            height="28"
            rx="4"
            fill="var(--ld-surface)"
            stroke={accent}
          />
          <text x="405" y="74" fill={accent}>
            PAGE
          </text>

          <rect
            x="382"
            y="140"
            width="76"
            height="28"
            rx="4"
            fill="var(--ld-surface)"
            stroke={accent}
          />
          <text x="390" y="158" fill={accent}>
            FIGURE ✓
          </text>

          <rect
            x="112"
            y="236"
            width="60"
            height="26"
            rx="4"
            fill="var(--ld-surface)"
            stroke={ink}
            strokeDasharray="4 3"
          />
          <text x="124" y="253" fill={ink}>
            WORK
          </text>

          <rect
            x="40"
            y="318"
            width="82"
            height="26"
            rx="4"
            fill="var(--ld-surface)"
            stroke={ink}
            strokeDasharray="4 3"
          />
          <text x="48" y="335" fill={ink}>
            CONTRACTOR
          </text>

          <rect
            x="296"
            y="258"
            width="66"
            height="26"
            rx="4"
            fill="var(--ld-surface)"
            stroke={ink}
            strokeDasharray="4 3"
          />
          <text x="306" y="275" fill={ink}>
            TENDER
          </text>
        </g>
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
