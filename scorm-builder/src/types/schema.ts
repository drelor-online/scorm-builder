/**
 * Unified Schema for SCORM Builder
 * 
 * This file addresses the schema fragmentation issue identified in the audit
 * where snake_case and camelCase variants exist across different layers.
 * 
 * All data normalization should happen at boundaries using the utilities provided here.
 */

import { z } from "zod";

// ============================================================================
// CORE MEDIA SCHEMA
// ============================================================================

export const MediaItemSchema = z.object({
  // Core identification
  id: z.string(),
  type: z.enum(["image", "video", "audio", "caption", "youtube"]),
  
  // Display information
  title: z.string().default(""),
  url: z.string().default(""),
  
  // YouTube specific (normalized fields)
  isYouTube: z.boolean().default(false),
  embedUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  
  // Clip timing (YouTube videos)
  clipStart: z.number().optional(),
  clipEnd: z.number().optional(),
  
  // Storage and metadata
  storageId: z.string().optional(),
  pageId: z.string().default(""),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  
  // Additional metadata
  thumbnail: z.string().optional(),
  photographer: z.string().optional(),
  source: z.enum(["upload", "search", "library"]).optional(),
  dimensions: z.string().optional(),
  views: z.string().optional(),
  uploadedAt: z.string().optional(),
  channel: z.string().optional(),
  duration: z.string().optional(),
  
  // Runtime-only fields (not persisted)
  blob: z.instanceof(Blob).optional(),
  captionUrl: z.string().optional(),
  captionBlob: z.instanceof(Blob).optional(),
});

export type MediaItem = z.infer<typeof MediaItemSchema>;

// ============================================================================
// YOUTUBE URL NORMALIZER (as recommended by audit)
// ============================================================================

export function extractYouTubeUrl(
  m: { 
    url?: string; 
    embedUrl?: string; 
    embed_url?: string; 
    youtubeUrl?: string; 
    youtube_url?: string;
    [key: string]: any;
  }
): string | null {
  return (
    m.url ?? 
    m.embedUrl ?? 
    (m as any).embed_url ?? 
    m.youtubeUrl ?? 
    (m as any).youtube_url ?? 
    null
  );
}

// ============================================================================
// MEDIA NORMALIZATION UTILITIES
// ============================================================================

/**
 * Normalizes media data from any source into the canonical MediaItem format
 * Handles both snake_case (backend) and camelCase (frontend) variants
 */
export function normalizeMediaItem(raw: any): MediaItem {
  const mapped = {
    // Core fields
    id: raw.id || "",
    type: raw.type || "image",
    title: raw.title || raw.original_name || "",
    url: raw.url || "",
    
    // YouTube detection and URL normalization
    isYouTube: raw.isYouTube || raw.type === "youtube" || false,
    embedUrl: raw.embedUrl || raw.embed_url,
    youtubeUrl: extractYouTubeUrl(raw),
    
    // Clip timing (support both formats)
    clipStart: raw.clipStart ?? raw.clip_start,
    clipEnd: raw.clipEnd ?? raw.clip_end,
    
    // Storage and identification
    storageId: raw.storageId || raw.storage_id,
    pageId: raw.pageId || raw.page_id || "",
    mimeType: raw.mimeType || raw.mime_type,
    fileName: raw.fileName || raw.original_name,
    
    // Metadata
    thumbnail: raw.thumbnail,
    photographer: raw.photographer,
    source: raw.source,
    dimensions: raw.dimensions,
    views: raw.views,
    uploadedAt: raw.uploadedAt || raw.uploaded_at,
    channel: raw.channel,
    duration: raw.duration,
    
    // Runtime fields (preserve if present)
    blob: raw.blob,
    captionUrl: raw.captionUrl || raw.caption_url,
    captionBlob: raw.captionBlob,
  };
  
  return MediaItemSchema.parse(mapped);
}

/**
 * Converts MediaItem to backend format (snake_case)
 * Used when sending data to Rust backend
 */
export function mediaItemToBackend(item: MediaItem) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    url: item.url,
    page_id: item.pageId,
    storage_id: item.storageId,
    mime_type: item.mimeType,
    original_name: item.fileName || item.title,
    embed_url: item.embedUrl,
    youtube_url: item.youtubeUrl,
    clip_start: item.clipStart,
    clip_end: item.clipEnd,
    source: item.source,
  };
}

// ============================================================================
// COURSE CONTENT SCHEMA
// ============================================================================

const PageSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  narration: z.string().default(""),
  imageKeywords: z.array(z.string()).default([]),
  imagePrompts: z.array(z.string()).default([]),
  videoSearchTerms: z.array(z.string()).default([]),
  duration: z.number().default(5),
  media: z.array(MediaItemSchema).default([]),
  
  // Legacy support
  audioFile: z.string().optional(),
  captionFile: z.string().optional(),
  audioId: z.string().optional(),
  captionId: z.string().optional(),
});

const TopicSchema = PageSchema.extend({
  knowledgeCheck: z.object({
    questions: z.array(z.object({
      id: z.string(),
      type: z.enum(["multiple-choice", "true-false", "fill-in-the-blank"]),
      question: z.string(),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string(),
      blank: z.string().optional(),
      explanation: z.string().optional(),
      feedback: z.object({
        correct: z.string(),
        incorrect: z.string(),
      }).optional(),
    }))
  }).optional(),
});

export const CourseContentSchema = z.object({
  welcomePage: PageSchema,
  learningObjectivesPage: PageSchema,
  topics: z.array(TopicSchema),
  assessment: z.object({
    questions: z.array(z.any()), // Keep flexible for now
  }),
  objectives: z.array(z.string()).optional(),
});

export type CourseContent = z.infer<typeof CourseContentSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Topic = z.infer<typeof TopicSchema>;

/**
 * Normalizes course content from any source
 * Ensures all media items are properly normalized
 */
export function normalizeCourseContent(raw: any): CourseContent {
  const normalizePageMedia = (page: any) => {
    if (page.media && Array.isArray(page.media)) {
      page.media = page.media.map(normalizeMediaItem);
    }
    return page;
  };

  const normalized = {
    ...raw,
    welcomePage: normalizePageMedia(raw.welcomePage || {}),
    learningObjectivesPage: normalizePageMedia(raw.learningObjectivesPage || raw.objectivesPage || {}),
    topics: (raw.topics || []).map(normalizePageMedia),
    assessment: raw.assessment || { questions: [] },
    objectives: raw.objectives || [],
  };

  return CourseContentSchema.parse(normalized);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates that a media item has required YouTube fields if it's a YouTube video
 */
export function validateYouTubeMedia(item: MediaItem): boolean {
  if (!item.isYouTube && item.type !== "youtube") return true;
  
  const hasUrl = !!(item.youtubeUrl || item.embedUrl || item.url);
  return hasUrl;
}

/**
 * Validates that media items are properly associated with pages
 */
export function validateMediaPageAssociation(item: MediaItem, pageId: string): boolean {
  return item.pageId === pageId || item.pageId === "";
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export {
  // Schemas
  MediaItemSchema,
  CourseContentSchema,
  
  // Normalization functions
  normalizeMediaItem,
  normalizeCourseContent,
  mediaItemToBackend,
  
  // YouTube utilities
  extractYouTubeUrl,
  
  // Validation
  validateYouTubeMedia,
  validateMediaPageAssociation,
};