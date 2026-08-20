import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AuthForm from "@/components/AuthForm";
import StageArt from "@/components/StageArt";
import Showcase from "@/components/Showcase";

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
            Grow a garden of eight species, each wanting something different —
            and climb a weekly league against gardeners on your own clock.
          </p>
          <ul className="feature-list">
            <li>🌿 8 species, each with its own daily schedule</li>
            <li>💧 One water per day — the server keeps time, no cheating</li>
            <li>🏆 A weekly league of gardeners on your clock</li>
            <li>🌸 Bloom, harvest, and grow something harder</li>
          </ul>
        </div>
        <div className="hero-auth">
          <AuthForm />
        </div>
      </section>

      <Showcase />

      <footer className="landing-footer">
        made with 💚 · everything drawn with code, no assets harmed
      </footer>
    </main>
  );
}
