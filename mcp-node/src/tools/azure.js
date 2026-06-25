// azure.js - the node operates its own Azure resource group through the
// Function App's managed identity. The identity is scoped to THIS resource
// group only, so these tools cannot reach anything else in the subscription.
const { DefaultAzureCredential } = require("@azure/identity");

const ARM = "https://management.azure.com";
const credential = new DefaultAzureCredential();

async function armToken() {
  const t = await credential.getToken("https://management.azure.com/.default");
  return t.token;
}

async function armGet(pathAndQuery) {
  const token = await armToken();
  const res = await fetch(`${ARM}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`ARM ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function sub() {
  const s = process.env.AZURE_SUBSCRIPTION_ID;
  if (!s) throw new Error("AZURE_SUBSCRIPTION_ID app setting is not set");
  return s;
}
function rg() {
  const r = process.env.AZURE_RESOURCE_GROUP;
  if (!r) throw new Error("AZURE_RESOURCE_GROUP app setting is not set");
  return r;
}

const resources = {
  name: "azure_resources",
  description: "List the resources in this node's own resource group.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const data = await armGet(
      `/subscriptions/${sub()}/resourceGroups/${rg()}/resources?api-version=2021-04-01`
    );
    return {
      resourceGroup: rg(),
      resources: (data.value || []).map((r) => ({
        name: r.name,
        type: r.type,
        location: r.location,
      })),
    };
  },
};

const spend = {
  name: "azure_spend",
  description: "Month-to-date cost for this node's resource group.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const token = await armToken();
    const scope = `/subscriptions/${sub()}/resourceGroups/${rg()}`;
    const res = await fetch(
      `${ARM}${scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "ActualCost",
          timeframe: "MonthToDate",
          dataset: {
            granularity: "None",
            aggregation: { total: { name: "Cost", function: "Sum" } },
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`CostManagement ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const rows = data.properties?.rows || [];
    const total = rows.length ? rows[0][0] : 0;
    const currency = rows.length ? rows[0][rows[0].length - 1] : "USD";
    return { resourceGroup: rg(), monthToDateCost: total, currency };
  },
};

module.exports = { tools: [resources, spend] };
