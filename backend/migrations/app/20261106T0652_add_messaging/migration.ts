#!/usr/bin/env -S node
import type { Contract as Start } from "../../snapshots/5e5f298be81ef8cc6954b6f25b4c57b300094ad618a04d87561583e1a0942c64/contract";
import startContract from "../../snapshots/5e5f298be81ef8cc6954b6f25b4c57b300094ad618a04d87561583e1a0942c64/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/a5cd9d506ba3af6ac41e72f943dbff0e43cee16b42478712ed25da289f0ee751/contract";
import endContract from "../../snapshots/a5cd9d506ba3af6ac41e72f943dbff0e43cee16b42478712ed25da289f0ee751/contract.json" with { type: "json" };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from "@prisma/orm-postgres/migration";

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: "public",
        table: "conversation",
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("directKey", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("type", "text", {
            notNull: true,
            default: lit("DIRECT"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "conversation_type_check_0c5ebe0f",
            "\"type\" IN ('DIRECT')",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "conversationParticipant",
        columns: [
          col("conversationId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("joinedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("lastReadAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["conversationId", "userId"])],
      }),
      this.createTable({
        schema: "public",
        table: "message",
        columns: [
          col("body", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("clientMessageId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("conversationId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("deletedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("editedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("id", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("senderId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("type", "text", {
            notNull: true,
            default: lit("TEXT"),
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "message_type_check_c345b9c4",
            "\"type\" IN ('TEXT')",
          ),
        ],
      }),
      this.addUnique({
        schema: "public",
        table: "conversation",
        constraint: "conversation_directKey_key",
        columns: ["directKey"],
      }),
      this.addUnique({
        schema: "public",
        table: "message",
        constraint: "message_senderId_clientMessageId_key",
        columns: ["senderId", "clientMessageId"],
      }),
      this.createIndex({
        schema: "public",
        table: "conversation",
        index: "conversation_updatedAt_idx_8c508b31",
        columns: ["updatedAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "conversationParticipant",
        index: "conversationParticipant_conversationId_idx_669215a6",
        columns: ["conversationId"],
      }),
      this.createIndex({
        schema: "public",
        table: "conversationParticipant",
        index: "conversationParticipant_userId_idx_a489d58a",
        columns: ["userId"],
      }),
      this.createIndex({
        schema: "public",
        table: "conversationParticipant",
        index: "conversationParticipant_userId_lastReadAt_idx_2b7fec09",
        columns: ["userId", "lastReadAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "message",
        index: "message_conversationId_createdAt_idx_44d4ac61",
        columns: ["conversationId", "createdAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "message",
        index: "message_conversationId_idx_669215a6",
        columns: ["conversationId"],
      }),
      this.createIndex({
        schema: "public",
        table: "message",
        index: "message_senderId_createdAt_idx_ed252b01",
        columns: ["senderId", "createdAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "message",
        index: "message_senderId_idx_4689c490",
        columns: ["senderId"],
      }),
      this.addForeignKey({
        schema: "public",
        table: "conversationParticipant",
        foreignKey: {
          name: "conversationParticipant_conversationId_fkey",
          columns: ["conversationId"],
          references: {
            schema: "public",
            table: "conversation",
            columns: ["id"],
          },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "conversationParticipant",
        foreignKey: {
          name: "conversationParticipant_userId_fkey",
          columns: ["userId"],
          references: { schema: "public", table: "user", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "message",
        foreignKey: {
          name: "message_conversationId_fkey",
          columns: ["conversationId"],
          references: {
            schema: "public",
            table: "conversation",
            columns: ["id"],
          },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "message",
        foreignKey: {
          name: "message_senderId_fkey",
          columns: ["senderId"],
          references: { schema: "public", table: "user", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
