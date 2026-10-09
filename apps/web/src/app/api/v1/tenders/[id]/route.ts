import { AppError } from "@lokdarpan/errors";
import { portalByCode, portalHomeUrl, tenderRecord } from "@lokdarpan/domain";

import { inLedger } from "@/server/container";
import { tenderDetailsArePublishable } from "@/server/publishable";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * One tender's record (ADR-079): what, where, who, how much and when, every
 * field known with its source or missing with its reason.
 *
 * Withheld unless the gate opens tender details (ADR-056, ADR-073): then only
 * that the tender is held, and a link to its portal, which the portals' terms
 * permit. Nothing the tender says is read, so it cannot reach a response or a
 * cache. In the operator's private preview the gate opens (ADR-078).
 */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const tenderId = Number(id);
    if (!Number.isInteger(tenderId) || tenderId < 1) {
      throw new AppError("NOT_FOUND", `No tender ${id}`);
    }
    return inLedger(async ({ tenders }) => {
      if (!tenderDetailsArePublishable()) {
        const held = await tenders.tenderPortal(tenderId);
        if (held === null) throw new AppError("NOT_FOUND", `No tender ${id}`);
        const portal = portalByCode(held.portalCode);
        return {
          withheld: true as const,
          portalUrl: portal === undefined ? null : portalHomeUrl(portal),
        };
      }
      const input = await tenders.recordInput(tenderId);
      if (input === null) throw new AppError("NOT_FOUND", `No tender ${id}`);
      return { withheld: false as const, record: tenderRecord(input) };
    });
  });
}
