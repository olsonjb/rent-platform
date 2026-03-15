import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      include: [
        "lib/agent/**",
        "lib/maintenance-review.ts",
        "lib/application-screening.ts",
        "lib/stripe.ts",
        "lib/twilio/**",
        "lib/maintenance-requests.ts",
        "lib/auth/**",
        "lib/chat/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    setupFiles: ["__tests__/setup.ts"],
    testTimeout: 10000,
  },
});
