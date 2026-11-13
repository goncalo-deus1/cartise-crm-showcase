import { redirect } from "next/navigation";

/** The task list was removed: old links and bookmarks land on the pipeline. */
export default function TarefasPage() {
  redirect("/pipeline");
}
