import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Card({ children, className, style }: CardProps) {
  return <div className={["crm-card", className].filter(Boolean).join(" ")} style={style}>{children}</div>;
}

