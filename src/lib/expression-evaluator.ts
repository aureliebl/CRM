/**
 * Secure expression evaluator for computed columns.
 * Supports: +, -, *, /, %, parentheses, column references (by name),
 * number literals, string literals ("..."), and functions:
 *   CONCAT(...), ROUND(expr, decimals), IF(condition, then, else),
 *   ABS(expr), MIN(a,b), MAX(a,b), LEN(expr), UPPER(expr), LOWER(expr),
 *   COALESCE(a,b,...).
 * Condition operators: ==, !=, >, <, >=, <=
 *
 * NO eval() is used — the parser is hand-written for safety.
 */

type Value = string | number | boolean | null;
type Row = Record<string, Value | undefined>;

// ── Tokeniser ──────────────────────────────────────────────────────────

type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENT"
  | "OP"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "CMP"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal
    if (/\d/.test(ch) || (ch === "." && i + 1 < len && /\d/.test(expr[i + 1]))) {
      let num = "";
      while (i < len && (/\d/.test(expr[i]) || expr[i] === ".")) {
        num += expr[i++];
      }
      tokens.push({ type: "NUMBER", value: num });
      continue;
    }

    // String literal "..."
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = "";
      i++; // skip opening quote
      while (i < len && expr[i] !== quote) {
        if (expr[i] === "\\" && i + 1 < len) {
          i++;
          str += expr[i];
        } else {
          str += expr[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: "STRING", value: str });
      continue;
    }

    // Two-char comparison operators
    if (i + 1 < len) {
      const two = ch + expr[i + 1];
      if (two === "==" || two === "!=" || two === ">=" || two === "<=") {
        tokens.push({ type: "CMP", value: two });
        i += 2;
        continue;
      }
    }

    // Single-char comparison
    if (ch === ">" || ch === "<") {
      tokens.push({ type: "CMP", value: ch });
      i++;
      continue;
    }

    // Operators
    if ("+-*/%".includes(ch)) {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }

    // Parentheses
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    // Comma
    if (ch === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }

    // Identifiers (column names, function names)
    // Support dotted names like `j1_fieldName` or backtick-quoted names
    if (ch === "`") {
      let ident = "";
      i++; // skip opening backtick
      while (i < len && expr[i] !== "`") {
        ident += expr[i++];
      }
      i++; // skip closing backtick
      tokens.push({ type: "IDENT", value: ident });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < len && /[a-zA-Z0-9_.]/.test(expr[i])) {
        ident += expr[i++];
      }
      tokens.push({ type: "IDENT", value: ident });
      continue;
    }

    // Unknown character — skip
    i++;
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

