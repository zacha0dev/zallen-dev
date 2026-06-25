# Prereqs - do this first

You only need two things. Node, Functions tools, and openssl get installed for
you during the install, so they are not here.

## 1. An Azure subscription

Sign in or make one (free tier works): https://azure.microsoft.com/free

## 2. One agent CLI (pick any one)

This is the thing you paste the install line into.

- **Claude Code** - `npm install -g @anthropic-ai/claude-code`
  (docs: https://docs.claude.com/en/docs/claude-code)
- **OpenAI Codex CLI** - `npm install -g @openai/codex`
  (docs: https://github.com/openai/codex)
- **GitHub Copilot CLI** - `npm install -g @github/copilot`
  (docs: https://docs.github.com/copilot/concepts/agents/about-copilot-cli)
- **Gemini CLI** - `npm install -g @google/gemini-cli`
  (docs: https://github.com/google-gemini/gemini-cli)

(If you do not have `npm`, install Node 20+ first: https://nodejs.org)

## Optional: Azure CLI

The install will offer to set this up for you. To do it yourself first:

- macOS: `brew install azure-cli`
- Windows: `winget install Microsoft.AzureCLI`
- Linux / docs: https://learn.microsoft.com/cli/azure/install-azure-cli

## That is it

Now go back to the [README](../README.md) and paste the one install line.
