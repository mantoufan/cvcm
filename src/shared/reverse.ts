export function reverseText(text: string): string {
  return Array.from(text).reverse().join("");
}

export function isPalindrome(text: string): boolean {
  const key = Array.from(text)
    .filter((ch) => /\p{L}|\p{N}/u.test(ch))
    .join("")
    .toLowerCase();
  if (!key) return false;
  return key === Array.from(key).reverse().join("");
}
