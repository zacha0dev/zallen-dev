# Scaling

From one node to many.

## Default: re-run the install

Run the install again with a new node name. You get a second node in its own
resource group (RG) with its own cost cap. Each node's identity stays scoped to
its own box. This is the safe path - the human, who holds subscription rights, is
the one creating each RG.

## Opt-in: let the node stamp siblings

Run `scripts/enable-scaling.sh` once. It grants the node's managed identity
Contributor at subscription scope. After that the connected AI can, from inside
the connector:

- `azure_rg_create` - create a new RG,
- `azure_budget_set` - put a cap on it,
- `azure_deploy_template` - deploy a sibling node into it.

This is real power - the node can now manage any RG in the subscription - so it
is off until you run the script. Revoke any time with the command the script
prints.

## Which to use

Use the default while you are learning or the count is small. Turn on
self-scaling when you want the node itself to manage a fleet.
