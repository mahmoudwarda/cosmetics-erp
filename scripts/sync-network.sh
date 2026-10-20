#!/usr/bin/env bash

# Cosmetics ERP - Dynamic Host Network Sync
# Detects host IP (Wi-Fi / iPhone Personal Hotspot / LAN) and syncs it with Docker & the App.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="$ROOT_DIR/data/network"
TARGET_FILE="$TARGET_DIR/host_ip.txt"

mkdir -p "$TARGET_DIR"

detect_ip() {
  local ip=""

  # 1. macOS specific fast lookups
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 en2 pdp_ip0; do
      ip=$(ipconfig getifaddr "$iface" 2>/dev/null)
      if [ -n "$ip" ] && [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && [[ ! "$ip" =~ ^127\. ]] && [[ ! "$ip" =~ ^169\.254\. ]]; then
        echo "$ip"
        return
      fi
    done
  fi

  # 2. General ifconfig lookup (macOS / Linux)
  if command -v ifconfig >/dev/null 2>&1; then
    ip=$(ifconfig 2>/dev/null | awk '/inet / && !/127\.0\.0\.1/ && !/169\.254\./ && !/172\.1[7-9]\./ {print $2}' | head -n 1)
    if [ -n "$ip" ]; then
      echo "$ip"
      return
    fi
  fi

  # 3. Linux ip route lookup
  if command -v ip >/dev/null 2>&1; then
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')
    if [ -n "$ip" ]; then
      echo "$ip"
      return
    fi
  fi

  echo "127.0.0.1"
}

update_ip() {
  local current_ip
  current_ip=$(detect_ip)
  local prev_ip=""
  if [ -f "$TARGET_FILE" ]; then
    prev_ip=$(cat "$TARGET_FILE" 2>/dev/null | tr -d '[:space:]')
  fi

  if [ "$current_ip" != "$prev_ip" ]; then
    echo "$current_ip" > "$TARGET_FILE.tmp"
    mv "$TARGET_FILE.tmp" "$TARGET_FILE"
    echo "[Network Sync] Updated Active IP -> http://$current_ip:3000 (Saved to data/network/host_ip.txt)"
  fi
}

# Run once
update_ip

# If --watch or -w passed, keep updating continuously in background
if [ "$1" = "--watch" ] || [ "$1" = "-w" ]; then
  echo "[Network Sync] Watching for network changes (Wi-Fi / Hotspot)... Press Ctrl+C to stop."
  while true; do
    sleep 4
    update_ip
  done
fi
