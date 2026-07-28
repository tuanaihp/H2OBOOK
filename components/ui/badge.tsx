import { cn } from "@/lib/utils";
export function Badge({children,tone="neutral"}:{children:React.ReactNode;tone?:"success"|"warning"|"neutral"|"purple"|"danger"}) { return <span className={cn("badge",`badge-${tone}`)}>{children}</span>; }
