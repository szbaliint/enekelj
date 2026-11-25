#!/bin/sh
# Új verziójel a script/css hivatkozásokra, hogy a böngészők (főleg telefonon) ne a régi, cache-elt fájlt futtassák.
# Bumps the ?v= tag on script/css links so browsers (especially phones) don't run stale cached files.
# Usage: sh tools/bump-version.sh   (run before each deploy)
V=$(date +%Y%m%d%H%M)
sed -i -E "s#(src=\"js/[a-z0-9-]+\.js)(\?v=[0-9]+)?\"#\1?v=$V\"#g; s#(href=\"styles\.css)(\?v=[0-9]+)?\"#\1?v=$V\"#" index.html
echo "version $V"
