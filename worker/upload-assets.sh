#!/bin/bash
set -euo pipefail
: "${KV_ID:?Set KV_ID}"
wrangler kv key put --namespace-id "$KV_ID" agent-installer "$(cat ../agent/install.sh)"
wrangler kv key put --namespace-id "$KV_ID" agent-bin-amd64 ../agent/bin/vless-agent-linux-amd64 --remote
wrangler kv key put --namespace-id "$KV_ID" agent-bin-arm64 ../agent/bin/vless-agent-linux-arm64 --remote
echo 'Agent assets uploaded.'
