# An AI that runs its own cloud

*A hands-on explainer of the self-managing MCP node.*

---

## The short version

It is one small node: a server your AI connects to, plus the tools for that AI to
run its own cloud and its own code. Capped at about $10 a month, scaled to zero
when idle, locked to a sandbox it cannot leave.

Not a demo you watch. One you hold.

## What is MCP (30 seconds)

MCP is a standard way to hand an AI a set of tools. Your assistant (Claude,
ChatGPT, anything that speaks it) connects to your server and can use those tools.

That is the whole trick. What matters is *which tools* you put behind it. Put the
right ones there and the AI stops being something you ask, and becomes something
you work with.

## The idea

One cloud resource group; call it a node. Inside it: a small MCP server, its own
keys, and tools that let the AI manage its own cloud and its own code.

So the AI can deploy and update itself, read its own logs, and even spin up new
nodes, each with its own cap. The thing it lives in is the same thing it controls.
Ask it to add a feature, and it edits its code, ships it, then uses what it just
built.

## What it is made of

A Function App is the MCP server: it holds the OAuth endpoints and the tool
endpoint the AI calls. A Key Vault holds its keys. A Managed Identity scopes it to
its one resource group so it cannot wander. A cost guard caps and throttles spend
and ships the logs. The AI connects in by OAuth, then reaches back out through the
Azure and GitHub tools to run, rebuild, and extend itself.

## Follow along

1. **Stand up a node.** One script creates the resource group, the server, the
   keys, and the budget cap.
2. **Connect your assistant.** The script prints what to paste. Claude needs an
   id and secret; ChatGPT needs the full endpoint set.
3. **Explore.** Ask what it can do. Ask it to read its logs. Ask it to add a tool
   and ship it. Ask it to spin up a second, separately-capped node.

The first time it edits its own code, deploys, and then uses the thing it just
built, it stops feeling abstract.

## Why it is safe to hand it the keys

- **One node, one resource group.** Its access stops there. It cannot wander.
- **A hard cap.** About $10 a month by default, with alerts and an automatic
  throttle at the ceiling. Want more room? Change one number.
- **Scale-to-zero.** Idle costs next to nothing.
- **Your keys.** You connect to *your* node. Nothing is shared with a third party.

## Why it matters

- **The model is the easy part.** The value is the tools, the limits, the wiring.
- **The limits are the feature.** Caps and boundaries are what make letting an AI
  act trustworthy instead of reckless.
- **AI as an operator, not an oracle.** The question stops being "what will it
  say?" and becomes "what will it do, and how do I shape that?"

## Version

**v1.0** - deploys, self-manages, caps its own spend, and connects Claude or ChatGPT.

---

*From [zallen.dev](https://zallen.dev): building with AI, hands-on.*
