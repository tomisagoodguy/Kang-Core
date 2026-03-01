# Technical Design: Kang-Core Initial Architecture

## Context

The goal is to provide a single fullstack web application that combines LINE Messaging logic, AI-driven data parsing (via Gemini API), and dashboard visualization (Firestore backend). We aim for Vercel deployment which reduces ops complexity, while strictly handling Gemini 2.5 Flash's 20 RPD limits.

## Goals / Non-Goals

**Goals:**

- Provide clear Next.js API Routes for the LINE Bot webhook.
- Provide a `Mock Mode` wrapper around the Gemini calls for local development.
- Securely store parsing results to Firestore via Firebase Admin SDK or Client SDK as appropriate.
- Define a strict TypeScript interface `Accounting` and `Archive` sharing data between client & server.

**Non-Goals:**

- Setting up Google Cloud Scheduler automation immediately.
- Implementing the detailed front-end dashboard UI before the backend data ingestion is solid.

## Decisions

- **Fullstack Next.js**: Consolidate Python logic into Node.js. Although Python excels at data parsing, `@google/generative-ai` SDK is mature on Node.js and allows sharing types/schemas directly with the React frontend.
- **Mock Mode Wrapper**: Create a `lib/gemini/parser.ts` that checks `process.env.MOCK_AI`. If true, returns a deeply mocked JSON object matching the `accounting/archive` intent instead of invoking the API, preserving the 20 limits per day.

## Risks / Trade-offs

- **Risk: LINE Webhook Timeouts**. LINE expects a response to a webhook within a very short time window. Since AI inference (even Flash) can take several seconds, performing this synchronously in the Vercel API Route could lead to timeouts or failed LINE delivery.
  - **Trade-off/Mitigation**: Start with synchronous (blocking) execution to test the flow. If timeouts occur, transition to an asynchronous queue (e.g., triggering a background endpoint or storing the message first and processing it later).
- **Risk: Vercel Function CPU limits**: Free Vercel tier has 10s limits for API routes.
  - **Mitigation**: Offload heavy image classification or fallback to Firebase Cloud Functions if constraints become unmanageable.
