#!/usr/bin/env bash
# Génère .cursor/mcp.json depuis .cursor/github.env (token hors git)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.cursor/github.env"
EXAMPLE="$ROOT/.cursor/github.env.example"
MCP_OUT="$ROOT/.cursor/mcp.json"

mkdir -p "$ROOT/.cursor"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Créé $ENV_FILE — ajoute ton token GitHub puis relance ce script."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  echo "Remplis GITHUB_PERSONAL_ACCESS_TOKEN dans $ENV_FILE"
  echo "Token : https://github.com/settings/personal-access-tokens/new"
  exit 1
fi

python3 - "$MCP_OUT" <<'PY'
import json, os, sys
out = sys.argv[1]
token = os.environ["GITHUB_PERSONAL_ACCESS_TOKEN"]
cfg = {
    "mcpServers": {
        "github": {
            "url": "https://api.githubcopilot.com/mcp/",
            "headers": {
                "Authorization": f"Bearer {token}",
            },
        }
    }
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
PY

echo "✓ Écrit $MCP_OUT"
echo "→ Cursor : Settings → Tools & MCP → Reload"
echo "→ Test : « Liste mes repos GitHub costockage »"
