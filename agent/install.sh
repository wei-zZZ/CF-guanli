#!/bin/bash
set -euo pipefail

: "${WORKER:?WORKER missing}"
: "${INSTALL_TOKEN:?INSTALL_TOKEN missing}"

BASE=/usr/local/vless-agent
mkdir -p "$BASE"

command -v curl >/dev/null || { apt-get update && apt-get install -y curl; }
command -v openssl >/dev/null || { apt-get update && apt-get install -y openssl; }
command -v python3 >/dev/null || { apt-get update && apt-get install -y python3; }

ARCH=$(uname -m)
case "$ARCH" in
  x86_64) XARCH=64 ;;
  aarch64|arm64) XARCH=arm64-v8a ;;
  armv7l) XARCH=arm32-v7a ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Install latest Xray release using the official installer repository.
curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh | bash

UUID=$(cat /proc/sys/kernel/random/uuid)
KEYS=$(xray x25519)
PRIVATE_KEY=$(echo "$KEYS" | awk -F': ' '/PrivateKey/ {print $2}')
PUBLIC_KEY=$(echo "$KEYS" | awk -F': ' '/^(Password|Public key):/ {print $2; exit}')
SHORT_ID=$(openssl rand -hex 8)
PORT=${XRAY_PORT:-443}
SNI=${XRAY_SNI:-www.microsoft.com}
HOST=$(curl -4 -fsSL --max-time 8 https://api.ipify.org || curl -6 -fsSL --max-time 8 https://api6.ipify.org || true)

mkdir -p /usr/local/etc/xray
cat > /usr/local/etc/xray/config.json <<JSON
{
  "log": {"loglevel": "warning"},
  "inbounds": [{
    "listen": "0.0.0.0",
    "port": $PORT,
    "protocol": "vless",
    "settings": {
      "clients": [{"id": "$UUID", "flow": "xtls-rprx-vision"}],
      "decryption": "none"
    },
    "streamSettings": {
      "network": "tcp",
      "security": "reality",
      "realitySettings": {
        "show": false,
        "dest": "$SNI:443",
        "xver": 0,
        "serverNames": ["$SNI"],
        "privateKey": "$PRIVATE_KEY",
        "shortIds": ["$SHORT_ID"]
      }
    }
  }],
  "outbounds": [{"protocol": "freedom", "tag": "direct"}]
}
JSON

xray run -test -config /usr/local/etc/xray/config.json
systemctl enable xray
systemctl restart xray

# Build a tiny registration helper in Python to avoid requiring Go on the target VPS.
REG_JSON=$(printf '%s' "{\"installToken\":\"$INSTALL_TOKEN\",\"publicKey\":\"$PUBLIC_KEY\",\"shortId\":\"$SHORT_ID\",\"uuid\":\"$UUID\",\"host\":\"$HOST\",\"port\":$PORT}")
REG=$(curl -fsSL -X POST "$WORKER/api/agent/register" -H 'Content-Type: application/json' --data "$REG_JSON")
SERVER_ID=$(printf '%s' "$REG" | python3 -c 'import json,sys; print(json.load(sys.stdin)["serverId"])')
AGENT_TOKEN=$(printf '%s' "$REG" | python3 -c 'import json,sys; print(json.load(sys.stdin)["agentToken"])')
VLESS=$(printf '%s' "$REG" | python3 -c 'import json,sys; print(json.load(sys.stdin)["vless"])')
cat > "$BASE/config.json" <<JSON
{"worker":"$WORKER","serverId":"$SERVER_ID","agentToken":"$AGENT_TOKEN"}
JSON
echo
echo "VLESS 分享链接:"
echo "$VLESS"

case "$(uname -m)" in
  x86_64) BIN_ARCH=amd64 ;;
  aarch64|arm64) BIN_ARCH=arm64 ;;
  *) echo "Unsupported agent architecture"; exit 1 ;;
esac
curl -fsSL "$WORKER/agent/bin/$BIN_ARCH?token=$INSTALL_TOKEN" -o "$BASE/agent"
chmod 0755 "$BASE/agent"

cat > /etc/systemd/system/vless-agent.service <<SERVICE
[Unit]
Description=VLESS Worker Manager Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$BASE/agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now vless-agent

echo "Agent installed."
