// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public backend connection values (publishable, safe to ship in the browser).
// The publish build runs without the untracked .env file, so these keep the
// live site connected. Values in .env/process.env still win when present.
const PUBLIC_BACKEND = {
  VITE_SUPABASE_URL: "https://xgttlggrmphvmlyxvxiu.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_2No1-agU3SPnOAKCCL24Nw_Sa_UN8Ih",
  VITE_SUPABASE_PROJECT_ID: "xgttlggrmphvmlyxvxiu",
};

const publicBackendDefine = Object.fromEntries(
  Object.entries(PUBLIC_BACKEND).map(([key, fallback]) => [
    `import.meta.env.${key}`,
    JSON.stringify(process.env[key] || fallback),
  ]),
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: publicBackendDefine,
  },
});
