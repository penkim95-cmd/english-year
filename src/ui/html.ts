/**
 * Escape-by-default HTML templating. Every interpolated value is escaped unless
 * it is itself the result of `html` (or `raw` for trusted static markup), so
 * AI replies, user input and restored backups can never inject markup.
 */
const SAFE = Symbol("safe-html");

export interface SafeHtml {
  readonly [SAFE]: true;
  readonly value: string;
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}

function isSafe(value: unknown): value is SafeHtml {
  return typeof value === "object" && value !== null && SAFE in value;
}

function render(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (isSafe(value)) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0]!;
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1]!;
  });
  return { [SAFE]: true, value: out };
}

/** Marks a static, developer-written string as markup. Never pass user or AI text. */
export function raw(markup: string): SafeHtml {
  return { [SAFE]: true, value: markup };
}

export function mount(el: Element, content: SafeHtml): void {
  el.innerHTML = content.value;
}
