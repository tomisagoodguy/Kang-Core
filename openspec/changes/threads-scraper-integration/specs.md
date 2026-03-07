# Specification: Threads Scraper API and Data Flow

This specification aims to define the expected behaviors of the Python crawler reporting its findings to the Next.js API.

## NEW Requirements

### Requirement: Accept Thread Payload

The system MUST provide a `POST` endpoint at `/api/webhooks/threads` to receive the data payloads from the Python `threads-scraper`.

#### Scenario: Valid Thread POST

- **Given** continuous execution of the scraper finding a new matching post content
- **When** the scraper triggers its webhook against `/api/webhooks/threads`
- **Then** the webhook payload MUST be successfully parsed through the `ThreadsEntrySchema`
- **And** the parsed entry MUST be saved into the Firestore `entries` collection

#### Scenario: Send to Line Bot

- **Given** a successfully stored `ThreadsEntry`
- **When** the data is inserted into the Next.js `POST /api/webhooks/threads` route
- **Then** the `LineService` MUST be invoked with the entry data
- **And** the payload MUST be styled as a friendly text message to inform the admin
