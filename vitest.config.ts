import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    isolate: true,
    pool: "forks",
    reporters: ["default"],
  },
});
