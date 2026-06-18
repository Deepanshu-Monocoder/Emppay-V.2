import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { X, Upload, Camera, RotateCw } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  onSave: (croppedImage: string) => void;
  onCancel: () => void;
  currentPhoto?: string;
}

interface Point { x: number; y: number; }
interface CroppedArea { x: number; y: number; width: number; height: number; }

export function PhotoUploadCrop({ onSave, onCancel, currentPhoto }: Props) {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(currentPhoto || null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);

  const onCropComplete = useCallback((_: CroppedArea, pixels: CroppedArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result as string));
      reader.readAsDataURL(file);
    }
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', reject);
      image.src = url;
    });

  const getCroppedImg = async (src: string, pixelCrop: CroppedArea, rot = 0): Promise<string> => {
    const image = await createImage(src);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));
    canvas.width = safeArea;
    canvas.height = safeArea;
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);
    ctx.drawImage(image, safeArea / 2 - image.width * 0.5, safeArea / 2 - image.height * 0.5);
    const data = ctx.getImageData(0, 0, safeArea, safeArea);
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.putImageData(data, Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x), Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y));
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onSave(croppedImage);
    } catch (e) { console.error(e); }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--app-overlay)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: 'var(--app-card)', width: isMobile ? '100%' : 600, maxHeight: isMobile ? '90vh' : '80vh', borderRadius: isMobile ? '20px 20px 0 0' : 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
            {imageSrc ? 'Crop Profile Photo' : 'Upload Profile Photo'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X style={{ width: 20, height: 20, color: 'var(--app-text-muted)' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {!imageSrc ? (
            <div
              style={{ border: '2px dashed var(--app-input-border)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload style={{ width: 48, height: 48, color: 'var(--app-text-muted)', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--app-text-primary)', marginBottom: 8 }}>
                Click to upload or drag and drop
              </div>
              <div style={{ fontSize: 14, color: 'var(--app-text-muted)', marginBottom: 16 }}>
                JPG, PNG or JPEG (max 5MB)
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500, background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Upload style={{ width: 16, height: 16 }} />
                  Browse Files
                </button>
                {isMobile && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'user');
                        fileInputRef.current.click();
                      }
                    }}
                    style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500, background: 'var(--app-btn-secondary-bg)', color: 'var(--app-btn-secondary-fg)', border: '1px solid var(--app-btn-secondary-border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Camera style={{ width: 16, height: 16 }} />
                    Take Photo
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', width: '100%', height: 400, background: '#000', borderRadius: 12, overflow: 'hidden' }}>
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                />
              </div>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 8 }}>Zoom</label>
                  <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 8 }}>Rotation</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="range" value={rotation} min={0} max={360} step={1} onChange={e => setRotation(Number(e.target.value))} style={{ flex: 1 }} />
                    <button
                      onClick={() => setRotation((rotation + 90) % 360)}
                      style={{ padding: 8, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <RotateCw style={{ width: 16, height: 16, color: 'var(--app-text-muted)' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--app-border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500, background: 'var(--app-btn-secondary-bg)', color: 'var(--app-btn-secondary-fg)', border: '1px solid var(--app-btn-secondary-border)', borderRadius: 8, cursor: 'pointer' }}>
            Cancel
          </button>
          {imageSrc && (
            <button onClick={handleSave} style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500, background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Save Photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
