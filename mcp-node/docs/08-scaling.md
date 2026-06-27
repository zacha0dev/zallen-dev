← [All docs](README.md)

# Scaling

From one node to many.

**"Scaling" here means fan-out, not scale-up.** Everything below is about
running MORE nodes (each its own RG, identity, and budget) - it does NOT make a
single node bigger or faster. A single node already auto-scales its own
Consumption plan horizontally per request; `enable-scaling` is purely a switch
that grants the node rights to STAMP additional nodes.

## How many nodes can I run?

Azure caps Consumption (Y1) Function Apps at roughly **100 per region per
subscription**. Spread across regions or use multiple subscriptions to go past
that. If you need a single node to be *vertically* larger (more memory, no
cold-start, longer runtime), that is a different plan entirely - an App Service
or Elastic Premium plan - not anything `enable-scaling` does.

## Default: re-run the install

Run the install again with a new node name. You get a second node in its own
resource group (RG) with its own cost cap. Each node's identity stays scoped to
its own box. This is the safe path - the human, who holds subscription rights, is
the one creating each RG.

## Opt-in: let the node stamp siblings

Run `scripts/enable-scaling.sh` once. It gives the node permission over your whole
subscription (not just its own box) - "Contributor at subscription scope" in
Azure terms. After that the connected AI can, from inside the connector:

- `azure_rg_create` - create a new RG,
- `azure_budget_set` - put a cap on it,
- `azure_deploy_template` - deploy a sibling node into it.

This is real power - the node can now manage any RG in the subscription - so it
is off until you run the script. Revoke any time with the command the script
prints.

## Which to use

Use the default while you are learning or the count is small. Turn on
self-scaling when you want the node itself to manage a fleet.
