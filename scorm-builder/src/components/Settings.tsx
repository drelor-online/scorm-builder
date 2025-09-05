import React, { useState, useEffect } from 'react'
import { Card } from './DesignSystem/Card'
import { Button } from './DesignSystem/Button'
import { Input } from './DesignSystem/Input'
import { Section, Grid } from './DesignSystem/Layout'
import { Alert } from './DesignSystem/Alert'
import { apiKeyStorage, ApiKeys } from '../services/ApiKeyStorage'
import { logger, disableCategory, enableCategory, getDisabledCategories, clearDisabledCategories } from '../utils/logger'
import { Tabs, Tab } from './DesignSystem/Tabs'
import { Badge } from './DesignSystem/Badge'
import { Icon } from './DesignSystem'
import { Check, AlertTriangle, Eye, EyeOff, BookOpen, Download, Shield } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'

interface SettingsProps {
  onSave?: (apiKeys: ApiKeys) => void
}

export const Settings: React.FC<SettingsProps> = ({ onSave }) => {
  const [formData, setFormData] = useState<ApiKeys>({
    googleImageApiKey: '',
    googleCseId: '',
    youtubeApiKey: ''
  })
  const [disabledLogCategories, setDisabledLogCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [forceDownloadMode, setForceDownloadMode] = useState<boolean>(false)
  const { success, error: notifyError } = useNotifications()
  
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
    
    // Load disabled log categories
    const categories = getDisabledCategories()
    setDisabledLogCategories(categories)
    
    // Load force download mode setting
    const savedForceDownload = localStorage.getItem('scorm_builder_force_download_mode')
    if (savedForceDownload !== null) {
      setForceDownloadMode(JSON.parse(savedForceDownload))
    }
    
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
        success('API keys saved securely!')
      } catch (error) {
        console.error('Error saving API keys:', error)
        notifyError('Failed to save API keys')
      }
      
      onSave?.(formData)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPasswords(!showPasswords)
  }

  const handleForceDownloadToggle = () => {
    const newValue = !forceDownloadMode
    setForceDownloadMode(newValue)
    localStorage.setItem('scorm_builder_force_download_mode', JSON.stringify(newValue))
    
    if (newValue) {
      success('Force Download Mode enabled - use only if experiencing frequent download failures')
    } else {
      success('Force Download Mode disabled')
    }
  }

  const inputType = showPasswords ? 'text' : 'password'
  
  // Logger category handlers
  const handleAddCategory = () => {
    if (newCategory && !disabledLogCategories.includes(newCategory)) {
      disableCategory(newCategory)
      setDisabledLogCategories([...disabledLogCategories, newCategory])
      setNewCategory('')
      logger.info(`[Settings] Disabled logging for category: ${newCategory}`)
    }
  }
  
  const handleRemoveCategory = (category: string) => {
    enableCategory(category)
    setDisabledLogCategories(disabledLogCategories.filter(c => c !== category))
    logger.info(`[Settings] Enabled logging for category: ${category}`)
  }
  
  const handleClearAllCategories = () => {
    clearDisabledCategories()
    setDisabledLogCategories([])
    logger.info('[Settings] Cleared all disabled log categories')
  }

  return (
    <Card>
      <Section>
        <h1 className="text-2xl font-semibold text-gray-100 mb-2">
          Settings
        </h1>
        <p className="text-gray-400">
          Configure your application settings
        </p>
      </Section>

      <Tabs>
        <Tab tabKey="api-keys" label="API Keys">
          <form role="form" onSubmit={handleSubmit}>
            <Section>
              {/* Show if keys are already saved */}
              {(formData.googleImageApiKey || formData.googleCseId || formData.youtubeApiKey) ? (
                <p className="text-green-400 text-sm mt-2">
                  <>
                    <Icon icon={Check} size="sm" color="var(--color-success)" />
                    API keys are loaded from saved settings
                  </>
                </p>
              ) : (
                <p className="text-yellow-400 text-sm mt-2">
                  <>
                    <Icon icon={AlertTriangle} size="sm" color="var(--color-warning)" />
                    No API keys found. Please enter your API keys below to enable media features.
                  </>
                </p>
              )}
            </Section>
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
                  icon={showPasswords ? <Icon icon={EyeOff} size="sm" /> : <Icon icon={Eye} size="sm" />}
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
            <h3 className="font-medium mb-2">
              <Icon icon={BookOpen} size="sm" />
              Getting Your API Keys
            </h3>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li><strong>Google APIs:</strong> Visit Google Cloud Console → APIs & Services → Credentials</li>
              <li><strong>YouTube API:</strong> Enable YouTube Data API v3 in Google Cloud Console</li>
              <li><strong>Custom Search:</strong> Create a search engine at cse.google.com</li>
            </ul>
          </Alert>
        </Section>
          </form>
        </Tab>
        
        <Tab tabKey="logger" label="Logger Settings">
          <Section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--gray-200)', marginBottom: 'var(--space-sm)' }}>
              Logger Category Filtering
            </h2>
            <p style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-lg)' }}>
              Disable logging for specific categories to reduce console noise. Use wildcards (*) to match multiple categories.
            </p>
            
            {/* Quick Toggle Common Categories */}
            <Card variant="dark" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-300)', marginBottom: 'var(--space-md)' }}>Quick Toggle Common Categories</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                {[
                  { name: 'MediaService', desc: 'Media operations' },
                  { name: 'FileStorage', desc: 'File system' },
                  { name: 'PageThumbnail*', desc: 'All thumbnail logs' },
                  { name: 'UnifiedMediaContext', desc: 'Media context' },
                  { name: 'MediaEnhancement*', desc: 'Enhancement wizard' }
                ].map(cat => (
                  <Button
                    key={cat.name}
                    variant={disabledLogCategories.includes(cat.name) ? 'secondary' : 'tertiary'}
                    size="small"
                    onClick={() => {
                      if (disabledLogCategories.includes(cat.name)) {
                        handleRemoveCategory(cat.name)
                      } else {
                        disableCategory(cat.name)
                        setDisabledLogCategories([...disabledLogCategories, cat.name])
                        logger.info(`[Settings] Disabled logging for category: ${cat.name}`)
                      }
                    }}
                    title={cat.desc}
                  >
                    <>
                      {disabledLogCategories.includes(cat.name) && <Icon icon={Check} size="xs" />}
                      {cat.name}
                    </>
                  </Button>
                ))}
              </div>
            </Card>
            
            {/* Add Custom Category */}
            <Card variant="dark" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-300)', marginBottom: 'var(--space-md)' }}>Add Custom Category</h3>
              <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    placeholder="Enter category name (e.g., MyComponent, Debug*, etc.)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  />
                </div>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={handleAddCategory}
                  disabled={!newCategory}
                  style={{ marginTop: 0 }}
                >
                  Add Category
                </Button>
              </div>
            </Card>
                
            {/* Currently Disabled Categories */}
            {disabledLogCategories.length > 0 ? (
              <Card variant="dark" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-300)' }}>Currently Disabled Categories</h3>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleClearAllCategories}
                  >
                    Enable All
                  </Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {disabledLogCategories.map(category => (
                    <div
                      key={category}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-sm)', backgroundColor: 'var(--gray-800)', borderRadius: 'var(--radius-sm)' }}
                    >
                      <span style={{ color: 'var(--gray-200)', fontFamily: 'monospace', fontSize: '0.875rem' }}>{category}</span>
                      <Button
                        variant="tertiary"
                        size="small"
                        onClick={() => handleRemoveCategory(category)}
                        aria-label={`Enable ${category}`}
                      >
                        Enable
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Alert variant="info">
                No categories are currently disabled. All log messages will be shown in the console.
              </Alert>
            )}
              
          </Section>
        </Tab>

        <Tab tabKey="advanced" label="Advanced">
          <Section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--gray-200)', marginBottom: 'var(--space-sm)' }}>
              Advanced Download Settings
            </h2>
            <p style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-lg)' }}>
              Configure specialized download behavior for corporate networks and VPN environments.
            </p>
            
            {/* Force Download Mode */}
            <Card variant="dark" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                    <Icon icon={Download} size="sm" color="var(--gray-300)" />
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-200)' }}>
                      Force Download Mode
                    </h3>
                    <Badge variant={forceDownloadMode ? 'success' : 'default'}>
                      {forceDownloadMode ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-md)' }}>
                    <strong style={{ color: 'var(--color-warning)' }}>⚠️ Insecure Mode:</strong> Disables security restrictions for image downloads only. 
                    Bypasses CORS, SSL validation, and domain restrictions to work in VPN/corporate environments. 
                    <strong style={{ color: 'var(--color-warning)' }}> Use only for trusted image sources.</strong>
                  </p>
                  
                  {forceDownloadMode && (
                    <Alert variant="warning">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <Icon icon={Shield} size="sm" />
                        <div>
                          <strong>Insecure Download Mode is Active</strong>
                          <p style={{ fontSize: '0.75rem', margin: 0, marginTop: '4px' }}>
                            All security restrictions are disabled for image downloads. SSL certificates, domain restrictions, 
                            and CORS policies are bypassed. Only use with trusted image sources.
                          </p>
                        </div>
                      </div>
                    </Alert>
                  )}
                </div>
                
                <Button
                  variant={forceDownloadMode ? 'primary' : 'secondary'}
                  size="medium"
                  onClick={handleForceDownloadToggle}
                  style={{ minWidth: '100px' }}
                >
                  {forceDownloadMode ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </Card>

            {/* Information about when to use */}
            <Alert variant="info">
              <h3 style={{ fontWeight: 500, marginBottom: 'var(--space-sm)' }}>
                <Icon icon={BookOpen} size="sm" />
                When to Enable Force Download Mode
              </h3>
              <ul style={{ fontSize: '0.875rem', margin: 0, paddingLeft: '1.25rem' }}>
                <li>You're on a corporate network or VPN</li>
                <li>Image downloads frequently fail or timeout</li>
                <li>You see "CORS policy" or "blocked" errors in the console</li>
                <li>Regular download methods are unreliable</li>
              </ul>
              <p style={{ fontSize: '0.875rem', margin: 0, marginTop: 'var(--space-sm)', color: 'var(--gray-400)' }}>
                This mode may be slower but more reliable in restrictive network environments.
              </p>
            </Alert>
          </Section>
        </Tab>
      </Tabs>
      
    </Card>
  )
}

export default Settings;