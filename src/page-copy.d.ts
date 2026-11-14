// Modules built by the `page-copy` plugin in vite.config.ts from src/locales/<locale>.json and guides/<locale>.json.
// The core `ui` and `guides` are typed as the full files: the page copy they leave out is merged in before a page
// that reads it renders (src/client/i18n.ts).
declare module "virtual:page-copy/ui/*" {
  const ui: import("./shared/messages").UiMessages;
  export default ui;
}

declare module "virtual:page-copy/guides/*" {
  const guides: import("./shared/messages").GuideMessages;
  export default guides;
}

declare module "virtual:page-copy/tools/*" {
  const copy: import("./shared/page-copy").ToolCopy;
  export default copy;
}

declare module "virtual:page-copy/tutorials/*" {
  const copy: import("./shared/page-copy").TutorialCopy;
  export default copy;
}
