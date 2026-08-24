import { injectable, inject } from "tsyringe";
import type { ProjectRepository, ProjectSummary } from "./project.repository.js";
import { PROJECT_REPOSITORY } from "./project.repository.js";
import { AppError } from "../../errors/index.js";

/** Business logic. Depends on the port, not on any concrete data source. */
@injectable()
export class ProjectService {
  constructor(@inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async getProject(rawId: string): Promise<ProjectSummary> {
    // Validate at the boundary; never trust a caller-supplied identifier.
    if (!/^\d{1,12}$/.test(rawId)) {
      throw AppError.badRequest("Project id must be a positive integer.");
    }
    return this.projects.findById(Number.parseInt(rawId, 10));
  }
}
