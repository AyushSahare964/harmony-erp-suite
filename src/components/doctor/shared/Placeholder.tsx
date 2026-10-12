import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** Temporary page for screens that come in a later build step. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <section className="vd-placeholder" aria-label={title}>
      <h2>{title}</h2>
      <p>{note}</p>
      <Link to="/" className="vd-pill-btn">
        <ArrowLeft strokeWidth={1.8} aria-hidden="true" /> Home
      </Link>
    </section>
  );
}
