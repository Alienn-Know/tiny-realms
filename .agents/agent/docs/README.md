# Local Docs (RAG)

## Purpose
This folder `.agents/docs/` serves as the local knowledge base for third-party libraries (e.g., PIXI.js, Vue, React, Next.js).
To avoid hallucinations, agents MUST place current markdown documentation for libraries here.

## Rules for Agents
When using a new library or feature:
1. Store its markdown documentation here.
2. Read the documentation before proceeding with implementation.
