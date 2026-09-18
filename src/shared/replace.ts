export function replaceText(text: string, find: string, repl: string, all: boolean): string {
  if (!find) return text;
  if (!all) {
    const i = text.indexOf(find);
    if (i < 0) return text;
    return text.slice(0, i) + repl + text.slice(i + find.length);
  }
  return text.split(find).join(repl);
}
