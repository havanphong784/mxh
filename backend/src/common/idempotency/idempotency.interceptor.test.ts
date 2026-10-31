import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ExecutionContext, HttpStatus } from "@nestjs/common";
import { of, throwError, firstValueFrom } from "rxjs";
import { IdempotencyService } from "./idempotency.service.js";
import { IdempotencyInterceptor } from "./idempotency.interceptor.js";
import {
  DomainException,
  ERROR_CODES,
} from "../exceptions/domain.exception.js";

function createMockContext(options: {
  method: string;
  headers?: Record<string, string>;
  user?: { sub?: string; id?: string };
  ip?: string;
}) {
  const headers = options.headers || {};
  let setHeaderCalledWith: [string, string] | null = null;
  let statusCalledWith: number | null = null;

  const request = {
    method: options.method,
    headers,
    user: options.user,
    ip: options.ip || "127.0.0.1",
  };

  const reply = {
    statusCode: options.method === "POST" ? 201 : 200,
    header: (name: string, value: string) => {
      setHeaderCalledWith = [name, value];
    },
    status: (code: number) => {
      statusCalledWith = code;
    },
  };

  const context: Partial<ExecutionContext> = {
    getType: () => "http" as never,
    switchToHttp: () =>
      ({
        getRequest: () => request,
        getResponse: () => reply,
      }) as any,
  };

  return {
    context: context as ExecutionContext,
    request,
    reply,
    getSetHeader: () => setHeaderCalledWith,
    getStatus: () => statusCalledWith,
  };
}

test("IdempotencyInterceptor passes through when no Idempotency-Key header is present", async () => {
  const service = new IdempotencyService();
  const interceptor = new IdempotencyInterceptor(service);

  const { context } = createMockContext({ method: "POST" });
  let handlerCalled = false;
  const next = {
    handle: () => {
      handlerCalled = true;
      return of({ success: true });
    },
  };

  const result = await firstValueFrom(interceptor.intercept(context, next as any));
  assert.equal(handlerCalled, true);
  assert.deepEqual(result, { success: true });
});

test("IdempotencyInterceptor passes through on GET requests even if header is present", async () => {
  const service = new IdempotencyService();
  const interceptor = new IdempotencyInterceptor(service);

  const { context } = createMockContext({
    method: "GET",
    headers: { "idempotency-key": "get-key-1" },
  });
  let handlerCalled = false;
  const next = {
    handle: () => {
      handlerCalled = true;
      return of({ data: "feed" });
    },
  };

  const result = await firstValueFrom(interceptor.intercept(context, next as any));
  assert.equal(handlerCalled, true);
  assert.deepEqual(result, { data: "feed" });
  assert.equal(service.get("anonymous:get-key-1"), undefined);
});

test("IdempotencyInterceptor caches response and replays on duplicate request", async () => {
  const service = new IdempotencyService();
  const interceptor = new IdempotencyInterceptor(service);
  const idempotencyKey = "uuid-key-123";

  // Request 1: Execute and cache
  const req1 = createMockContext({
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    user: { sub: "user-1" },
  });

  let executions = 0;
  const next1 = {
    handle: () => {
      executions++;
      return of({ id: "post-1", content: "Hello world" });
    },
  };

  const result1 = await firstValueFrom(
    interceptor.intercept(req1.context, next1 as any),
  );
  assert.equal(executions, 1);
  assert.deepEqual(result1, { id: "post-1", content: "Hello world" });

  // Request 2: Duplicate key from same user
  const req2 = createMockContext({
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    user: { sub: "user-1" },
  });

  const next2 = {
    handle: () => {
      executions++;
      return of({ id: "post-2", content: "Duplicate" });
    },
  };

  const result2 = await firstValueFrom(
    interceptor.intercept(req2.context, next2 as any),
  );
  assert.equal(executions, 1, "Handler should NOT have executed a second time");
  assert.deepEqual(result2, { id: "post-1", content: "Hello world" });
  assert.deepEqual(req2.getSetHeader(), ["x-idempotent-replay", "true"]);
});

test("IdempotencyInterceptor rejects concurrent in-flight request with 409 Conflict", async () => {
  const service = new IdempotencyService();
  const interceptor = new IdempotencyInterceptor(service);
  const idempotencyKey = "in-flight-key";

  // Set the key as in-flight
  service.setInFlight(`user-1:${idempotencyKey}`);

  const { context } = createMockContext({
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    user: { sub: "user-1" },
  });

  const next = {
    handle: () => of({ success: true }),
  };

  assert.throws(
    () => {
      interceptor.intercept(context, next as any);
    },
    (err: any) => {
      assert(err instanceof DomainException);
      assert.equal(err.code, ERROR_CODES.IDEMPOTENT_OPERATION_IN_PROGRESS);
      assert.equal(err.getStatus(), HttpStatus.CONFLICT);
      return true;
    },
  );
});

test("IdempotencyInterceptor cleans up key when handler throws error, allowing retry", async () => {
  const service = new IdempotencyService();
  const interceptor = new IdempotencyInterceptor(service);
  const idempotencyKey = "retry-key";

  const req1 = createMockContext({
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    user: { sub: "user-1" },
  });

  const nextFail = {
    handle: () => throwError(() => new Error("Database timeout")),
  };

  try {
    await firstValueFrom(interceptor.intercept(req1.context, nextFail as any));
    assert.fail("Should have thrown error");
  } catch (err: any) {
    assert.equal(err.message, "Database timeout");
  }

  // Key must be deleted so that subsequent retry can proceed
  assert.equal(service.get(`user-1:${idempotencyKey}`), undefined);
});

test("IdempotencyInterceptor scopes keys by user ID", async () => {
  const service = new IdempotencyService();
  const interceptor = new IdempotencyInterceptor(service);
  const sharedKey = "shared-uuid";

  // User 1
  const reqUser1 = createMockContext({
    method: "POST",
    headers: { "idempotency-key": sharedKey },
    user: { sub: "user-alpha" },
  });
  let countAlpha = 0;
  await firstValueFrom(
    interceptor.intercept(reqUser1.context, {
      handle: () => {
        countAlpha++;
        return of({ user: "alpha" });
      },
    } as any),
  );

  // User 2 with same idempotency key
  const reqUser2 = createMockContext({
    method: "POST",
    headers: { "idempotency-key": sharedKey },
    user: { sub: "user-beta" },
  });
  let countBeta = 0;
  const resultBeta = await firstValueFrom(
    interceptor.intercept(reqUser2.context, {
      handle: () => {
        countBeta++;
        return of({ user: "beta" });
      },
    } as any),
  );

  assert.equal(countAlpha, 1);
  assert.equal(countBeta, 1);
  assert.deepEqual(resultBeta, { user: "beta" });
});

test("IdempotencyInterceptor rejects keys exceeding 128 characters", async () => {
  const service = new IdempotencyService();
  const interceptor = new IdempotencyInterceptor(service);

  const overlyLongKey = "a".repeat(129);
  const { context } = createMockContext({
    method: "POST",
    headers: { "idempotency-key": overlyLongKey },
  });

  assert.throws(
    () => {
      interceptor.intercept(context, { handle: () => of(true) } as any);
    },
    (err: any) => {
      assert(err instanceof DomainException);
      assert.equal(err.code, ERROR_CODES.VALIDATION_FAILED);
      assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
      return true;
    },
  );
});
