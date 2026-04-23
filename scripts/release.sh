#!/bin/bash
set -e

FIREBASE_DB="https://hockey-manager-2652a-default-rtdb.europe-west1.firebasedatabase.app"
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
    NEW=$CURRENT
    echo "Versie niet opgehoogd (v$CURRENT)"
    ;;
  *)
    NEW=$CURRENT
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
echo "Bevat deze versie breaking changes in Firebase data?"
echo "  (Ja = gebruikers met oudere versie worden geblokkeerd totdat ze verversen)"
read -p "Breaking changes? [j/N]: " breaking

echo ""
echo "Versie registreren in Firebase..."

if [[ "$breaking" == "j" || "$breaking" == "J" ]]; then
  FIREBASE_PAYLOAD="{\"latestVersion\": \"${NEW}\", \"minVersion\": \"${NEW}\"}"
  curl -s -X PATCH \
    "${FIREBASE_DB}/config.json" \
    -H "Content-Type: application/json" \
    -d "$FIREBASE_PAYLOAD" > /dev/null \
    && echo "✓ Firebase config bijgewerkt (latestVersion + minVersion: v${NEW})" \
    || echo "⚠ Firebase update mislukt — stel versies handmatig in"
else
  curl -s -X PATCH \
    "${FIREBASE_DB}/config.json" \
    -H "Content-Type: application/json" \
    -d "{\"latestVersion\": \"${NEW}\"}" > /dev/null \
    && echo "✓ Firebase config bijgewerkt (latestVersion: v${NEW})" \
    || echo "⚠ Firebase update mislukt — stel latestVersion handmatig in"
fi

echo ""
echo "✓ Klaar! v${NEW} is live."
