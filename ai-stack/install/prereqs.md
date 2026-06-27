# Prereqs

Three things. (Node, openssl, jq, and the PostgreSQL client install themselves
later if missing; the container image is built server-side by `az acr build`, so
no Docker is needed.)

## 1. A running mcp-node

ai-stack is the brains the node uses, so stand up
[mcp-node](https://github.com/zacha0dev/zallen-dev/tree/main/mcp-node) first.
You will need its resource group, function-app name, and Key Vault name to wire
the two together at the end.

## 2. An Azure account

Free tier works: https://azure.microsoft.com/free
(Container Apps scale to zero, but Postgres Flexible has an hourly floor — the
default budget cap is ~$25/month.)

## 3. An agent CLI - pick one

This is what you paste the install line into.

Claude Code:

```
npm install -g @anthropic-ai/claude-code
```

OpenAI Codex:

```
npm install -g @openai/codex
```

GitHub Copilot:

```
npm install -g @github/copilot
```

Gemini:

```
npm install -g @google/gemini-cli
```

Then go paste the install line from the [README](../README.md).
