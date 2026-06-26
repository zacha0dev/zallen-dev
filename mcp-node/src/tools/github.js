// github.js - the node manages its own code: read files, commit changes, and
// dispatch its deploy workflow (so it can update itself). The GitHub token is
// read from the node's Key Vault (secret name: github-token); if it is not
// present these tools report that cleanly instead of failing hard.
const { getSecret } = require("../lib/secrets");

const API = "https://api.github.com";

// Confused-deputy guard: the node's github-token may have wide scope, so a
// caller-supplied `repo` must be restricted to the node's OWN repo. The allowed
// repo comes from the NODE_REPO app setting (owner/name). If NODE_REPO is unset
// we fail CLOSED - rather than guess, we refuse all repos with a clear message
// telling the deployer to set NODE_REPO. Keep it simple: exact match only.
function allowedRepo() {
  return (process.env.NODE_REPO || "").trim();
}

function assertRepoAllowed(repo) {
  const allowed = allowedRepo();
  if (!allowed) {
    throw new Error(
      "NODE_REPO app setting is not set; GitHub tools are restricted to the node's own repo. " +
        'Set NODE_REPO="owner/name" (the repo this node deploys from) to enable them.'
    );
  }
  if (String(repo || "").trim().toLowerCase() !== allowed.toLowerCase()) {
    throw new Error(
      `Repo "${repo}" is not allowed; this node may only act on its own repo (${allowed}).`
    );
  }
}

async function token() {
  try {
    return await getSecret("github-token");
  } catch {
    return null;
  }
}

async function gh(pathName, opts = {}) {
  const t = await token();
  if (!t) throw new Error("github-token not set in Key Vault; add it to enable GitHub tools");
  const res = await fetch(`${API}${pathName}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "mcp-node",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.status === 204 ? {} : res.json();
}

const getFile = {
  name: "github_get_file",
  description: "Read a file from a repo (owner/name) at an optional ref.",
  inputSchema: {
    type: "object",
    properties: {
      repo: { type: "string", description: "owner/name" },
      path: { type: "string" },
      ref: { type: "string" },
    },
    required: ["repo", "path"],
  },
  handler: async ({ repo, path, ref }) => {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const data = await gh(`/repos/${repo}/contents/${path}${q}`);
    return {
      path: data.path,
      sha: data.sha,
      content: Buffer.from(data.content || "", "base64").toString("utf8"),
    };
  },
};

const putFile = {
  name: "github_put_file",
  description: "Create or update a file in a repo on a branch.",
  inputSchema: {
    type: "object",
    properties: {
      repo: { type: "string", description: "owner/name" },
      path: { type: "string" },
      content: { type: "string" },
      message: { type: "string" },
      branch: { type: "string" },
      sha: { type: "string", description: "existing file sha when updating" },
    },
    required: ["repo", "path", "content", "message"],
  },
  handler: async ({ repo, path, content, message, branch, sha }) => {
    const body = {
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
    };
    if (branch) body.branch = branch;
    if (sha) body.sha = sha;
    const data = await gh(`/repos/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { path: data.content?.path, commit: data.commit?.sha };
  },
};

const dispatch = {
  name: "github_dispatch_workflow",
  description: "Trigger a workflow_dispatch on a repo (the node deploys itself).",
  inputSchema: {
    type: "object",
    properties: {
      repo: { type: "string", description: "owner/name" },
      workflow: { type: "string", description: "workflow file name, e.g. deploy.yml" },
      ref: { type: "string", description: "branch to run on (default main)" },
    },
    required: ["repo", "workflow"],
  },
  handler: async ({ repo, workflow, ref }) => {
    await gh(`/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: ref || "main" }),
    });
    return { dispatched: true, repo, workflow, ref: ref || "main" };
  },
};

module.exports = { tools: [getFile, putFile, dispatch] };
