← [All docs](README.md)

# Connectors

A connector is any wiring between the node and something else. There are two
directions, and the node does both.

## Clients connecting in (an AI to the node)

The AI clients - Claude, ChatGPT, Grok, command-line tools - connect to the MCP
server over Open Authorization (OAuth). They are the connectors coming in.

- Set it up: [Connecting a client](connect.md)
- How the sign-in works: [Auth and identity](03-auth.md)

## The node connecting out (to services and data)

The node's tools are connectors going out:

- the **github** tool connects to GitHub,
- the **azure** tool connects to Azure,
- a **3rd-party** tool connects to any service you wrap.

Each new tool you add is a new outbound connector. Its key lives in the node's
Key Vault, and the tool reads it at call time.

- The built-in connectors: [The tools](05-tools.md)
- Add your own: [Extending](09-extending.md)

## In one line

Clients connect in over OAuth; the node connects out through tools. Adding a
connector is adding a tool with its key in the vault.
