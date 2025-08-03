import {
  Save,
  Upload,
  Mic,
  Square,
  Play,
  Download,
  Search,
  Clock,
  Edit2,
  Check,
  X,
  ArrowRight,
  Volume2,
  AlertCircle,
  FileText,
  Settings,
  HelpCircle,
  Package,
  Sparkles,
  ChevronRight,
  Brain,
  Users,
  Target,
  TrendingUp,
  Award
} from 'lucide-react'

// Comprehensive mapping of emojis to Lucide icons
export const emojiToIconMap = {
  // File operations
  '💾': Save,
  '📁': Upload,
  '📂': Upload,
  '⬇️': Download,
  '📄': FileText,
  '📋': FileText,
  
  // Media
  '🎙️': Mic,
  '🎤': Mic,
  '⏹️': Square,
  '▶️': Play,
  '⏸️': Play,
  '🔊': Volume2,
  '🔈': Volume2,
  '🎵': Volume2,
  '🎶': Volume2,
  
  // Status/Actions
  '✓': Check,
  '✔️': Check,
  '✅': Check,
  '✗': X,
  '✖️': X,
  '❌': X,
  '→': ArrowRight,
  '➡️': ArrowRight,
  '📝': Edit2,
  '✏️': Edit2,
  
  // UI Elements
  '🔍': Search,
  '⏱️': Clock,
  '⏰': Clock,
  '⚙️': Settings,
  '❓': HelpCircle,
  '❔': HelpCircle,
  '❗': AlertCircle,
  '❕': AlertCircle,
  '⚠️': AlertCircle,
  
  // Progress/Success
  '📦': Package,
  '✨': Sparkles,
  '🎯': Target,
  '🏆': Award,
  '📈': TrendingUp,
  
  // Education
  '🧠': Brain,
  '👥': Users,
  '👤': Users,
  
  // Navigation
  '▶': ChevronRight,
  '◀': ChevronRight,
  '▼': ChevronRight,
  '▲': ChevronRight,
} as const

// Helper function to replace emoji with icon component
export function getIconForEmoji(emoji: string) {
  return emojiToIconMap[emoji as keyof typeof emojiToIconMap] || null
}

// Common button text replacements
export const buttonTextMap = {
  '🎙️ Record Audio': 'Record Audio',
  '📁 Upload Audio': 'Upload Audio',
  '💾 Save Recording': 'Save Recording',
  '⏹️ Stop': 'Stop',
  '▶️ Play': 'Play',
  '⬇️ Download': 'Download',
  '🔍 Search': 'Search',
  '📝 Edit': 'Edit',
  '✓ Save': 'Save',
  '✗ Cancel': 'Cancel',
  '→ Skip': 'Skip',
  '⚙️ Settings': 'Settings',
  '❓ Help': 'Help',
} as const