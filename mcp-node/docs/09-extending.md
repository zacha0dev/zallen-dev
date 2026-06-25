← [All docs](README.md)

# Extending: 3rd-party connectors and your own tools

This is the point of the open box: wrap any application programming interface
(API) as a tool, store its key in Key Vault, and the artificial intelligence (AI)
can use it. You can do every step by prompting the connected AI, or by hand.

## Own the code (fork)

Fork the repo so you own the source and the deploy workflow. Copy
`mcp-node/deploy/deploy.yml` to `.github/workflows/deploy.yml` in your fork so
GitHub Actions can run it.

## Wire the deploy (one-time)

Set two repository secrets in your fork:

- `AZURE_CREDENTIALS` - a service principal scoped to your node's resource group:
  ```
  az ad sp create-for-rbac --sdk-auth --role contributor \
    --scopes /subscriptions/<sub>/resourceGroups/<rg>
  ```
- `FUNCTION_APP_NAME` - your node's Function App name.

Then point the node's `github-token` (in Key Vault) at your fork so its github
tools can commit and dispatch.

## Worked example: a 3rd-party connector

Say you want a `weather_now` tool that calls a REST API needing a key.

**1. Store the key in the node's Key Vault.** The node's identity has Key Vault
Secrets Officer, so you can also just ask the node to do this; by hand:

```
az keyvault secret set --vault-name <node-kv> --name weather-api-key --value <key>
```

**2. Add the tool module** - `src/tools/weather.js`:

```
const { getSecret } = require("../lib/secrets");

const tool = {
  name: "weather_now",
  description: "Current weather for a city.",
  inputSchema: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
  handler: async ({ city }) => {
    const key = await getSecret("weather-api-key");
    const res = await fetch(
      `https://api.example.com/now?city=${encodeURIComponent(city)}&key=${key}`
    );
    if (!res.ok) throw new Error(`weather ${res.status}: ${await res.text()}`);
    return res.json();
  },
};

module.exports = { tools: [tool] };
```

Note it reads the key with `getSecret` and throws a clear error if the call
fails - that is the pattern (`tools/github.js` does the same with its token).

**3. Register it** in `src/tools/index.js` - require the module and spread its
`.tools` into the registry list.

**4. Deploy** - commit and dispatch the workflow (or ask the AI to). The Action
builds `src/` and publishes to your Function App.

**5. Reconnect** your client - the tool list is fixed at connect, so `weather_now`
appears after a reconnect or a fresh session.

### Or just prompt it

"Add a `weather_now` tool that calls api.example.com using `weather-api-key` from
Key Vault." The AI follows `src/kb/extending.md`, writes the module, registers
it, and redeploys.

## Managing keys

Check what is set (names only, no values):

```
az keyvault secret list --vault-name <node-kv> -o table
```

Read or rotate a key:

```
az keyvault secret show --vault-name <node-kv> --name weather-api-key --query value -o tsv
az keyvault secret set  --vault-name <node-kv> --name weather-api-key --value <new-key>
```

## Debugging

Expect a round or two. If a build or deploy fails, the AI reads the Action logs,
fixes the module, and redeploys. Common causes: a syntax error, a missing
dependency in `package.json` (add it; the Action runs `npm ci`), or a runtime
throw (check Application Insights).

## The node knows this too

The same process is baked into the node's knowledge (`src/kb/extending.md`,
`src/kb/operating.md`), so the AI can follow it from inside the connector.
