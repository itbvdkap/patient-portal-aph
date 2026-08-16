import { redirect } from "next/navigation";

export default function VisitNotFound() {
  redirect("/visits");
}
