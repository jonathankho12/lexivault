import { createSocialCardImage } from "@/lib/ogCard";

export const alt =
  "LexiVault — Master English & IELTS Fluency from A1 to C2 with adaptive A1–C2 vocabulary, 4-skill IELTS training, and real-time grammar feedback";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function TwitterImage() {
  return createSocialCardImage();
}
