/// <reference types="vite/client" />

// Desktop Co-pilot env (PG-289). VITE_PG_API_URL overrides the backend base URL
// (defaults to http://localhost:3000 in ./api/client). Augments vite's
// ImportMetaEnv so `import.meta.env.VITE_PG_API_URL` is typed.
interface ImportMetaEnv {
  readonly VITE_PG_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
