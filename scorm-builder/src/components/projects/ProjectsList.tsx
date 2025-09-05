/**
 * ProjectsList Component - Simplified Design System Version
 * 
 * Compact, searchable vertical list that replaces the card grid
 * Uses Design System components and eliminates virtualization rendering issues
 */

import React, { useMemo, useState } from 'react'
import styles from './ProjectsList.module.css'
import { Button } from '../DesignSystem/Button'
import { Input } from '../DesignSystem/Input'
import { Icon } from '../DesignSystem/Icons'
import { Search } from 'lucide-react'
import { ProjectRow, getProjectPath, getLastAccessed } from './types'

type Props = {
  projects: ProjectRow[]
  onOpen: (p: ProjectRow) => void
  onExport: (p: ProjectRow) => void
  onDelete: (p: ProjectRow) => void
  onRename: (p: ProjectRow) => void
}

export default function ProjectsList({ projects, onOpen, onExport, onDelete, onRename }: Props) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'lastAccessed'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? projects.filter(p =>
          (p.name?.toLowerCase() ?? '').includes(q) ||
          getProjectPath(p).toLowerCase().includes(q)
        )
      : projects.slice()

    base.sort((a, b) => {
      let av: string = '', bv: string = ''
      if (sortKey === 'name') {
        av = a.name?.toLowerCase() || ''
        bv = b.name?.toLowerCase() || ''
      } else {
        av = getLastAccessed(a)
        bv = getLastAccessed(b)
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return base
  }, [projects, query, sortKey, sortDir])

  const formatDate = (dateString: string) => {
    if (!dateString) return '—'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '—'
      
      // Use Intl.RelativeTimeFormat for relative dates
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
      
      if (diffInSeconds < 60) return 'Just now'
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
      
      // For older dates, show actual date
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className={styles.listContainer}>
      <div className={styles.toolbar}>
        <div className={styles.inputWithIcon} aria-label="Search projects">
          <span className={styles.icon} aria-hidden="true">
            <Icon icon={Search} size="sm" />
          </span>
          <Input
            placeholder="Search projects by name or path…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>

        <select
          aria-label="Sort by"
          className={styles.sortSelect}
          value={sortKey}
          onChange={e => setSortKey(e.target.value as any)}
        >
          <option value="name">Title</option>
          <option value="lastAccessed">Last Modified</option>
        </select>

        <select
          aria-label="Sort direction"
          className={styles.sortDir}
          value={sortDir}
          onChange={e => setSortDir(e.target.value as any)}
        >
          <option value="asc">↑</option>
          <option value="desc">↓</option>
        </select>

        <div className={styles.count}>{filtered.length} projects</div>
      </div>

      <div className={styles.columns} role="rowgroup" aria-hidden="true">
        <div>PROJECT</div>
        <div style={{ textAlign: 'right' }}>LAST MODIFIED</div>
        <div style={{ textAlign: 'right' }}>ACTIONS</div>
      </div>

      <div className={styles.rows} role="table" aria-label="Projects">
        {filtered.map((p) => {
          const path = getProjectPath(p)
          const last = getLastAccessed(p)
          return (
            <div 
              key={p.id} 
              className={styles.row} 
              role="row" 
              tabIndex={0}
              onDoubleClick={() => onOpen(p)}
            >
              <div role="cell" className={styles.titleCell}>
                <div className={styles.title} title={p.name}>{p.name}</div>
                <div className={styles.path} title={path}>{path || 'No path specified'}</div>
              </div>
              <div className={styles.last} role="cell" title={last || '—'}>
                {last ? formatDate(last) : '—'}
              </div>
              <div className={styles.actions} role="cell">
                <Button size="small" onClick={() => onOpen(p)}>Open</Button>
                <Button size="small" variant="secondary" onClick={() => onExport(p)}>Export</Button>
                <Button size="small" variant="secondary" onClick={() => onRename(p)}>Rename</Button>
                <Button size="small" variant="danger" onClick={() => onDelete(p)}>Delete</Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}