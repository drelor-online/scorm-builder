import React from 'react'
import {
  // File & Folder
  Save,
  Upload,
  Download,
  File,
  FileText,
  Folder,
  
  // Media
  Mic,
  Play,
  Pause,
  Square,
  Volume2,
  Image,
  Video,
  Youtube,
  
  // Navigation
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
  
  // Actions
  Plus,
  Minus,
  Edit2,
  Trash2,
  Check,
  Clock,
  RefreshCw,
  RotateCcw,
  
  // UI Elements
  Search,
  Settings,
  HelpCircle,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  
  // Progress
  Loader2,
  
  // Communication
  
  // Layout
  
  // Education specific
  BookOpen,
  GraduationCap,
  Brain,
  Target,
  Award,
  
  // More specific icons
  Package,
  Sparkles,
  Wand2,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Users,
  User,
  Calendar,
  
  type LucideIcon
} from 'lucide-react'

// Icon wrapper component for consistent sizing and styling
interface IconProps {
  icon: LucideIcon
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  className?: string
  strokeWidth?: number
}

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32
}

export const Icon: React.FC<IconProps> = ({
  icon: IconComponent,
  size = 'md',
  color = 'currentColor',
  className = '',
  strokeWidth = 2
}) => {
  return (
    <IconComponent 
      size={sizeMap[size]} 
      color={color}
      strokeWidth={strokeWidth}
      className={className}
    />
  )
}

// Mapping of old emoji usage to new icons
export const iconMap = {
  // File operations
  save: Save,
  upload: Upload,
  download: Download,
  folder: Folder,
  file: File,
  
  // Media controls
  record: Mic,
  stopRecord: Square,
  play: Play,
  pause: Pause,
  audio: Volume2,
  image: Image,
  video: Video,
  youtube: Youtube,
  
  // Status
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  check: Check,
  close: X,
  
  // Actions
  edit: Edit2,
  delete: Trash2,
  add: Plus,
  remove: Minus,
  refresh: RefreshCw,
  undo: RotateCcw,
  
  // Navigation
  back: ArrowLeft,
  next: ArrowRight,
  up: ChevronUp,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
  
  // UI
  search: Search,
  settings: Settings,
  help: HelpCircle,
  menu: Menu,
  loading: Loader2,
  
  // Education
  course: BookOpen,
  learn: Brain,
  graduate: GraduationCap,
  objective: Target,
  achievement: Award,
  
  // Other
  package: Package,
  sparkle: Sparkles,
  magic: Wand2,
  time: Clock,
  user: User,
  users: Users,
  calendar: Calendar,
  external: ExternalLink,
  view: Eye,
  hide: EyeOff,
  lock: Lock,
  unlock: Unlock
} as const

// Re-export commonly used icons for convenience
export {
  Save,
  Upload,
  Download,
  Mic,
  Play,
  Pause,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Search,
  Settings,
  HelpCircle,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  BookOpen,
  Brain,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Info,
  Clock,
  FileText,
  Image,
  Video,
  Volume2,
  Square,
  Package,
  Sparkles
}

// Spinner component using Loader2
interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md',
  className = '' 
}) => {
  return (
    <Loader2 
      size={sizeMap[size]}
      className={`animate-spin ${className}`}
      strokeWidth={2}
    />
  )
}