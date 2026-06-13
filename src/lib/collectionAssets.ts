import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";

export const COLLECTION_ASSETS_BUCKET = "collection-images";
export const COLLECTION_ASSETS_PROJECT_URL = "https://zhqxwcnnyqrlizlowtgd.supabase.co";

export const uploadCollectionImage = async (file: File, folder: "categories" | "components" | "variants") => {
  const preparedFile = await prepareImageForUpload(file, { maxDimension: 1024, preservePng: true });
  const ext = preparedFile.name.split(".").pop() || "webp";
  const filePath = `${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(COLLECTION_ASSETS_BUCKET)
    .upload(filePath, preparedFile, { upsert: true, contentType: preparedFile.type });

  if (error) throw error;

  const { data } = supabase.storage.from(COLLECTION_ASSETS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
};

export const uploadCollectionRemoteImage = async (
  imageUrl: string,
  folder: "categories" | "components" | "variants",
  fileNameSeed: string
) => {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Immagine non raggiungibile: ${response.status}`);

  const blob = await response.blob();
  const contentType = blob.type || response.headers.get("content-type") || "image/webp";
  const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";
  const safeSeed = fileNameSeed.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || `${Date.now()}`;
  const filePath = `${folder}/beytrackr/${safeSeed}.${extension}`;

  const { error } = await supabase.storage
    .from(COLLECTION_ASSETS_BUCKET)
    .upload(filePath, blob, { upsert: true, contentType });

  if (error) throw error;

  const { data } = supabase.storage.from(COLLECTION_ASSETS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
};
