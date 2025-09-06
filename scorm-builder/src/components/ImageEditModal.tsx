import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Cropper, CropperRef } from 'react-advanced-cropper'
import 'react-advanced-cropper/dist/style.css'
import { Modal, Button, ButtonGroup, ProgressBar } from './DesignSystem'
import { RotateCcw, FlipHorizontal, FlipVertical, Crop as CropIcon, ZoomIn, ZoomOut } from 'lucide-react'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import { useNotifications } from '../contexts/NotificationContext'
import styles from './ImageEditModal.module.css'

interface ImageEditModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  imageTitle: string
  originalImageId: string
  onImageUpdated: (imageId: string, newTitle: string) => void
}

interface EditState {
  rotation: number
  flipHorizontal: boolean
  flipVertical: boolean
  zoom: number
  aspectRatio: number | undefined // undefined = free-form, 1 = 1:1, 4/3, 16/9, etc.
}

interface TransformedImageState {
  transformedImageUrl: string | null
  isTransforming: boolean
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', error => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

const getCroppedImg = async (
  imageSrc: string,
  cropCoordinates: { left: number; top: number; width: number; height: number } | null,
  rotation = 0,
  flipHorizontal = false,
  flipVertical = false
): Promise<Blob> => {
  if (!cropCoordinates) {
    throw new Error('No crop coordinates provided')
  }
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  // Calculate final canvas dimensions after rotation
  const { width, height } = cropCoordinates
  const radians = (rotation * Math.PI) / 180
  
  // For 90° and 270° rotations, swap width and height
  const isRotated90or270 = rotation % 180 !== 0
  const finalWidth = isRotated90or270 ? height : width
  const finalHeight = isRotated90or270 ? width : height
  
  canvas.width = finalWidth
  canvas.height = finalHeight

  // Save the context state
  ctx.save()

  // Move to center of canvas
  ctx.translate(finalWidth / 2, finalHeight / 2)

  // Apply rotation
  ctx.rotate(radians)

  // Apply scaling for flips
  ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1)

  // Draw the cropped portion of the image
  // When drawing, we need to position relative to the center
  ctx.drawImage(
    image,
    cropCoordinates.left,
    cropCoordinates.top,
    cropCoordinates.width,
    cropCoordinates.height,
    -width / 2,
    -height / 2,
    width,
    height
  )

  // Restore the context state
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'))
        return
      }
      resolve(blob)
    }, 'image/jpeg', 0.95)
  })
}

const createTransformedImage = async (
  imageSrc: string,
  rotation = 0,
  flipHorizontal = false,
  flipVertical = false
): Promise<string> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  // Calculate canvas dimensions after rotation
  const radians = (rotation * Math.PI) / 180
  const isRotated90or270 = rotation % 180 !== 0
  
  // For 90° and 270° rotations, swap width and height
  const canvasWidth = isRotated90or270 ? image.height : image.width
  const canvasHeight = isRotated90or270 ? image.width : image.height
  
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  // Save the context state
  ctx.save()

  // Move to center of canvas
  ctx.translate(canvasWidth / 2, canvasHeight / 2)

  // Apply rotation
  ctx.rotate(radians)

  // Apply scaling for flips
  ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1)

  // Draw the image centered
  ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height)

  // Restore the context state
  ctx.restore()

  return canvas.toDataURL('image/jpeg', 0.95)
}

// Define aspect ratio constants for precise comparison
const ASPECT_RATIOS = {
  SQUARE: 1,
  STANDARD: 4 / 3, // ≈ 1.333
  WIDESCREEN: 16 / 9, // ≈ 1.778
  FREE: undefined
} as const

