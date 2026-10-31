import { Injectable, OnModuleDestroy } from "@nestjs/common";

export interface IdempotencyRecord {
  status: "IN_FLIGHT" | "COMPLETED";
  statusCode?: number;
  body?: unknown;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private readonly storage = new Map<string, IdempotencyRecord>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Dọn dẹp các key hết hạn định kỳ mỗi 60 giây
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60_000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }

  get(key: string): IdempotencyRecord | undefined {
    const record = this.storage.get(key);
    if (!record) {
      return undefined;
    }

    if (Date.now() > record.expiresAt) {
      this.storage.delete(key);
      return undefined;
    }

    return record;
  }

  setInFlight(key: string, ttlMs = 300_000): void {
    const now = Date.now();
    this.storage.set(key, {
      status: "IN_FLIGHT",
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  setCompleted(
    key: string,
    statusCode: number,
    body: unknown,
    ttlMs = 300_000,
  ): void {
    const now = Date.now();
    this.storage.set(key, {
      status: "COMPLETED",
      statusCode,
      body,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  delete(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, record] of this.storage.entries()) {
      if (now > record.expiresAt) {
        this.storage.delete(key);
        count++;
      }
    }
    return count;
  }
}
