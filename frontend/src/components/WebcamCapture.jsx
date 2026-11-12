import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, Eye, Sparkles, AlertCircle } from 'lucide-react';

export const WebcamCapture = ({
  onFrameCapture,
  isScanning = false,
  detectedFaces = [],
  autoScanInterval = 1800,
  enableAutoScan = true,
  overlayMessage = null
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize Webcam
  const startCamera = async () => {
    setErrorMessage('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
          setHasPermission(true);
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setCameraActive(false);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Webcam access was denied. Please allow camera permissions in your browser.');
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No camera device detected on this system.');
      } else {
        setErrorMessage('Unable to initialize webcam: ' + err.message);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Capture current frame as base64 JPEG
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !cameraActive || videoRef.current.readyState !== 4) {
      return null;
    }
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [cameraActive]);

  // Periodic Auto-Scan
  useEffect(() => {
    if (!enableAutoScan || !cameraActive) return;

    const interval = setInterval(async () => {
      if (isProcessing) return;
      const base64 = captureFrame();
      if (base64 && onFrameCapture) {
        setIsProcessing(true);
        try {
          await onFrameCapture(base64);
        } catch (e) {
          // ignore scan error
        } finally {
          setIsProcessing(false);
        }
      }
    }, autoScanInterval);

    return () => clearInterval(interval);
  }, [enableAutoScan, cameraActive, autoScanInterval, isProcessing, captureFrame, onFrameCapture]);

  // Draw face bounding boxes on overlay canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detectedFaces || detectedFaces.length === 0) return;

    const videoW = video.videoWidth || 640;
    const videoH = video.videoHeight || 480;
    canvas.width = videoW;
    canvas.height = videoH;

    detectedFaces.forEach((face) => {
      if (!face.box) return;
      const { top, right, bottom, left } = face.box;
      const width = right - left;
      const height = bottom - top;

      const isRegistered = face.employee_id > 0;
      const strokeColor = isRegistered ? '#10b981' : '#f59e0b'; // Emerald or Amber

      // Draw bounding box
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(left, top, width, height);

      // Corner accents
      const cornerLength = Math.min(20, width / 4);
      ctx.lineWidth = 5;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(left, top + cornerLength);
      ctx.lineTo(left, top);
      ctx.lineTo(left + cornerLength, top);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(right - cornerLength, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, top + cornerLength);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(left, bottom - cornerLength);
      ctx.lineTo(left, bottom);
      ctx.lineTo(left + cornerLength, bottom);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(right - cornerLength, bottom);
      ctx.lineTo(right, bottom);
      ctx.lineTo(right, bottom - cornerLength);
      ctx.stroke();

      // Label background
      const labelText = isRegistered 
        ? `${face.full_name} (${face.confidence}%)`
        : 'Unknown Face (Unregistered)';
      
      ctx.font = 'bold 14px Inter, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      const labelY = top > 30 ? top - 10 : bottom + 22;

      ctx.fillStyle = isRegistered ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.9)';
      ctx.roundRect 
        ? ctx.roundRect(left, labelY - 18, textWidth + 16, 24, 6)
        : ctx.fillRect(left, labelY - 18, textWidth + 16, 24);
      ctx.fill();

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, left + 8, labelY);
    });
  }, [detectedFaces]);

  // Manual Trigger
  const handleManualScan = async () => {
    if (isProcessing) return;
    const base64 = captureFrame();
    if (base64 && onFrameCapture) {
      setIsProcessing(true);
      try {
        await onFrameCapture(base64);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
      {/* Video Viewport */}
      <div className="relative aspect-video w-full max-h-[520px] flex items-center justify-center bg-black overflow-hidden">
        
        {/* Live video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Bounding box overlay canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Scanning laser animation overlay */}
        {cameraActive && (
          <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#078BD0] to-transparent animate-scan pointer-events-none"></div>
        )}

        {/* Camera Off / Permission Error State */}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50/95 space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-500 shadow-sm">
              <CameraOff className="w-10 h-10 text-[#078BD0]" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#12345A]">Webcam Not Active</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {errorMessage || 'Click the button below to initialize your laptop camera for facial biometric detection.'}
              </p>
            </div>
            <button
              onClick={startCamera}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-semibold shadow-lg shadow-[#078BD0]/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Connect Webcam</span>
            </button>
          </div>
        )}

        {/* Top Camera HUD Overlay */}
        {cameraActive && (
          <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-semibold">LIVE WEBCAM</span>
              <span className="text-slate-400 font-mono text-[11px] ml-1">640x480</span>
            </div>

            <div className="flex items-center space-x-2">
              {isProcessing && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#078BD0]/80 backdrop-blur-md border border-[#078BD0]/30 text-xs font-semibold text-white animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Matching Biometrics...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Banner Message */}
        {overlayMessage && (
          <div className="absolute bottom-4 inset-x-4 flex justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 text-xs font-semibold text-[#12345A] shadow-xl flex items-center space-x-2">
              <Eye className="w-4 h-4 text-[#078BD0]" />
              <span>{overlayMessage}</span>
            </div>
          </div>
        )}

      </div>

      {/* Control Bar */}
      <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-[#078BD0]"></span>
          <span>OpenCV Haar/HOG Biometrics Active</span>
        </div>

        <div className="flex items-center space-x-2">
          {cameraActive ? (
            <>
              <button
                type="button"
                onClick={handleManualScan}
                disabled={isProcessing}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#078BD0] hover:bg-[#0675b0] disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan Frame</span>
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#DDF2FF]/40 text-[#12345A] text-xs font-medium transition-all cursor-pointer"
              >
                Turn Off
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#078BD0] hover:bg-[#0675b0] text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start Camera</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
