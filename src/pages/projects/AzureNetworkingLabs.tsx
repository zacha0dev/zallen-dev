import { FadeIn } from "@/components/FadeIn";
import { NavLink } from "@/components/NavLink";
import { ArrowLeft } from "lucide-react";

export default function AzureNetworkingLabsArchitecture() {
  return (
    <section className="container py-16">
      <FadeIn>
        <NavLink
          to="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </NavLink>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Azure Networking Labs
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Architecture Notes
        </p>
      </FadeIn>

      <div className="mt-16 space-y-12">
        <FadeIn delay={100}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Problem Constraints
            </h2>
            <div className="text-foreground/90 leading-relaxed space-y-3">
              <p>
                Enterprise networking patterns are difficult to learn without access 
                to production environments. Documentation describes concepts, but 
                understanding traffic flows, DNS resolution chains, and routing 
                behaviors requires hands-on experimentation.
              </p>
              <p>
                The challenge: build reproducible lab environments that mirror 
                enterprise complexity without enterprise budgets, and do it in a 
                way that validates real-world patterns rather than simplified examples.
              </p>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={200}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Key Design Decisions
            </h2>
            <ul className="space-y-4 text-foreground/90 leading-relaxed">
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Ephemeral by design.</strong>{" "}
                Labs are meant to be destroyed and recreated. This forces complete 
                automation and prevents configuration drift. A lab that can't be 
                rebuilt from scratch has failed its primary purpose.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Realistic topologies.</strong>{" "}
                Hub-spoke networks, multi-region connectivity, and hybrid DNS scenarios. 
                Simplified "hello world" networks don't surface the edge cases that 
                matter in production.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Observability built in.</strong>{" "}
                Every lab includes logging, flow visualization, and DNS query tracing. 
                Understanding what's happening matters more than just making it work.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Cost boundaries enforced.</strong>{" "}
                Auto-shutdown schedules, resource tagging for cost tracking, and alerts 
                on spend thresholds. Learning shouldn't require unexpected invoices.
              </li>
            </ul>
          </article>
        </FadeIn>

        <FadeIn delay={300}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Tradeoffs Considered
            </h2>
            <div className="space-y-4 text-foreground/90 leading-relaxed">
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">Terraform vs. Bicep for Azure-only</p>
                <p className="mt-1">
                  Used both intentionally. Terraform for complex multi-resource labs 
                  (better state management), Bicep for quick single-purpose experiments 
                  (faster iteration). Context determines the tool.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">Virtual WAN vs. Traditional Hub-Spoke</p>
                <p className="mt-1">
                  Built labs for both patterns. Virtual WAN simplifies management but 
                  obscures routing mechanics. Traditional hub-spoke requires more 
                  configuration but teaches deeper routing fundamentals.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">Private DNS Zones vs. Custom DNS VMs</p>
                <p className="mt-1">
                  Azure Private DNS Zones for most scenarios (simpler, cheaper), but 
                  custom DNS VMs for testing conditional forwarding and hybrid scenarios 
                  that require BIND or Windows DNS behavior.
                </p>
              </div>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={400}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              What I'd Change Next
            </h2>
            <ul className="space-y-3 text-foreground/90 leading-relaxed">
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Add Azure Firewall labs with policy management and traffic inspection 
                  to complete the security layer understanding.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Build ExpressRoute simulation using VPN Gateway with BGP to practice 
                  hybrid connectivity patterns without circuit costs.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Create automated test suites that validate connectivity after each 
                  lab deployment, ensuring infrastructure code stays correct.
                </span>
              </li>
            </ul>
          </article>
        </FadeIn>

        <FadeIn delay={500}>
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-medium tracking-tight text-foreground mb-6">
              Current System Snapshot
            </h2>
            <div className="bg-card border border-border rounded-lg p-6 font-mono text-sm text-foreground/80 overflow-x-auto">
              <pre>{`                    ┌─────────────────────────────────┐
                    │         On-Premises Sim         │
                    │     (VPN Gateway + DNS VM)      │
                    └─────────────────────────────────┘
                                    │
                                    │ Site-to-Site VPN
                                    │
                    ┌─────────────────────────────────┐
                    │           Hub VNet              │
                    │    ┌─────────────────────┐      │
                    │    │   Azure Firewall    │      │
                    │    │   (or NVA)          │      │
                    │    └─────────────────────┘      │
                    │    ┌─────────────────────┐      │
                    │    │   Private DNS       │      │
                    │    │   Resolver          │      │
                    │    └─────────────────────┘      │
                    └─────────────────────────────────┘
                         │                     │
            ┌────────────┘                     └────────────┐
            │ Peering                               Peering │
            ▼                                               ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│      Spoke VNet 1       │               │      Spoke VNet 2       │
│    ┌─────────────┐      │               │    ┌─────────────┐      │
│    │  Workload   │      │               │    │  Workload   │      │
│    │  Subnet     │      │               │    │  Subnet     │      │
│    └─────────────┘      │               │    └─────────────┘      │
│    ┌─────────────┐      │               │    ┌─────────────┐      │
│    │  Private    │      │               │    │  App        │      │
│    │  Endpoint   │      │               │    │  Gateway    │      │
│    └─────────────┘      │               │    └─────────────┘      │
└─────────────────────────┘               └─────────────────────────┘`}</pre>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
