import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test/testProviders'
import { PageContainer, Section, Flex, Grid } from '../Layout'

describe('Layout Components - Simple Tests', () => {
  describe('PageContainer', () => {
    it('should render children', () => {
      render(
        <PageContainer>
          <div>Page content</div>
        </PageContainer>
      )
      
      expect(screen.getByText('Page content')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(
        <PageContainer className="custom-container">
          Content
        </PageContainer>
      )
      
      expect(container.firstChild).toHaveClass('page-container')
      expect(container.firstChild).toHaveClass('custom-container')
    })
  })

  describe('Section', () => {
    it('should render children', () => {
      render(
        <Section>
          <p>Section content</p>
        </Section>
      )
      
      expect(screen.getByText('Section content')).toBeInTheDocument()
    })

    it('should render title when provided', () => {
      render(
        <Section title="My Section">
          Content
        </Section>
      )
      
      expect(screen.getByText('My Section')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toHaveClass('section-title')
    })

    it('should apply spacing classes', () => {
      const { rerender, container } = render(
        <Section spacing="small">Content</Section>
      )
      
      expect(container.firstChild).toHaveClass('section-spacing-small')

      rerender(<Section spacing="medium">Content</Section>)
      expect(container.firstChild).not.toHaveClass('section-spacing-medium')

      rerender(<Section spacing="large">Content</Section>)
      expect(container.firstChild).toHaveClass('section-spacing-large')
    })

    it('should apply custom className', () => {
      render(
        <Section className="custom-section">
          Content
        </Section>
      )
      
      expect(container.firstChild).toHaveClass('section')
      expect(container.firstChild).toHaveClass('custom-section')
    })
  })

  describe('Flex', () => {
    it('should render children', () => {
      render(
        <Flex>
          <span>Item 1</span>
          <span>Item 2</span>
        </Flex>
      )
      
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
    })

    it('should apply direction classes', () => {
      const { rerender, container } = render(
        <Flex direction="row">Content</Flex>
      )
      
      expect(container.firstChild).not.toHaveClass('flex-column')

      rerender(<Flex direction="column">Content</Flex>)
      expect(container.firstChild).toHaveClass('flex-column')
    })

    it('should apply gap classes', () => {
      const { rerender, container } = render(
        <Flex gap="small">Content</Flex>
      )
      
      expect(container.firstChild).toHaveClass('flex-gap-small')

      rerender(<Flex gap="medium">Content</Flex>)
      expect(container.firstChild).toHaveClass('flex-gap-medium')

      rerender(<Flex gap="large">Content</Flex>)
      expect(container.firstChild).toHaveClass('flex-gap-large')
    })

    it('should apply align classes', () => {
      render(
        <Flex align="center">Content</Flex>
      )
      
      expect(container.firstChild).toHaveClass('flex-align-center')
    })

    it('should apply justify classes', () => {
      render(
        <Flex justify="space-between">Content</Flex>
      )
      
      expect(container.firstChild).toHaveClass('flex-justify-space-between')
    })

    it('should apply wrap class when true', () => {
      render(
        <Flex wrap={true}>Content</Flex>
      )
      
      expect(container.firstChild).toHaveClass('flex-wrap')
    })

    it('should apply custom style', () => {
      render(
        <Flex style={{ backgroundColor: 'red' }}>Content</Flex>
      )
      
      const flex = container.firstChild as HTMLElement
      expect(flex.style.backgroundColor).toBe('red')
    })

    it('should apply custom className', () => {
      render(
        <Flex className="custom-flex">Content</Flex>
      )
      
      expect(container.firstChild).toHaveClass('flex')
      expect(container.firstChild).toHaveClass('custom-flex')
    })

    it('should use default props', () => {
      render(<Flex>Content</Flex>)
      
      const flex = container.firstChild
      expect(flex).toHaveClass('flex')
      expect(flex).toHaveClass('flex-gap-medium')
      expect(flex).not.toHaveClass('flex-column')
      expect(flex).not.toHaveClass('flex-wrap')
    })
  })

  describe('Grid', () => {
    it('should render children', () => {
      render(
        <Grid>
          <div>Cell 1</div>
          <div>Cell 2</div>
        </Grid>
      )
      
      expect(screen.getByText('Cell 1')).toBeInTheDocument()
      expect(screen.getByText('Cell 2')).toBeInTheDocument()
    })

    it('should apply column classes for number cols', () => {
      const { rerender, container } = render(
        <Grid cols={3}>Content</Grid>
      )
      
      expect(container.firstChild).toHaveClass('grid-cols-3')

      rerender(<Grid cols={4}>Content</Grid>)
      expect(container.firstChild).toHaveClass('grid-cols-4')
    })

    it('should apply responsive column classes', () => {
      render(
        <Grid cols={{ sm: 1, md: 2, lg: 3 }}>Content</Grid>
      )
      
      expect(container.firstChild).toHaveClass('grid-cols-sm-1')
      expect(container.firstChild).toHaveClass('grid-cols-md-2')
      expect(container.firstChild).toHaveClass('grid-cols-lg-3')
    })

    it('should apply gap classes', () => {
      const { rerender, container } = render(
        <Grid gap="small">Content</Grid>
      )
      
      expect(container.firstChild).toHaveClass('grid-gap-small')

      rerender(<Grid gap="medium">Content</Grid>)
      expect(container.firstChild).toHaveClass('grid-gap-medium')

      rerender(<Grid gap="large">Content</Grid>)
      expect(container.firstChild).toHaveClass('grid-gap-large')
    })

    it('should apply custom className', () => {
      render(
        <Grid className="custom-grid">Content</Grid>
      )
      
      expect(container.firstChild).toHaveClass('grid')
      expect(container.firstChild).toHaveClass('custom-grid')
    })

    it('should use default props', () => {
      render(<Grid>Content</Grid>)
      
      const grid = container.firstChild
      expect(grid).toHaveClass('grid')
      expect(grid).toHaveClass('grid-cols-2')
      expect(grid).toHaveClass('grid-gap-medium')
    })
  })
})