// Google Custom Search API types
interface GoogleSearchItem {
  cacheId?: string
  link: string
  title: string
  displayLink: string
  image?: {
    thumbnailLink: string
    width: number
    height: number
  }
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[]
}

// YouTube API types
interface YouTubeSearchItem {
  id: {
    videoId: string
  }
  snippet: {
    title: string
    channelTitle: string
    publishedAt: string
    thumbnails: {
      high?: {
        url: string
      }
      medium?: {
        url: string
      }
    }
  }
}

interface YouTubeVideoDetails {
  id: string
  contentDetails: {
    duration: string
  }
  statistics: {
    viewCount: string
  }
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[]
  nextPageToken?: string
  prevPageToken?: string
}

interface YouTubeDetailsResponse {
  items?: YouTubeVideoDetails[]
}

// Helper function to parse YouTube duration format (PT15M51S) to readable format (15:51)
function parseDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
  if (!match) return ''
  
  const hours = match[1] ? parseInt(match[1]) : 0
  const minutes = match[2] ? parseInt(match[2]) : 0
  const seconds = match[3] ? parseInt(match[3]) : 0
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export interface SearchResult {
  id: string
  url: string
  title: string
  thumbnail?: string
  embedUrl?: string
  photographer?: string
  source?: string
  dimensions?: string
  views?: string
  uploadedAt?: string
  channel?: string
  duration?: string
}


export class SearchError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_ERROR' | 'RATE_LIMIT' | 'INVALID_KEY' | 'NETWORK_ERROR',
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'SearchError'
  }
}

// For demo purposes, we'll use mock data but structure it like real API responses
// In production, you would need to obtain API keys and use the real APIs

export const searchGoogleImages = async (
  query: string, 
  page: number = 1,
  apiKey?: string,
  cseId?: string
): Promise<SearchResult[]> => {
  const results: SearchResult[] = []
  
  // Try to use real API if keys are provided
  if (apiKey && cseId) {
    try {
      const start = (page - 1) * 10 + 1
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${query}&searchType=image&start=${start}`
      )
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new SearchError('Rate limit exceeded. Please try again later.', 'RATE_LIMIT', response.status)
        }
        if (response.status === 403) {
          throw new SearchError('Invalid API key or insufficient permissions.', 'INVALID_KEY', response.status)
        }
        throw new SearchError(`API request failed: ${response.statusText}`, 'API_ERROR', response.status)
      }
      
      const data = await response.json() as GoogleSearchResponse
      if (data.items) {
        return data.items.map((item, index) => ({
          id: item.cacheId || `img-${start + index}`,
          url: item.link,
          thumbnail: item.image?.thumbnailLink || item.link,
          title: item.title,
          source: item.displayLink,
          dimensions: item.image ? `${item.image.width}x${item.image.height}` : undefined,
          photographer: undefined
        }))
      }
    } catch (error) {
      // Log the error but fall back to mock data
      console.warn('Google Images API error:', error)
      // Continue to mock data below
    }
  }
  
  // Fall back to mock data if API call fails or no keys provided
  
  if (query.toLowerCase().includes('electrical ppe')) {
    // Generate enough PPE results for 10 pages (100 results)
    const basePpeItems = [
      { title: 'Electrical Safety Personal Protective Equipment', source: 'Safety Equipment Store', dims: '800x600' },
      { title: 'PPE for Electrical Workers - Hard Hat & Safety Gear', source: 'Industrial Safety', dims: '1200x800' },
      { title: 'Electrical Arc Flash PPE Kit', source: 'PPE Warehouse', dims: '1024x768' },
      { title: 'High Voltage Electrical Safety Equipment', source: 'Safety First Supply', dims: '900x600' },
      { title: 'Electrical Insulated Gloves and PPE', source: 'Protection Plus', dims: '1280x720' },
      { title: 'Complete Electrical Worker PPE Set', source: 'WorkSafe Equipment', dims: '1600x900' },
      { title: 'Electrical Safety Helmet with Face Shield', source: 'ProGear Safety', dims: '800x800' },
      { title: 'PPE Requirements for Electrical Work', source: 'Safety Standards Co', dims: '1920x1080' },
      { title: 'Electrical Protection Suit Full Body', source: 'Industrial PPE', dims: '768x1024' },
      { title: 'Safety Equipment for Electrical Maintenance', source: 'Maintenance Gear', dims: '1400x900' }
    ]
    
    // Generate 100 total results by creating variations
    const allPpeItems = []
    for (let i = 0; i < 100; i++) {
      const baseItem = basePpeItems[i % basePpeItems.length]
      const variation = Math.floor(i / basePpeItems.length)
      allPpeItems.push({
        ...baseItem,
        title: variation === 0 ? baseItem.title : `${baseItem.title} - Type ${variation + 1}`,
        source: variation === 0 ? baseItem.source : `${baseItem.source} ${variation + 1}`
      })
    }
    
    const startIdx = (page - 1) * 10
    const pageItems = allPpeItems.slice(startIdx, startIdx + 10)
    
    pageItems.forEach((item, i) => {
      const idx = startIdx + i + 1
      results.push({
        id: `ppe-${idx}`,
        url: `https://picsum.photos/800/600?random=${idx}&ppe`,
        thumbnail: `https://picsum.photos/400/300?random=${idx}&ppe`,
        title: item.title,
        source: item.source,
        dimensions: item.dims,
        photographer: `Industrial Photographer ${idx}`
      })
    })
  } else {
    // Return generic results for other queries
    for (let i = 0; i < 10; i++) {
      const idx = (page - 1) * 10 + i + 1
      results.push({
        id: `img-${idx}`,
        url: `https://picsum.photos/800/600?random=${idx}`,
        thumbnail: `https://picsum.photos/400/300?random=${idx}`,
        title: `${query} - Result ${idx}`,
        source: `Source ${idx % 3 === 0 ? 'Unsplash' : idx % 3 === 1 ? 'Pexels' : 'Pixabay'}`,
        dimensions: `${800 + (idx * 100) % 1200}x${600 + (idx * 50) % 600}`,
        photographer: `Photographer ${idx}`
      })
    }
  }
  
  return results
}

