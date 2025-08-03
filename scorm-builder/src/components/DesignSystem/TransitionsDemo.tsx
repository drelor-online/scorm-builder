import React, { useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Modal } from './Modal'
import { Alert } from './Alert'
import { IconButton } from './IconButton'
import { LoadingSpinner } from './LoadingSpinner'
import { 
  Play, 
  RotateCcw, 
  Zap, 
  Star,
  Heart,
  Bell
} from 'lucide-react'
import './transitions.css'
import './designSystem.css'

export const TransitionsDemo: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [alertType, setAlertType] = useState<'info' | 'success' | 'warning' | 'error'>('info')
  const [animateCards, setAnimateCards] = useState(false)
  const [loadingButton, setLoadingButton] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  
  const demoCards = [
    { title: 'Fade In', description: 'Smooth opacity transition' },
    { title: 'Slide Up', description: 'Elegant upward motion' },
    { title: 'Scale In', description: 'Zoom effect on entry' },
    { title: 'Stagger', description: 'Sequential animations' }
  ]
  
  const handleLoadingClick = () => {
    setLoadingButton(true)
    setTimeout(() => setLoadingButton(false), 2000)
  }
  
  const handleShowAlert = (type: typeof alertType) => {
    setAlertType(type)
    setShowAlert(true)
    setTimeout(() => setShowAlert(false), 3000)
  }
  
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Transitions & Animations Demo</h1>
      <p style={{ fontSize: '1.125rem', marginBottom: '3rem', color: 'var(--text-secondary)' }}>
        Explore the new micro-animations and transitions added to the design system
      </p>
      
      {/* Button Animations */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Button Interactions</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="primary">
            Hover & Press Me
          </Button>
          <Button variant="secondary" icon={<Zap />}>
            With Icon
          </Button>
          <Button 
            variant="success" 
            onClick={handleLoadingClick}
            loading={loadingButton}
          >
            Loading State
          </Button>
          <Button variant="danger" className="animate-pulse">
            Pulsing Button
          </Button>
        </div>
      </section>
      
      {/* Icon Button Animations */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Icon Buttons</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <IconButton 
            icon={Heart} 
            variant="danger"
            tooltip="Like"
            onClick={() => setLikeCount(c => c + 1)}
          />
          <span className={likeCount > 0 ? 'animate-bounce' : ''}>
            {likeCount > 0 && `+${likeCount}`}
          </span>
          <IconButton icon={Bell} tooltip="Notifications" className="animate-pulse" />
          <IconButton icon={Star} variant="primary" tooltip="Favorite" />
          <IconButton icon={RotateCcw} tooltip="Refresh" className="hover-scale" />
        </div>
      </section>
      
      {/* Card Animations */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Card Animations</h2>
        <Button 
          variant="secondary" 
          onClick={() => {
            setAnimateCards(false)
            setTimeout(() => setAnimateCards(true), 100)
          }}
          style={{ marginBottom: '1.5rem' }}
        >
          <Play /> Animate Cards
        </Button>
        
        <div 
          className={animateCards ? 'stagger-children' : ''}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {demoCards.map((card, index) => (
            <Card 
              key={card.title}
              title={card.title}
              className={animateCards ? 'animate-fadeInUp' : ''}
              style={{ animationDelay: `${index * 0.1}s` }}
              interactive
            >
              <p>{card.description}</p>
            </Card>
          ))}
        </div>
      </section>
      
      {/* Alert Animations */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Alert Notifications</h2>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <Button variant="secondary" onClick={() => handleShowAlert('info')}>
            Show Info
          </Button>
          <Button variant="success" onClick={() => handleShowAlert('success')}>
            Show Success
          </Button>
          <Button variant="secondary" onClick={() => handleShowAlert('warning')}>
            Show Warning
          </Button>
          <Button variant="danger" onClick={() => handleShowAlert('error')}>
            Show Error
          </Button>
        </div>
        
        {showAlert && (
          <Alert variant={alertType}>
            This is a {alertType} alert with slide-down animation!
          </Alert>
        )}
      </section>
      
      {/* Modal Animation */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Modal Transitions</h2>
        <Button onClick={() => setShowModal(true)}>
          Open Modal
        </Button>
        
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Animated Modal"
          size="medium"
        >
          <p style={{ marginBottom: '1rem' }}>
            This modal features smooth scale and fade animations on open and close.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShowModal(false)}>
              Confirm
            </Button>
          </div>
        </Modal>
      </section>
      
      {/* Loading States */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Loading Animations</h2>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <LoadingSpinner size="small" />
          <LoadingSpinner size="medium" />
          <LoadingSpinner size="large" />
          <div className="loading-shimmer" style={{ 
            width: '200px', 
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary)'
          }} />
        </div>
      </section>
      
      {/* Hover Effects */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Hover Effects</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <Card className="hover-lift" interactive>
            <p>Hover Lift Effect</p>
          </Card>
          <Card className="hover-scale" interactive>
            <p>Hover Scale Effect</p>
          </Card>
          <Card className="hover-glow" interactive>
            <p>Hover Glow Effect</p>
          </Card>
        </div>
      </section>
      
      {/* Reduced Motion Note */}
      <section>
        <Alert variant="info">
          <strong>Accessibility Note:</strong> All animations respect the user's 
          "prefers-reduced-motion" setting for better accessibility.
        </Alert>
      </section>
    </div>
  )
}