import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // Capitalize path segments
  const formatSegment = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).replace("-", " ");
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm font-medium">
      <Link
        to="/"
        className="text-muted hover:text-foreground transition-colors duration-200"
      >
        Home
      </Link>
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;

        return (
          <div key={to} className="flex items-center gap-1.5">
            <ChevronRight className="h-4 w-4 text-muted/65 shrink-0" />
            {last ? (
              <span className="text-foreground font-semibold" aria-current="page">
                {formatSegment(value)}
              </span>
            ) : (
              <Link
                to={to}
                className="text-muted hover:text-foreground transition-colors duration-200"
              >
                {formatSegment(value)}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
