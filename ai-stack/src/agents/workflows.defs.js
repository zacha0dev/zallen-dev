// workflows.defs.js - the SET of generalized example workflows (Phase 5). This
// file IS the copy-me kickstart artifact: each definition is small, editable, and
// demonstrates one composition pattern. A deployer forks a workflow by copying a
// def, renaming it, and editing the steps - the engine (workflows.js) is reused
// unchanged. See docs/extending.md "add your own workflow".
//
// A workflow chains role agents (PROJECT 2: rag/agents) and/or node tools
// (PROJECT 1: Azure/GitHub), threading each step's output forward. The three
// patterns shown:
//   1. research_and_draft  - two PROJECT-2 agents in series (RESEARCHER -> DRAFTER)
//   2. enrich_and_check    - a PROJECT-2 agent feeding the shared output-checker
//   3. summarize_repo_file - COMBINED: a PROJECT-1 node tool (github_get_file)
//                            feeding a PROJECT-2 agent (RESEARCHER/DRAFTER)
//
// Each step is exactly one of run | agent | tool (see workflows.js for the step
// contract). `inputFrom` threads a prior step's output; a function inputFrom is
// the general mapper for reshaping between steps.

const { check } = require("./output-checker");

// --- 1. research_and_draft (PROJECT 2 only) --------------------------------
// The canonical two-agent chain: RESEARCHER answers + cites from the RAG store,
// then DRAFTER turns that grounded summary into a finished draft in a target
// format. Run it as a single workflow, or call either agent alone - both are the
// same single-call workers, just composed here.
//
// Input:  { question, depth?, topK?, format?, instruction? }
// Output: the DRAFTER result { draft, format, wordCount, warnings[] }, with the
//         research summary available in outputs.research for the trace.
const research_and_draft = {
  name: "research_and_draft",
  description:
    "RESEARCHER -> DRAFTER. Research a question against the RAG store (grounded, " +
    "cited), then draft a finished document from that summary. Project-2 only.",
  steps: [
    {
      id: "research",
      agent: "researcher",
      // first step: receives the workflow input directly ({ question, depth, topK }).
    },
    {
      id: "draft",
      agent: "drafter",
      // Reshape the researcher's { summary, citations } into the drafter's
      // { context, format, instruction } input. This mapper IS the output-thread.
      inputFrom: (outputs, input) => ({
        context: (outputs.research && outputs.research.summary) || "",
        format: input.format || "markdown",
        instruction:
          input.instruction ||
          `Write a clear document answering: ${input.question || "the research question"}.`,
      }),
    },
  ],
};

// --- 2. enrich_and_check (PROJECT 2 only) ----------------------------------
// A DRAFTER generates content, then the SHARED output-checker grades it - the
// same gate the reasoner + trainer use, here as an explicit workflow step so a
// deployer sees how to attach quality gating to ANY producing step. The check
// step is an inline `run` (it calls the lib directly with ctx.llm) rather than an
// agent, showing that a step can be any async function over (input, {ctx,...}).
//
// Input:  { context, format?, instruction? }  (what to draft)
// Output: { draft, verdict } - the draft plus the checker's { pass, reason, ... }.
const enrich_and_check = {
  name: "enrich_and_check",
  description:
    "DRAFTER -> output-checker. Generate content, then grade it with the shared " +
    "two-stage gate (deterministic-first, then a cheap LLM grade). Project-2 only.",
  steps: [
    {
      id: "draft",
      agent: "drafter",
      // receives the workflow input ({ context, format, instruction }) directly.
    },
    {
      id: "check",
      // Inline step: run the shared gate over the draft. The "task" is a synthetic
      // instruction describing what the draft should accomplish; the gate's
      // deterministic stage validates non-empty + non-refusal, then a cheap grade.
      run: async (draftResult, { ctx }) => {
        const task =
          "Produce a clean, non-empty draft that accomplishes the requested instruction.";
        const verdict = await check(
          task,
          // The checker reads textual surfaces (.answer/.text) or stringifies; pass
          // an object exposing the draft as `text` so looksRefused/empty works.
          { text: (draftResult && draftResult.draft) || "" },
          {},
          ctx
        );
        return verdict;
      },
      inputFrom: "draft",
    },
    {
      id: "result",
      // Combine both prior outputs into the workflow's final shape.
      run: async (_input, { outputs }) => ({
        draft: outputs.draft,
        verdict: outputs.check,
      }),
    },
  ],
};

// --- 3. summarize_repo_file (COMBINED PROJECT 1 + 2) -----------------------
// The cross-project pattern: pull a file from GitHub via the NODE's
// `github_get_file` tool (PROJECT 1), then summarize it with RESEARCHER/DRAFTER
// (PROJECT 2). ai-stack reaches the node tool through ctx.tools - in production a
// node-tool caller (makeNodeToolCaller, wired from MCP_NODE_URL + the node
// bearer); in a test a stub. The combined call is documented in
// docs/architecture.md "the combined 1+2 pattern".
//
// We summarize with DRAFTER (pure generation over the fetched file text) rather
// than RESEARCHER, because the grounding context is the FILE ITSELF, not the RAG
// store - so no rag_search is needed and the worker is the cheapest one. (Swap
// the second step to `agent: "researcher"` if you want the answer grounded in the
// RAG store with citations instead.)
//
// Input:  { repo, path, ref?, account?, format?, instruction? }
// Output: the DRAFTER result { draft, format, wordCount, warnings[] }; the raw
//         fetched file is in outputs.fetch for the trace.
const summarize_repo_file = {
  name: "summarize_repo_file",
  description:
    "COMBINED project-1+2: github_get_file (node tool) -> DRAFTER. Fetch a repo " +
    "file via the node, then summarize it. Shows how an ai-stack workflow reaches " +
    "back to a project-1 node tool through ctx.tools.",
  steps: [
    {
      id: "fetch",
      tool: "github_get_file",
      // Pass only the fields github_get_file accepts; the node tool returns the
      // file metadata + (decoded or base64) content.
      inputFrom: (_outputs, input) => ({
        repo: input.repo,
        path: input.path,
        ref: input.ref,
        account: input.account,
      }),
    },
    {
      id: "draft",
      agent: "drafter",
      // Decode the fetched content (the node tool may return base64) and feed it as
      // the drafter's context. This mapper is the project-1 -> project-2 bridge.
      inputFrom: (outputs, input) => {
        const f = outputs.fetch || {};
        let content = f.content;
        // github_get_file returns { content, encoding }; decode base64 to text.
        if (typeof content === "string" && f.encoding === "base64") {
          try {
            content = Buffer.from(f.content, "base64").toString("utf8");
          } catch {
            content = f.content;
          }
        }
        return {
          context: String(content || ""),
          format: input.format || "markdown",
          instruction:
            input.instruction ||
            `Summarize the file ${input.path || ""} from ${input.repo || "the repo"}: what it does and its key parts.`,
        };
      },
    },
  ],
};

// WORKFLOWS - the definition map. makeWorkflows(WORKFLOWS) (workflows.js) turns
// this into the ctx.workflows registry the dispatch seam resolves, and
// listWorkflows(WORKFLOWS) into the discovery metadata for workflow_list.
const WORKFLOWS = {
  research_and_draft,
  enrich_and_check,
  summarize_repo_file,
};

module.exports = {
  WORKFLOWS,
  research_and_draft,
  enrich_and_check,
  summarize_repo_file,
};
