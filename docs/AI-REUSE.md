# Reusing Ellis's local AI connections

`src/ai-cli.cjs` is a self-contained Node module. It imports only Node built-ins,
so copying it to another local project does not require either source app or a
new package dependency. Its API is `AIConnection.status()` and
`AIConnection.suggest({provider, prompt, images, schema, signal})`. The caller
validates the returned object and decides what the user may save.

Adapted 2026-10-05 from Ellis's existing source:

- Experience Cloud: `server/harness/providers/claude-cli.mjs` — newest runnable
  Claude installation selection, authentication status, structured completions,
  official subprocess execution and cancellation.
- Vacuum: `packages/mcp-server/src/ai/providers/local-account.ts` — Claude Code
  and Codex providers, capability checks, image staging in a temporary working
  directory, official-tool account status, isolated Codex configuration,
  structured response handling and process-group termination on cancellation.

The source repositories are read-only references. LUT Pal has no import or
runtime path into either repository. The official binaries are installed
separately; they retain authentication ownership. No credential files are read
by this module. Unlike the prototypes' subscription-only environment filtering,
Claude's built-in authentication methods remain available, with detected billing
reported to the user. Codex ignores coding configuration while retaining its
normal authentication location, as its official flag describes.

LUT-specific wiring lives in `src/server.cjs`, `src/metadata.cjs` and `ui/ai.js`:

- Suggestions are explicit requests, never an automatic consequence of import.
- Only the selected thumbnail and metadata are staged. LUT descriptions use
  an actual original/graded pair from the existing rendering path, excluding
  saved preview adjustments. No camera footage is uploaded by this integration.
- Creator guesses and recording-profile guesses are forbidden by the prompt.
  The response schema excludes technical profile fields; those cannot be written
  through the suggestion result.
- The response is validated, shown in editable fields, and applied to the detail
  form only for checked fields. The user still chooses Save details.
- A revision check rejects saves if the item changed during review.
- Editable LUT abbreviations use `details.displayCode`; the original
  `details.code` remains the legacy gallery filename. Original CUBE bytes,
  filenames, LUT IDs, viewer selection and gallery assets stay intact.
- Scene descriptions use `details.description`; no database migration is needed.

Official references checked 2026-10-05:

- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/en/legal-and-compliance
- https://learn.chatgpt.com/docs/app-server
- https://developers.openai.com/siwc/token-sharing-open-source

Running unmodified Claude Code in a product follows Anthropic's stated terms:
user-owned official authentication, direct billing, no reselling/intermediating
usage and no removal of built-in authentication methods. OpenAI's documented
local/open-source authentication support is distinct from commercial/hosted
integration; selling or hosting this project requires revisiting that route.
