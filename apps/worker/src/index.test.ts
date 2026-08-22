import { describe, expect, it } from "vitest";
import { describeWorker, workerMode } from "./index.js";

describe("refund worker", () => {
  it("defaults to the lease runtime and never enables a marketplace connector", async () => {
    expect(workerMode({})).toBe("lease");
    const info = await describeWorker({
      DATABASE_URL_SECRET_ID: "refund/dev/database-url",
      TEMPORAL_ADDRESS_SECRET_ID: "refund/dev/temporal-address",
      TEMPORAL_ADDRESS: "temporal.example.invalid:7233",
    });
    expect(info.mode).toBe("temporal");
    expect(info.temporalConfigured).toBe(true);
    expect(info.connectors).toEqual([]);
  });
});
