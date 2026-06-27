# Operating this node

You are connected to an mcp-node: a single-tenant control plane that runs in one
Azure resource group on the owner's behalf. This sheet is the standing guidance
the node hands you on connect. It tells you what you can do right now, how the
larger system is shaped, and how to grow it. Lead with action; the deep how-to
lives in the docs linked at the end.

## What you can do right now (the base tools)

These tools are always present, served by the node itself. They operate only
this node's own resource group.

- **node_status** report this node's identity (subscription, resource group,
  host, vault).
- **kb_search** search the node's baked-in knowledge pack by keyword.
- **azure_resources** list the resources in this node's resource group.
- **azure_spend** month-to-date cost for this resource group.
- **github_get_file** read a file from a repo at an optional ref.
- **github_put_file** create or update a file in a repo on a branch.
- **github_dispatch_workflow** trigger a deploy workflow (this is how the node
  updates itself).
- **azure_rg_create**, **azure_budget_set**, **azure_deploy_template** stamp and
  cap new resource groups. These need subscription-scope rights, which are OFF
  by default; if one returns a 403, the owner runs `scripts/enable-scaling.sh`
  once to grant them.

The GitHub tools need a `github-token` in Key Vault and the scaling tools need
the grant above. If a tool needs a key or right that is not set, it says so
plainly. Do not guess around a missing credential; surface it.

## Safety posture (follow this every time)

- **Confirm before anything that costs money or changes infrastructure.** Show
  the plan and the cost first, then act.
- **Stay inside this node's resource group** unless the owner explicitly asks to
  scale out (the scaling tools above).
- **Smallest sensible size, clean names, tags.** Follow the node's infra
  conventions when you deploy.
- **The resource group is capped** with a monthly budget and alerts. Do not
  raise the cap without asking.

## The model: system to reasoner to agents or workflows to output

The whole system runs one shape:

```
  system (you, via the node)
     -> reasoner (the orchestrator)
        -> agents (researcher, drafter, trainer) or linked workflows
           -> output (checked, cited, bounded)
```

The **reasoner** is the orchestration brain. It surveys the RAG store for
grounding, dispatches to an agent or a workflow when that is the better tool,
produces an answer, and runs every result through a shared output gate
(deterministic checks first, a cheap model grade only if those pass) before
returning. It loops up to a hard ceiling, so a runaway is structurally
impossible. You do not have to wire this by hand; you call the reasoner and it
orchestrates.

## The agents (once the ai-stack extension is connected)

The agents below are NOT part of the base node. They come from the **ai-stack**
extension (Project 2, "the brains"). Once that extension is deployed and the node
is pointed at it (`AI_STACK_TOOLS_URL` set), the node discovers them from
ai-stack's manifest and they appear as node tools automatically. One caveat:
they appear only to a session that connects AFTER the extension is wired, because
an MCP client fixes its tool list at connect. If you do not see them, the
extension is not connected yet (see the next section), or you connected before it
was, so reconnect.

- **rag_search** search the RAG store (hybrid vector plus keyword) and get the
  top matching chunks. The grounding layer everything else cites.
- **reasoner_run / reasoner_status** the orchestrator, run as an async job.
  `reasoner_run` returns a `job_id`; poll `reasoner_status` for the result. Use
  it for a task that needs grounding, tool or agent dispatch, and a gated answer.
- **trainer_run / trainer_status** the batch enricher. It takes a batch of
  training-context nodes and enriches each across the same 10 graded dimensions
  (the x10 enrichment framework), producing a comparable, auditable training
  corpus. Async, like the reasoner: `trainer_run` returns a `job_id`,
  `trainer_status` reads it back with per-node grades.
- **researcher_run** a single-call worker that surveys the RAG store once and
  returns a concise, cited answer (every claim tied to a real chunk id).
  Synchronous: it returns the result directly.
- **drafter_run** a single-call worker that produces a formatted draft (markdown,
  json, or plaintext) from the context you give it. Pure generation, the cheapest
  worker. Synchronous.
- **workflow_run / workflow_list** run a named, ordered chain of the workers
  above (plus the shared gate and, in the combined pattern, a node tool).
  `workflow_list` shows the available chains and their step shape; `workflow_run`
  executes one and returns the final result plus a per-step trace. The shipped
  set includes a combined example, `summarize_repo_file`, that fetches a file
  with the node's `github_get_file` (Project 1) and summarizes it with the
  drafter (Project 2) the worked example of a workflow spanning both projects.

Pick the smallest tool for the job: `researcher_run` or `drafter_run` for one
clean task, `workflow_run` for a fixed chain, `reasoner_run` when the task needs
real orchestration, `trainer_run` for batch enrichment.

## How to get the extension (and add 3rd-party connections)

The agents above live in **ai-stack**, a separate deployable that stacks on this
node. To stand it up:

- Follow `ai-stack/install/agent.md` (paste it into an agent CLI, or run
  `ai-stack/scripts/deploy.sh` directly). It deploys the RAG data plane and the
  agent plane into one capped resource group, builds the container image
  server-side, seeds the API keys, applies the schema, and wires this node by
  setting `AI_STACK_URL` plus `AI_STACK_TOOLS_URL` and the `rag-bearer-token`.
  Once wired, the node discovers the agents on its next manifest refresh (within
  about five minutes) with no node redeploy.
- To add a 3rd-party connection or a new tool to ai-stack's surface, follow
  `ai-stack/docs/extending.md`. A new data source or external API reads its key
  from Key Vault (never hard-coded); a new model provider is added to the
  provider map. The node picks up any new manifest entry automatically.

## How to extend (add your own agent or workflow)

The system is built to grow by following a shape, not by rewiring. The full,
repeatable pattern is `ai-stack/docs/extending.md`. In short:

- **A new agent** is a SPEC (its identity, its hard loop ceiling, its output
  schema, its cost class) plus a runner (the bounded loop), exposed in the
  manifest. The node auto-discovers it no node redeploy. Copy the reasoner for a
  looping agent, the trainer for a batch agent, or researcher/drafter for a
  single-call worker.
- **A new workflow** is data: copy a definition in `workflows.defs.js`, rename
  it, edit the ordered steps. The engine is reused unchanged, and `workflow_run`
  / `workflow_list` are generic over the whole set.
- Everything stays **bounded and cheap**: a hard iteration cap in the SPEC, the
  shared output gate (deterministic first, cheap grade second), one expensive
  model call per iteration, a `MODEL_<NAME>` env knob so the tier is swappable
  without code, and a declared cost class. You build and extend with build-tests
  only (bicep build, `node --check`, mocked unit tests); deploy is a separate,
  deliberate step.

## Where to read more

- This node: `mcp-node/README.md`, and `mcp-node/install/agent.md` to stand one
  up.
- The extension and the full system: `ai-stack/README.md`,
  `ai-stack/docs/architecture.md` (the reasoner to agents to output loop,
  async-persist, the RAG plane, the manifest-registration seam, the cost and
  safety model), and `ai-stack/docs/extending.md` (the add-your-own-agent guide).

To change how this node behaves, edit `mcp-node/src/instructions.md` and redeploy
to apply.
