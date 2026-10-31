# Backend Data Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Enforce the backend table ownership and private repository rules while preserving the current HTTP behavior.

**Architecture:** UsersModule owns persistence for User, Follow, OtpVerification, and Session. PostsModule owns persistence for Post, PostMedia, PostLike, and PostBookmark. Services keep validation, transaction coordination, DTO mapping, and events; repositories contain ORM and SQL statements. Cross-module reads and writes go through a public service facade.

**Tech Stack:** NestJS 12, TypeScript, Prisma ORM 8, node:test.

**Spec:** `docs/02-backend-db.md` sections 7.1 and 7.2.

## Global Constraints

- Preserve public routes, response DTOs, documented error codes, and atomic counter updates.
- Keep network calls and event emission outside database transactions.
- Never export a private repository from its owning module.

## Review Focus

- Concurrent refresh requests must rotate a session at most once.
- OTP activation must roll back when session creation fails.
- Revoked sessions must remain available for audit and access token checks.
- Followers-only post visibility must still use the root author's relationship.
- Public service facades must not expose password hashes or token hashes.

## Task 1: Session access facade

- [x] Add a failing test showing AccessSessionService obtains session status through UsersService and that the public result contains no token hash.
- [x] Add `UsersRepository.findAccessSession(sessionId)` and `UsersService.getAccessSessionState(sessionId)`; return only fields required by AccessSessionService.
- [x] Make AuthModule import UsersModule using `forwardRef`, and route AccessSessionService through UsersService.
- [x] Run `npm run test:auth`, `npm run test:users`, and `npm run build` in `backend/`.

## Task 2: Auth operations on Users-owned tables

- [x] Add failing tests for the UsersModule auth facade covering registration, OTP activation, password reset, refresh rotation, and replay revocation.
- [x] Put the corresponding User, OtpVerification, and Session queries and SQL in UsersRepository, exposed through the public UsersAuthService facade.
- [x] Replace direct AuthService queries with the UsersAuthService facade; retain JWT, mail, error handling, and events in AuthService.
- [x] Run `npm run test:auth`, `npm run test:users`, and `npm run build` in `backend/`.

## Task 3: UsersService repository boundary

- [x] Add or adapt tests for search, profile changes, follow pagination, and public facade DTOs.
- [x] Move all remaining User, Follow, and Session ORM expressions from UsersService into explicit UsersRepository methods.
- [x] Run `npm run test:users`, `npm run test:posts`, and `npm run build` in `backend/`.

## Task 4: PostsService repository boundary

- [x] Add or adapt tests for post creation, visibility, feeds, likes, bookmarks, and counter transactions.
- [x] Move Post, PostMedia, PostLike, and PostBookmark ORM and SQL expressions from PostsService into explicit PostsRepository methods.
- [x] Run `npm test`, `npm run build`, and `npm run lint -- --quiet` in `backend/`.

## Final verification

- [x] Confirm no ORM or SQL statements remain in AuthService, AccessSessionService, UsersService, or PostsService.
- [x] Confirm no private repository is exported from AuthModule, UsersModule, or PostsModule.
- [x] Run repository-wide `npm test`, backend build, and `git diff --check`.
