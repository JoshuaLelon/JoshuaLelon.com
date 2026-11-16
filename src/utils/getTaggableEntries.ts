import { getCollection, type CollectionEntry } from "astro:content";
import { getSortedPosts } from "./getSortedPosts";

export type TaggableEntry =
  CollectionEntry<"posts"> | CollectionEntry<"prototypes">;

/** Posts keep their date order; prototypes keep their curated order. */
export async function getTaggableEntries(): Promise<TaggableEntry[]> {
  const [posts, prototypes] = await Promise.all([
    getCollection("posts"),
    getCollection("prototypes", ({ data }) => !data.draft),
  ]);
  return [
    ...getSortedPosts(posts),
    ...prototypes.sort(
      (a, b) =>
        a.data.order - b.data.order || a.data.title.localeCompare(b.data.title)
    ),
  ];
}
