# API Documentation & Frontend Helper Plan

## Documentation Strategy
- Use Markdown in repo (`docs/api/`) versioned alongside code.
- Structure per endpoint: summary, URL, method, query params, response schema, examples, error codes.
- Auto-generate OpenAPI spec via decorators (e.g., `zod-to-openapi`) to keep docs in sync.
- Publish rendered docs with `docusaurus` or `redoc` during deploy; host at `/docs` (protected for internal use initially).
- Include change log section highlighting breaking vs non-breaking updates.

## Maintenance Practices
- Treat docs as part of PR review; require updates when API shape changes.
- Version endpoints via `/v1` prefix; breaking changes go to `/v2` with overlap period.
- Provide “sunset” headers when deprecating fields.
- Add doc generation to CI to prevent stale schemas.

## Frontend SDK / Helper
- Create lightweight TypeScript module `src/api/client.ts` exporting typed fetch helpers.
- Use `fetch` with `AbortController` and caching heuristics (e.g., `stale-while-revalidate`).
- Example method signature:
  ```ts
  export async function getBubbles(params: GetBubblesParams): Promise<BubbleResponse>;
  ```
- Leverage shared TypeScript types generated from OpenAPI using `openapi-typescript` to avoid drift.
- Include error normalization, retries (limited), and logging hooks.

## Developer Experience
- Provide code snippets in docs (JS/TS) showing typical usage.
- Offer MSW mock handlers for local development and Storybook integration.
- Maintain examples directory demonstrating interval switching, favorites filtering.

## Release Process
- Update docs and regenerate types in same PR as backend changes.
- Version SDK via npm package (internal registry) or workspace export.
- Tag releases aligning with backend deployment; include release notes linking to docs diff.

















