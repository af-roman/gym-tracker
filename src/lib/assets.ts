/** Resolve public asset paths for GitHub Pages subpath deploys. */
export function assetUrl(path: string): string {
  if (path.startsWith('data:') || path.startsWith('http')) return path
  const clean = path.replace(/^\//, '')
  return `${import.meta.env.BASE_URL}${clean}`
}
