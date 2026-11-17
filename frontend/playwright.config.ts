import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Set E2E_DATABASE_URL to a dedicated local database named mxh_e2e.",
  );
}

const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, "");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(parsedDatabaseUrl.hostname) ||
  databaseName !== "mxh_e2e"
) {
  throw new Error(
    "E2E tests only accept a loopback PostgreSQL database named mxh_e2e.",
  );
}

const frontendOrigin = "http://127.0.0.1:3100";
const backendOrigin = "http://127.0.0.1:5100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: frontendOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev --workspace backend",
      url: `${backendOrigin}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: databaseUrl,
        NODE_ENV: "test",
        PORT: "5100",
        CORS_ORIGIN: frontendOrigin,
        JWT_ACCESS_SECRET: "mxh-e2e-access-secret-000000000000000000000000",
        JWT_REFRESH_SECRET: "mxh-e2e-refresh-secret-000000000000000000000000",
        COOKIE_SECRET: "mxh-e2e-cookie-secret-000000000000000000000000",
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "465",
        SMTP_SECURE: "true",
        SMTP_USER: "e2e@example.com",
        SMTP_PASS: "e2e-test-only",
        EMAIL_FROM: '"MXH E2E" <e2e@example.com>',
        CLOUDINARY_CLOUD_NAME: "e2e-test",
        CLOUDINARY_API_KEY: "e2e-test",
        CLOUDINARY_API_SECRET: "e2e-test",
      },
    },
    {
      command:
        "npm run dev --workspace frontend -- --hostname 127.0.0.1 --port 3100",
      url: frontendOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `${backendOrigin}/api/v1`,
        NEXT_PUBLIC_SOCKET_URL: backendOrigin,
      },
    },
  ],
});
