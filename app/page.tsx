import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AuthForm from "@/components/AuthForm";
import StageArt from "@/components/StageArt";

export default async function LandingPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/garden");

  return (
    <main className="landing">
      <div className="landing-clouds" aria-hidden>
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
      </div>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-art" aria-hidden>
            <div className="hero-pond">
              <StageArt stage={6} size={150} />
            </div>
          </div>
          <h1>
            Lily <span className="accent">Days</span>
          </h1>
          <p className="tagline">
            A tiny pond. A sleepy seed. One watering a day.
            <br />
            Come back every day and grow a water lily from seed to full bloom —
            miss a day and it will droop and wait for you.
          </p>
          <ul className="feature-list">
            <li>🌱 7 growth stages over 7 real days of care</li>
            <li>💧 One water per day — the server keeps time, no cheating!</li>
            <li>📖 A journal of every stage you unlock</li>
            <li>🌸 Bloom, celebrate, replant, repeat</li>
          </ul>
        </div>
        <div className="hero-auth">
          <AuthForm />
        </div>
      </section>

      <footer className="landing-footer">
        made with 💚 · everything drawn with code, no assets harmed
      </footer>
    </main>
  );
}