// ── Parser ─────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos = 0;
  private row: Row;

  constructor(tokens: Token[], row: Row) {
    this.tokens = tokens;
    this.row = row;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: "EOF", value: "" };
  }

  private consume(expected?: TokenType): Token {
    const tok = this.peek();
    if (expected && tok.type !== expected) {
      throw new Error(`Expected ${expected} but got ${tok.type} (${tok.value})`);
    }
    this.pos++;
    return tok;
  }

  // Entry: comparison (lowest precedence)
  parse(): Value {
    const result = this.parseComparison();
    return result;
  }

  // comparison: additive ( (== != > < >= <=) additive )?
  private parseComparison(): Value {
    let left = this.parseAdditive();

    while (this.peek().type === "CMP") {
      const op = this.consume().value;
      const right = this.parseAdditive();
      left = this.evalComparison(op, left, right);
    }

    return left;
  }

  private evalComparison(op: string, a: Value, b: Value): boolean {
    const na = Number(a);
    const nb = Number(b);
    const useNum = !Number.isNaN(na) && !Number.isNaN(nb) && a !== null && b !== null && a !== "" && b !== "";

    switch (op) {
      case "==":
        return useNum ? na === nb : String(a) === String(b);
      case "!=":
        return useNum ? na !== nb : String(a) !== String(b);
      case ">":
        return useNum ? na > nb : String(a) > String(b);
      case "<":
        return useNum ? na < nb : String(a) < String(b);
      case ">=":
        return useNum ? na >= nb : String(a) >= String(b);
      case "<=":
        return useNum ? na <= nb : String(a) <= String(b);
      default:
        return false;
    }
  }

  // additive: multiplicative ( (+ | -) multiplicative )*
  private parseAdditive(): Value {
    let left = this.parseMultiplicative();

    while (this.peek().type === "OP" && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();

      if (op === "+") {
        // If either is string, concatenate
        if (typeof left === "string" || typeof right === "string") {
          left = String(left ?? "") + String(right ?? "");
        } else {
          left = toNum(left) + toNum(right);
        }
      } else {
        left = toNum(left) - toNum(right);
      }
    }

    return left;
  }

  // multiplicative: unary ( (* | / | %) unary )*
  private parseMultiplicative(): Value {
    let left = this.parseUnary();

    while (this.peek().type === "OP" && "*/%".includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseUnary();

      if (op === "*") left = toNum(left) * toNum(right);
      else if (op === "/") {
        const d = toNum(right);
        left = d === 0 ? null : toNum(left) / d;
      } else {
        const d = toNum(right);
        left = d === 0 ? null : toNum(left) % d;
      }
    }

    return left;
  }

  // unary: (- unary) | primary
  private parseUnary(): Value {
    if (this.peek().type === "OP" && this.peek().value === "-") {
      this.consume();
      const v = this.parseUnary();
      return -toNum(v);
    }
    return this.parsePrimary();
  }

  // primary: NUMBER | STRING | IDENT | function call | (expr)
  private parsePrimary(): Value {
    const tok = this.peek();

    if (tok.type === "NUMBER") {
      this.consume();
      return parseFloat(tok.value);
    }

    if (tok.type === "STRING") {
      this.consume();
      return tok.value;
    }

    if (tok.type === "LPAREN") {
      this.consume();
      const val = this.parse();
      this.consume("RPAREN");
      return val;
    }

    if (tok.type === "IDENT") {
      this.consume();
      const name = tok.value;

      // Function call?
      if (this.peek().type === "LPAREN") {
        return this.parseFunction(name);
      }

      // Column reference
      if (name in this.row) {
        const v = this.row[name];
        if (v === undefined || v === null) return null;
        return v;
      }

      // Try case-insensitive lookup
      const lower = name.toLowerCase();
      for (const k of Object.keys(this.row)) {
        if (k.toLowerCase() === lower) {
          const v = this.row[k];
          if (v === undefined || v === null) return null;
          return v;
        }
      }

      return null; // Unknown column
    }

    // Fallback
    this.consume();
    return null;
  }

  private parseFunction(name: string): Value {
    this.consume("LPAREN"); // consume (
    const args: Value[] = [];

    if (this.peek().type !== "RPAREN") {
      args.push(this.parse());
      while (this.peek().type === "COMMA") {
        this.consume(); // consume ,
        args.push(this.parse());
      }
    }
    this.consume("RPAREN"); // consume )

    const fn = name.toUpperCase();

    switch (fn) {
      case "CONCAT":
        return args.map((a) => String(a ?? "")).join("");

      case "ROUND": {
        const val = toNum(args[0]);
        const dec = args.length > 1 ? toNum(args[1]) : 0;
        const factor = Math.pow(10, dec);
        return Math.round(val * factor) / factor;
      }

      case "ABS":
        return Math.abs(toNum(args[0]));

      case "MIN":
        return Math.min(...args.map(toNum));

      case "MAX":
        return Math.max(...args.map(toNum));

      case "LEN":
        return String(args[0] ?? "").length;

      case "UPPER":
        return String(args[0] ?? "").toUpperCase();

      case "LOWER":
        return String(args[0] ?? "").toLowerCase();

      case "COALESCE": {
        for (const a of args) {
          if (a !== null && a !== undefined && a !== "") return a;
        }
        return null;
      }

      case "IF": {
        const condition = args[0];
        const thenVal = args.length > 1 ? args[1] : null;
        const elseVal = args.length > 2 ? args[2] : null;
        return isTruthy(condition) ? thenVal : elseVal;
      }

      default:
        return null; // Unknown function
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function toNum(v: Value): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function isTruthy(v: Value): boolean {
  if (v === null || v === undefined || v === "" || v === 0 || v === false) return false;
  return true;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Evaluate a single expression against a row of data.
 * Returns the computed value (string | number | boolean | null).
 */
export function evaluateExpression(expression: string, row: Row): Value {
  try {
    const tokens = tokenize(expression);
    const parser = new Parser(tokens, row);
    return parser.parse();
  } catch {
    return null;
  }
}
