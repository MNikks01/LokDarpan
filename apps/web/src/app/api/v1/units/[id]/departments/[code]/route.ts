import { PostgresDepartmentFinanceRepository } from "@lokdarpan/database/department-finance";

import { pool } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

export function GET(
  request: Request,
  context: { params: Promise<{ id: string; code: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id, code } = await context.params;
    const repo = new PostgresDepartmentFinanceRepository(pool());
    const view = await repo.findByCode(id, code);
    return { data: view, datasetVersion: view.datasetVersion };
  });
}
