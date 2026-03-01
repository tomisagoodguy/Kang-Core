# Design Document: RAG and Context Memory

## Context

Currently, the LINE bot processes every incoming message independently. This creates a disjointed user experience where context across messages is lost. Furthermore, archived notes, images, and links are only searchable via basic database queries or keywords, failing to provide the semantic "search-and-answer" experience of a true second brain.

## Goals / Non-Goals

**Goals:**

- Provide a short-term Context Memory layer to enhance LINE bot interactions seamlessly.
- Implement a robust Retrieval-Augmented Generation (RAG) system for archived content.
- Update `parseUserInput` to utilize past message context.
- Use Gemini or a separate lightweight model to generate embeddings for relevant database entries.

**Non-Goals:**

- Replacing the entire rule-based Accounting System with AI generation.
- Real-time indexing of massive external databases.
- Multi-user complex access control (assuming this is a personal bot).

## Decisions

**Decision 1: Short-term Context Memory Storage**

- **Option A (Chosen):** Use Firestore `sessions` collection with a strict TTL (Time-To-Live) of 10-15 minutes or limit to the last 5 user messages.
- **Option B (Alternative):** Use Redis.
- **Rationale:** The bot already leverages Firestore heavily. Keeping the state local to the existing stack reduces complexity without sacrificing the required latency for a simple personal bot.

**Decision 2: RAG Vector Database**

- **Option A (Chosen):** Firestore Vector Search (or continuing to rely on Gemini's Context if the archive is small enough for prompt-injection, then transitioning to simple cosine similarity in Node.js or a managed DB). Let's use Firestore's built-in vector search if enabled, otherwise a simple in-memory vector comparison for MVP.
- **Option B (Alternative):** Pinecone or Qdrant.
- **Rationale:** We aim to keep the architecture light. Firestore will store embedding arrays alongside the `archive` documents.

## Risks / Trade-offs

- **Risk: Increased Latency.** Injecting history and reading from DB on every message slows the bot. -> **Mitigation:** Optimize Firestore queries and rely on edge functions where possible. Cache when sensible.
- **Risk: High Token Cost.** Feeding history and RAG context to Gemini eats tokens rapidly. -> **Mitigation:** Keep the context window very strict (last 4-5 messages) and use Flash/Flash-Lite models.

## Migration Plan

- Phase 1: Context Memory. Create the `sessions` saving logic in `MessageService` and inject it into the Gemini prompting phase.
- Phase 2: Post-process existing Archives to generate embeddings.
- Phase 3: Enhance the query parser to trigger RAG search instead of just keyword search.
