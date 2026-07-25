import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// junta classes condicionais + resolve conflitos do Tailwind (padrão shadcn)
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
