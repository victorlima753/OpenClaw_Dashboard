import { describe, expect, it } from "vitest";
import { KANBAN_COLUMNS } from "../domain";
import { seedAgents, seedJobs, seedLogs, seedReviews, seedSources } from "./seed-data";

describe("seed data", () => {
  it("covers the required operational minimums", () => {
    expect(seedAgents).toHaveLength(16);
    expect(seedJobs.length).toBeGreaterThanOrEqual(20);
    expect(seedLogs.length).toBeGreaterThanOrEqual(100);
    expect(seedReviews.length).toBeGreaterThanOrEqual(5);
    expect(seedJobs.filter((job) => job.status === "failed").length).toBeGreaterThanOrEqual(3);
    expect(seedJobs.filter((job) => job.status === "published").length).toBeGreaterThanOrEqual(5);
    expect(seedSources.length).toBeGreaterThanOrEqual(seedJobs.length);
  });

  it("has visible data for every Kanban column", () => {
    for (const column of KANBAN_COLUMNS) {
      expect(seedJobs.some((job) => job.status === column.status), column.status).toBe(true);
    }
  });
});
