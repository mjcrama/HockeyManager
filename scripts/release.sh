#!/bin/bash
set -e

CURRENT=$(node -p "require('./package.json').version")

echo ""
echo "Huidige versie: v$CURRENT"
echo ""
echo "Versie ophogen?"
echo "  p) patch  — bugfix         (bv. 1.0.1)"
echo "  m) minor  — nieuwe feature (bv. 1.1.0)"
echo "  M) major  — grote wijziging (bv. 2.0.0)"
echo "  n) niet ophogen"
echo ""
read -p "Keuze [p/m/M/n]: " choice

case $choice in
  p)
    npm version patch
    NEW=$(node -p "require('./package.json').version")
    echo "✓ Versie opgehoogd naar v$NEW"
    ;;
  m)
    npm version minor
    NEW=$(node -p "require('./package.json').version")
    echo "✓ Versie opgehoogd naar v$NEW"
    ;;
  M)
    npm version major
    NEW=$(node -p "require('./package.json').version")
    echo "✓ Versie opgehoogd naar v$NEW"
    ;;
  n|"")
    echo "Versie niet opgehoogd (v$CURRENT)"
    ;;
  *)
    echo "Ongeldige keuze — versie niet opgehoogd"
    ;;
esac

echo ""
echo "Bouwen en deployen..."
npm run deploy

echo ""
echo "Pushen naar GitHub..."
git push origin main --tags

echo ""
echo "✓ Klaar! v$(node -p "require('./package.json').version") is live."
