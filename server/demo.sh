#!/bin/bash
# JAGA link-agent demo: detonate the staged fixture in the Daytona sandbox,
# print the verdict, then open the evidence screenshot.
#   ./demo.sh                      (uses the staged fixture + demo phone)
#   ./demo.sh <url> [phone]
cd "$(dirname "$0")"
URL="${1:-https://dbs-secure.vercel.app}"
echo "JAGA · LINK AGENT"
echo "Investigating: $URL"
.venv/bin/python link_agent.py "$URL" "${2:-+6591234567}"
open "$(ls -t evidence/*.png | head -1)"
