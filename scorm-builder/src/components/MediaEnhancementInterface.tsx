import React, { useState } from 'react'
import { Card } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import { 
  Image as ImageIcon, 
  Video, 
  Sparkles,
  Search,
  Upload,
  Link,
  AlertCircle
} from 'lucide-react'

/**
 * Simplified Media Enhancement Interface based on mockup design
 * Without device preview modes - full width implementation
 */
export const MediaEnhancementInterface: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'ai'>('images')
  const [currentPage, setCurrentPage] = useState('welcome')

  return (
    <div style={{
      backgroundColor: tokens.colors.background.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 2rem',
        borderBottom: `1px solid ${tokens.colors.border.default}`,
        backgroundColor: tokens.colors.background.secondary
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Media Enhancement</h1>
        <p style={{ margin: '0.25rem 0 0', color: tokens.colors.text.secondary, fontSize: '0.875rem' }}>
          Add images, videos, and AI-generated content to your course
        </p>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Page Navigation */}
        <div style={{
          width: '300px',
          backgroundColor: tokens.colors.background.secondary,
          borderRight: `1px solid ${tokens.colors.border.default}`,
          padding: '1.5rem',
          overflowY: 'auto'
        }}>
          <h3 style={{ 
            fontSize: '0.875rem', 
            fontWeight: 600,
            textTransform: 'uppercase',
            color: tokens.colors.text.secondary,
            marginBottom: '1rem' 
          }}>
            Page Navigation
          </h3>
          
          <PageThumbnail 
            title="Welcome" 
            isActive={currentPage === 'welcome'}
            hasMedia 
            onClick={() => setCurrentPage('welcome')}
          />
          <PageThumbnail 
            title="Learning Objectives" 
            isActive={currentPage === 'objectives'}
            onClick={() => setCurrentPage('objectives')}
          />
          <PageThumbnail 
            title="Introduction to Safety" 
            isActive={currentPage === 'topic1'}
            hasMedia 
            onClick={() => setCurrentPage('topic1')}
          />
          <PageThumbnail 
            title="Equipment Overview" 
            isActive={currentPage === 'topic2'}
            hasMedia 
            onClick={() => setCurrentPage('topic2')}
          />
          <PageThumbnail 
            title="Emergency Procedures" 
            isActive={currentPage === 'topic3'}
            onClick={() => setCurrentPage('topic3')}
          />
          <PageThumbnail 
            title="Assessment" 
            isActive={currentPage === 'assessment'}
            onClick={() => setCurrentPage('assessment')}
          />
        </div>

        {/* Right Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Content Editor */}
          <div style={{
            height: '400px',
            borderBottom: `1px solid ${tokens.colors.border.default}`,
            padding: '2rem',
            backgroundColor: tokens.colors.background.primary
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem' 
            }}>
              <h2 style={{ margin: 0 }}>
                {currentPage === 'welcome' && 'Welcome Page'}
                {currentPage === 'objectives' && 'Learning Objectives'}
                {currentPage === 'topic1' && 'Introduction to Safety'}
                {currentPage === 'topic2' && 'Equipment Overview'}
                {currentPage === 'topic3' && 'Emergency Procedures'}
                {currentPage === 'assessment' && 'Assessment'}
              </h2>
              <span style={{ 
                fontSize: '0.875rem', 
                color: tokens.colors.text.secondary 
              }}>
                Rich Text Editor
              </span>
            </div>
            
            <div style={{
              height: 'calc(100% - 60px)',
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: '0.5rem',
              backgroundColor: tokens.colors.background.secondary,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Editor Toolbar */}
              <div style={{
                padding: '0.75rem',
                borderBottom: `1px solid ${tokens.colors.border.default}`,
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                backgroundColor: tokens.colors.background.tertiary
              }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <ToolbarButton>B</ToolbarButton>
                  <ToolbarButton>I</ToolbarButton>
                  <ToolbarButton>U</ToolbarButton>
                </div>
                <div style={{ width: '1px', height: '20px', backgroundColor: tokens.colors.border.default }} />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <ToolbarButton>H1</ToolbarButton>
                  <ToolbarButton>H2</ToolbarButton>
                  <ToolbarButton>H3</ToolbarButton>
                </div>
                <div style={{ width: '1px', height: '20px', backgroundColor: tokens.colors.border.default }} />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <ToolbarButton><ImageIcon size={16} /></ToolbarButton>
                  <ToolbarButton><Video size={16} /></ToolbarButton>
                  <ToolbarButton><Link size={16} /></ToolbarButton>
                </div>
              </div>
              
              {/* Editor Content */}
              <div style={{
                flex: 1,
                padding: '1.5rem',
                overflow: 'auto'
              }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', lineHeight: 1.6 }}>
                  <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Welcome to Safety Training</h1>
                  <p style={{ marginBottom: '1rem' }}>
                    This comprehensive course covers essential safety procedures and best practices for working with natural gas equipment.
                  </p>
                  <p style={{ marginBottom: '1rem' }}>
                    By the end of this training, you will understand:
                  </p>
                  <ul style={{ marginLeft: '2rem' }}>
                    <li>Key safety protocols and regulations</li>
                    <li>Proper equipment handling procedures</li>
                    <li>Emergency response guidelines</li>
                    <li>Risk assessment and mitigation strategies</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Media Enhancement Tabs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              borderBottom: `2px solid ${tokens.colors.border.default}`,
              backgroundColor: tokens.colors.background.secondary,
              padding: '0 2rem'
            }}>
              <TabButton
                icon={<ImageIcon size={18} />}
                label="Images"
                isActive={activeTab === 'images'}
                onClick={() => setActiveTab('images')}
              />
              <TabButton
                icon={<Video size={18} />}
                label="Videos"
                isActive={activeTab === 'videos'}
                onClick={() => setActiveTab('videos')}
              />
              <TabButton
                icon={<Sparkles size={18} />}
                label="AI Tools"
                isActive={activeTab === 'ai'}
                onClick={() => setActiveTab('ai')}
              />
            </div>

            {/* Tab Content */}
            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: '2rem',
              backgroundColor: tokens.colors.background.primary
            }}>
              {activeTab === 'images' && <ImageSearchTab />}
              {activeTab === 'videos' && <VideoSearchTab />}
              {activeTab === 'ai' && <AIToolsTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Page Thumbnail Component
const PageThumbnail: React.FC<{ 
  title: string
  isActive?: boolean
  hasMedia?: boolean
  onClick: () => void 
}> = ({ title, isActive, hasMedia, onClick }) => (
  <div 
    onClick={onClick}
    style={{
      marginBottom: '0.75rem',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      border: `2px solid ${isActive ? tokens.colors.primary[500] : 'transparent'}`,
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}
  >
    <div style={{
      height: '100px',
      backgroundColor: hasMedia ? '#2a2a2a' : tokens.colors.background.tertiary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '2rem'
    }}>
      {hasMedia ? '🖼️' : '📄'}
    </div>
    <div style={{ 
      padding: '0.75rem', 
      fontSize: '0.875rem',
      backgroundColor: isActive ? tokens.colors.primary[50] : tokens.colors.background.primary
    }}>
      {title}
    </div>
  </div>
)

// Tab Button Component
const TabButton: React.FC<{
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '1rem 1.5rem',
      border: 'none',
      backgroundColor: 'transparent',
      color: isActive ? tokens.colors.primary[500] : tokens.colors.text.secondary,
      borderBottom: `3px solid ${isActive ? tokens.colors.primary[500] : 'transparent'}`,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.9375rem',
      fontWeight: isActive ? 600 : 400,
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}
  >
    {icon}
    {label}
  </button>
)

// Toolbar Button Component
const ToolbarButton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <button style={{
    padding: '0.375rem 0.625rem',
    border: `1px solid ${tokens.colors.border.default}`,
    backgroundColor: tokens.colors.background.primary,
    borderRadius: '0.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    fontSize: '0.875rem',
    fontWeight: 600
  }}>
    {children}
  </button>
)

// Image Search Tab Content
const ImageSearchTab = () => (
  <div>
    {/* Search Bar */}
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={20} style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: tokens.colors.text.secondary
        }} />
        <input
          type="text"
          placeholder="Search for safety equipment, workplace images..."
          style={{
            width: '100%',
            padding: '0.875rem 1rem 0.875rem 3rem',
            borderRadius: '0.5rem',
            border: `1px solid ${tokens.colors.border.default}`,
            fontSize: '0.9375rem',
            backgroundColor: tokens.colors.background.secondary
          }}
        />
      </div>
      
      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <select style={filterStyle}>
          <option>All Sizes</option>
          <option>Large (1920x1080+)</option>
          <option>Medium (1024x768+)</option>
          <option>Small</option>
        </select>
        <select style={filterStyle}>
          <option>All Colors</option>
          <option>Full Color</option>
          <option>Black & White</option>
        </select>
        <select style={filterStyle}>
          <option>All Licenses</option>
          <option>Creative Commons</option>
          <option>Commercial Use</option>
          <option>Editorial Only</option>
        </select>
      </div>
    </div>

    {/* Upload Options */}
    <div style={{ 
      display: 'flex', 
      gap: '1rem',
      marginBottom: '2rem' 
    }}>
      <Card style={{ 
        flex: 1, 
        padding: '1.5rem',
        border: `2px dashed ${tokens.colors.border.default}`,
        textAlign: 'center',
        cursor: 'pointer'
      }}>
        <Upload size={24} style={{ marginBottom: '0.5rem', color: tokens.colors.primary[500] }} />
        <p style={{ margin: 0, fontWeight: 500 }}>Upload from Computer</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: tokens.colors.text.secondary }}>
          JPG, PNG, GIF, SVG
        </p>
      </Card>
      
      <Card style={{ 
        flex: 1, 
        padding: '1.5rem',
        border: `2px dashed ${tokens.colors.border.default}`,
        textAlign: 'center',
        cursor: 'pointer'
      }}>
        <Link size={24} style={{ marginBottom: '0.5rem', color: tokens.colors.primary[500] }} />
        <p style={{ margin: 0, fontWeight: 500 }}>Add from URL</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: tokens.colors.text.secondary }}>
          Direct image links
        </p>
      </Card>
    </div>

    {/* Search Results Grid */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '1.5rem'
    }}>
      {[1,2,3,4,5,6,7,8].map(i => (
        <Card key={i} style={{
          padding: 0,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}>
          <div style={{
            aspectRatio: '16/10',
            backgroundColor: tokens.colors.background.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem'
          }}>
            🖼️
          </div>
          <div style={{ padding: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>
              Safety Equipment {i}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: tokens.colors.text.secondary }}>
              1920x1080 • JPG
            </p>
          </div>
        </Card>
      ))}
    </div>
  </div>
)

