import { FadeIn } from "@/components/FadeIn";
import { FileText } from "lucide-react";

export default function Resume() {
  return (
    <section className="container py-16">
      <FadeIn>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Resume
        </h1>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="mt-12 max-w-2xl">
          <p className="text-lg leading-relaxed text-foreground/90">
            Cloud and platform engineer with depth in Azure networking, 
            infrastructure automation, and systems design. Focused on building 
            foundations that scale cleanly and remain stable under pressure.
          </p>

          <a
            href="/resume.pdf"
            download
            className="mt-8 inline-flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-4 text-foreground transition-all hover:border-accent/50 hover:translate-y-[-2px]"
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Download Resume</p>
              <p className="text-sm text-muted-foreground">PDF</p>
            </div>
          </a>
        </div>
      </FadeIn>
    </section>
  );
}
