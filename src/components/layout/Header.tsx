import { NavLink } from "@/components/NavLink";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/notes", label: "Notes" },
  { to: "/about", label: "About" },
  { to: "/resume", label: "Resume" },
];

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
      <nav className="container flex items-center justify-between py-6">
        <NavLink
          to="/"
          className="text-lg font-medium tracking-tight text-foreground hover:text-accent transition-colors"
        >
          ZA
        </NavLink>

        <ul className="flex items-center gap-8">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                activeClassName="text-foreground"
                end={item.to === "/"}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
