[mcp-node](../README.md) · [Docs](README.md) · [← Infrastructure](06-infrastructure.md) · [Scaling →](08-scaling.md)

# Cost

What the node costs, and what keeps it bounded.

## Why it is near $0 at rest

- It is pay-as-you-go and scales to zero - you are charged only when a tool
  actually runs, and an idle node runs nothing.
- The artificial intelligence (AI) is yours (Claude / ChatGPT), so there is no
  large language model (LLM) cost charged to the node.
- Logs are bounded by a daily ingestion cap.

## What can actually cost money

- Tool calls (Function executions) - tiny, and the free tier covers a lot.
- Anything you deploy INTO the box - a running virtual machine (VM) or a database
  has real hourly cost. This is where the cap matters.

## The guard

The resource group has a monthly budget (default about $10) with alerts at
50/80/100% of actual spend plus a forecast alert. Infrastructure the node deploys
follows `kb/infra.md`: smallest sensible size tier, the cost shown before deploy,
and tags so a project is clean to tear down.

## Raising it

`monthlyCapUsd` is a parameter. Raise it on purpose when you mean to run
something larger; keep it low while you are exploring.
