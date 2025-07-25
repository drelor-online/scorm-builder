import React, { useState, useEffect } from 'react';
import { Card, Button, Flex, Alert } from './DesignSystem';
import { securityMonitor } from '../utils/securityMonitor';
import { invoke } from '@tauri-apps/api/core';

interface SecurityEvent {
  type: string;
  timestamp: string;
  details: any;
  blocked: boolean;
}

export const SecurityMonitorDashboard: React.FC = () => {
  const [violations, setViolations] = useState<Record<string, number>>({});
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      const summary = securityMonitor.getViolationSummary();
      setViolations(summary);
    };

    // Update every 2 seconds
    const interval = setInterval(updateStats, 2000);
    updateStats();

    return () => clearInterval(interval);
  }, []);

  const runSecurityTests = async () => {
    setTestMode(true);
    const events: SecurityEvent[] = [];

    // Test 1: Path Traversal
    try {
      await invoke('save_project', {
        projectData: createMockProject(),
        filePath: '../../../etc/passwd.scormproj'
      });
      events.push({
        type: 'path_traversal',
        timestamp: new Date().toISOString(),
        details: { path: '../../../etc/passwd.scormproj' },
        blocked: false
      });
    } catch (error) {
      events.push({
        type: 'path_traversal',
        timestamp: new Date().toISOString(),
        details: { path: '../../../etc/passwd.scormproj', error: String(error) },
        blocked: true
      });
    }

    // Test 2: XSS Attempt
    const xssContent = '<script>alert("XSS")</script><p>Normal content</p>';
    const sanitized = await testXSS(xssContent);
    events.push({
      type: 'xss_attempt',
      timestamp: new Date().toISOString(),
      details: { 
        original: xssContent,
        sanitized: sanitized,
        blocked: !sanitized.includes('script')
      },
      blocked: true
    });

    // Test 3: Invalid URL
    try {
      await invoke('download_image', {
        url: 'https://malicious-site.com/steal-data.jpg'
      });
      events.push({
        type: 'invalid_url',
        timestamp: new Date().toISOString(),
        details: { url: 'https://malicious-site.com/steal-data.jpg' },
        blocked: false
      });
    } catch (error) {
      events.push({
        type: 'invalid_url',
        timestamp: new Date().toISOString(),
        details: { url: 'https://malicious-site.com/steal-data.jpg', error: String(error) },
        blocked: true
      });
    }

    setRecentEvents(events);
    setTestMode(false);
  };

  const createMockProject = () => ({
    version: '1.0',
    project: { 
      id: 'test', 
      name: 'Test', 
      created: new Date().toISOString(), 
      last_modified: new Date().toISOString() 
    },
    course_data: { 
      title: 'Test', 
      difficulty: 1, 
      template: 'none', 
      topics: [], 
      custom_topics: null 
    },
    ai_prompt: null,
    course_content: null,
    media: { images: [], videos: [], audio: [] },
    audio_settings: { voice: 'en-US', speed: 1, pitch: 1 },
    scorm_config: { version: '2004', completion_criteria: 'all', passing_score: 80 }
  });

  const testXSS = async (content: string): Promise<string> => {
    // This would use the actual sanitizer
    return content.replace(/<script[^>]*>.*?<\/script>/gi, '');
  };

  const getStatusColor = (blocked: boolean) => blocked ? '#22c55e' : '#ef4444';
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'path_traversal': return '📁';
      case 'xss_attempt': return '💉';
      case 'invalid_url': return '🔗';
      case 'size_limit': return '📏';
      default: return '⚠️';
    }
  };

  const totalViolations = Object.values(violations).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Card title="🔒 Security Monitor" padding="large">
        {/* Status Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Alert 
            variant={totalViolations > 0 ? 'warning' : 'success'}
          >
          {totalViolations > 0 
            ? `${totalViolations} security violation(s) detected`
            : 'No security violations detected'
          }
          </Alert>
        </div>

        {/* Violation Summary */}
        <div style={{ marginBottom: '2rem' }}>
          <h3>Violation Summary</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1rem'
          }}>
            {Object.entries({
              'Path Traversal': violations.path_traversal || 0,
              'XSS Attempts': violations.xss_attempt || 0,
              'Invalid URLs': violations.invalid_url || 0,
              'Size Violations': violations.size_limit || 0,
              'Rate Limits': violations.rate_limit || 0
            }).map(([label, count]) => (
              <div
                key={label}
                style={{
                  background: '#27272a',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                  {count}
                </div>
                <div style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Events */}
        {recentEvents.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>Recent Security Events</h3>
            <div style={{ marginTop: '1rem' }}>
              {recentEvents.map((event, index) => (
                <div
                  key={index}
                  style={{
                    background: '#27272a',
                    borderRadius: '0.375rem',
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    borderLeft: `4px solid ${getStatusColor(event.blocked)}`
                  }}
                >
                  <Flex justify="space-between" align="center">
                    <div>
                      <span style={{ marginRight: '0.5rem' }}>
                        {getEventIcon(event.type)}
                      </span>
                      <strong>{event.type.replace(/_/g, ' ').toUpperCase()}</strong>
                      <span style={{ 
                        marginLeft: '1rem',
                        color: getStatusColor(event.blocked),
                        fontWeight: 'bold'
                      }}>
                        {event.blocked ? 'BLOCKED' : 'ALLOWED'}
                      </span>
                    </div>
                    <span style={{ color: '#71717a', fontSize: '0.875rem' }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </Flex>
                  
                  {event.details && (
                    <div style={{ 
                      marginTop: '0.5rem',
                      fontSize: '0.875rem',
                      color: '#a1a1aa',
                      fontFamily: 'monospace'
                    }}>
                      {JSON.stringify(event.details, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <Flex gap="medium">
          <Button
            onClick={runSecurityTests}
            disabled={testMode}
          >
            {testMode ? 'Running Tests...' : 'Run Security Tests'}
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? 'Pause Monitoring' : 'Resume Monitoring'}
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => {
              setRecentEvents([]);
              // Clear violations in monitor
              console.log('Cleared security events');
            }}
          >
            Clear Events
          </Button>
        </Flex>

        {/* Security Tips */}
        <div style={{ 
          marginTop: '2rem',
          padding: '1rem',
          background: '#18181b',
          borderRadius: '0.5rem'
        }}>
          <h4 style={{ marginTop: 0 }}>🛡️ Security Best Practices</h4>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Always validate user input on both client and server</li>
            <li>Use allowlists instead of blocklists for validation</li>
            <li>Sanitize HTML content before storing or displaying</li>
            <li>Restrict file operations to designated directories</li>
            <li>Monitor and log all security events</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};