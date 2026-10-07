# dynep-spot CLI

> Instant real-time AI cloud GPU spot price and arbitrage terminal across 31 cloud providers.

[![npm version](https://img.shields.io/npm/v/dynep-spot.svg)](https://www.npmjs.com/package/dynep-spot)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Zero-Install Instant Run

Run directly in any terminal (macOS, Linux, Windows) with `npx`:

```bash
npx dynep-spot
```

---

## 🚀 Options & Commands

### Filter by GPU Model
```bash
npx dynep-spot --gpu H100
npx dynep-spot --gpu 4090
npx dynep-spot --gpu B200
```

### Model Context Protocol (MCP) Server for Cursor & Claude Desktop
Add to your `claude_desktop_config.json` or `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "dynep-spot": {
      "command": "npx",
      "args": ["-y", "dynep-spot", "--mcp"]
    }
  }
}
```

### Output Raw JSON for Pipelines / Scripts
```bash
npx dynep-spot --json | jq .
```

### Claim Complimentary Developer API Key (100 req/mo)
```bash
npx dynep-spot --claim dev@startup.ai
```

---

## 🌐 Live Portal & Documentation
- **Web Terminal:** [https://data.dynep.com](https://data.dynep.com)
- **API Playground:** [https://data.dynep.com/#playground](https://data.dynep.com/#playground)
