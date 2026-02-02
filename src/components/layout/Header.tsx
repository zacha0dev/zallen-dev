import { useState } from "react";
import { motion } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Home", number: "01" },
  { to: "/projects", label: "Projects", number: "02" },
  { to: "/notes", label: "Notes", number: "03" },
  { to: "/how-i-work", label: "How I Work", number: "04" },
  { to: "/about", label: "About", number: "05" },
  { to: "/resume", label: "Resume", number: "06" },
];

const navItemVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.3 + i * 0.05,
      duration: 0.4,
      ease: "easeOut" as const,
    },
  }),
};

const mobileItemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: "easeOut" as const,
    },
  }),
};

export function Header() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
      <nav className="container flex items-center justify-between py-6">
        <AnimatedLogo />

        {/* Desktop Navigation */}
        {!isMobile && (
          <ul className="flex items-center gap-8">
            {navItems.map((item, i) => (
              <motion.li
                key={item.to}
                custom={i}
                variants={navItemVariants}
                initial="hidden"
                animate="visible"
              >
                <NavLink
                  to={item.to}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full"
                  activeClassName="text-foreground after:w-full"
                  end={item.to === "/"}
                >
                  {item.label}
                </NavLink>
              </motion.li>
            ))}
          </ul>
        )}

        {/* Mobile Navigation */}
        {isMobile && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative z-50">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full h-full border-none bg-background p-0 flex flex-col [&>button]:hidden"
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              
              {/* Header inside sheet */}
              <div className="flex items-center justify-between p-6">
                <span className="flex items-center gap-0.5 text-foreground">
                  <span className="text-muted-foreground">[</span>
                  <span className="text-sm font-medium tracking-tight px-1">ZA</span>
                  <span className="text-muted-foreground">]</span>
                </span>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close menu</span>
                  </Button>
                </SheetClose>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 flex flex-col justify-center px-8">
                <ul className="space-y-2">
                  {navItems.map((item, index) => (
                    <motion.li
                      key={item.to}
                      className="overflow-hidden"
                      custom={index}
                      variants={mobileItemVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <SheetClose asChild>
                        <NavLink
                          to={item.to}
                          className="group flex items-center gap-6 py-4 text-muted-foreground hover:text-foreground transition-all duration-300"
                          activeClassName="text-foreground"
                          end={item.to === "/"}
                        >
                          <span className="text-xs font-mono text-accent/60 group-hover:text-accent transition-colors">
                            {item.number}
                          </span>
                          <span className="text-3xl font-light tracking-tight group-hover:translate-x-2 transition-transform duration-300">
                            {item.label}
                          </span>
                          <span className="flex-1 h-px bg-border/30 group-hover:bg-accent/50 transition-colors duration-300" />
                        </NavLink>
                      </SheetClose>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-mono">
                  Cloud & Platform Engineer
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  zallen.dev
                </p>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </nav>
    </header>
  );
}
