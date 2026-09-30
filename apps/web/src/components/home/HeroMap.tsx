import type React from "react";
import Link from "next/link";
import type { DistrictOpenTenders, StateHoldings } from "@lokdarpan/database/overview";
import type { IndiaOutline } from "@/server/india-map";
import { homeCopy } from "@/copy/home";
import { cx } from "@/ui/cx";
import styles from "./home.module.css";

/** The explorer, opened on one state. The same parameter the explorer writes. */
export const stateHref = (code: string): string => `/explore?state=${encodeURIComponent(code)}`;

/** At most this many floating cards; the list under the map names every state. */
const MAX_CARDS = 4;

interface Card {
  readonly holding: StateHoldings;
  readonly anchor: readonly [number, number];
  side: "left" | "right";
  /** Vertical centre of the card, as a fraction of the map's height. */
  y: number;
}

/**
 * Cards on two sides of the map, each joined to its state by a line.
 *
 * A state left of centre gets a card on the left, and the rest on the right;
 * cards on one side are then spread down the sea so none overlaps. Order is LGD code, which
 * is also the order the list under the map uses — never a ranking.
 */
function placeCards(outline: IndiaOutline, holdings: readonly StateHoldings[]): readonly Card[] {
  const anchors = new Map(outline.states.map((s) => [s.code, s.anchor]));
  const cards: Card[] = [];
  for (const holding of holdings) {
    const anchor = anchors.get(holding.stateLgdCode);
    if (anchor === undefined) continue;
    cards.push({
      holding,
      anchor,
      side: anchor[0] / outline.width < 0.42 ? "left" : "right",
      y: anchor[1] / outline.height,
    });
    if (cards.length === MAX_CARDS) break;
  }
  // Keep the sides balanced: a third card on one side moves to the other.
  for (const side of ["left", "right"] as const) {
    const onSide = cards.filter((c) => c.side === side);
    for (const card of onSide.slice(2)) card.side = side === "left" ? "right" : "left";
  }
  // Cards sit over the sea rather than over land: the Arabian Sea below
  // Gujarat on the left, the Bay of Bengal on the right. Placed there, no card
  // covers the state it describes, and the leader line does the pointing.
  const FLOOR = { left: 0.64, right: 0.5 } as const;
  const GAP = 0.16;
  for (const side of ["left", "right"] as const) {
    const onSide = cards.filter((c) => c.side === side).sort((a, b) => a.y - b.y);
    let floor: number = FLOOR[side];
    for (const card of onSide) {
      card.y = Math.min(0.92, Math.max(floor, card.y));
      floor = card.y + GAP;
    }
  }
  return cards;
}

const pct = (n: number): string => `${(n * 100).toFixed(2)}%`;

/** Where a leader line meets its card, as a fraction of the map's width. */
const CARD_EDGE = 0.3;

export function HeroMap({
  outline,
  holdings,
  tenderDistricts,
}: {
  readonly outline: IndiaOutline;
  /** Null when the ledger could not be read: boundaries only, and the page says why. */
  readonly holdings: readonly StateHoldings[] | null;
  readonly tenderDistricts: readonly DistrictOpenTenders[] | null;
}): React.JSX.Element {
  const { hero } = homeCopy;
  const held = new Set((holdings ?? []).map((h) => h.stateLgdCode));
  const cards = holdings === null ? [] : placeCards(outline, holdings);
  const dots = (tenderDistricts ?? []).flatMap((d) => {
    const key = `${d.stateLgdCode}-${d.districtLgdCode}`;
    const district = outline.districts.get(key);
    return district === undefined ? [] : [{ key, at: district.anchor }];
  });
  const { width, height } = outline;

  return (
    <figure className={styles.mapFigure}>
      <div
        className={styles.mapStage}
        style={{ aspectRatio: `${String(width)} / ${String(height)}` }}
      >
        <svg
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          role="img"
          aria-label={hero.mapLabel}
          className={styles.mapSvg}
        >
          <g className={styles.mapStates}>
            {outline.states.map((state) => (
              <path
                key={state.code}
                d={state.d}
                className={held.has(state.code) ? styles.mapHeld : undefined}
              />
            ))}
          </g>
          <g className={styles.mapDots}>
            {dots.map((dot) => (
              <circle key={dot.key} cx={dot.at[0]} cy={dot.at[1]} r="3.2" />
            ))}
          </g>
          <g className={styles.mapLeaders}>
            {cards.map((card) => (
              <line
                key={card.holding.stateLgdCode}
                x1={card.anchor[0]}
                y1={card.anchor[1]}
                x2={(card.side === "left" ? CARD_EDGE : 1 - CARD_EDGE) * width}
                y2={card.y * height}
                pathLength={1}
              />
            ))}
          </g>
          <g className={styles.mapAnchors}>
            {cards.map((card) => (
              <circle
                key={card.holding.stateLgdCode}
                cx={card.anchor[0]}
                cy={card.anchor[1]}
                r="4.5"
              />
            ))}
          </g>
        </svg>
        {cards.map((card, index) => (
          <Link
            key={card.holding.stateLgdCode}
            href={stateHref(card.holding.stateLgdCode)}
            className={cx(
              styles.mapCard,
              card.side === "left" ? styles.mapCardLeft : styles.mapCardRight,
            )}
            style={{ top: pct(card.y), animationDelay: `${String(400 + index * 140)}ms` }}
            aria-label={hero.cardLink(card.holding.stateName)}
          >
            <strong>{card.holding.stateName}</strong>
            <span>{hero.card(card.holding.reports, card.holding.publishedFacts)}</span>
          </Link>
        ))}
      </div>

      <figcaption className={styles.mapCaption}>
        {holdings === null ? (
          <p className={styles.mapUnavailable}>{hero.unavailable}</p>
        ) : (
          <>
            <ul className={styles.mapList}>
              {holdings.map((h) => (
                <li key={h.stateLgdCode}>
                  <Link href={stateHref(h.stateLgdCode)}>{h.stateName}</Link>
                  <span>{hero.card(h.reports, h.publishedFacts)}</span>
                </li>
              ))}
            </ul>
            <ul className={styles.legend}>
              {held.size > 0 ? (
                <li>
                  <span className={cx(styles.swatch, styles.swatchHeld)} aria-hidden="true" />
                  {hero.legendReports}
                </li>
              ) : null}
              {dots.length > 0 ? (
                <li>
                  <span className={cx(styles.swatch, styles.swatchDot)} aria-hidden="true" />
                  {hero.legendTenders}
                </li>
              ) : null}
            </ul>
          </>
        )}
        <p className={styles.credit}>
          {hero.boundaryCredit(outline.attribution, outline.licence)} {outline.note}
        </p>
      </figcaption>
    </figure>
  );
}
