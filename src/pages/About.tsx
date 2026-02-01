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
            I'm a cloud and platform engineer focused on Azure networking, 
            infrastructure automation, and the systems that enable engineering 
            teams to ship reliably. My work emphasizes end-to-end ownership—from 
            network architecture to deployment pipelines.
          </p>
          <p>
            I stay sharp by building. Practice environments, networking labs, 
            and internal tooling keep my hands in real infrastructure while 
            exploring patterns that scale. Curiosity drives the work; iteration 
            refines the judgment.
          </p>
          <p>
            Systems thinking shapes how I approach problems—understanding 
            dependencies, anticipating failure modes, and designing for 
            operational clarity. The best platform work disappears into the 
            background, enabling others to move faster without thinking about it.
          </p>
        </div>
      </FadeIn>
    </section>
  );
}
