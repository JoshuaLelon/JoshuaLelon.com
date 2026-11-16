import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://joshualelon.com/",
    title: "Joshua Lelon",
    description:
      "Software engineer passionate about education technology and machine learning. Writing about code, learning, and building products that help people grow.",
    author: "Joshua Lelon",
    profile: "https://joshualelon.com/",
    ogImage: "og.png",
    lang: "en",
    timezone: "America/Chicago",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: false,
    },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/joshualelon" },
    { name: "x", url: "https://x.com/joshualelon" },
    { name: "linkedin", url: "https://www.linkedin.com/in/joshualelon/" },
    { name: "mail", url: "mailto:jlelonmitchell@gmail.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
