import React from 'react'
import { Card } from './Card'
import { IconButton } from './IconButton'
import { Icon, Spinner } from './Icons'
import { Button } from './Button'
import { Flex } from './Layout'
import { 
  Save, Upload, Mic, Play, Pause, Download,
  Check, X, ArrowRight, Settings,
  Edit2, Trash2,
  BookOpen, Brain, Package, Sparkles
} from 'lucide-react'

export const IconDemo: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Icon System Demo</h1>
      
      {/* Icon Buttons Section */}
      <Card title="Icon Buttons" subtitle="Replacing emoji buttons with proper icons" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gap: '2rem' }}>
          
          {/* Primary Actions */}
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Primary Actions</h4>
            <Flex gap="medium" wrap>
              <IconButton icon={Save} variant="primary" tooltip="Save changes">
                Save Recording
              </IconButton>
              <IconButton icon={Upload} variant="primary" tooltip="Upload file">
                Upload Audio
              </IconButton>
              <IconButton icon={Mic} variant="primary" tooltip="Start recording">
                Record Audio
              </IconButton>
            </Flex>
          </div>
          
          {/* Media Controls */}
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Media Controls</h4>
            <Flex gap="medium">
              <IconButton icon={Play} variant="secondary" tooltip="Play" />
              <IconButton icon={Pause} variant="secondary" tooltip="Pause" />
              <IconButton icon={Download} variant="secondary" tooltip="Download" />
            </Flex>
          </div>
          
          {/* Status Indicators */}
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Status Actions</h4>
            <Flex gap="medium">
              <IconButton icon={Check} variant="success" tooltip="Approve" />
              <IconButton icon={X} variant="danger" tooltip="Reject" />
              <IconButton icon={ArrowRight} variant="ghost" tooltip="Skip" />
            </Flex>
          </div>
          
          {/* Icon Button Sizes */}
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Sizes</h4>
            <Flex gap="medium" align="center">
              <IconButton icon={Settings} size="sm" tooltip="Small" />
              <IconButton icon={Settings} size="md" tooltip="Medium" />
              <IconButton icon={Settings} size="lg" tooltip="Large" />
            </Flex>
          </div>
        </div>
      </Card>

      {/* Enhanced Cards */}
      <Card title="Enhanced Cards" subtitle="Cards with icons and actions" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Card
            icon={BookOpen}
            title="Course Content"
            subtitle="Manage your course materials"
            variant="default"
            actions={
              <Flex gap="small">
                <IconButton icon={Edit2} size="sm" variant="secondary" />
                <IconButton icon={Trash2} size="sm" variant="secondary" />
              </Flex>
            }
          >
            <p>Your course has 12 topics and 5 assessments ready for review.</p>
          </Card>

          <Card
            icon={Brain}
            title="AI Generation"
            subtitle="Powered by advanced AI"
            variant="glass"
            interactive
            onClick={() => console.log('Card clicked')}
          >
            <p>Click to generate new content using AI assistance.</p>
          </Card>

          <Card
            icon={Package}
            title="SCORM Package"
            subtitle="Ready for export"
            variant="dark"
            actions={
              <Button size="small" variant="primary">
                <Icon icon={Download} size="sm" />
                Export
              </Button>
            }
          >
            <p>Your SCORM package is ready to be downloaded.</p>
          </Card>
        </div>
      </Card>

      {/* Loading States */}
      <Card title="Loading States" subtitle="Improved loading indicators" style={{ marginBottom: '2rem' }}>
        <Flex gap="large" align="center">
          <div style={{ textAlign: 'center' }}>
            <Spinner size="xs" />
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Extra Small</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Spinner size="sm" />
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Small</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Spinner size="md" />
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Medium</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Large</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Spinner size="xl" />
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>Extra Large</p>
          </div>
        </Flex>
      </Card>

      {/* Icon Replacements */}
      <Card title="Emoji to Icon Mapping" subtitle="Before and after comparison" style={{ marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #3f3f46' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Old (Emoji)</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>New (Icon)</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem' }}>💾</td>
              <td style={{ padding: '0.5rem' }}><Icon icon={Save} size="md" /></td>
              <td style={{ padding: '0.5rem' }}>Save operations</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}>🎙️</td>
              <td style={{ padding: '0.5rem' }}><Icon icon={Mic} size="md" /></td>
              <td style={{ padding: '0.5rem' }}>Audio recording</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}>📁</td>
              <td style={{ padding: '0.5rem' }}><Icon icon={Upload} size="md" /></td>
              <td style={{ padding: '0.5rem' }}>File upload</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}>✓</td>
              <td style={{ padding: '0.5rem' }}><Icon icon={Check} size="md" /></td>
              <td style={{ padding: '0.5rem' }}>Success/Complete</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}>✨</td>
              <td style={{ padding: '0.5rem' }}><Icon icon={Sparkles} size="md" /></td>
              <td style={{ padding: '0.5rem' }}>AI/Magic features</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}

export default IconDemo