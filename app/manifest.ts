import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "당신의 입장 | Your Reader",
    short_name: "Your Reader",
    description: "생각과 마음을 기록하고 공감 어린 답장을 받는 글쓰기 공간",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#30473a",
    orientation: "portrait-primary",
    lang: "ko",
    categories: ["lifestyle", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
