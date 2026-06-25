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

A tool is a named action with a typed input. The server advertises each tool's
**name**, a **description** (so the model knows when to use it), and an **input
schema** (what arguments it takes). For example, a tool `azure_spend` with no
inputs that returns this month's cost.

## How a call actually happens

This is the core loop. It rides on JSON remote procedure call (JSON-RPC), a
simple request/response format over HTTP.

1. **Connect and initialize.** The client opens a session and sends
   `initialize`. The server replies with its protocol version and what it
   supports. This is the handshake.
2. **Discover tools.** The client sends `tools/list`; the server returns every
   tool with its schema. Now the model knows what it can do.
3. **The model decides.** As you chat, the model sees those tool descriptions.
   When your request matches one ("what am I spending?"), it chooses to call that
   tool and fills the arguments from the schema. This step is the model's
   judgment, not the server's.
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

A node is one self-contained MCP server plus the cloud it manages, deployed as a
single unit: a Function App, in its own resource group (RG), with tools to
operate that RG and its own code. **Single-tenant** means one owner, one
connection, full access - no multi-user permission system, because it is yours
alone. That simplification is what keeps it light.

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
