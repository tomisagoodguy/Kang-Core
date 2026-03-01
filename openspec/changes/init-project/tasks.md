## 1. Project Scaffolding & Configuration

- [x] 1.1 Move Next.js files from `kang-core/` temp subfolder to root if necessary, or ensure repository structure defaults are set up.
- [x] 1.2 Setup Firebase Configuration (`firebase-admin` and `firebase` packages) in a `lib/firebase` module.
- [x] 1.3 Configure Zod and Typescript typings for `AccountingEntry` and `ArchiveEntry` under `models/`.

## 2. Mocking & Prompt Setup

- [x] 2.1 Implement `lib/gemini/parser.ts` that includes the prompt structured outputs configuration.
- [x] 2.2 Add `MOCK_AI=true` checking logic inside the parser to avoid exhausting the 20 RPD Gemini API limits during development.

## 3. Webhook Integration

- [x] 3.1 Install `@line/bot-sdk` via yarn.
- [x] 3.2 Create `app/api/webhook/line-bot/route.ts` API route for receiving LINE POST requests.
- [x] 3.3 Connect the Line Bot Webhook to `lib/gemini/parser.ts` to parse user queries directly and store them to Firebase.
