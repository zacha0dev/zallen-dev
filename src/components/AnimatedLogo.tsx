import { motion } from "framer-motion";
import { NavLink } from "@/components/NavLink";

interface AnimatedLogoProps {
  animate?: boolean;
}

export function AnimatedLogo({ animate = true }: AnimatedLogoProps) {
  const bracketVariants = {
    hidden: { opacity: 0, x: -4 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: "easeOut" as const }
    },
  };

  const bracketRightVariants = {
    hidden: { opacity: 0, x: 4 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: "easeOut" as const, delay: 0.1 }
    },
  };

  const textVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.4, delay: 0.2 }
    },
  };

  if (!animate) {
    return (
      <NavLink
        to="/"
        className="group flex items-center gap-0.5 text-foreground hover:text-accent transition-colors"
      >
        <span className="text-muted-foreground group-hover:text-accent transition-colors">[</span>
        <span className="text-sm font-medium tracking-tight px-1">ZA</span>
        <span className="text-muted-foreground group-hover:text-accent transition-colors">]</span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/"
      className="group flex items-center gap-0.5 text-foreground hover:text-accent transition-colors"
    >
      <motion.span
        className="text-muted-foreground group-hover:text-accent transition-colors"
        variants={bracketVariants}
        initial="hidden"
        animate="visible"
      >
        [
      </motion.span>
      <motion.span
        className="text-sm font-medium tracking-tight px-1"
        variants={textVariants}
        initial="hidden"
        animate="visible"
      >
        ZA
      </motion.span>
      <motion.span
        className="text-muted-foreground group-hover:text-accent transition-colors"
        variants={bracketRightVariants}
        initial="hidden"
        animate="visible"
      >
        ]
      </motion.span>
    </NavLink>
  );
}
