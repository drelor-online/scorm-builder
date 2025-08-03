import { render, screen } from '../../../test/testProviders'
import { describe, it, expect } from 'vitest'
import { ButtonGroup } from './ButtonGroup'
import { Button } from './Button'

describe('ButtonGroup Component', () => {
  it('renders children buttons', () => {
    render(
      <ButtonGroup>
        <Button>Button 1</Button>
        <Button>Button 2</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1')).toBeInTheDocument()
    expect(screen.getByText('Button 2')).toBeInTheDocument()
  })

  it('applies horizontal layout by default', () => {
    render(
      <ButtonGroup>
        <Button>Button 1</Button>
      </ButtonGroup>
    )
    const group = screen.getByText('Button 1').parentElement
    expect(group).toHaveClass('button-group', 'button-group-horizontal')
  })

  it('applies vertical layout when specified', () => {
    render(
      <ButtonGroup direction="vertical">
        <Button>Button 1</Button>
      </ButtonGroup>
    )
    const group = screen.getByText('Button 1').parentElement
    expect(group).toHaveClass('button-group-vertical')
  })

  it('applies different gap sizes', () => {
    const { rerender } = render(
      <ButtonGroup gap="small">
        <Button>Button 1</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1').parentElement).toHaveClass('button-group-gap-small')
    
    rerender(
      <ButtonGroup gap="large">
        <Button>Button 1</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1').parentElement).toHaveClass('button-group-gap-large')
  })

  it('applies alignment classes', () => {
    const { rerender } = render(
      <ButtonGroup align="start">
        <Button>Button 1</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1').parentElement).toHaveClass('button-group-align-start')
    
    rerender(
      <ButtonGroup align="center">
        <Button>Button 1</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1').parentElement).toHaveClass('button-group-align-center')
    
    rerender(
      <ButtonGroup align="end">
        <Button>Button 1</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1').parentElement).toHaveClass('button-group-align-end')
  })

  it('applies space-between justification', () => {
    render(
      <ButtonGroup justify="space-between">
        <Button>Button 1</Button>
        <Button>Button 2</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1').parentElement).toHaveClass('button-group-justify-space-between')
  })

  it('wraps buttons when specified', () => {
    render(
      <ButtonGroup wrap>
        <Button>Button 1</Button>
        <Button>Button 2</Button>
      </ButtonGroup>
    )
    expect(screen.getByText('Button 1').parentElement).toHaveClass('button-group-wrap')
  })
})