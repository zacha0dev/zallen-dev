import { FadeIn } from "@/components/FadeIn";

export default function HowIWork() {
  return (
    <section className="container py-16">
      <FadeIn>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          How I Work
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          My approach to engineering problems, from ambiguity to production.
        </p>
      </FadeIn>

      <div className="mt-16 space-y-16">
        <FadeIn delay={100}>
          <article className="space-y-4">
            <h2 className="text-2xl font-medium tracking-tight text-foreground">
              Approaching Ambiguous Problems
            </h2>
            <div className="text-foreground/90 leading-relaxed space-y-4">
              <p>
                Most interesting problems don't arrive with clear requirements. 
                When facing ambiguity, I start by identifying what constraints 
                are actually fixed versus what's assumed. Often, the problem 
                definition itself is the first thing worth challenging.
              </p>
              <p>
                I work to understand the problem space before proposing solutions. 
                This means asking uncomfortable questions early: What are we 
                actually trying to achieve? What happens if we do nothing? Who 
                will maintain this in two years?
              </p>
              <p>
                The goal isn't to eliminate uncertainty—that's usually impossible—but 
                to identify which uncertainties matter most and reduce those first.
              </p>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={200}>
          <article className="space-y-4">
            <h2 className="text-2xl font-medium tracking-tight text-foreground">
              Testing Ideas
            </h2>
            <div className="text-foreground/90 leading-relaxed space-y-4">
              <p>
                I prefer validating assumptions through small, reversible experiments 
                rather than extensive upfront design. Build the smallest thing that 
                could prove or disprove the hypothesis, then iterate.
              </p>
              <p>
                This doesn't mean moving fast and breaking things. It means 
                identifying the riskiest assumption and testing it first, before 
                investing in the full implementation. Fail fast, but fail deliberately.
              </p>
              <p>
                Documentation happens during experimentation, not after. Notes 
                capture not just what worked, but what didn't and why. These 
                decision logs become valuable context for future work.
              </p>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={300}>
          <article className="space-y-4">
            <h2 className="text-2xl font-medium tracking-tight text-foreground">
              Balancing Speed and Correctness
            </h2>
            <div className="text-foreground/90 leading-relaxed space-y-4">
              <p>
                Speed and correctness aren't always in tension—often, moving 
                carefully is faster than cleaning up mistakes. But when they do 
                conflict, context determines the balance.
              </p>
              <p>
                For exploratory work and prototypes, I optimize for learning 
                velocity. For production systems and shared infrastructure, 
                I invest more in getting it right the first time. The cost of 
                mistakes scales with the blast radius.
              </p>
              <p>
                I'm skeptical of "we'll fix it later" without a concrete plan. 
                Technical debt is real, but so is the interest. If something 
                needs to be temporary, I make that explicit and schedule the cleanup.
              </p>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={400}>
          <article className="space-y-4">
            <h2 className="text-2xl font-medium tracking-tight text-foreground">
              Working With Teams
            </h2>
            <div className="text-foreground/90 leading-relaxed space-y-4">
              <p>
                I believe the best engineering happens when people with different 
                perspectives can disagree constructively. I try to make my reasoning 
                visible so others can challenge it, and I actively seek out 
                viewpoints that might invalidate my assumptions.
              </p>
              <p>
                Written communication matters. I document decisions, share context 
                proactively, and invest in making complex ideas accessible. The 
                best solution fails if no one understands it well enough to maintain it.
              </p>
              <p>
                I'm most effective when I understand not just what to build, but 
                why it matters. Context about business constraints, user needs, 
                and organizational dynamics helps me make better technical tradeoffs.
              </p>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={500}>
          <article className="space-y-4">
            <h2 className="text-2xl font-medium tracking-tight text-foreground">
              Continuous Improvement
            </h2>
            <div className="text-foreground/90 leading-relaxed space-y-4">
              <p>
                I treat my own practices as systems to be refined. When something 
                goes wrong, I look for process improvements rather than just 
                fixing the immediate issue. When something goes well, I try to 
                understand what made it work so I can apply it elsewhere.
              </p>
              <p>
                Learning happens best through deliberate practice with real 
                constraints. That's why I maintain personal projects and lab 
                environments—not as hobbies, but as controlled spaces to develop 
                and validate new skills before they're needed in production.
              </p>
            </div>
          </article>
        </FadeIn>
      </div>
    </section>
  );
}