// Video Search Tab Content
const VideoSearchTab = () => (
  <div>
    {/* Search Bar */}
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={20} style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: tokens.colors.text.secondary
        }} />
        <input
          type="text"
          placeholder="Search YouTube for safety training videos..."
          style={{
            width: '100%',
            padding: '0.875rem 1rem 0.875rem 3rem',
            borderRadius: '0.5rem',
            border: `1px solid ${tokens.colors.border.default}`,
            fontSize: '0.9375rem',
            backgroundColor: tokens.colors.background.secondary
          }}
        />
      </div>
      
      {/* Duration Filter */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <select style={filterStyle}>
          <option>Any Duration</option>
          <option>Under 4 minutes</option>
          <option>4-20 minutes</option>
          <option>Over 20 minutes</option>
        </select>
        <select style={filterStyle}>
          <option>Relevance</option>
          <option>Upload Date</option>
          <option>View Count</option>
          <option>Rating</option>
        </select>
      </div>
    </div>

    {/* Info Box */}
    <Card style={{
      padding: '1rem',
      marginBottom: '2rem',
      backgroundColor: tokens.colors.info[50],
      border: `1px solid ${tokens.colors.info[200]}`
    }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <AlertCircle size={20} style={{ color: tokens.colors.info[600], flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 500, color: tokens.colors.info[900] }}>
            YouTube Integration
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: tokens.colors.info[700] }}>
            Videos are embedded directly from YouTube. Ensure you have rights to use the content in your course.
          </p>
        </div>
      </div>
    </Card>

    {/* Video Results Grid */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1.5rem'
    }}>
      {[1,2,3,4,5,6].map(i => (
        <Card key={i} style={{
          padding: 0,
          overflow: 'hidden',
          cursor: 'pointer'
        }}>
          <div style={{
            aspectRatio: '16/9',
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            position: 'relative'
          }}>
            ▶️
            <span style={{
              position: 'absolute',
              bottom: '0.5rem',
              right: '0.5rem',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem'
            }}>
              {i * 2}:34
            </span>
          </div>
          <div style={{ padding: '1rem' }}>
            <p style={{ margin: 0, fontWeight: 500 }}>
              Safety Training Video {i}
            </p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: tokens.colors.text.secondary }}>
              SafetyFirst Channel • 125K views • 2 months ago
            </p>
            <p style={{ 
              margin: '0.5rem 0 0', 
              fontSize: '0.875rem',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              Learn essential safety procedures for working with industrial equipment. This comprehensive guide covers...
            </p>
          </div>
        </Card>
      ))}
    </div>
  </div>
)

