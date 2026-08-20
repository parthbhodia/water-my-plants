import Link from "next/link";
import { SPECIES, PLOT_LABEL } from "@/lib/species";
import { GUIDE_BY_KEY } from "@/lib/guides";

const hour = (n: number) => `${String(n).padStart(2, "0")}:00`;

/**
 * The care contract for all eight species as a real HTML table. This is the
 * page's densest block of long-tail text — "how often to water the ghost
 * orchid" is a query, and this is the answer.
 */
export default function PlantTable() {
  return (
    <div className="table-scroll">
      <table className="plant-table">
        <caption className="sr-only">
          Watering schedule, plot type and extra care for every plant in Lily Days
        </caption>
        <thead>
          <tr>
            <th scope="col">Plant</th>
            <th scope="col">Water</th>
            <th scope="col">Time window</th>
            <th scope="col">Plot</th>
            <th scope="col">Extra care</th>
            <th scope="col">Days to bloom</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {SPECIES.map((s) => {
            const extras: string[] = [];
            if (s.feedsRequired) extras.push(`Feed ×${s.feedsRequired}`);
            if (s.prunesRequired) extras.push(`Prune ×${s.prunesRequired}`);
            if (s.overwaterable) extras.push("Rots if watered early");
            return (
              <tr key={s.key}>
                <th scope="row">
                  <Link href={`/plants/${s.key}`}>{s.name}</Link>
                  <span className="pt-diff">{GUIDE_BY_KEY[s.key]?.difficulty}</span>
                </th>
                <td>{s.cadenceDays === 1 ? "Every day" : `Every ${s.cadenceDays} days`}</td>
                <td>
                  {s.windowStart === null
                    ? "Any hour"
                    : `${hour(s.windowStart)}–${hour(s.windowEnd ?? 0)}`}
                </td>
                <td>{PLOT_LABEL[s.needsPlot]}</td>
                <td>{extras.length ? extras.join(" · ") : "None"}</td>
                <td>{s.maturesDays}</td>
                <td>{s.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
