# An AI that runs its own cloud

*A hands-on look at the self-managing MCP node — and what it changes about how you think about AI.*

---

Most "AI" you meet is a text box. You type, it talks back. Useful, but it
doesn't *do* anything to the world — it has no hands.

This is about giving it hands, safely, and watching what happens. The result is a
small piece of cloud infrastructure that an AI can stand up, run, repair, and
extend **by itself** — inside a sandbox it can't escape and a budget it can't
blow. You can deploy your own in an afternoon for about ten dollars a month, point
your assistant at it, and start exploring. That's the whole point: not a demo you
watch, one you *hold*.

## The shift in one sentence

The interesting move in AI right now isn't a bigger model — it's giving a capable
model a **clean, bounded way to act**, and then letting it operate. The model
stops being a thing you ask and becomes a thing you *work with*.

The clean, bounded way to act is **MCP** (the Model Context Protocol): a simple
contract that exposes a set of tools to an AI client. Your assistant — Claude,
ChatGPT, whatever speaks MCP — connects to your server and can call those tools.
That's it. The magic isn't the protocol; it's *what tools you put behind it*.

## The idea: a node that owns itself

Picture one cloud resource group — call it a **node**. Inside it:

- a small **MCP server** (the connector your AI talks to),
- its own **identity and secrets**, scoped to just that node,
- and a set of tools that let the AI manage **its own cloud** and **its own code**.

Give the node tools to talk to its cloud provider and to its own Git repository,
and something clicks: the AI inside can **deploy itself, update itself, read its
own logs, and even stamp out new resource groups** — each one capped at its own
budget. It's not calling out to some hosted service that does the work. It *is*
the service, and it can reach back into itself to operate.

That's the part that makes engineers sit up: the agent's world and the agent's
control plane are the same thing. Ask it to add a capability, and it can edit its
code, open the change, ship it, and watch the deploy — then use the capability it
just built.

## Why it's safe to hand it the keys

Hands without guardrails is how you wake up to a $4,000 bill. So the design is
boundaries first:

- **One node = one resource group.** The AI's identity is scoped to *that* group
  and nothing else. It can't wander your account.
- **A hard cost cap.** Every resource group ships with a monthly budget — default
  around **$10** — with alerts at 50/80/100% *and* a throttle that throctles the
  thing down to near-nothing if it ever hits the ceiling. Pick a bigger number if
  you want more room; it's one parameter.
- **Scale-to-zero.** The server costs essentially nothing when idle. A node you're
  not using rounds to free.
- **Your own auth.** Connecting is a normal OAuth handshake to *your* node. You
  hold the keys; nothing is shared with a third party.

Bounded sandbox, capped spend, your credentials. That's what makes "let the AI
run infrastructure" a reasonable sentence instead of a reckless one.

## What you actually do (hands-on)

1. **Stand up a node.** A setup script provisions the resource group, the MCP
   server, secrets, and the budget cap. One command, one node.
2. **Connect your assistant.** The script hands you the connection details for
   your client — Claude needs just an OAuth client id + secret; ChatGPT wants the
   full endpoint set (server URL + authorize + token + id + secret + scopes). Paste
   them in.
3. **Explore.** Ask it what it can do. Ask it to read its own logs. Ask it to add
   a tool and ship it. Ask it to spin up a second, separately-capped node. Watch
   an AI operate a slice of cloud the way a junior engineer would — except it
   never forgets the runbook.

The first time it edits its own code, deploys, and then *uses the thing it just
built*, the abstraction stops being abstract.

## What this teaches about AI

- **The model is the easy part.** The value is in the tools, the boundaries, and
  the wiring. Good engineering, not magic.
- **Constraints are the feature.** The cost cap, the scoped identity, the
  scale-to-zero — those aren't limitations bolted on after. They're what makes
  autonomy *trustworthy*.
- **AI is an operator, not an oracle.** Once it can act inside a safe boundary, the
  question shifts from "what will it say?" to "what will it *do*, and how do I
  shape that?" That's a more useful question, and a more honest one.

## Honest status

This is an emerging build, shared as a pattern you can learn from and stand up
yourself — not a polished one-click product (yet). The pieces are real and
running; the smooth installer is being packaged. If you want to follow along as it
hardens, that's exactly what this journal is for.

The reason I'm writing it down: I think a lot of engineers are about to fall in
love with this — not the hype version of AI, the *hands-on* version, where you can
deploy it, break it, cap it, and own it. If that's you, pull up a terminal.

---

*Part of [zallen.dev](https://zallen.dev) — an engineering journal about building
with AI, hands-on. Questions and corrections welcome.*
