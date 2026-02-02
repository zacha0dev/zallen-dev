import { Github, Linkedin, FileText } from "lucide-react";

const socialLinks = [
  {
    href: "https://github.com/zacha0dev",
    label: "GitHub",
    icon: Github,
  },
  {
    href: "https://www.linkedin.com/in/zacharythomasallen/",
    label: "LinkedIn",
    icon: Linkedin,
  },
  {
    href: "/resume",
    label: "Resume",
    icon: FileText,
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="container py-12">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-8">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={link.label}
              >
                <link.icon className="h-5 w-5" />
              </a>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            © {currentYear}
          </p>
        </div>
      </div>
    </footer>
  );
}
