## 1. Context Memory Engine

- [x] 1.1 Create `SessionService` in `src/services` to manage conversational history (read/write to Firestore `sessions` collection with a 15-minute TTL limit or last 5 messages).
- [x] 1.2 Update `message.service.ts` to log user input and AI replies into the current user's active session.
- [x] 1.3 Update `parser.ts` to accept `history` parameter and gracefully weave the recent dialogue history into the Gemini/Gemma system prompt for contextual understanding.

## 2. Vector Embeddings (RAG Prep)

- [x] 2.1 Integrate Gemini text-embedding models (e.g. `text-embedding-004`) in a new `lib/gemini/embedding.ts` utility.
- [x] 2.2 Update `message.service.ts` to generate an embedding array whenever saving a new `archive` entry to Firestore.
- [x] 2.3 Create a backfill script to generate vector embeddings for all existing archive nodes in the database.

## 3. RAG Search Implementation

- [x] 3.1 Create `RAGService.ts` to handle querying Firestore for vector similarity (using manual cosine similarity if Vector Search isn't enabled natively, or the native one).
- [x] 3.2 Update `parser.ts` query schema to understand advanced semantic intent (e.g. "Find topics related to X").
- [x] 3.3 Update `message.service.ts` and `queryEngine.ts` to route complex semantic questions to `RAGService` rather than simplistic tag matches, and synthesize the result via Gemini AI.
