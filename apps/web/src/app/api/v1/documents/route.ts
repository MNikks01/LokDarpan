import { publishedFactRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    // `?unit=<lgdCode>` scopes to the documents recorded against that unit.
    const unit = new URL(request.url).searchParams.get("unit");
    const repository = publishedFactRepository();
    const documents =
      unit === null || unit === ""
        ? await repository.listDocuments()
        : await repository.listDocumentsForUnit(unit);
    return { data: { documents }, datasetVersion: 0 };
  });
}
