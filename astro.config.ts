import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import rehypeCallouts from "rehype-callouts";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import config from "./astro-paper.config";
import { unified } from "@astrojs/markdown-remark";

// https://astro.build/config
export default defineConfig({
  site: config.site.url,
  output: "static",
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },

  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        !/\/prototypes\/.+\/\d+\/?$/.test(page) &&
        (config.features?.showArchives !== false ||
          !/\/archives\/?$/.test(page)),
    }),
  ],

  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts],
    }),
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  image: {
    responsiveStyles: true,
    layout: "constrained",
  },

  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
  ],

  experimental: { svgOptimizer: svgoOptimizer() },

  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
});
