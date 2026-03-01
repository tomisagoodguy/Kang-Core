## ADDED Requirements

### Requirement: Vector Embeddings Generation

The system SHALL generate mathematical vector embeddings for all archived texts, notes, and links.

#### Scenario: Storing an archive

- **WHEN** a user saves a new note or link.
- **THEN** an embedding is created in the background and stored alongside the keyword and summary in the database.

### Requirement: Semantic RAG Searching

The system SHALL support semantic searching of the archive database.

#### Scenario: Answering a query

- **WHEN** the user asks "找出有關前端的教學".
- **THEN** the system retrieves notes matching the semantics, synthesizing them into a coherent answer.
