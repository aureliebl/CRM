import { evaluateExpression } from "@/lib/expression-evaluator";

type Primitive = string | number | boolean | null;

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function flattenRecord(
  source: Record<string, unknown>,
  prefix = "",
  output: Record<string, Primitive> = {}
): Record<string, Primitive> {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isPrimitive(value)) {
      output[path] = value;
      if (!prefix) {
        output[key] = value;
      }
      continue;
    }

    if (Array.isArray(value)) {
      output[path] = JSON.stringify(value);
      if (!prefix) {
        output[key] = JSON.stringify(value);
      }
      continue;
    }

    if (typeof value === "object" && value !== null) {
      flattenRecord(value as Record<string, unknown>, path, output);
      continue;
    }

    output[path] = null;
    if (!prefix) {
      output[key] = null;
    }
  }

  return output;
}

export function evaluateRightPanelFormula(expression: string, scope: Record<string, unknown>): Primitive {
  const flattened = flattenRecord(scope);
  const result = evaluateExpression(expression, flattened);

  if (result === undefined) return null;
  if (typeof result === "string" || typeof result === "number" || typeof result === "boolean" || result === null) {
    return result;
  }
  return null;
}
