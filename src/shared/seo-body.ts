/**
 * Registers the page bodies the Worker serves when a page has no prerendered body, for channels whose HTML builders
 * must not reach the main client bundle through seo.ts. Imported by the Worker and the tests, never by the client.
 */
import { registerChannelBody } from "./seo";
import { ideasPageHtml } from "./ideas-page";

registerChannelBody((locale, seo) => (seo.ideas ? ideasPageHtml(locale, seo.ideaId ?? null) : null));
