← [All docs](README.md)

# Custom instructions

The node can tell every connected AI how you want it to behave - standing
guidance the client receives the moment it connects. It is how you shape the
system's behavior in one place instead of repeating yourself in each chat.

## How it works

When a client connects (the `initialize` step), the server includes an
`instructions` field. Model Context Protocol (MCP) clients read it and treat it
as standing guidance for the session. The node reads those instructions from
`src/instructions.md`, so editing that one file changes how the AI behaves on the
next connect.

## Setting them

1. Edit `src/instructions.md` - plain text. Write it like you are briefing a
   teammate: "always confirm before deploying anything that costs money," "name
   resources per the infra conventions," and so on.
2. Redeploy the node (or ask the connected AI to redeploy, then reconnect).
3. New sessions pick up the new instructions.

## Why one place

Without this, every person and every chat re-explains the rules. With it, the
node carries them - so behavior is consistent across ChatGPT, Claude, Grok, and
any other client, and updating it is a single file.

## Memory (related)

Custom instructions are static guidance. For things the node should remember
across sessions (decisions, preferences, state), add a memory tool that stores
and recalls from the vault or a file - see [Extending](09-extending.md).
