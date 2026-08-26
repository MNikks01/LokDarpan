import { injectable, inject } from "tsyringe";
import type { Logger } from "../../logging/logger.js";
import { LOGGER } from "../../logging/logger.js";
import { AppError } from "@lokdarpan/errors";

/** The shape the API returns. Mirrors @lokdarpan/contracts. */
export interface ProjectSummary {
  readonly id: number;
  readonly name: string;
  readonly datasetVersion: number;
}

/**
 * The port. Business logic depends on this, never on a database driver —
 * dependency inversion, and the reason DI earns its place here rather than in
 * the web client (.docs/adr/013-dependency-injection.md).
 */
export interface ProjectRepository {
  findById(id: number): Promise<ProjectSummary>;
}

export const PROJECT_REPOSITORY = Symbol.for("ProjectRepository");

/**
 * In-memory adapter. The database does not exist yet; this keeps the module
 * testable and the composition honest until a Postgres adapter replaces it
 * without any change to callers.
 */
@injectable()
export class InMemoryProjectRepository implements ProjectRepository {
  private readonly rows: ReadonlyMap<number, ProjectSummary> = new Map([
    [501, { id: 501, name: "Upgradation of ODR-14, Baramati", datasetVersion: 137 }],
  ]);

  constructor(@inject(LOGGER) private readonly logger: Logger) {}

  findById(id: number): Promise<ProjectSummary> {
    const row = this.rows.get(id);
    if (!row) {
      this.logger.info("project.not_found", { projectId: id });
      return Promise.reject(AppError.notFound(`Project ${String(id)}`));
    }
    return Promise.resolve(row);
  }
}
