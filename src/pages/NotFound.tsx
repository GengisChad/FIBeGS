import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: rotta inesistente:", location.pathname);
  }, [location.pathname]);

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ background: "var(--gradient-hero)" }}
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-primary">
        Fuori arena
      </p>
      <h1 className="ibnf-glow-text mb-1 text-[clamp(5.5rem,24vw,9rem)] leading-none text-foreground">
        404
      </h1>
      <h2 className="mb-4 max-w-md text-2xl tracking-wide text-foreground">
        Questo Bey è uscito dallo stadio
      </h2>
      <p className="mx-auto mb-8 max-w-sm text-base text-muted-foreground">
        La pagina che cerchi non esiste o è stata spostata. Torna in pista e
        riprendi la sfida.
      </p>
      <div className="flex w-full max-w-sm flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <Link
          to="/"
          className="fib-cta-glow press-spring inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold uppercase tracking-wide text-primary-foreground sm:w-auto"
        >
          Torna alla Home
        </Link>
        <Link
          to="/tournaments"
          className="press-spring inline-flex w-full items-center justify-center rounded-xl border border-border px-6 py-3 font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-secondary sm:w-auto"
        >
          Vedi i tornei
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
