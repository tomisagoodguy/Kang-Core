## ADDED Requirements

### Requirement: Short-term Session Memory

The system SHALL maintain a short-term conversational history for each user.

#### Scenario: Follow-up question

- **WHEN** a user asks a question that relies on context from their previous message within the last 15 minutes.
- **THEN** the system correctly understands the context and replies appropriately.

#### Scenario: Session expiry

- **WHEN** a user sends a message after 15 minutes of inactivity.
- **THEN** the system treats it as a new session without previous context.

## MODIFIED Requirements

### Requirement: Message Parsing Logic

The system SHALL use Gemini/Gemma models to parse incoming user text, now incorporating the session's conversational history to improve classification and response generation.

#### Scenario: Modifying an entry

- **WHEN** a user sends "買了便當 100", and immediately follows up with "改為 120".
- **THEN** the system understands they are modifying the previous accounting entry to 120.
