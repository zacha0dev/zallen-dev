import { FadeIn } from "@/components/FadeIn";

interface Note {
  title: string;
  date: string;
  content: string;
}

const notes: Note[] = [
  {
    title: "Designing systems before users exist",
    date: "January 2026",
    content:
      "Building platform foundations without immediate user pressure creates space for architectural clarity. The tradeoff is real: without feedback loops, it's easy to over-engineer or optimize for the wrong constraints. But there's value in treating early systems as deliberate practice—making decisions, observing consequences, and refining judgment through iteration. The goal isn't perfection before launch; it's developing the instincts to recognize good structure when it matters.",
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
          Reflections on architectural decisions, system tradeoffs, 
          and the practice of building reliable infrastructure.
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
