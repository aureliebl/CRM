#!/usr/bin/env bash
# Bootstrap Cursor workspace: costockage/ + kostok + pilotage-kostok
# Run on your machine (needs Bitbucket SSH + GitHub access).
set -euo pipefail

COSTOCKAGE_DIR="${COSTOCKAGE_DIR:-$HOME/dev/costockage}"

echo "==> Git identity (Aurélie)"
git config --global user.name "Aurélie"
git config --global user.email "aurelie@costockage.fr"

echo "==> Workspace parent: $COSTOCKAGE_DIR"
mkdir -p "$(dirname "$COSTOCKAGE_DIR")"
if [[ ! -d "$COSTOCKAGE_DIR/.git" ]]; then
  git clone git@bitbucket.org:Devcostockage/costockage-workspace.git "$COSTOCKAGE_DIR"
else
  echo "    costockage-workspace already cloned, pulling..."
  git -C "$COSTOCKAGE_DIR" pull --ff-only || true
fi

cd "$COSTOCKAGE_DIR"

if [[ ! -d kostok/.git ]]; then
  git clone https://github.com/costockage/kostok-site.git kostok
else
  echo "    kostok/ already cloned"
fi

if [[ ! -d pilotage-kostok/.git ]]; then
  git clone https://github.com/costockage/pilotage-kostok.git pilotage-kostok
else
  echo "    pilotage-kostok/ already cloned"
fi

echo "==> MCP config (from workspace examples)"
if [[ -f .cursor/mcp.json.example ]]; then
  cp -n .cursor/mcp.json.example .cursor/mcp.json 2>/dev/null || cp .cursor/mcp.json.example .cursor/mcp.json
fi
if [[ -f .cursor/github.env.example ]]; then
  cp -n .cursor/github.env.example .cursor/github.env 2>/dev/null || cp .cursor/github.env.example .cursor/github.env
fi
if [[ -f .cursor/supabase.env.example ]]; then
  cp -n .cursor/supabase.env.example .cursor/supabase.env 2>/dev/null || cp .cursor/supabase.env.example .cursor/supabase.env
fi

echo "==> Kostok.fr"
if [[ -d kostok ]]; then
  (cd kostok && npm install)
  if [[ -f kostok/.env.example && ! -f kostok/.env ]]; then
    cp kostok/.env.example kostok/.env
    echo "    Created kostok/.env — fill Supabase keys from dashboard (developer@)"
  fi
fi

echo "==> Pilotage CRM"
if [[ -d pilotage-kostok/dashboard ]]; then
  (cd pilotage-kostok/dashboard && npm install)
fi

echo ""
echo "Done. Next steps:"
echo "  1. Open folder in Cursor: $COSTOCKAGE_DIR"
echo "  2. Fill .cursor/github.env + .cursor/supabase.env (never commit)"
echo "  3. Cursor Settings → Tools & MCP → Connect notion, atlassian, vercel"
echo "  4. Kostok:  cd kostok && npm run dev   → http://localhost:8080"
echo "  5. Pilotage: cd pilotage-kostok/dashboard && npm run dev → http://localhost:5173"
