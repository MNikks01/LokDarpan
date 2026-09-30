import type React from "react";
import Link from "next/link";
import { formatAmount, formatAmountSpoken } from "@lokdarpan/money";
import type { ExampleFigure } from "@lokdarpan/database/overview";
import type { StateCloseUp } from "@/server/india-map";
import { homeCopy, longDate } from "@/copy/home";
import { cx } from "@/ui/cx";
import { Icon, type IconName } from "./icons";
import { stateHref } from "./HeroMap";
import styles from "./home.module.css";

const count = (value: number): string => value.toLocaleString("en-IN");

/**
 * The explorer, previewed: one state drawn from the ledger's geometry, with
 * what is held there beside it.
 *
 * A picture of the product built from its real data rather than a screenshot
 * that would go stale — and rather than the map library itself, which would
 * put the explorer's whole bundle on the homepage.
 */
export function PlacePreview({
  closeUp,
  reports,
  figures,
  openTenders,
  tenderDistricts,
}: {
  readonly closeUp: StateCloseUp;
  readonly reports: number;
  readonly figures: number;
  /** Null when the state's portal is not collected: never shown as zero. */
  readonly openTenders: number | null;
  /** District codes in this state with open tenders placed in them. */
  readonly tenderDistricts: ReadonlySet<string>;
}): React.JSX.Element {
  const { preview } = homeCopy;
  return (
    <div className={styles.frame}>
      <div className={styles.frameBar} aria-hidden="true">
        <span />
        <span />
        <span />
        <em>{preview.frameLabel}</em>
      </div>
      <div className={styles.frameBody}>
        <div className={styles.previewMap}>
          <svg
            viewBox={`-8 -8 ${String(closeUp.width + 16)} ${String(closeUp.height + 16)}`}
            aria-hidden="true"
            focusable="false"
          >
            <path d={closeUp.d} className={styles.previewState} />
            {closeUp.districts.map((district) => (
              <circle
                key={district.code}
                cx={district.anchor[0]}
                cy={district.anchor[1]}
                r={tenderDistricts.has(district.code) ? 5 : 3}
                className={
                  tenderDistricts.has(district.code) ? styles.previewTender : styles.previewDistrict
                }
              />
            ))}
          </svg>
          <ul className={styles.legend}>
            <li>
              <span className={cx(styles.swatch, styles.swatchDistrict)} aria-hidden="true" />
              {preview.legendDistrict}
            </li>
            {tenderDistricts.size > 0 ? (
              <li>
                <span className={cx(styles.swatch, styles.swatchDot)} aria-hidden="true" />
                {preview.legendTenders}
              </li>
            ) : null}
          </ul>
        </div>
        <div className={styles.previewPanel}>
          <h3>{closeUp.name}</h3>
          <dl className={styles.previewStats}>
            <div>
              <dt>{preview.districts}</dt>
              <dd>{count(closeUp.districts.length)}</dd>
            </div>
            <div>
              <dt>{preview.reports}</dt>
              <dd>{count(reports)}</dd>
            </div>
            <div>
              <dt>{preview.figures}</dt>
              <dd>{count(figures)}</dd>
            </div>
            <div>
              <dt>{preview.tenders}</dt>
              <dd>{openTenders === null ? preview.tendersNotCollected : count(openTenders)}</dd>
            </div>
          </dl>
          {openTenders === null ? (
            <p className={styles.previewNote}>{preview.tendersNotCollectedNote(closeUp.name)}</p>
          ) : null}
          <Link href={stateHref(closeUp.code)} className={styles.primary}>
            {preview.cta(closeUp.name)} <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface TrailStep {
  readonly icon: IconName;
  readonly label: string;
  readonly body: React.ReactNode;
}

const SCHEMATIC_ICONS: readonly IconName[] = ["figure", "quote", "page", "report", "file", "check"];

/**
 * One verified figure and everything it carries, in the order a reader would
 * check it: the number, the sentence, the page, the report, the file, and who
 * checked it. With no example, the same steps are named without values.
 */
export function SourceTrail({
  example,
}: {
  readonly example: ExampleFigure | null;
}): React.JSX.Element {
  const { trail } = homeCopy;
  if (example === null) {
    return (
      <ol className={styles.trail}>
        {trail.schematic.map((step, index) => (
          <li key={step} className={styles.trailStep}>
            <span className={styles.trailIcon}>
              <Icon name={SCHEMATIC_ICONS[index] ?? "check"} />
            </span>
            <div className={styles.trailBody}>{step}</div>
          </li>
        ))}
      </ol>
    );
  }

  let host = example.sourceUrl;
  try {
    host = new URL(example.sourceUrl).host;
  } catch {
    // An unparseable URL is shown as stored rather than hidden.
  }

  const steps: readonly TrailStep[] = [
    {
      icon: "figure",
      label: trail.steps.figure,
      body: (
        <span className={styles.trailFigure} title={formatAmountSpoken(example.value)}>
          {formatAmount(example.value)}
        </span>
      ),
    },
    {
      icon: "quote",
      label: trail.steps.sentence,
      body: <q className={styles.trailQuote}>{example.rawText}</q>,
    },
    { icon: "page", label: trail.steps.page, body: trail.pageNumber(example.pageNumber) },
    {
      icon: "report",
      label: trail.steps.report,
      body: (
        <>
          {example.documentTitle}
          <span className={styles.trailMeta}>{example.issuingAuthority}</span>
        </>
      ),
    },
    {
      icon: "file",
      label: trail.steps.source,
      body: (
        <>
          <a href={example.sourceUrl} rel="noopener noreferrer" className={styles.trailLink}>
            {host}
          </a>
          <span className={styles.trailMeta}>{trail.retrieved(longDate(example.retrievedAt))}</span>
        </>
      ),
    },
    {
      icon: "check",
      label: trail.steps.checked,
      body: trail.checkedOn(longDate(example.verifiedAt)),
    },
  ];

  return (
    <>
      <ol className={styles.trail}>
        {steps.map((step) => (
          <li key={step.label} className={styles.trailStep}>
            <span className={styles.trailIcon}>
              <Icon name={step.icon} />
            </span>
            <div>
              <span className={styles.trailLabel}>{step.label}</span>
              <div className={styles.trailBody}>{step.body}</div>
            </div>
          </li>
        ))}
      </ol>
      <Link href={`/documents/${String(example.documentId)}`} className={styles.textLink}>
        {trail.open} <Icon name="arrow" size={16} />
      </Link>
    </>
  );
}
