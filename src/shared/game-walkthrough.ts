import type { GameId } from "./games";
import type { Locale } from "./locale";
import { messages } from "./messages";

export type WalkthroughStep = {
  id: string;
  title: string;
  body: string;
  image?: string;
};

export type Walkthrough = {
  intro: string;
  steps: WalkthroughStep[];
};

function table(locale: Locale): Record<string, Walkthrough> {
  return messages(locale).walkthroughs;
}

export function gameWalkthrough(locale: Locale, id: GameId): Walkthrough {
  return table(locale)[id] ?? table("en")[id];
}

export function gameGuideSteps(locale: Locale, id: GameId): WalkthroughStep[] {
  return gameWalkthrough(locale, id).steps;
}

export function walkthroughImage(gameId: GameId, slug: string): string {
  return `/covers/games/guides/${gameId}/${slug}.jpg?v=2`;
}
