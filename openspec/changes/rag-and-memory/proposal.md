# Context Memory and RAG Architecture Proposal

## Objective

Implement a short-term Context Memory for the LINE Bot to maintain conversational continuity, and introduce a Retrieval-Augmented Generation (RAG) architecture for semantic search on archived notes and links.

## Motivation

Currently, the LINE bot processes each message in isolation. A Context Memory system will allow users to have natural, multi-turn conversations (e.g., asking follow-up questions or modifying previous entries). Additionally, the system currently lacks true semantic search capabilities. A RAG architecture will transform the bot into a "second brain," enabling users to retrieve past knowledge via semantic queries against their archived data.

## Scope

- Implement a session-based Context Memory to prepend the last N messages or last X minutes of dialogue to Gemini prompts.
- Implement vector embedding generation for archived content (notes, links, images).
- Create a vector search query engine to retrieve relevant past documents.
- Synthesize retrieved context within a Gemini RAG prompt for intelligent answering.

## Capabilities

### New Capabilities

- `context-memory`: Maintains a short-term history of user interactions per session for conversational continuity.
- `rag-search`: Uses vector embeddings to semantically search the archive database and synthesize answers.

### Modified Capabilities

- `gemini-parser`: Will need updates to leverage context memory for parsing accuracy.

## Impact

- **Database**: New collections or fields for storing vector embeddings and conversational logs.
- **AI Integration**: More complex prompting incorporating retrieved texts and chat history.
- **Cost**: Potential increase in token usage due to longer prompts and embedding API calls.