// AI Tools Tab Content
const AIToolsTab = () => (
  <div>
    {/* AI Prompt Generator */}
    <Card style={{ marginBottom: '2rem', padding: '2rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
        <Sparkles size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
        AI Prompt Generator
      </h3>
      <p style={{ marginBottom: '1rem', color: tokens.colors.text.secondary }}>
        Describe the image you need and we'll generate an optimized prompt for AI image generators.
      </p>
      <textarea
        placeholder="Example: A professional photo of safety equipment including hard hat, safety goggles, and gloves arranged on a clean white background..."
        style={{
          width: '100%',
          minHeight: '120px',
          padding: '0.875rem',
          borderRadius: '0.5rem',
          border: `1px solid ${tokens.colors.border.default}`,
          fontSize: '0.9375rem',
          resize: 'vertical',
          backgroundColor: tokens.colors.background.secondary
        }}
      />
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
        <button style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: tokens.colors.primary[500],
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          fontSize: '0.9375rem',
          fontWeight: 500,
          cursor: 'pointer'
        }}>
          Generate Optimized Prompt
        </button>
        <button style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: 'transparent',
          color: tokens.colors.primary[500],
          border: `1px solid ${tokens.colors.primary[500]}`,
          borderRadius: '0.5rem',
          fontSize: '0.9375rem',
          fontWeight: 500,
          cursor: 'pointer'
        }}>
          View Examples
        </button>
      </div>
    </Card>

    {/* AI Image Generators Grid */}
    <div>
      <h3 style={{ marginBottom: '1rem' }}>Popular AI Image Generators</h3>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {[
          { name: 'DALL-E 3', desc: 'OpenAI\'s latest model with high quality results' },
          { name: 'Midjourney', desc: 'Artistic and creative image generation' },
          { name: 'Stable Diffusion', desc: 'Open source with many style options' },
          { name: 'Ideogram', desc: 'Excellent for text in images' },
          { name: 'Adobe Firefly', desc: 'Professional quality, commercial safe' },
          { name: 'Bing Image Creator', desc: 'Free access to DALL-E 3' }
        ].map(tool => (
          <Card key={tool.name} style={{ 
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem' }}>{tool.name}</h4>
              <p style={{ 
                margin: 0, 
                fontSize: '0.875rem', 
                color: tokens.colors.text.secondary,
                lineHeight: 1.4
              }}>
                {tool.desc}
              </p>
            </div>
            <button style={{
              marginTop: '1rem',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              border: `1px solid ${tokens.colors.primary[500]}`,
              backgroundColor: 'transparent',
              color: tokens.colors.primary[500],
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 500
            }}>
              Open Tool →
            </button>
          </Card>
        ))}
      </div>
    </div>
  </div>
)

// Shared Styles
const filterStyle: React.CSSProperties = {
  padding: '0.625rem 1rem',
  borderRadius: '0.375rem',
  border: `1px solid ${tokens.colors.border.default}`,
  fontSize: '0.875rem',
  backgroundColor: tokens.colors.background.secondary,
  cursor: 'pointer'
}

export default MediaEnhancementInterface