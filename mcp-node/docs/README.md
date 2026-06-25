[← mcp-node](../README.md)

# mcp-node docs

A learning resource for understanding the system. Installed it from the main
README? These pages explain how it works and how to build on it.

## Read in order

1. [Concepts](01-concepts.md) - what MCP is, what a node is.
2. [Architecture and data flow](02-architecture.md) - the components and how a request flows.
3. [Connectors](connectors.md) - clients in, data sources out.
4. [Connecting a client](connect.md) - per-client setup (Claude / ChatGPT / Grok / CLI).
5. [Auth and identity](03-auth.md) - OAuth in, managed identity out.
6. [Custom instructions](custom-instructions.md) - shape how the AI behaves.
7. [The server](04-server.md) - inside the Function App.
8. [The tools](05-tools.md) - the tool system and built-ins.
9. [Infrastructure](06-infrastructure.md) - the bicep, resource by resource.
10. [Cost](07-cost.md) - what it costs and the cap.
11. [Scaling](08-scaling.md) - one node to many.
12. [Extending](09-extending.md) - add your own tools and connectors.

## Following the "Building an AI System" series

This project backs the series; the early parts map to these pages:

- Part 2, the MCP server -> [Concepts](01-concepts.md) + [The server](04-server.md)
- Part 3, Connectors -> [Connectors](connectors.md)
- Part 4, Data Flow -> [Architecture and data flow](02-architecture.md)
- Part 5, Custom Instructions -> [Custom instructions](custom-instructions.md)
- Part 6, Multi-Client Wireup -> [Connecting a client](connect.md)
- Part 7, Where We Are Now -> this whole set

Convention: acronyms are spelled out on first use in each page, then used short.
