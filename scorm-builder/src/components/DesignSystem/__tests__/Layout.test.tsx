import { render, screen } from '../../../test/testProviders'
import { describe, it, expect } from 'vitest'
import { PageContainer, Section, Flex, Grid } from './Layout'

describe('Layout Components', () => {
  describe('PageContainer', () => {
    it('renders children content', () => {
      render(<PageContainer>Page content</PageContainer>)
      expect(screen.getByText('Page content')).toBeInTheDocument()
    })

    it('applies max width constraint', () => {
      render(<PageContainer>Content</PageContainer>)
      expect(container.firstChild).toHaveClass('page-container')
    })

    it('applies custom className', () => {
      render(<PageContainer className="custom">Content</PageContainer>)
      expect(container.firstChild).toHaveClass('custom')
    })
  })

  describe('Section', () => {
    it('renders with title', () => {
      render(<Section title="Section Title">Content</Section>)
      expect(screen.getByText('Section Title')).toBeInTheDocument()
      expect(screen.getByText('Section Title').tagName).toBe('H2')
    })

    it('renders without title', () => {
      render(<Section>Content</Section>)
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('applies different spacing', () => {
      render(<Section spacing="large">Content</Section>)
      expect(container.firstChild).toHaveClass('section-spacing-large')
    })
  })

  describe('Flex', () => {
    it('renders children in flex container', () => {
      render(
        <Flex>
          <div>Item 1</div>
          <div>Item 2</div>
        </Flex>
      )
      expect(container.firstChild).toHaveClass('flex')
    })

    it('applies different directions', () => {
      render(<Flex direction="column">Content</Flex>)
      expect(container.firstChild).toHaveClass('flex-column')
    })

    it('applies gap sizes', () => {
      render(<Flex gap="large">Content</Flex>)
      expect(container.firstChild).toHaveClass('flex-gap-large')
    })

    it('applies alignment and justification', () => {
      render(
        <Flex align="center" justify="space-between">Content</Flex>
      )
      expect(container.firstChild).toHaveClass('flex-align-center', 'flex-justify-space-between')
    })

    it('wraps content when specified', () => {
      render(<Flex wrap>Content</Flex>)
      expect(container.firstChild).toHaveClass('flex-wrap')
    })
  })

  describe('Grid', () => {
    it('renders children in grid container', () => {
      render(
        <Grid>
          <div>Item 1</div>
          <div>Item 2</div>
        </Grid>
      )
      expect(container.firstChild).toHaveClass('grid')
    })

    it('applies different column counts', () => {
      render(<Grid cols={3}>Content</Grid>)
      expect(container.firstChild).toHaveClass('grid-cols-3')
    })

    it('applies gap sizes', () => {
      render(<Grid gap="large">Content</Grid>)
      expect(container.firstChild).toHaveClass('grid-gap-large')
    })

    it('applies responsive columns', () => {
      render(<Grid cols={{ sm: 1, md: 2, lg: 3 }}>Content</Grid>)
      expect(container.firstChild).toHaveClass('grid-cols-sm-1', 'grid-cols-md-2', 'grid-cols-lg-3')
    })
  })
})