import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onDetected, onClose }) {
  const [manualBarcode, setManualBarcode] = useState('');
  const [scannerError, setScannerError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [scannerInstance, setScannerInstance] = useState(null);

  useEffect(() => {
    let html5Qrcode = null;

    const startScanner = async () => {
      try {
        html5Qrcode = new Html5Qrcode("scanner-reader-view");
        
        const config = { 
          fps: 15, 
          qrbox: (width, height) => {
            // Rectangular box matching barcode shape
            return {
              width: Math.min(width * 0.8, 320),
              height: 120
            };
          }
        };

        await html5Qrcode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            onDetected(decodedText);
            if (html5Qrcode && html5Qrcode.isScanning) {
              html5Qrcode.stop().catch(err => console.error("Stop error", err));
            }
          },
          (errorMessage) => {
            // Keep scanner reading silently
          }
        );

        // Check torch capability after successful stream startup
        try {
          const track = html5Qrcode.getRunningTrack();
          const caps = track?.getCapabilities();
          if (caps && 'torch' in caps) {
            setHasFlash(true);
          }
        } catch (e) {
          console.warn("Torch capability check failed:", e);
        }

        setScannerInstance(html5Qrcode);
      } catch (err) {
        console.warn("Camera start failed, falling back to manual input:", err);
        setScannerError(err.message || 'Unable to access camera.');
      }
    };

    startScanner();

    return () => {
      if (html5Qrcode) {
        if (html5Qrcode.isScanning) {
          html5Qrcode.stop().catch(err => console.error("Cleanup stop error", err));
        }
      }
    };
  }, [onDetected]);

  const handleToggleFlash = async () => {
    if (!scannerInstance) return;
    try {
      const track = scannerInstance.getRunningTrack();
      if (track && track.getCapabilities()?.torch) {
        const nextFlash = !flashOn;
        await track.applyConstraints({
          advanced: [{ torch: nextFlash }]
        });
        setFlashOn(nextFlash);
      }
    } catch (e) {
      console.warn("Torch apply constraints failed:", e);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onDetected(manualBarcode.trim());
    }
  };

  return (
    <div className="scanner-overlay">
      <div className="scanner-container">
        
        {/* Title panel */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #222', backgroundColor: '#111', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', color: '#fff' }}>📷 Live Barcode Scanner</h3>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {hasFlash && (
              <button 
                type="button"
                onClick={handleToggleFlash} 
                className="btn btn-outline" 
                style={{ 
                  minHeight: '32px', 
                  height: '32px', 
                  padding: '0 0.75rem', 
                  fontSize: '0.8rem', 
                  color: '#fff', 
                  borderColor: '#444', 
                  backgroundColor: flashOn ? 'var(--primary)' : 'transparent',
                  cursor: 'pointer'
                }}
              >
                {flashOn ? '🔦 Flash On' : '🔦 Flash Off'}
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* Camera Render Viewport */}
        <div id="scanner-reader-view" style={{ width: '100%', minHeight: '260px', backgroundColor: '#000' }}></div>

        {scannerError && (
          <div style={{ padding: '1rem', color: 'var(--accent-warning)', fontSize: '0.85rem', textAlign: 'center', backgroundColor: '#111' }}>
            ⚠️ Camera Access Blocked. Using manual barcode entries.
          </div>
        )}

        {/* Manual Fallback Entry */}
        <form onSubmit={handleManualSubmit} style={{ padding: '1rem', backgroundColor: '#111', borderTop: '1px solid #222', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="input"
            style={{ backgroundColor: '#222', border: '1px solid #333', color: '#fff', minHeight: '40px', height: '40px' }}
            placeholder="Type barcode digits manually..."
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ minHeight: '40px', padding: '0.5rem 1rem' }}>
            Submit
          </button>
        </form>

      </div>
    </div>
  );
}
