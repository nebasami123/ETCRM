import type { SVGProps } from "react";

interface LogoProps extends SVGProps<SVGSVGElement> {
  showText?: boolean;
}

export function Logo({ showText = true, className = "", ...props }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Logomark */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="none"
        className="h-8 w-8 text-accent transition-transform duration-350 ease-out-smooth hover:rotate-6"
        {...props}
      >
        {/* Hexagon Shield Background */}
        <path
          d="M16 2L28 8.5v15L16 30 4 23.5v-15L16 2z"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* stylized E and T shapes in the center */}
        <path
          d="M11 10h10M11 16h8M11 22h10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M16 10v12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Logotype */}
      {showText && (
        <span className="font-sans text-xl font-bold tracking-tight text-foreground transition-colors duration-300">
          ET<span className="text-accent">CRM</span>
        </span>
      )}
    </div>
  );
}

export function Logomark(props: SVGProps<SVGSVGElement>) {
  return <Logo showText={false} {...props} />;
}
