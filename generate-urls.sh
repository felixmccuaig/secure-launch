#!/bin/bash
set -e

read -p "Lyrebird Public Key (base64 JWK): " LYREBIRD_PUBLIC_KEY
read -p "Lyrebird URL (e.g. https://app.lyrebirdhealth.com): " LYREBIRD_URL

export LYREBIRD_PUBLIC_KEY LYREBIRD_URL

DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=== Node.js ==="
node "$DIR/nodejs/index.mjs" 2>&1 | grep "^Launch URL:" | sed 's/^Launch URL: //'

echo ""
echo "=== C# ==="
dotnet run --project "$DIR/csharp" 2>&1 | grep "^Launch URL:" | sed 's/^Launch URL: //'

echo ""
echo "NOTE: URLs expire after 5 minutes. Re-run this script to generate fresh ones."
