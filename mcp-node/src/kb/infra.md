# Infra conventions - clean, human-readable deploys

When you ask the node to deploy infrastructure ("deploy a small VM", "add a
database", "stand up a web app"), it follows these conventions so what lands in
your Azure is a clean, readable system - not a pile of random names.

## Where it deploys

Into the node's own resource group by default. With scaling enabled, into a named
resource group you choose - one project per group keeps things clean.

## Naming

Lowercase, hyphenated, human-readable: `<project>-<workload>-<type>`.

- `blog-web-vm`, `blog-web-nic`, `blog-web-vnet`, `blog-web-ip`
- `blog-data-sql`, `app-api-plan`, `app-api-app`

The type suffix says what a thing is at a glance (`-vm`, `-nic`, `-vnet`, `-ip`,
`-kv`, `-st`, `-plan`, `-app`, `-sql`). No GUID soup.

## Tags

Every resource gets tags so the group is self-describing:

- `managed-by = mcp-node`
- `project = <project name>`
- `workload = <workload>`

## Region

Inherit the resource group's region unless you ask for another.

## Cost first (the box is capped)

The node's resource group is capped at about $10/month, and some resources blow
that fast (a running VM, a SQL database). So the node:

- defaults to the smallest reasonable SKU (e.g. a B-series burstable VM),
- tells you the rough monthly cost before deploying something that will exceed
  the cap,
- suggests deallocating a VM when idle, or raising the cap on purpose
  (`monthlyCapUsd`) if you mean to run it.

## One-shot deploy

You describe it; the node authors a minimal template named per the convention
above, tags it, and deploys it with `azure_deploy_template` into the resource
group. Then it tells you what it made and the cost.

## Clean teardown

Because everything is in one resource group and tagged, removing a project is
clean: list by tag, delete the resources (or the whole group). Nothing strays.
