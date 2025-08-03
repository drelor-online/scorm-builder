import React, { useState, useEffect } from 'react'
import { Card } from './DesignSystem/Card'
import { Button } from './DesignSystem/Button'
import { Input } from './DesignSystem/Input'
import { Section, Grid } from './DesignSystem/Layout'
import { Alert } from './DesignSystem/Alert'
import { Toast } from './Toast'
import { apiKeyStorage, ApiKeys } from '../services/ApiKeyStorage'

interface SettingsProps {
  onSave?: (apiKeys: ApiKeys) => void
}

export const Settings: React.FC<SettingsProps> = ({ onSave }) => {
  const [formData, setFormData] = useState<ApiKeys>({
    googleImageApiKey: '',
    googleCseId: '',
    youtubeApiKey: ''
  })
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  
  // Load API keys from encrypted file on mount
  useEffect(() => {
    let mounted = true
    const loadKeys = async () => {
      try {
        const savedKeys = await apiKeyStorage.load()
        if (mounted && savedKeys) {
          setFormData(savedKeys)
          console.log('API keys loaded successfully')
        }
        // No need to log if no keys found - this is normal for new users
      } catch (error) {
        console.error('Unexpected error loading API keys:', error)
      }
    }
    loadKeys()
    
    return () => {
      mounted = false
    }
  }, [])
  
  const [showPasswords, setShowPasswords] = useState(false)
  const [errors, setErrors] = useState<Partial<ApiKeys>>({})

  const handleInputChange = (field: keyof ApiKeys, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<ApiKeys> = {}
    
    if (!formData.googleImageApiKey.trim()) {
      newErrors.googleImageApiKey = 'Google Image API Key is required'
    }
    
    if (!formData.googleCseId.trim()) {
      newErrors.googleCseId = 'Google CSE ID is required'
    }
    
    if (!formData.youtubeApiKey.trim()) {
      newErrors.youtubeApiKey = 'YouTube API Key is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validateForm()) {
      // Save to encrypted file
      try {
        await apiKeyStorage.save(formData)
        console.log('API keys saved to encrypted file')
        setToastMessage('API keys saved securely!')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      } catch (error) {
        console.error('Error saving API keys:', error)
        setToastMessage('Failed to save API keys')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
      
      onSave?.(formData)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPasswords(!showPasswords)
  }

  const inputType = showPasswords ? 'text' : 'password'

  return (
    <Card>
      <Section>
        <h1 className="text-2xl font-semibold text-gray-100 mb-2">
          Settings
        </h1>
        <p className="text-gray-400">
          Configure your API keys for enhanced functionality
        </p>
        {/* Show if keys are already saved */}
        {(formData.googleImageApiKey || formData.googleCseId || formData.youtubeApiKey) ? (
          <p className="text-green-400 text-sm mt-2">
            ✓ API keys are loaded from saved settings
          </p>
        ) : (
          <p className="text-yellow-400 text-sm mt-2">
            ⚠️ No API keys found. Please enter your API keys below to enable media features.
          </p>
        )}
      </Section>

      <form role="form" onSubmit={handleSubmit}>
        <Section>
          <Card variant="dark" className="p-6">
            <h2 className="text-xl font-medium text-gray-200 mb-6">
              API Configuration
            </h2>
            
            <Grid cols={1} gap="large">
              <Input
                label="Google Image Search API Key"
                required
                type={inputType}
                value={formData.googleImageApiKey}
                onChange={(e) => handleInputChange('googleImageApiKey', e.target.value)}
                placeholder="Enter your Google Image Search API key"
                error={errors.googleImageApiKey}
              />

              <Input
                label="Google Custom Search Engine (CSE) ID"
                required
                type="text"
                value={formData.googleCseId}
                onChange={(e) => handleInputChange('googleCseId', e.target.value)}
                placeholder="Enter your Google CSE ID"
                error={errors.googleCseId}
              />

              <Input
                label="YouTube Data API Key"
                required
                type={inputType}
                value={formData.youtubeApiKey}
                onChange={(e) => handleInputChange('youtubeApiKey', e.target.value)}
                placeholder="Enter your YouTube API key"
                error={errors.youtubeApiKey}
              />

              <div className="flex items-center">
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={togglePasswordVisibility}
                  icon={showPasswords ? '🙈' : '👁️'}
                >
                  Toggle API Key Visibility
                </Button>
              </div>
            </Grid>
          </Card>
        </Section>

        <Section>
          <Button
            type="submit"
            variant="primary"
            size="large"
            fullWidth
          >
            Save Settings
          </Button>
        </Section>
        
        <Section>
          <Alert variant="info">
            <h3 className="font-medium mb-2">📘 Getting Your API Keys</h3>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li><strong>Google APIs:</strong> Visit Google Cloud Console → APIs & Services → Credentials</li>
              <li><strong>YouTube API:</strong> Enable YouTube Data API v3 in Google Cloud Console</li>
              <li><strong>Custom Search:</strong> Create a search engine at cse.google.com</li>
            </ul>
          </Alert>
        </Section>
      </form>
      
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastMessage.includes('success') ? 'success' : 'error'}
          onClose={() => setShowToast(false)}
        />
      )}
    </Card>
  )
}

export default Settings;