#!/bin/sh
# gatehouse serve wrapper (rebuilt 2026-10-21): sources estate secrets + runs
# the real gatehouse (mcpproxy) server. Port SSOT: KAPPA/GC ports in
# config/ports.env; mcp_config at ranch/barn/gatehouse/mcp_config.json.
set -e
SECRETS=/home/toxic/.secrets
CFG=/home/toxic/estate/ranch/barn/gatehouse/mcp_config.json
DIST=/home/toxic/estate/ranch/barn/gatehouse/mcp_config.json.dist
if [ -f "$SECRETS" ]; then . "$SECRETS"; fi
: "${MCPPROXY_API_KEY:?MCPPROXY_API_KEY missing from $SECRETS}"
export MCPPROXY_API_KEY
if [ -n "${EXA_API_KEY:-}" ]; then export EXA_API_KEY; fi
if [ ! -f "$CFG" ]; then cp "$DIST" "$CFG"; chmod 600 "$CFG"; fi
exec /home/toxic/estate/ranch/propylon/gatehouse-serve.sh
