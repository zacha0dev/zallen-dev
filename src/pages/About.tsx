import { FadeIn } from "@/components/FadeIn";

export default function About() {
  return (
    <section className="container py-16">
      <FadeIn>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          About
        </h1>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="mt-12 max-w-2xl space-y-6 text-lg leading-relaxed text-foreground/90">
          <p>
            I'm a platform engineer with eight years of experience building and 
            operating infrastructure at scale. My focus is on Kubernetes platforms, 
            developer tooling, and the systems that enable engineering organizations 
            to ship reliably.
          </p>
          <p>
            Previously, I led platform initiatives at companies ranging from 
            Series B startups to enterprise organizations. I care about reducing 
            operational burden, designing for failure, and creating systems that 
            teams can understand and maintain.
          </p>
          <p>
            I approach infrastructure as a product discipline—understanding user 
            needs, making deliberate tradeoffs, and measuring outcomes. The best 
            platform work disappears into the background, enabling others to move 
            faster without thinking about it.
          </p>
        </div>
      </FadeIn>
    </section>
  );
}
