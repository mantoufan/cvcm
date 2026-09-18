const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
] as const;

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"] as const;

const SCALES = ["", "thousand", "million", "billion"] as const;

function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest === 0) return parts.join(" ");
  if (rest < 20) {
    parts.push(ONES[rest]!);
  } else {
    const ten = Math.floor(rest / 10);
    const one = rest % 10;
    parts.push(one ? `${TENS[ten]}-${ONES[one]}` : TENS[ten]!);
  }
  return parts.join(" ");
}

export function numberToWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999_999) return null;
  if (n === 0) return "zero";
  const chunks: string[] = [];
  let scale = 0;
  let x = n;
  while (x > 0) {
    const chunk = x % 1000;
    if (chunk) {
      const body = underThousand(chunk);
      const name = SCALES[scale];
      chunks.push(name ? `${body} ${name}` : body);
    }
    x = Math.floor(x / 1000);
    scale += 1;
  }
  return chunks.reverse().join(" ");
}
