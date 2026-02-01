import { FadeIn } from "@/components/FadeIn";

export default function Home() {
  return (
    <section className="container flex min-h-[calc(100vh-5rem)] flex-col justify-center">
      <FadeIn>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          Zachary Allen
        </h1>
      </FadeIn>

      <FadeIn delay={100}>
        <p className="mt-4 text-xl text-muted-foreground sm:text-2xl">
          Cloud & Platform Engineer
          <span className="hidden sm:inline"> (Solutions-Focused)</span>
        </p>
      </FadeIn>

      <FadeIn delay={200}>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          I design and operate production systems that other teams build on. My work 
          focuses on cloud foundations, platform workflows, and architectures that 
          scale cleanly while remaining stable under pressure.
        </p>
      </FadeIn>
    </section>
  );
}
