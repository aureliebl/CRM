/**
 * HTML sanitizer for ticket descriptions.
 * Strips dangerous tags/attributes while preserving rich formatting.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
  "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "a",
  "blockquote", "code", "pre",
  "table", "thead", "tbody", "tr", "th", "td",
  "img",
  "hr",
  "sub", "sup",
  "mark",
]);

const DANGEROUS_TAG_RE = /<\s*\/?\s*(script|iframe|object|embed|form|input|textarea|select|button|applet|link|meta|style|base)\b[^>]*>/gi;
const EVENT_ATTR_RE = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_HREF_RE = /(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi;
const DATA_URI_RE = /(href|src)\s*=\s*["']?\s*data\s*:/gi;

export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let safe = html;

  // Remove dangerous tags entirely (including content for script)
  safe = safe.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  safe = safe.replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "");

  // Remove remaining dangerous tags
  safe = safe.replace(DANGEROUS_TAG_RE, "");

  // Remove on* event attributes
  safe = safe.replace(EVENT_ATTR_RE, "");

  // Remove javascript: URIs
  safe = safe.replace(JAVASCRIPT_HREF_RE, '$1=""');

  // Remove data: URIs (except for images)
  safe = safe.replace(DATA_URI_RE, (match, attr) => {
    if (attr === "src") return match; // allow data: for images
    return `${attr}=""`;
  });

  return safe.trim();
}
