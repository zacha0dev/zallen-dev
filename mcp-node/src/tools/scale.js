// scale.js - the node scales itself across projects: create a new resource
// group, put a cost cap on it, and deploy a template into it. These let one
// node stamp more capped nodes.
//
// These require the node's identity to have subscription-scope rights, which is
// OFF by default. Run scripts/enable-scaling.sh once to grant it. Until then
// these tools return a clear 403 telling you to enable scaling.
const { DefaultAzureCredential } = require("@azure/identity");

const ARM = "https://management.azure.com";
const credential = new DefaultAzureCredential();

async function arm(method, pathQuery, body) {
  const t = await credential.getToken("https://management.azure.com/.default");
  const res = await fetch(`${ARM}${pathQuery}`, {
    method,
    headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) {
    throw new Error(
      "403 from Azure: this node is not allowed to manage other resource groups. " +
        "Run scripts/enable-scaling.sh once to grant it subscription-scope rights."
    );
  }
  if (!res.ok) throw new Error(`ARM ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

function sub() {
  const s = process.env.AZURE_SUBSCRIPTION_ID;
  if (!s) throw new Error("AZURE_SUBSCRIPTION_ID app setting is not set");
  return s;
}

const rgCreate = {
  name: "azure_rg_create",
  description: "Create a new resource group (for a new node / project).",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "resource group name" },
      location: { type: "string", description: "region, e.g. eastus" },
    },
    required: ["name", "location"],
  },
  handler: async ({ name, location }) => {
    const data = await arm(
      "PUT",
      `/subscriptions/${sub()}/resourcegroups/${name}?api-version=2021-04-01`,
      { location }
    );
    return { resourceGroup: data.name, location: data.location, state: data.properties?.provisioningState };
  },
};

const budgetSet = {
  name: "azure_budget_set",
  description: "Put a monthly cost cap (with alerts) on a resource group.",
  inputSchema: {
    type: "object",
    properties: {
      resourceGroup: { type: "string" },
      amountUsd: { type: "number", description: "monthly cap, e.g. 10" },
      startDate: { type: "string", description: "YYYY-MM-01" },
      alertEmail: { type: "string" },
    },
    required: ["resourceGroup", "amountUsd", "startDate", "alertEmail"],
  },
  handler: async ({ resourceGroup, amountUsd, startDate, alertEmail }) => {
    const note = (threshold, kind) => ({
      enabled: true,
      operator: "GreaterThanOrEqualTo",
      threshold,
      thresholdType: kind,
      contactEmails: [alertEmail],
    });
    const data = await arm(
      "PUT",
      `/subscriptions/${sub()}/resourceGroups/${resourceGroup}/providers/Microsoft.Consumption/budgets/${resourceGroup}-monthly-cap?api-version=2023-11-01`,
      {
        properties: {
          category: "Cost",
          amount: amountUsd,
          timeGrain: "Monthly",
          timePeriod: { startDate },
          notifications: {
            actual_80: note(80, "Actual"),
            actual_100: note(100, "Actual"),
            forecast_100: note(100, "Forecasted"),
          },
        },
      }
    );
    return { budget: data.name, amountUsd, resourceGroup };
  },
};

const deployTemplate = {
  name: "azure_deploy_template",
  description: "Deploy an ARM template (object) into a resource group.",
  inputSchema: {
    type: "object",
    properties: {
      resourceGroup: { type: "string" },
      name: { type: "string", description: "deployment name" },
      template: { type: "object", description: "ARM template JSON" },
      parameters: { type: "object", description: "template parameters" },
    },
    required: ["resourceGroup", "name", "template"],
  },
  handler: async ({ resourceGroup, name, template, parameters }) => {
    const data = await arm(
      "PUT",
      `/subscriptions/${sub()}/resourcegroups/${resourceGroup}/providers/Microsoft.Resources/deployments/${name}?api-version=2021-04-01`,
      {
        properties: {
          mode: "Incremental",
          template,
          parameters: parameters || {},
        },
      }
    );
    return { deployment: data.name, state: data.properties?.provisioningState };
  },
};

module.exports = { tools: [rgCreate, budgetSet, deployTemplate] };
