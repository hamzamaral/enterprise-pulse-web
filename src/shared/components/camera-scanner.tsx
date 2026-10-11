import { CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function getDetector(): BarcodeDetectorConstructor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

/** Camera scanning relies on the native BarcodeDetector API (Chrome / Edge / Android). */
export function cameraScanSupported() {
  return typeof window !== 'undefined' && !!getDetector() && !!navigator.mediaDevices?.getUserMedia;
}

/** The same code is reported again only after this pause, so one label is not scanned twice. */
const REPEAT_MS = 2500;

function ScannerView({ onDetected }: { onDetected: (code: string) => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const callback = useRef(onDetected);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const Detector = getDetector();
    if (!Detector) return;
    const detector = new Detector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8'] });
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopped = false;
    let last = { code: '', at: 0 };

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState >= 2) {
        const [hit] = await detector.detect(video).catch(() => []);
        const now = Date.now();
        if (hit && (hit.rawValue !== last.code || now - last.at > REPEAT_MS)) {
          last = { code: hit.rawValue, at: now };
          callback.current(hit.rawValue);
        }
      }
      timer = window.setTimeout(() => void tick(), 250);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (media) => {
        stream = media;
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = media;
        await videoRef.current.play();
        void tick();
      })
      .catch(() => setFailed(true));

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (failed) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
        <CameraOff className="size-8" />
        {t('scanner.cameraError')}
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-md bg-black">
      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-1/4 rounded-lg border-2 border-white/80" />
    </div>
  );
}

export function CameraScanner({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('scanner.title')}</DialogTitle>
          <DialogDescription>{t('scanner.hint')}</DialogDescription>
        </DialogHeader>
        {open && <ScannerView onDetected={onDetected} />}
      </DialogContent>
    </Dialog>
  );
}
