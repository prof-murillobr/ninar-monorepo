import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ninar — cuidado atento para cada momento",
    short_name: "Ninar",
    description:
      "Grave um chorinho e veja hipóteses de cuidado com percentuais de confiança.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8f5",
    theme_color: "#fff8f5",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
