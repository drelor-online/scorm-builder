import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/testProviders';
import userEvent from '@testing-library/user-event';
import { MediaLibrary } from '../MediaLibrary';

describe('MediaLibrary - Array Mutation Prevention', () => {
  it('should not mutate the original items array when sorting', () => {
    const originalItems = [
      { id: '1', name: 'Zebra.jpg', type: 'image' as const, size: 1000, url: 'url1', tags: [], uploadedAt: new Date('2024-01-01') },
      { id: '2', name: 'Apple.jpg', type: 'image' as const, size: 2000, url: 'url2', tags: [], uploadedAt: new Date('2024-01-02') },
      { id: '3', name: 'Banana.jpg', type: 'image' as const, size: 3000, url: 'url3', tags: [], uploadedAt: new Date('2024-01-03') }
    ];
    
    // Create a copy to compare later
    const itemsCopy = [...originalItems];
    
    const onSelect = vi.fn();
    const onUpload = vi.fn();
    const onDelete = vi.fn();
    
    render(
      <MediaLibrary
        items={originalItems}
        onSelect={onSelect}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    );
    
    // Check that original array order is preserved
    expect(originalItems[0].name).toBe('Zebra.jpg');
    expect(originalItems[1].name).toBe('Apple.jpg');
    expect(originalItems[2].name).toBe('Banana.jpg');
    
    // Verify original array wasn't mutated
    expect(originalItems).toEqual(itemsCopy);
  });

  it('should display items in sorted order without mutating props', async () => {
    const originalItems = [
      { id: '1', name: 'Zebra.jpg', type: 'image' as const, size: 1000, url: 'url1', tags: [], uploadedAt: new Date('2024-01-01') },
      { id: '2', name: 'Apple.jpg', type: 'image' as const, size: 2000, url: 'url2', tags: [], uploadedAt: new Date('2024-01-02') },
      { id: '3', name: 'Banana.jpg', type: 'image' as const, size: 3000, url: 'url3', tags: [], uploadedAt: new Date('2024-01-03') }
    ];
    
    const onSelect = vi.fn();
    const onUpload = vi.fn();
    const onDelete = vi.fn();
    
    const { container } = render(
      <MediaLibrary
        items={originalItems}
        onSelect={onSelect}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    );
    
    // Click on Sort by Name
    const sortSelect = screen.getByLabelText('Sort by');
    await userEvent.selectOptions(sortSelect, 'name');
    
    // Wait for items to render
    const items = await screen.findAllByTestId('media-item');
    
    // Check that items are displayed in alphabetical order
    expect(items[0]).toHaveTextContent('Apple.jpg');
    expect(items[1]).toHaveTextContent('Banana.jpg');
    expect(items[2]).toHaveTextContent('Zebra.jpg');
    
    // But original array should still be in original order
    expect(originalItems[0].name).toBe('Zebra.jpg');
    expect(originalItems[1].name).toBe('Apple.jpg');
    expect(originalItems[2].name).toBe('Banana.jpg');
  });
});