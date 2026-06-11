import fibegsLogo from "@/assets/brand/fibegs-logo-ice.png";
import { Play, Video, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { HomeEditableText } from "@/components/home/HomeEditableText";
import HomeNavCards from "@/components/HomeNavCards";

const NATIONAL_VIDEO_IDS: Record<2024 | 2025, string> = {
  2024: "m5zQgw52nFw",
  2025: "m5zQgw52nFw",
};

export const HeroSection = () => {
  const [videoOpen, setVideoOpen] = useState(false);
  const [selectedVideoYear, setSelectedVideoYear] = useState<2024 | 2025>(2025);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoId = NATIONAL_VIDEO_IDS[selectedVideoYear];

  useEffect(() => {
    setVideoLoaded(false);
  }, [selectedVideoYear]);

  return (
    <section id="home" className="ibnf-hero">
      <div className="ibnf-hero-aurora" aria-hidden="true" />

      {/* Centred emblem */}
      <div className="ibnf-hero-orbit">
        <div className="ibnf-hero-logoglow" aria-hidden="true" />
        <img className="ibnf-hero-logo" src={fibegsLogo} alt="FIBeGS" />
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
        <HomeNavCards />

        <div className="ibnf-hero-cta">
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
                defaultText="Nazionale FIBeGS"
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
                  alt={`FIBeGS — Nazionale ${selectedVideoYear}`}
                  loading="lazy"
                />
                <span className="ibnf-video-play"><Play size={26} fill="currentColor" /></span>
              </button>
            ) : (
              <div className="ibnf-video-frame">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                  title={`FIBeGS — Nazionale ${selectedVideoYear}`}
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
