"use client";

import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, onClose }) => {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!scannerRef.current) return;

    const html5QrCode = new Html5Qrcode(scannerRef.current.id);
    html5QrCodeRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText, _decodedResult) => {
            onScanSuccess(decodedText);
          },
          (_errorMessage) => {
            // Handle scan failure, but we can ignore it for continuous scanning
          }
        );
      } catch (err) {
        console.error("Erro ao iniciar o scanner:", err);
        toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
        onClose();
      }
    };

    startScanner();

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => {
          console.error("Erro ao parar o scanner:", err);
        });
      }
    };
  }, [onScanSuccess, onClose]);

  return <div id="camera-scanner-viewfinder" ref={scannerRef} className="w-full border-2 border-dashed border-primary rounded-lg overflow-hidden" />;
};

export default CameraScanner;