/** Parse common YouTube URL formats into a canonical watch URL. */
export function parseYoutubeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    )
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0]
      return id ? `https://www.youtube.com/watch?v=${id}` : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v')
        return id ? `https://www.youtube.com/watch?v=${id}` : null
      }
      const embedMatch = url.pathname.match(/^\/embed\/([^/?]+)/)
      if (embedMatch) {
        return `https://www.youtube.com/watch?v=${embedMatch[1]}`
      }
      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?]+)/)
      if (shortsMatch) {
        return `https://www.youtube.com/watch?v=${shortsMatch[1]}`
      }
    }
  } catch {
    return null
  }

  return null
}
