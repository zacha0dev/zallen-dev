← [All docs](README.md)

# Concepts: what the Model Context Protocol is

Start here. This page explains the protocol and the model behind the node before
you touch any of its parts.

## The problem it solves

An artificial intelligence (AI) model can reason and write, but on its own it
cannot read your email, deploy a server, or query a database. It needs a way to
take real actions. The Model Context Protocol (MCP) is the standard for that: a
shared language between an AI client and a server that exposes actions - called
tools - the AI can call.

## Client and server

- The **client** is the AI app: Claude, ChatGPT, an agent command-line interface
  (CLI). It holds the model and the conversation.
- The **server** is a program that exposes tools. It has no model of its own; it
  advertises "here are my tools" and runs them when asked.

mcp-node is an MCP server.

## What a tool is

A tool is one specific thing the server can do for the AI - like "check this
month's cost" or "deploy a server." Each tool comes with:

- a **name** the AI uses to ask for it,
- a plain **description** so the AI knows when it is the right one to use,
- a list of any **details it needs** to do the job (for example, a city name, or
  how big to make something). Some tools need no details at all.

For example, a tool called `azure_spend` needs no details and just returns this
month's cost.

## How a call actually happens

This is the core loop. It rides on JSON remote procedure call (JSON-RPC), a
simple request/response format over HTTP.

1. **Connect and initialize.** The client opens a session and sends
   `initialize`. The server replies with its protocol version and what it
   supports. This is the handshake.
2. **Discover tools.** The client sends `tools/list`; the server returns every
   tool with its schema. Now the model knows what it can do.
3. **The model decides.** As you chat, the AI sees those tool descriptions. When
   your request matches one ("what am I spending?"), it picks that tool and fills
   in any details it needs. This choice is the AI's judgment, not the server's.
4. **Call.** The client sends `tools/call` with the tool name and arguments.
5. **Run and return.** The server runs the tool's handler and returns the result;
   the model reads it and answers you.

[Architecture and runtime](02-architecture.md) traces these five steps through
the actual code.

## Why mcp-node is different

Most MCP servers wrap one external service (a calendar, a database). mcp-node
wraps *its own cloud*: its tools operate the Azure resource group and GitHub
repository the server itself runs in. So the AI can deploy, update, and extend
the very node it is talking to.

## What a "node" is

A node is one resource group (RG) - your own isolated, cost-capped box in Azure -
with an MCP server running inside it that manages that box. **One node = one
resource group.** The server (a Function App), its tools, its secrets, and its
cost cap all live in that single RG.

**Single-tenant** means one owner, one connection, full access - no multi-user
permission system, because the node is yours alone. That keeps it light.

You expand by adding more nodes: each new node is another resource group, its own
capped box, the same shape. One to start, more as you grow. ([Scaling](08-scaling.md).)

## The open-box idea

It ships with a few tools but is built to grow. You ask the connected AI to add a
tool; it edits the node's own source and redeploys. Day one is a starting point,
not a fixed product. ([Extending](09-extending.md) shows how.)

## Why it stays safe

- the node's identity is scoped to its own RG only,
- the RG has a hard monthly budget cap (about $10 by default),
- the Function App scales to zero when idle - nothing runs, or costs, unless
  used.

## How it scales

One node is the base. For another, run the install again or let the node stamp a
sibling. Every node is the same shape, so the system grows by repeating one
known-good unit. ([Scaling](08-scaling.md).)
