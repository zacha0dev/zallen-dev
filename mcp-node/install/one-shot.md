# Install walkthrough

The install is one line you paste into an agentic CLI. The agent then reads
`agent.md` (the canonical steps) and drives the whole deploy.

Works in any agent CLI that runs shell commands: Claude Code (`claude`), OpenAI
Codex (`codex`), GitHub Copilot (`copilot`), Gemini (`gemini`).

## The one line

```
Install mcp-node: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/mcp-node/install/agent.md
```

## What the agent handles for you (the prereq / setup pass)

You do not set anything up by hand first. Step 0 of `agent.md` is a prereq pass
that:

- checks for Azure CLI (`az`), Node 20+, Azure Functions Core Tools (`func`),
  `openssl`, and `git`, and installs anything missing with your platform's
  package manager (`brew` / `apt` / `dnf` / `winget`);
- runs `az login` for you if you are not already signed in, and confirms the
  subscription;
- clones this repo if you are not already inside it.

Then it collects your inputs (node name, region, cost cap, alert email), deploys
`infra/node.bicep`, seeds the OAuth secrets, publishes the server, and prints
your connect config.

The canonical step-by-step lives in [`agent.md`](./agent.md) - that is the file
the one line points at, so it is the single source of truth. This page is just
the human-readable overview.

## Access note (the Key Vault reader-role wall)

On an RBAC Key Vault, being subscription Owner does NOT grant data-plane secret
access. The deploy closes this for you: it passes your object id
(`az ad signed-in-user show --query id -o tsv`) so the bicep grants both you and
the node **Key Vault Secrets Officer** (read + rotate). That is why the node can
update its own OAuths and why the first secret-seed does not hit Forbidden.

## Prefer a plain script (no agent)?

`scripts/deploy.sh` (bash) and `scripts/deploy.ps1` (PowerShell) are the same
setup script run directly: they do the identical prereq checks, drive `az login`,
deploy, and print the connect config. Pick whichever fits.
