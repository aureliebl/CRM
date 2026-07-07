#!/bin/bash
# Double-clic sur Mac (Finder) ou: bash scripts/setup-costockage-mac.command
set -euo pipefail

export COSTOCKAGE_DIR="${COSTOCKAGE_DIR:-$HOME/dev/costockage}"

echo "=============================================="
echo "  Setup dossier costockage/ (workspace Kostok)"
echo "=============================================="
echo ""

git config --global user.name "Aurélie"
git config --global user.email "aurelie@costockage.fr"
echo "✓ Git: Aurélie <aurelie@costockage.fr>"
echo ""

# Bitbucket SSH check
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 -T git@bitbucket.org 2>&1 | grep -qi "authenticated"; then
  echo "⚠ Bitbucket SSH non configuré."
  echo "  1. Génère une clé: ssh-keygen -t ed25519 -C aurelie@costockage.fr"
  echo "  2. Ajoute la clé publique sur https://bitbucket.org/account/settings/ssh-keys/"
  echo "  3. Relance ce script."
  echo ""
  read -r -p "Continuer quand même ? (o/N) " ans
  [[ "${ans,,}" == "o" ]] || exit 1
fi

mkdir -p "$(dirname "$COSTOCKAGE_DIR")"
if [[ ! -d "$COSTOCKAGE_DIR/.git" ]]; then
  echo "→ Clone costockage-workspace dans $COSTOCKAGE_DIR"
  git clone git@bitbucket.org:Devcostockage/costockage-workspace.git "$COSTOCKAGE_DIR"
else
  echo "→ costockage-workspace déjà présent, pull..."
  git -C "$COSTOCKAGE_DIR" pull --ff-only || true
fi

cd "$COSTOCKAGE_DIR"

[[ -d kostok/.git ]] || git clone https://github.com/costockage/kostok-site.git kostok
[[ -d pilotage-kostok/.git ]] || git clone https://github.com/costockage/pilotage-kostok.git pilotage-kostok

[[ -f .cursor/mcp.json ]] || cp .cursor/mcp.json.example .cursor/mcp.json
[[ -f .cursor/github.env ]] || cp .cursor/github.env.example .cursor/github.env
[[ -f .cursor/supabase.env ]] || cp .cursor/supabase.env.example .cursor/supabase.env

echo ""
echo "→ npm install kostok..."
( cd kostok && npm install )
[[ -f kostok/.env ]] || cp kostok/.env.example kostok/.env

if [[ -d pilotage-kostok/dashboard ]]; then
  echo "→ npm install pilotage dashboard..."
  ( cd pilotage-kostok/dashboard && npm install )
fi

echo ""
echo "=============================================="
echo "  Terminé — structure costockage/"
echo "=============================================="
ls -la "$COSTOCKAGE_DIR"
echo ""
echo "Ouvre dans Cursor: $COSTOCKAGE_DIR"
echo "Kostok:    cd kostok && npm run dev  → http://localhost:8080"
echo "Pilotage:  cd pilotage-kostok/dashboard && npm run dev → http://localhost:5173"
echo ""
read -r -p "Appuie sur Entrée pour fermer..."