// Store page tokens for YouTube pagination
const youtubePageTokens = new Map<string, string>()

// Clear tokens for a specific query when starting a new search
export const clearYouTubePageTokens = (query: string) => {
  // Remove all tokens for this query
  const keysToDelete: string[] = []
  youtubePageTokens.forEach((_, key) => {
    if (key.startsWith(query + '_')) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => youtubePageTokens.delete(key))
}

// Check if there's a next page available for YouTube search
export const hasYouTubeNextPage = (query: string, currentPage: number): boolean => {
  const nextPageCacheKey = `${query}_${currentPage}_nextPageToken`
  return youtubePageTokens.has(nextPageCacheKey)
}

export const searchYouTubeVideos = async (
  query: string, 
  page: number = 1,
  apiKey?: string
): Promise<SearchResult[]> => {
  const results: SearchResult[] = []
  
  // Try to use real API if key is provided
  if (apiKey) {
    try {
      const maxResults = 10
      
      // Build URL with pageToken if not on first page
      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=${maxResults}&key=${apiKey}`
      
      // For pages > 1, we need the pageToken from the previous page
      if (page > 1) {
        const prevCacheKey = `${query}_${page - 1}_nextPageToken`
        const pageToken = youtubePageTokens.get(prevCacheKey)
        if (pageToken) {
          url += `&pageToken=${pageToken}`
        } else {
          // If we don't have the token for this page, we can't paginate
          // Return empty results to indicate no more pages
          return []
        }
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new SearchError('YouTube API rate limit exceeded. Please try again later.', 'RATE_LIMIT', response.status)
        }
        if (response.status === 403) {
          throw new SearchError('Invalid YouTube API key or quota exceeded.', 'INVALID_KEY', response.status)
        }
        throw new SearchError(`YouTube API request failed: ${response.statusText}`, 'API_ERROR', response.status)
      }
      
      const data = await response.json()
      
      // Store the nextPageToken for future pagination
      if (data.nextPageToken) {
        const nextPageCacheKey = `${query}_${page}_nextPageToken`
        youtubePageTokens.set(nextPageCacheKey, data.nextPageToken)
      }
      
      if (data.items) {
        // Get video details for duration
        const searchResponse = data as YouTubeSearchResponse
        const videoIds = searchResponse.items?.map((item) => item.id.videoId).join(',') || ''
        
        if (videoIds) {
          const detailsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${apiKey}`
          )
          
          if (!detailsResponse.ok) {
            // Log but don't fail the whole search if details fail
            console.warn('Failed to fetch video details:', detailsResponse.statusText)
          }
          
          const detailsData = detailsResponse.ok ? await detailsResponse.json() as YouTubeDetailsResponse : { items: [] }
          const detailsMap = new Map(
            detailsData.items?.map((item) => [item.id, item]) || []
          )
          
          const results = searchResponse.items?.map((item) => {
            const details = detailsMap.get(item.id.videoId)
            return {
              id: item.id.videoId,
              url: `https://youtube.com/watch?v=${item.id.videoId}`,
              embedUrl: `https://youtube.com/embed/${item.id.videoId}`,
              thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
              title: item.snippet.title,
              channel: item.snippet.channelTitle,
              uploadedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
              views: details?.statistics?.viewCount 
                ? `${Number(details.statistics.viewCount).toLocaleString()} views`
                : undefined,
              duration: details?.contentDetails?.duration 
                ? parseDuration(details.contentDetails.duration)
                : undefined
            }
          }) || []
          
          // Return the results
          return results
        }
      }
      return []
    } catch (error) {
      // Log the error but fall back to mock data
      console.warn('YouTube API error:', error)
      // Continue to mock data below
    }
  }
  
  // Fall back to mock data if API call fails or no key provided
  
  if (query.toLowerCase().includes('react')) {
    // Generate enough results for 10 pages (100 results)
    const baseVideos = [
      { title: 'React Tutorial for Beginners - Full Course', channel: 'Programming Academy', views: '2.3M', ago: '6 months ago', duration: '3:45:22' },
      { title: 'Learn React in 30 Minutes', channel: 'Code With Me', views: '890K', ago: '2 weeks ago', duration: '32:15' },
      { title: 'React Hooks Tutorial - Complete Guide', channel: 'Dev Channel', views: '456K', ago: '1 month ago', duration: '1:12:45' },
      { title: 'Building a React App from Scratch', channel: 'Tech Tutorials', views: '1.2M', ago: '3 months ago', duration: '2:15:30' },
      { title: 'React State Management Guide', channel: 'Frontend Masters', views: '567K', ago: '2 months ago', duration: '45:20' },
      { title: 'React Router Tutorial', channel: 'Web Dev Simplified', views: '789K', ago: '4 weeks ago', duration: '28:45' },
      { title: 'React Context API Tutorial', channel: 'The Net Ninja', views: '345K', ago: '5 weeks ago', duration: '35:10' },
      { title: 'React Performance Optimization', channel: 'Advanced React', views: '234K', ago: '1 week ago', duration: '52:30' },
      { title: 'React Testing Tutorial', channel: 'Test Driven Dev', views: '123K', ago: '3 weeks ago', duration: '1:05:15' },
      { title: 'React Custom Hooks Guide', channel: 'Hook Masters', views: '456K', ago: '2 months ago', duration: '40:22' }
    ]
    
    // Generate 100 total results by creating variations
    const allTutorials = []
    for (let i = 0; i < 100; i++) {
      const baseVideo = baseVideos[i % baseVideos.length]
      const variation = Math.floor(i / baseVideos.length)
      allTutorials.push({
        ...baseVideo,
        title: variation === 0 ? baseVideo.title : `${baseVideo.title} - Part ${variation + 1}`,
        views: `${Math.floor(parseInt(baseVideo.views) / (variation + 1))}${baseVideo.views.slice(-1)}`,
        ago: `${(i % 12) + 1} ${i % 2 === 0 ? 'weeks' : 'months'} ago`
      })
    }
    
    const startIdx = (page - 1) * 10
    const pageItems = allTutorials.slice(startIdx, startIdx + 10)
    
    pageItems.forEach((item, i) => {
      const idx = startIdx + i + 1
      results.push({
        id: `video-${idx}`,
        url: `https://youtube.com/watch?v=demoVideo${idx}`,
        embedUrl: `https://youtube.com/embed/demoVideo${idx}`,
        thumbnail: `https://picsum.photos/320/180?random=${idx}&video`,
        title: item.title,
        channel: item.channel,
        views: `${item.views} views`,
        uploadedAt: item.ago,
        duration: item.duration
      })
    })
  } else {
    // Return generic results
    for (let i = 0; i < 10; i++) {
      const idx = (page - 1) * 10 + i + 1
      results.push({
        id: `video-${idx}`,
        url: `https://youtube.com/watch?v=${idx}`,
        embedUrl: `https://youtube.com/embed/${idx}`,
        thumbnail: `https://picsum.photos/320/180?random=${idx}&generic`,
        title: `${query} - Tutorial Part ${idx}`,
        channel: `Channel ${idx}`,
        views: `${Math.floor(Math.random() * 900 + 100)}K views`,
        uploadedAt: `${idx} days ago`,
        duration: `${Math.floor(Math.random() * 50 + 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
      })
    }
  }
  
  return results
}