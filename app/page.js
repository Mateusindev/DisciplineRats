import { redirect } from "next/navigation";
import { HOME_ROUTE } from "@/lib/state";

export default function Home() {
  redirect(HOME_ROUTE);
}
