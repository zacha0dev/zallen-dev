// trainer-matrix.spec.js - the STARTER TRAINING MATRIX, one of the two kickstart
// artifacts the trainer ships. The trainer's grading contract (the 10 dimensions)
// lives in trainer.spec.js; this file is the worked EXAMPLE a deployer edits to
// stand up their own training run - an example enrichment-node set plus a tiny
// helper to turn it into the { nodes } payload POST /agents/trainer expects.
//
// Edit STARTER_MATRIX for your domain: each entry is a NODE - a unit of training
// context you want enriched across the 10 dimensions. Keep ids stable so the
// enrichment_tracker rows line up run-to-run.

const { ENRICHMENT_DIMENSIONS } = require("./trainer.spec");

// STARTER_MATRIX - a small, generic example set. Replace these with YOUR
// training-context units. The shape is { id, context }; the runner fills in
// enrichments + grades. These are deployer-agnostic on purpose (a deployer
// swaps in domain content) but show the right granularity: one focused idea per
// node, written as the raw context to be enriched.
const STARTER_MATRIX = [
  {
    id: "node-onboarding-welcome",
    context:
      "A new user just signed up. Explain, in the product's voice, what they " +
      "can do in the first five minutes and the single most valuable first action.",
  },
  {
    id: "node-pricing-faq",
    context:
      "Answer the common question 'what happens to my data if I cancel?' for a " +
      "subscription product, accurately and without scaring the user.",
  },
  {
    id: "node-error-recovery",
    context:
      "A user hit a failed-upload error. Describe what likely went wrong and the " +
      "exact recovery steps, covering the common edge cases (file too large, " +
      "network drop, unsupported type).",
  },
  {
    id: "node-feature-explainer",
    context:
      "Explain a core feature to a non-technical audience: what it is, when to " +
      "reach for it, and one concrete example - no jargon.",
  },
  {
    id: "node-policy-summary",
    context:
      "Summarize the support SLA (response times by tier) so a reader can act " +
      "on it immediately, with no ambiguity about which tier applies to them.",
  },
];

// toBatch - turn the matrix (or any node array) into the POST /agents/trainer
// body. Defaults to the starter matrix.
function toBatch(matrix = STARTER_MATRIX) {
  return { nodes: matrix.map((n) => ({ id: n.id, context: n.context })) };
}

module.exports = {
  STARTER_MATRIX,
  toBatch,
  // re-exported so a deployer editing the matrix sees the grading contract here.
  ENRICHMENT_DIMENSIONS,
};
