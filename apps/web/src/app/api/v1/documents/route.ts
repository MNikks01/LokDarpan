import { publishedFactRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const documents = await publishedFactRepository().listDocuments();
    return { data: { documents }, datasetVersion: 0 };
  });
}
