import { YouTubeTranscriptApi } from "@hallelx/youtube-transcript";

const api = new YouTubeTranscriptApi();
const videoId = "9iS-YYLIXiw";

console.log("Fetching transcript for:", videoId);
try {
  const t = await api.fetch(videoId, { languages: ["en"] });
  console.log("✅ Success! Segments:", t.snippets.length);
  console.log("First 3:", JSON.stringify(t.snippets.slice(0, 3), null, 2));
  console.log("Language:", t.language, `(${t.languageCode})`, "| Auto:", t.isGenerated);
} catch (e) {
  console.error("❌ Failed:", e instanceof Error ? e.message : String(e));
}