export const ImageEditModal: React.FC<ImageEditModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageTitle,
  originalImageId,
  onImageUpdated
}) => {
  const [editState, setEditState] = useState<EditState>({
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    zoom: 1,
    aspectRatio: undefined // Start with free-form cropping
  })
  
  const [transformedImage, setTransformedImage] = useState<TransformedImageState>({
    transformedImageUrl: null,
    isTransforming: false
  })
  
  const [cropCoordinates, setCropCoordinates] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const cropperRef = useRef<CropperRef>(null)
  
  const { updateMedia } = useUnifiedMedia()
  const { success: showSuccess, error: showError } = useNotifications()

  const onCropChange = useCallback((cropper: CropperRef) => {
    const coordinates = cropper.getCoordinates()
    setCropCoordinates(coordinates)
  }, [])

  // Update transformed image when transformations change
  useEffect(() => {
    const updateTransformedImage = async () => {
      // Only transform if we have actual transformations
      if (editState.rotation === 0 && !editState.flipHorizontal && !editState.flipVertical) {
        setTransformedImage({ transformedImageUrl: null, isTransforming: false })
        return
      }

      setTransformedImage(prev => ({ ...prev, isTransforming: true }))
      
      try {
        console.log('Creating transformed image with:', {
          rotation: editState.rotation,
          flipHorizontal: editState.flipHorizontal,
          flipVertical: editState.flipVertical
        })
        
        const transformedUrl = await createTransformedImage(
          imageUrl,
          editState.rotation,
          editState.flipHorizontal,
          editState.flipVertical
        )
        
        console.log('Transformed image created successfully')
        setTransformedImage({ transformedImageUrl: transformedUrl, isTransforming: false })
      } catch (error) {
        console.error('Error creating transformed image:', error)
        setTransformedImage({ transformedImageUrl: null, isTransforming: false })
      }
    }

    updateTransformedImage()
  }, [imageUrl, editState.rotation, editState.flipHorizontal, editState.flipVertical])

  const handleRotate = useCallback(() => {
    setEditState(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))
  }, [])

  const handleFlipHorizontal = useCallback(() => {
    setEditState(prev => ({ ...prev, flipHorizontal: !prev.flipHorizontal }))
  }, [])

  const handleFlipVertical = useCallback(() => {
    setEditState(prev => ({ ...prev, flipVertical: !prev.flipVertical }))
  }, [])

  const handleZoomIn = useCallback(() => {
    setEditState(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.2, 3) }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setEditState(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.2, 0.5) }))
  }, [])

  const handleAspectRatioChange = useCallback((newAspectRatio: number | undefined) => {
    setEditState(prev => ({ ...prev, aspectRatio: newAspectRatio }))
  }, [])


  const handleApplyChanges = useCallback(async () => {
    if (!cropCoordinates) {
      showError('Please select a crop area')
      return
    }

    setIsProcessing(true)
    
    try {
      // If we have transformations (rotation, flip), use the transformed image as source
      // and don't apply transformations again. Otherwise, use original image and apply transformations in getCroppedImg
      const hasTransformations = editState.rotation !== 0 || editState.flipHorizontal || editState.flipVertical
      
      const sourceImageUrl = hasTransformations && transformedImage.transformedImageUrl 
        ? transformedImage.transformedImageUrl 
        : imageUrl
      
      const shouldApplyTransformations = !hasTransformations || !transformedImage.transformedImageUrl
      
      console.log('Applying changes with:', {
        hasTransformations,
        hasTransformedImage: !!transformedImage.transformedImageUrl,
        shouldApplyTransformations,
        rotation: editState.rotation,
        flipHorizontal: editState.flipHorizontal,
        flipVertical: editState.flipVertical,
        sourceImageUrl: sourceImageUrl.substring(0, 50) + '...'
      })
      
      const croppedImageBlob = await getCroppedImg(
        sourceImageUrl,
        cropCoordinates,
        shouldApplyTransformations ? editState.rotation : 0,
        shouldApplyTransformations ? editState.flipHorizontal : false,
        shouldApplyTransformations ? editState.flipVertical : false
      )

      // Generate descriptive name based on edits
      const edits: string[] = []
      if (editState.rotation !== 0) {
        edits.push(`rotated ${editState.rotation}°`)
      }
      if (editState.flipHorizontal) {
        edits.push('flipped horizontally')
      }
      if (editState.flipVertical) {
        edits.push('flipped vertically')
      }
      if (cropCoordinates) {
        edits.push('cropped')
      }

      const editDescription = edits.length > 0 ? ` (${edits.join(', ')})` : ''
      const newTitle = `${imageTitle} - edited${editDescription}`

      // Update the existing image with edited content
      const updatedImageMedia = await updateMedia(originalImageId, croppedImageBlob, { title: newTitle })
      
      if (updatedImageMedia) {
        onImageUpdated(updatedImageMedia.id, newTitle) // ID stays the same
        showSuccess('Image edited successfully')
        onClose()
      } else {
        throw new Error('Failed to update image')
      }
    } catch (error) {
      console.error('Error applying image edits:', error)
      showError('Failed to apply image edits')
    } finally {
      setIsProcessing(false)
    }
  }, [cropCoordinates, editState, imageUrl, imageTitle, originalImageId, updateMedia, onImageUpdated, onClose, showSuccess, showError, transformedImage])

  const handleCancel = useCallback(() => {
    // Reset state when closing
    setEditState({
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      zoom: 1,
      aspectRatio: undefined
    })
    setCropCoordinates(null)
    setTransformedImage({
      transformedImageUrl: null,
      isTransforming: false
    })
    onClose()
  }, [onClose])


  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Edit Image" size="large">
      <div className={styles.imageEditModal}>
        <div className={styles.toolbar}>
          <ButtonGroup>
            <Button
              variant="secondary"
              size="small"
              onClick={handleRotate}
              disabled={isProcessing}
              aria-label="Rotate image 90 degrees"
              title="Rotate 90°"
            >
              <RotateCcw size={16} />
              Rotate
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={handleFlipHorizontal}
              disabled={isProcessing}
              aria-label="Flip image horizontally"
              title="Flip Horizontal"
            >
              <FlipHorizontal size={16} />
              Flip H
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={handleFlipVertical}
              disabled={isProcessing}
              aria-label="Flip image vertically"
              title="Flip Vertical"
            >
              <FlipVertical size={16} />
              Flip V
            </Button>
          </ButtonGroup>

          <ButtonGroup>
            <Button
              variant="secondary"
              size="small"
              onClick={handleZoomOut}
              disabled={isProcessing || editState.zoom <= 0.5}
              aria-label="Zoom out"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
              Zoom Out
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={handleZoomIn}
              disabled={isProcessing || editState.zoom >= 3}
              aria-label="Zoom in"
              title="Zoom In"
            >
              <ZoomIn size={16} />
              Zoom In
            </Button>
          </ButtonGroup>
          
          <ButtonGroup>
            <Button
              variant={editState.aspectRatio === ASPECT_RATIOS.SQUARE ? "primary" : "secondary"}
              size="small"
              onClick={() => handleAspectRatioChange(ASPECT_RATIOS.SQUARE)}
              disabled={isProcessing}
              aria-label="Crop to square aspect ratio (1:1)"
              title="Square (1:1)"
            >
              1:1
            </Button>
            <Button
              variant={editState.aspectRatio === ASPECT_RATIOS.STANDARD ? "primary" : "secondary"}
              size="small"
              onClick={() => handleAspectRatioChange(ASPECT_RATIOS.STANDARD)}
              disabled={isProcessing}
              aria-label="Crop to standard aspect ratio (4:3)"
              title="Standard (4:3)"
            >
              4:3
            </Button>
            <Button
              variant={editState.aspectRatio === ASPECT_RATIOS.WIDESCREEN ? "primary" : "secondary"}
              size="small"
              onClick={() => handleAspectRatioChange(ASPECT_RATIOS.WIDESCREEN)}
              disabled={isProcessing}
              aria-label="Crop to widescreen aspect ratio (16:9)"
              title="Widescreen (16:9)"
            >
              16:9
            </Button>
            <Button
              variant={editState.aspectRatio === ASPECT_RATIOS.FREE ? "primary" : "secondary"}
              size="small"
              onClick={() => handleAspectRatioChange(ASPECT_RATIOS.FREE)}
              disabled={isProcessing}
              aria-label="Free-form cropping"
              title="Free-form"
            >
              Free
            </Button>
          </ButtonGroup>
        </div>

        <div className={styles.cropInstructions}>
          <p>
            <strong>Crop Instructions:</strong> Drag center to move • Drag corners/edges to resize • Hold Shift to maintain aspect ratio
          </p>
        </div>

        <div className={styles.cropperContainer} data-testid="image-cropper">
          <Cropper
            ref={cropperRef}
            src={transformedImage.transformedImageUrl || imageUrl}
            onChange={onCropChange}
            className={styles.cropper}
            stencilProps={{
              aspectRatio: editState.aspectRatio,
              grid: true
            }}
          />
        </div>

        {isProcessing && (
          <div className={styles.processingIndicator}>
            <ProgressBar indeterminate={true} label="Processing image..." />
          </div>
        )}

        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleApplyChanges}
            disabled={isProcessing || !cropCoordinates}
          >
            {isProcessing ? 'Processing...' : 'Apply Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}