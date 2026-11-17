import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  expect,
  request as playwrightRequest,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:5100/api/v1/";
const databaseUrl = process.env.E2E_DATABASE_URL!;
const password = process.env.E2E_USER_PASSWORD ?? "Demo1234!";
const accounts = [
  {
    email: process.env.E2E_USER_A_EMAIL ?? "minhthu@example.test",
    password: process.env.E2E_USER_A_PASSWORD ?? password,
  },
  {
    email: process.env.E2E_USER_B_EMAIL ?? "quanghuy@example.test",
    password: process.env.E2E_USER_B_PASSWORD ?? password,
  },
] as const;

interface AuthResult {
  accessToken: string;
  user: { id: string; username: string; displayName: string };
}

async function login(page: Page, email: string, userPassword: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(userPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

async function removeDirectConversation(directKey: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM "message"
       WHERE "conversationId" IN (
         SELECT "id" FROM "conversation" WHERE "directKey" = $1
       )`,
      [directKey],
    );
    await client.query(
      `DELETE FROM "conversationParticipant"
       WHERE "conversationId" IN (
         SELECT "id" FROM "conversation" WHERE "directKey" = $1
       )`,
      [directKey],
    );
    await client.query(`DELETE FROM "conversation" WHERE "directKey" = $1`, [
      directKey,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

test("two accounts can start, exchange, read, and page through a conversation", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const api = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
  let mobileContext: BrowserContext | undefined;
  let desktopContext: BrowserContext | undefined;
  let directKey: string | undefined;

  try {
    const loginResponseA = await api.post("auth/login", {
      data: accounts[0],
    });
    const loginResponseB = await api.post("auth/login", {
      data: accounts[1],
    });
    expect(loginResponseA.status()).toBe(200);
    expect(loginResponseB.status()).toBe(200);
    const authA = (await loginResponseA.json()) as AuthResult;
    const authB = (await loginResponseB.json()) as AuthResult;
    directKey = [authA.user.id, authB.user.id].sort().join(":");
    await removeDirectConversation(directKey);

    const directResponse = await api.post("conversations/direct", {
      headers: { Authorization: `Bearer ${authA.accessToken}` },
      data: { targetUserId: authB.user.id },
    });
    expect(directResponse.status()).toBe(201);
    const { id: conversationId } = (await directResponse.json()) as {
      id: string;
    };

    const historyBodies = Array.from(
      { length: 29 },
      (_, index) =>
        `E2E history ${randomUUID()} ${String(index).padStart(2, "0")}`,
    );
    for (const [index, body] of historyBodies.entries()) {
      const response = await api.post(
        `conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${authA.accessToken}` },
          data: { body, clientMessageId: randomUUID() },
        },
      );
      expect(response.status(), `History message ${index}`).toBe(201);
    }
    for (let index = 0; index < 2; index += 1) {
      const response = await api.post(
        `conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${authB.accessToken}` },
          data: {
            body: `E2E reply history ${randomUUID()} ${index}`,
            clientMessageId: randomUUID(),
          },
        },
      );
      expect(response.status(), `Reply history message ${index}`).toBe(201);
    }
    for (const accessToken of [authA.accessToken, authB.accessToken]) {
      const response = await api.post(`conversations/${conversationId}/read`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(201);
    }

    mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const mobilePage = await mobileContext.newPage();
    const desktopPage = await desktopContext.newPage();

    await login(mobilePage, accounts[0].email, accounts[0].password);
    await mobilePage.goto(`/${authB.user.username}`);
    await mobilePage
      .getByRole("button", { name: "Nhắn tin", exact: true })
      .click();
    await expect(mobilePage).toHaveURL(/\/messages\?conversation=/);
    await expect(
      mobilePage.getByRole("heading", { name: authB.user.displayName }),
    ).toBeVisible();
    expect(new URL(mobilePage.url()).searchParams.get("conversation")).toBe(
      conversationId,
    );

    const oldestHistoryBody = historyBodies[0]!;
    const mobileMessageList = mobilePage.getByTestId(
      "conversation-message-list",
    );
    await expect(
      mobileMessageList.getByText(historyBodies.at(-1)!, { exact: true }),
    ).toBeVisible();
    await login(desktopPage, accounts[1].email, accounts[1].password);
    const firstHistoryPage = desktopPage.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname ===
          `/api/v1/conversations/${conversationId}/messages` &&
        !new URL(response.url()).searchParams.has("cursor"),
    );
    const olderHistoryPage = desktopPage.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname ===
          `/api/v1/conversations/${conversationId}/messages` &&
        new URL(response.url()).searchParams.has("cursor"),
    );
    await desktopPage.goto(`/messages?conversation=${conversationId}`);
    await expect(
      desktopPage.getByRole("heading", { name: authA.user.displayName }),
    ).toBeVisible();
    await expect(
      desktopPage
        .getByTestId("conversation-message-list")
        .getByText(historyBodies.at(-1)!, { exact: true }),
    ).toBeVisible();
    const desktopMessageList = desktopPage.getByTestId(
      "conversation-message-list",
    );
    const firstHistory = await (await firstHistoryPage).json();
    expect(firstHistory.data).toHaveLength(30);
    expect(firstHistory.hasMore).toBe(true);
    await desktopMessageList.evaluate((element) => {
      element.scrollTop = 0;
    });
    const olderHistory = await (await olderHistoryPage).json();
    expect(olderHistory.data).toHaveLength(1);
    expect(olderHistory.hasMore).toBe(false);
    expect(
      new Set(
        [...firstHistory.data, ...olderHistory.data].map(
          (message: { id: string }) => message.id,
        ),
      ).size,
    ).toBe(31);
    await expect(
      desktopMessageList.getByText(oldestHistoryBody, { exact: true }),
    ).toBeVisible();
    await desktopPage.goto("/messages");
    await expect(desktopPage.getByTestId("conversation-list")).toBeVisible();

    const realtimeBody = `E2E realtime ${randomUUID()}`;
    await mobilePage.getByLabel("Nội dung tin nhắn").fill(realtimeBody);
    await mobilePage.getByRole("button", { name: "Gửi tin nhắn" }).click();

    const conversationRow = desktopPage
      .getByRole("button")
      .filter({ hasText: realtimeBody });
    await expect(conversationRow).toBeVisible();
    await expect(
      conversationRow.locator("span.absolute").getByText("1", { exact: true }),
    ).toBeVisible();
    const desktopReadResponse = desktopPage.waitForResponse(
      (response) =>
        response.url().includes(`/conversations/${conversationId}/read`) &&
        response.request().method() === "POST",
    );
    await conversationRow.click();
    await expect(
      desktopPage
        .getByTestId("conversation-message-list")
        .getByText(realtimeBody, { exact: true }),
    ).toBeVisible();
    expect((await desktopReadResponse).status()).toBe(201);
    await expect(
      conversationRow.locator("span.absolute").getByText("1", { exact: true }),
    ).toHaveCount(0);

    const replyBody = `E2E reply ${randomUUID()}`;
    await desktopPage.getByLabel("Nội dung tin nhắn").fill(replyBody);
    await desktopPage.getByRole("button", { name: "Gửi tin nhắn" }).click();
    await expect(
      mobileMessageList.getByText(replyBody, { exact: true }),
    ).toBeVisible();

    await desktopMessageList.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(
      desktopMessageList.getByText(oldestHistoryBody, { exact: true }),
    ).toBeVisible();

    await mobilePage.reload();
    await expect(
      mobilePage.getByRole("heading", { name: authB.user.displayName }),
    ).toBeVisible();
    const reloadedMessageList = mobilePage.getByTestId(
      "conversation-message-list",
    );
    await expect(
      reloadedMessageList.getByText(replyBody, { exact: true }),
    ).toBeVisible();

    await mobilePage
      .getByRole("button", { name: "Quay lại danh sách" })
      .click();
    await expect(mobilePage).toHaveURL(/\/messages$/);
    await expect(mobilePage.getByTestId("conversation-list")).toBeVisible();
  } finally {
    await mobileContext?.close();
    await desktopContext?.close();
    if (directKey) await removeDirectConversation(directKey);
    await api.dispose();
  }
});
