import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  attachment: string;
}

/**
 * Resolves a feedback attachment to a signed URL.
 * Supports both new-style storage paths ("user_id/file.jpg") and
 * legacy full public URLs (kept for backward compatibility).
 */
export const FeedbackAttachment = ({ attachment }: Props) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      // Legacy: already a full URL
      if (/^https?:\/\//i.test(attachment)) {
        setUrl(attachment);
        return;
      }
      const { data, error } = await supabase.storage
        .from("feedback-attachments")
        .createSignedUrl(attachment, 60 * 60); // 1h
      if (!cancelled) {
        if (error || !data) setUrl(null);
        else setUrl(data.signedUrl);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [attachment]);

  if (!url) {
    return (
      <div className="w-full h-32 rounded-lg border border-border bg-background animate-pulse" />
    );
  }

  return (
    <>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt="Allegato"
          className="w-full max-h-[200px] object-contain rounded-lg border border-border bg-background cursor-pointer hover:opacity-80 transition-opacity"
        />
      </a>
      <p className="text-xs text-muted-foreground">Clicca per aprire a piena risoluzione</p>
    </>
  );
};
