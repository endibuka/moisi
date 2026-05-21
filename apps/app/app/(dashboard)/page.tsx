import { redirect } from "next/navigation";

// Default landing is Muse (the AI surface). Track Separation lives at /library.
export default function Home() {
  redirect("/muse");
}
