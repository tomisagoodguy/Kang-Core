# Proposal: Kang-Core Project Initialization

## Motivation

To create a streamlined personal intelligent assistant and knowledge/financial management system using a unified Next.js (App Router) fullstack architecture. The current fragmented tools make tracking expenses and archiving knowledge cumbersome. By integrating a LINE Bot webhook, Google AI Studio (Gemini 1.5/2.5 Flash), and Firebase within a single Next.js application, the system will accurately parse natural language, automatically organize links/documents, and visualize data via a dashboard.

## Proposed Changes

- Initialize a Next.js (App Router) project with TypeScript and Tailwind CSS.
- Set up a Firebase ecosystem (Firestore, Storage, Auth) for flexible NoSQL data storage and secure file hosting.
- Integrate Google AI Studio (Gemini API) using Structured Outputs to parse unstructured LINE messages into `accounting` or `archives` schemas.
- Implement robust rate limiting (20 RPD) or a Dev Mode mocking system to avoid hitting free-tier API limits for Gemini 2.5 Flash.

## Capabilities

### New Capabilities

- `accounting`: Parse and store income/expense entries from natural language context.
- `archives`: Store URLs, notes, and images with automatic metadata fetching and AI-generated tags feature.
- `dashboard`: Read and display basic data visualizations directly from Firestore via Next.js server components.
- `webhook`: Serve as the endpoint receiving data from the LINE Messaging API.

### Modified Capabilities

- N/A (Fresh start)

## Impact

This foundation sets up the unified `Kang-Core` environment. The unified `.env.local` controls external dependencies (Firebase & Gemini limits), and it paves the way for deeper integration logic (Next.js server actions vs API routes) and component architectures.
