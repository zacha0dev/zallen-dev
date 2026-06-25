# Concepts

The mental model. Start here.

## The Model Context Protocol (MCP)

MCP is a standard way for an artificial intelligence (AI) client - Claude,
ChatGPT, and others - to call external tools. The AI does not run your code. It
sends a structured request ("call this tool with these arguments") to an MCP
server, the server runs the tool and returns the result, and the AI uses that
result in its answer.

An MCP server is just a program that exposes a set of tools over this protocol.
mcp-node is one of those servers, with a twist: it also manages the cloud it runs
in.

## What a "node" is

A node is one self-contained MCP server plus the cloud it manages, deployed as a
single unit:

- it runs as an Azure Function App,
- it lives in its own resource group (RG),
- it has tools to operate that RG and its own code repository.

**Single-tenant** means one owner, one connection, full access. There is no
multi-user permission system because the node belongs to you alone. That is a
deliberate simplification - it is what keeps the node light.

## The open-box idea

The node ships with a small set of tools, but it is built to grow. You ask the
connected AI to add a tool; it edits the node's own source and redeploys. So the
day-one toolset is a starting point, not a fixed product. The box opens as you
use it. ([Extending](09-extending.md) covers how.)

## Why it stays safe

Three things keep "explore freely" from turning into "broke something" or "$500
bill":

- the node's identity is scoped to its own RG only, so it cannot touch the rest
  of your subscription,
- the RG has a hard monthly budget cap (about $10 by default),
- the Function App scales to zero when idle, so nothing runs - or costs - unless
  used.

## How it scales

One node is the base. When you want another - a new project, a fresh sandbox -
you either run the install again or let the node stamp a sibling. Every node is
the same shape, so the system grows by repeating one known-good unit rather than
building something new each time. ([Scaling](08-scaling.md) has the detail.)
