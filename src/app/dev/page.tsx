import { redirect } from "next/navigation";

export default function DevelopmentToolsPage() {
  redirect("/dev/role-switcher");
}
