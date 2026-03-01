## ADDED Requirements

### Requirement: AI Webhook Parsing

The system SHALL receive LINE messages and parse them into a predetermined JSON structure via the Gemini API.

#### Scenario: User sends an accounting message

- **WHEN** user sends "晚餐吃麵 150"
- **THEN** the system classifies it as `accounting` and extracts the expense amount, description, and tags

#### Scenario: Gemini Daily Quota Exhausted

- **WHEN** the user exceeds 20 requests per day bounds during parsing
- **THEN** the system catches the 429 error and places the message into a local mock queue or responds gracefully via LINE.

### Requirement: Cross-platform Database Types

The system SHALL define strictly typed interfaces used for both Firebase Admin (backend) and Firestore Client (frontend).

#### Scenario: Next.js writes to Firestore

- **WHEN** the parsed JSON is ready
- **THEN** it validates against the `Accounting` interface before saving to `accounting` collection.
