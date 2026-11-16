export const INDEXNOW_HOST: string;
export const INDEXNOW_KEY: string;
export const INDEXNOW_BATCH: number;
export function sitemapUrls(xml: string): string[];
export function pageSignature(html: string): string;
export function pageSignatures(dist: string): Promise<Record<string, string>>;
export function changedUrls(previous: Record<string, string> | null, next: Record<string, string>): string[];
export function indexNowBody(urls: string[]): { host: string; key: string; keyLocation: string; urlList: string[] };
