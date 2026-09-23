/**
 * The portal table lives in `@lokdarpan/domain` (`gepnic-portals.ts`), shared
 * with the explorer, which links readers to each state's portal. Re-exported so
 * the collector's imports are unchanged.
 */
export { PORTALS, portalByCode, portalForState, portalHomeUrl } from "@lokdarpan/domain";
export type { Portal } from "@lokdarpan/domain";
