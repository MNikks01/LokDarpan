import { AppError } from "@lokdarpan/errors";
import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/** One unit, its ancestors for a breadcrumb, and its own boundary if held. */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const unitId = Number(id);
    if (!Number.isInteger(unitId) || unitId < 1) throw new AppError("NOT_FOUND", `No unit ${id}`);

    return inLedger(async ({ geography }) => {
      const unit = await geography.unitById(unitId);
      if (unit === null) throw new AppError("NOT_FOUND", `No unit ${id}`);

      const [ancestors, geometry] = await Promise.all([
        geography.ancestorsOf(unitId),
        geography.boundaryOf(unitId),
      ]);
      return { unit, ancestors, geometry };
    });
  });
}
