# Agent installer setup

The Worker endpoint `/agent/install.sh` reads KV key `agent-installer`.

For the MVP, upload the contents of `agent/install.sh` to that key, after replacing the static placeholder flow as needed. A production build should bundle the installer into Worker source instead of KV; that avoids one KV read per install.

Recommended next change: import the installer as a generated TypeScript string during build, so installation requires **zero KV reads**.
