import { motion } from "framer-motion";
import { StaggerContainer, StaggerItem } from "@/components/StaggerContainer";

interface Decision {
  title: string;
  date: string;
  context: string;
  decision: string;
  outcome?: string;
}

const decisions: Decision[] = [
  {
    title: "Why Terraform over Bicep for multi-resource labs",
    date: "January 2026",
    context:
      "Building Azure networking labs that need to be reproducible and version-controlled. Bicep is Azure-native with tighter integration, but Terraform has mature state management and multi-provider support.",
    decision:
      "Chose Terraform for complex labs, Bicep for quick single-purpose experiments. The deciding factor was state management: Terraform's remote state and locking mechanisms are more robust for labs that might be modified over weeks.",
    outcome:
      "The hybrid approach works well. Bicep's faster iteration is valuable for testing individual resources; Terraform's state management prevents the 'what did I deploy?' confusion in larger labs.",
  },
  {
    title: "Structured logging from day one vs. adding later",
    date: "December 2025",
    context:
      "Starting a new platform project with limited initial traffic. Structured logging adds complexity and cost. The temptation was to start simple and add observability when 'needed.'",
    decision:
      "Invested in structured logging immediately. JSON-formatted logs with consistent field names, correlation IDs, and severity levels from the first deployment.",
    outcome:
      "The upfront investment paid off during the first unexpected issue. Having structured logs meant I could query specific request paths and error types without parsing unstructured text. The cost was minimal; the debugging time saved was significant.",
  },
  {
    title: "Monorepo vs. multi-repo for platform components",
    date: "November 2025",
    context:
      "Platform includes frontend, backend, infrastructure code, and automation scripts. Multi-repo offers cleaner separation; monorepo offers atomic changes and shared tooling.",
    decision:
      "Monorepo with strict directory boundaries. Shared types are explicitly exported. CI/CD detects which components changed and builds only those.",
    outcome:
      "Atomic commits across frontend and backend have been valuable for coordinated changes. The build system complexity was worth it—deploys that would require coordinating multiple PRs now happen in one commit.",
  },
  {
    title: "What broke: DNS resolution in hub-spoke topology",
    date: "October 2025",
    context:
      "Lab environment with hub-spoke networking and Private DNS Zones. Workloads in spoke VNets couldn't resolve private endpoints in other spokes, despite correct zone links.",
    decision:
      "After troubleshooting, discovered the issue was DNS forwarder configuration in the hub. Added a Private DNS Resolver in the hub and configured spoke VNets to use it as custom DNS.",
    outcome:
      "Documented the resolution flow and added it to the lab's README. The pattern is now part of my standard hub-spoke template. What felt like a bug was actually a gap in my understanding of Azure DNS resolution order.",
  },
];

export default function Decisions() {
  return (
    <section className="container py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Decision Log
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Key technical decisions, the reasoning behind them, and what I learned.
        </p>
      </motion.div>

      <StaggerContainer className="mt-16 space-y-12" staggerDelay={0.1}>
        {decisions.map((decision) => (
          <StaggerItem key={decision.title}>
            <article className="border-l-2 border-border pl-6 space-y-4 hover:border-accent/50 transition-colors">
              <div>
                <time className="text-sm text-muted-foreground">
                  {decision.date}
                </time>
                <h2 className="mt-2 text-xl font-medium tracking-tight text-foreground">
                  {decision.title}
                </h2>
              </div>

              <div className="space-y-3 text-foreground/90 leading-relaxed">
                <div>
                  <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Context
                  </span>
                  <p className="mt-1">{decision.context}</p>
                </div>

                <div>
                  <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Decision
                  </span>
                  <p className="mt-1">{decision.decision}</p>
                </div>

                {decision.outcome && (
                  <div>
                    <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Outcome
                    </span>
                    <p className="mt-1">{decision.outcome}</p>
                  </div>
                )}
              </div>
            </article>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
