/**
 * Get the full path of a blog post.
 *
 * The local Markdown loader supplies each filename as the entry id.
 * Preserve that slug at `/posts/<slug>` independently of the post title.
 *
 * @param id - id of the blog post (aka slug)
 * @param includeBase - whether to include `/posts` in return value
 * @returns blog post path
 */
export function getPath(id: string, includeBase = true) {
  const basePath = includeBase ? "/posts" : "";
  // Guard against an id that somehow carries a directory: keep the last segment.
  const slug = id.split("/").slice(-1);
  return [basePath, slug].join("/");
}
