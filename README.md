# zallen-dev

[zallen.dev](https://zallen.dev/) · [github.com/zacha0dev](https://github.com/zacha0dev)

Building AI systems on Azure: a self-managing MCP control plane and a stack of
agents that plug into it. Two projects, one repeatable pattern.

## The two projects

- **[mcp-node](mcp-node/)** Project 1, the control plane. A single-tenant,
  self-managing MCP server in one Azure resource group, capped at about
  $10/month and scaled to zero when idle. This is what an AI actually connects
  to: it speaks MCP, deploys infra in its own resource group, manages its own
  code, and can stamp more capped nodes. Day one is the floor, not the ceiling.
- **[ai-stack](ai-stack/)** Project 2, the brains. A RAG data plane (Postgres +
  pgvector + blob) and a set of agents on Azure Container Apps, in one capped
  resource group, stacked on a running mcp-node. It adds grounded retrieval and
  the agents the node hands work to.

mcp-node is the thing you talk to; ai-stack is the brains it uses. The node
never holds your data and ai-stack never speaks MCP; they meet at a bearer-authed
HTTP seam and a tool manifest the node auto-discovers.

## How it works (the system model)

```
  you / any MCP client (Claude Code, Codex, Copilot, Gemini, claude.ai, ChatGPT)
     -> mcp-node (control plane: MCP protocol, auth, the tool registry)
        -> ai-stack (the brains)
           -> reasoner (the orchestrator)
              -> agents (researcher, drafter, trainer) or linked workflows
                 -> output (checked, cited, bounded)
```

When ai-stack is wired to the node, the node discovers its agents from a manifest
and they appear as node tools automatically, with no node redeploy. The reasoner
orchestrates: it grounds in the RAG store, dispatches to an agent or a workflow,
and gates every result (deterministic checks first, a cheap model grade only if
those pass) before it returns. Everything is bounded and cheap by construction.

## Install

Both install with one paste into an agent CLI (Claude Code, Codex, Copilot,
Gemini). Stand up the node first, then the stack.

```
Install mcp-node: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/mcp-node/install/agent.md
```

```
Install ai-stack: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/ai-stack/install/agent.md
```

No agent CLI? Each project has a `scripts/deploy.sh` (and a PowerShell
`deploy.ps1`) you can run directly. See each project's README for the variables.

## Docs

- **mcp-node**: [README](mcp-node/README.md) ·
  [install](mcp-node/install/agent.md) · [how it works](mcp-node/docs/)
- **ai-stack**: [README](ai-stack/README.md) ·
  [install](ai-stack/install/agent.md) ·
  [architecture](ai-stack/docs/architecture.md) (the reasoner to agents to
  output loop, async-persist, the RAG plane, the manifest-registration seam, the
  cost and safety model) ·
  [extending](ai-stack/docs/extending.md) (the repeatable add-your-own-agent
  guide, build-tested without a live deploy)

The node also hands its connected AI a live operating guide on connect
([mcp-node/src/instructions.md](mcp-node/src/instructions.md)) covering the base
tools, the agents, and how to extend.

---

- Zachary Allen, [github.com/zacha0dev](https://github.com/zacha0dev)
