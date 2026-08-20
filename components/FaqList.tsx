import type { Faq } from "@/lib/guides";

/**
 * Plain <details> so the answers are in the HTML whether or not they are open —
 * collapsed text still counts, hidden-behind-JavaScript text does not.
 */
export default function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="faq-list">
      {items.map((f) => (
        <details key={f.q} className="faq-item">
          <summary>
            <h3>{f.q}</h3>
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}
