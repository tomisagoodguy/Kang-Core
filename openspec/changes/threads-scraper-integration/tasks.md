## Phase 1: Create Next.js Webhook Route

- [x] Create `src/app/api/webhooks/threads/route.ts` API Endpoint.
  - Create a POST handler.
  - Assume the incoming payload from Python's scraper looks like Webhook formatted JSON.
  - Parse the JSON using `ThreadsEntrySchema` from `schema.ts`.
  - Call the `ArchiveEntryService` or corresponding save logic using the parsed `ThreadsEntry` to save to Firestore.
- [x] Connect `LineService` inside the route.
  - Inject the push logic to notify the user of the new thread update, sending link and body.
  - Requires `LINE_USER_ID` to be set in `.env.local`.

## Phase 2: Python Tool Configuration

- [x] Update webhook URLs inside `services/threads-scraper/config/config.yaml`.
  - Set Webhook URL to point to `http://localhost:3000/api/webhooks/threads`.
  - Enabled `notifications.enabled: true`.
  - JSON structure confirmed compatible with `ThreadsEntrySchema` via `_send_generic_post()` in `notifier.py`.

## Phase 3: Dashboard UI (Optional but recommended)

- [x] Display `ThreadsEntryView` inside the dashboard UI.
  - Add a sub-tab or custom glass-card displaying "Recent Threads" to monitor what the scraper has retrieved.
