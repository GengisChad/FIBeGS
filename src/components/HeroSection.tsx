import { Link } from "react-router-dom";
import fibegsLogo from "@/assets/brand/fibegs-logo-ice.png";
import { Play, Zap, Trophy, Search, Shield, Video, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { HomeEditableText } from "@/components/home/HomeEditableText";

const NATIONAL_VIDEO_IDS: Record<2024 | 2025, string> = {
  2024: "m5zQgw52nFw",
  2025: "m5zQgw52nFw",
};

export const HeroSection = () => {
  const { user } = useAuth();

  const [videoOpen, setVideoOpen] = useState(false);
  const [selectedVideoYear, setSelectedVideoYear] = useState<2024 | 2025>(2025);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const videoId = NATIONAL_VIDEO_IDS[selectedVideoYear];

  useEffect(() => {
    if (!user) { setUserClubId(null); return; }
    supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setUserClubId(data?.club_id || null));
  }, [user]);

  useEffect(() => {
    setVideoLoaded(false);
  }, [selectedVideoYear]);

  const clubHref = userClubId ? `/clubs/${userClubId}` : "/clubs";

  return (
    <section id="home" className="ibnf-hero">
      <div className="ibnf-hero-aurora" aria-hidden="true" />

      {/* Centred emblem */}
      <div className="ibnf-hero-orbit">
        <div className="ibnf-hero-logoglow" aria-hidden="true" />
        <img className="ibnf-hero-logo" src={fibegsLogo} alt="IBNF" />
      </div>

      <div className="ibnf-hero-in">
        <span className="ibnf-chip ibnf-chip-violet ibnf-hero-chip">
          <span className="ibnf-dot-v" /> Stagione 2026 · LIVE
        </span>
        <HomeEditableText
          storageKey="hero-motto"
          defaultText="Accendi il bey. Scala l'Italia. Lascia il segno."
          as="h1"
          className="ibnf-display ibnf-hero-title ibnf-glow-text"
        />
        <HomeEditableText
          storageKey="hero-lead"
          defaultText="La federazione ufficiale dei Blader italiani: tornei, club, ranking BFL ed ELO in una sola arena competitiva."
          as="p"
          className="ibnf-lead ibnf-hero-lead"
          multiline
        />
        <div className="ibnf-hero-cta">
          <Link to="/tournaments" className="ibnf-btn ibnf-btn-primary ibnf-btn-lg">
            <Zap size={18} /> Iscriviti a un torneo
          </Link>
          <Link to="/rankings" className="ibnf-btn ibnf-btn-ghost ibnf-btn-lg">
            <Trophy size={18} /> Classifica Nazionale
          </Link>
          <Link to={clubHref} className="ibnf-btn ibnf-btn-ghost ibnf-btn-lg">
            {userClubId ? <><Shield size={18} /> Il tuo Club</> : <><Search size={18} /> Cerca un Club</>}
          </Link>
          <button
            type="button"
            onClick={() => setVideoOpen((v) => !v)}
            className={`ibnf-btn ibnf-btn-ghost ibnf-btn-lg ibnf-video-toggle${videoOpen ? " is-open" : ""}`}
            aria-expanded={videoOpen}
          >
            <Video size={18} /> Video Nazionale <ChevronDown size={16} />
          </button>
        </div>

        {videoOpen && (
          <div className="ibnf-hero-video ibnf-card">
            <div className="ibnf-video-head">
              <HomeEditableText
                storageKey="national-video-title"
                defaultText="Nazionale IBNF"
                as="h3"
                className="ibnf-video-title"
              />
              <div className="ibnf-year-switch" role="tablist" aria-label="Anno video nazionale">
                {([2024, 2025] as const).map((year) => (
                  <button
                    key={year}
                    type="button"
                    role="tab"
                    aria-selected={selectedVideoYear === year}
                    className={selectedVideoYear === year ? "is-active" : ""}
                    onClick={() => setSelectedVideoYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
            {!videoLoaded ? (
              <button
                onClick={() => setVideoLoaded(true)}
                className="ibnf-video-cover group"
              >
                <img
                  src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                  alt={`IBNF — Nazionale ${selectedVideoYear}`}
                  loading="lazy"
                />
                <span className="ibnf-video-play"><Play size={26} fill="currentColor" /></span>
              </button>
            ) : (
              <div className="ibnf-video-frame">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                  title={`IBNF — Nazionale ${selectedVideoYear}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
