import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test/testProviders'
import { ButtonGroup } from '../ButtonGroup'

describe('ButtonGroup Component - Simple Tests', () => {
  it('should render children', () => {
    render(
      <ButtonGroup>
        <button>Button 1</button>
        <button>Button 2</button>
      </ButtonGroup>
    )

    expect(screen.getByText('Button 1')).toBeInTheDocument()
    expect(screen.getByText('Button 2')).toBeInTheDocument()
  })

  it('should apply direction classes', () => {
    const { rerender, container } = render(
      <ButtonGroup direction="horizontal">
        <button>Test</button>
      </ButtonGroup>
    )
    
    expect(container.firstChild).toHaveClass('button-group-horizontal')

    rerender(
      <ButtonGroup direction="vertical">
        <button>Test</button>
      </ButtonGroup>
    )
    expect(container.firstChild).toHaveClass('button-group-vertical')
  })

  it('should apply gap classes', () => {
    const { rerender, container } = render(
      <ButtonGroup gap="small">
        <button>Test</button>
      </ButtonGroup>
    )
    
    expect(container.firstChild).toHaveClass('button-group-gap-small')

    rerender(
      <ButtonGroup gap="medium">
        <button>Test</button>
      </ButtonGroup>
    )
    expect(container.firstChild).toHaveClass('button-group-gap-medium')

    rerender(
      <ButtonGroup gap="large">
        <button>Test</button>
      </ButtonGroup>
    )
    expect(container.firstChild).toHaveClass('button-group-gap-large')
  })

  it('should apply align classes', () => {
    const { rerender, container } = render(
      <ButtonGroup align="start">
        <button>Test</button>
      </ButtonGroup>
    )
    
    expect(container.firstChild).toHaveClass('button-group-align-start')

    rerender(
      <ButtonGroup align="center">
        <button>Test</button>
      </ButtonGroup>
    )
    expect(container.firstChild).toHaveClass('button-group-align-center')

    rerender(
      <ButtonGroup align="end">
        <button>Test</button>
      </ButtonGroup>
    )
    expect(container.firstChild).toHaveClass('button-group-align-end')
  })

  it('should apply justify classes when provided', () => {
    const { rerender, container } = render(
      <ButtonGroup justify="start">
        <button>Test</button>
      </ButtonGroup>
    )
    
    expect(container.firstChild).toHaveClass('button-group-justify-start')

    rerender(
      <ButtonGroup justify="space-between">
        <button>Test</button>
      </ButtonGroup>
    )
    expect(container.firstChild).toHaveClass('button-group-justify-space-between')
  })

  it('should apply wrap class when wrap is true', () => {
    render(
      <ButtonGroup wrap={true}>
        <button>Test</button>
      </ButtonGroup>
    )
    
    expect(container.firstChild).toHaveClass('button-group-wrap')
  })

  it('should not apply wrap class when wrap is false', () => {
    render(
      <ButtonGroup wrap={false}>
        <button>Test</button>
      </ButtonGroup>
    )
    
    expect(container.firstChild).not.toHaveClass('button-group-wrap')
  })

  it('should apply custom className', () => {
    render(
      <ButtonGroup className="custom-group">
        <button>Test</button>
      </ButtonGroup>
    )
    
    expect(container.firstChild).toHaveClass('custom-group')
  })

  it('should use default props', () => {
    render(
      <ButtonGroup>
        <button>Test</button>
      </ButtonGroup>
    )
    
    const buttonGroup = container.firstChild
    expect(buttonGroup).toHaveClass('button-group')
    expect(buttonGroup).toHaveClass('button-group-horizontal')
    expect(buttonGroup).toHaveClass('button-group-gap-medium')
    expect(buttonGroup).toHaveClass('button-group-align-center')
    expect(buttonGroup).not.toHaveClass('button-group-wrap')
  })

  it('should handle multiple children', () => {
    render(
      <ButtonGroup>
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
        <span>Four</span>
      </ButtonGroup>
    )

    expect(screen.getByText('One')).toBeInTheDocument()
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.getByText('Three')).toBeInTheDocument()
    expect(screen.getByText('Four')).toBeInTheDocument()
  })
})