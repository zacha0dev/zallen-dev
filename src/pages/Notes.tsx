import { FadeIn } from "@/components/FadeIn";

interface Note {
  title: string;
  date: string;
  content: string;
}

const notes: Note[] = [
  {
    title: "On Platform Team Incentives",
    date: "January 2026",
    content:
      "Platform teams succeed when they measure adoption, not just uptime. The best infrastructure work is invisible—teams use it without thinking about it. This requires treating internal developers as customers, not captive users. We started tracking 'time to first deployment' for new engineers and saw more meaningful improvements than any SLA dashboard could show.",
  },
  {
    title: "Why We Chose Cilium Over Istio",
    date: "November 2025",
    content:
      "The decision came down to operational complexity. Istio's feature set was impressive, but our team of three couldn't sustain the maintenance burden. Cilium's eBPF foundation meant fewer moving parts and better performance at our scale. Sometimes the right choice is the one you can actually operate.",
  },
  {
    title: "Lessons from a Production Incident",
    date: "September 2025",
    content:
      "A cascading failure taught us that circuit breakers without proper timeout coordination create worse outcomes than no circuit breakers at all. We spent two weeks redesigning our retry and backoff strategies across 40 services. The documentation we wrote became the most-read page in our internal wiki.",
  },
];

export default function Notes() {
  return (
    <section className="container py-16">
      <FadeIn>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Notes
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Brief reflections on architecture decisions, operational lessons, 
          and the craft of building reliable systems.
        </p>
      </FadeIn>

      <div className="mt-16 space-y-12">
        {notes.map((note, index) => (
          <FadeIn key={note.title} delay={index * 100}>
            <article className="border-l-2 border-border pl-6">
              <time className="text-sm text-muted-foreground">{note.date}</time>
              <h2 className="mt-2 text-xl font-medium tracking-tight">
                {note.title}
              </h2>
              <p className="mt-4 text-foreground/90 leading-relaxed">
                {note.content}
              </p>
            </article>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
