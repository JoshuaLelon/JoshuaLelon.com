export const SITE = {
  website: "https://joshualelon.com/", // replace this with your deployed domain
  author: "Joshua Lelon",
  profile: "https://joshualelon.com/",
  desc: "Software engineer passionate about education technology and machine learning. Writing about code, learning, and building products that help people grow.",
  title: "Joshua Lelon",
  ogImage: "og.png",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/joshualmitchell/JoshuaLelon.com/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "America/Chicago", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
