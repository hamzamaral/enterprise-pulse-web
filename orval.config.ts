import { defineConfig } from 'orval';

/**
 * Generates typed API functions + TanStack Query hooks from the backend OpenAPI document.
 * Run `pnpm api:generate` while the API is running (or point OPENAPI_URL at a deployed API).
 */
export default defineConfig({
  erp: {
    input: {
      target: process.env.OPENAPI_URL ?? 'http://localhost:3000/docs-json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      override: {
        mutator: { path: 'src/api/http.ts', name: 'apiClient' },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
