import type { Plugin as EsbuildPlugin } from "esbuild";
import type { Plugin as VitePlugin } from "vite";

export const COVER_ORIGIN: string;
export function rewriteCoverPaths(code: string): string;
export const coverOriginVite: VitePlugin;
export const coverOriginEsbuild: EsbuildPlugin;
