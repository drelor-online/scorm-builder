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
      return new Date(dateString).toLocaleString()
    } catch {
      return '—'
    }
  }

  return (
    <div className={styles.listContainer}>
      <div className={styles.toolbar}>
        <Icon icon={Search} />
        <Input
          placeholder="Search projects by name or path…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          className={styles.searchInput}
        />
        <select
          aria-label="Sort key"
          value={sortKey}
          onChange={e => setSortKey(e.target.value as any)}
          className={styles.sortSelect}
        >
          <option value="name">Title</option>
          <option value="lastAccessed">Last Accessed</option>
        </select>
        <select
          aria-label="Sort direction"
          value={sortDir}
          onChange={e => setSortDir(e.target.value as any)}
          className={styles.sortSelect}
        >
          <option value="asc">↑</option>
          <option value="desc">↓</option>
        </select>
        <div className={styles.count}>{filtered.length} projects</div>
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
              <div className={styles.last} role="cell" title={last}>
                {formatDate(last)}
              </div>
              <div className={styles.actions} role="cell">
                <Button size="small" onClick={() => onOpen(p)}>Open</Button>
                <Button size="small" variant="secondary" onClick={() => onExport(p)}>Export</Button>
                <Button size="small" variant="secondary" onClick={() => onRename(p)}>Rename</Button>
                <Button 
                  size="small" 
                  variant="danger" 
                  data-testid={`delete-project-${p.id}`} 
                  onClick={() => onDelete(p)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}