import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react';

/**
 * Reusable image cropper modal.
 * Props:
 *   image        - data URL or object URL of the image to crop
 *   aspect       - aspect ratio (e.g. 3 for 3:1 cover, 1 for 1:1 avatar)
 *   onCropDone   - callback(blob) with the cropped image blob
 *   onCancel     - callback to close the modal
 *   title        - optional title for the modal (default: "Crop Image")
 */
export default function ImageCropper({ image, aspect = 3, onCropDone, onCancel, title = 'Crop Image' }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(image, croppedAreaPixels);
      onCropDone(blob);
    } catch {
      // fallback: pass original image as blob
      const res = await fetch(image);
      const blob = await res.blob();
      onCropDone(blob);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-edge/50 rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-edge/50">
          <h3 className="text-sm font-semibold text-theme-primary">{title}</h3>
          <button onClick={onCancel} aria-label="Cancel" className="p-1 text-theme-muted hover:text-theme-primary rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative w-full" style={{ height: '340px' }}>
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape={aspect === 1 ? 'round' : 'rect'}
            showGrid={true}
          />
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-edge/50">
          <ZoomOut className="w-4 h-4 text-theme-dim shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1 accent-amber-500 h-1"
          />
          <ZoomIn className="w-4 h-4 text-theme-dim shrink-0" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-edge/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-inset text-theme-muted rounded-lg text-sm hover:text-theme-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            {processing ? (
              <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Creates a cropped image blob from a source image and crop area.
 */
function getCroppedBlob(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}
