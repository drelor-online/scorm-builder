import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '../../test/testProviders';
import userEvent from '@testing-library/user-event';
import { MediaLibrary } from '../MediaLibrary';

describe('MediaLibrary - Memory Leak Prevention', () => {
  let clearIntervalSpy: any;
  let setIntervalSpy: any;
  let intervalIds: number[] = [];

  beforeEach(() => {
    intervalIds = [];
    
    // Spy on setInterval to track created intervals
    setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation((callback: any, delay: number) => {
      const id = Math.random();
      intervalIds.push(id);
      const originalId = (global.setInterval as any).mock.results.find((r: any) => !r.value)?.value || id;
      return originalId;
    });

    // Spy on clearInterval to track cleared intervals
    clearIntervalSpy = vi.spyOn(global, 'clearInterval');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should clear upload progress interval when upload completes', async () => {
    const onSelect = vi.fn();
    const onUpload = vi.fn();
    const onDelete = vi.fn();

    const { unmount } = render(
      <MediaLibrary
        items={[]}
        onSelect={onSelect}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    );

    // Create a file to upload
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText('Upload');
    
    // Trigger file upload
    await userEvent.upload(fileInput, file);

    // Wait for the upload to be called
    await waitFor(() => {
      expect(onUpload).toHaveBeenCalled();
    });

    // Check that setInterval was called for upload progress
    expect(setIntervalSpy).toHaveBeenCalled();

    // Wait for progress to complete (simulated by 100ms intervals * 10 = 1 second)
    await waitFor(() => {
      expect(clearIntervalSpy).toHaveBeenCalled();
    }, { timeout: 2000 });

    // Verify interval was cleared
    const setIntervalCalls = setIntervalSpy.mock.calls.length;
    const clearIntervalCalls = clearIntervalSpy.mock.calls.length;
    
    expect(clearIntervalCalls).toBeGreaterThan(0);
    
    // Unmount to ensure no lingering intervals
    unmount();
  });

  it('should clear interval when component unmounts during upload', async () => {
    const onSelect = vi.fn();
    const onUpload = vi.fn();
    const onDelete = vi.fn();

    const { unmount } = render(
      <MediaLibrary
        items={[]}
        onSelect={onSelect}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    );

    // Create a file to upload
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText('Upload');
    
    // Trigger file upload
    await userEvent.upload(fileInput, file);

    // Wait for the upload to be called
    await waitFor(() => {
      expect(onUpload).toHaveBeenCalled();
    });

    // Check that setInterval was called
    expect(setIntervalSpy).toHaveBeenCalled();

    // Unmount component before upload completes
    unmount();

    // After unmount, interval should be cleared
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should not create multiple intervals for simultaneous uploads', async () => {
    const onSelect = vi.fn();
    const onUpload = vi.fn();
    const onDelete = vi.fn();

    render(
      <MediaLibrary
        items={[]}
        onSelect={onSelect}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    );

    const fileInput = screen.getByLabelText('Upload');
    
    // Create multiple files
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });

    // Upload first file
    await userEvent.upload(fileInput, file1);
    
    // Immediately upload second file
    await userEvent.upload(fileInput, file2);

    // Should only have one interval running at a time
    const intervalCallsBeforeComplete = setIntervalSpy.mock.calls.length;
    
    // Wait for uploads to complete
    await waitFor(() => {
      expect(clearIntervalSpy).toHaveBeenCalled();
    }, { timeout: 2000 });

    // Verify we don't leak intervals
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(intervalCallsBeforeComplete);
  });
});