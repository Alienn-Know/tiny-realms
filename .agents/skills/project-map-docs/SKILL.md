---
name: project-map-docs
description: Generate and maintain a module map and self-updating documentation under `docks/` for code in `src/`. Use when creating, editing, deleting, or reviewing source modules, project structure, module dependencies, submodules, or architecture docs. Generated docs should default to Russian.
---

# Project Map Docs

Use this skill when work touches `src/` and the project map in `docks/` must stay current.

## Goal

Keep `docks/` as a readable map of the source tree:

- mirror the `src/` folder structure under `docks/src/`;
- ensure every generated folder has a `README.md`;
- create a separate `.md` card for each source file using the same filename plus `.md`;
- generate the self-documentation in Russian by default;
- keep descriptions short, concrete, and low-noise;
- include links to submodules and source files;
- show dependencies with simple Mermaid arrows for:
  - what the module depends on;
  - what uses the module.

## Required Structure

For every generated module README:

1. Add a short summary with no filler.
2. Link to child submodules and direct source files with one-line descriptions.
3. Include a Mermaid dependency graph with outgoing and incoming links.
4. Use expressive visual markers for scanability, for example:
   - `🌟` overview or short summary
   - `👤` or `👥` submodule links
   - `📄` source files
   - `🍎` dependency section
   - `🍑` reverse usage section

For every generated source file card:

1. Name the doc file exactly like the source file, with `.md` appended, for example `main.js.md`.
2. Describe only:
   - what the file is needed for;
   - the principle of how it works at a simple level.
3. Add a methods section with short but detailed descriptions of named methods.
4. Add a simple Mermaid map of method dependencies when methods are present.
5. Add a key constants section with:
   - constant name;
   - current value;
   - what the constant is used for.
6. Do not retell the full code line by line.
7. Add a small Mermaid graph only when it helps clarify file relations.
8. When showing `Зависит от` or `Используется в`, prefer placing a simple Mermaid graph directly inside that subsection for clarity.

## Update Rules

- Treat `docks/` as the generated module map for `src/`.
- When `src/` changes, regenerate impacted docs or rerun the generator.
- On deletions, remove stale generated module docs so the map stays honest.
- Prefer concise, structural truth over speculative descriptions.

## Output Style

- Use Russian for generated README files unless the user explicitly asks for another language.
- Prefer lively symbols like stars, people, fruit, and similar expressive markers instead of plain colored circles.
- Keep wording plain and short.
- Prefer bullet lists to dense prose.
- Use relative markdown links.
- Keep Mermaid graphs simple and readable.
