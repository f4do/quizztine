import { useState, useRef, useEffect, useCallback } from "react";
import { API_BASE } from "../lib/api";

const MAX_DURATION_MS = 10_000;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const BITRATE = 96_000;

function getSupportedMimeType(): string | undefined {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t));
}

interface AudioRecorderProps {
  onUploaded: (url: string) => void;
  onError?: (message: string) => void;
}

export default function AudioRecorder({
  onUploaded,
  onError,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoStopRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
    setDurationMs(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [cleanup, previewUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType
        ? { mimeType, audioBitsPerSecond: BITRATE }
        : { audioBitsPerSecond: BITRATE };
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunksRef.current, {
          type: mimeType ?? "audio/webm",
        });
        if (blob.size > MAX_SIZE_BYTES) {
          onError?.("Recording too large. Max 5 MB.");
          return;
        }
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      };

      recorder.onerror = () => {
        cleanup();
        onError?.("Recording failed");
      };

      recorder.start(100);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);
      autoStopRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, MAX_DURATION_MS);
    } catch (err) {
      onError?.("Microphone access denied or unavailable");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const handleUpload = async () => {
    if (!previewUrl) return;
    try {
      setUploading(true);
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const file = new File([blob], "recording.webm", {
        type: blob.type || "audio/webm",
      });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onUploaded(data.url);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const discard = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  return (
    <div className="space-y-2">
      {!isRecording && !previewUrl && (
        <button
          type="button"
          onClick={startRecording}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Record audio
        </button>
      )}
      {isRecording && (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Recording {(durationMs / 1000).toFixed(1)}s / 10s
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            Stop
          </button>
        </div>
      )}
      {previewUrl && (
        <div className="space-y-2">
          <audio controls src={previewUrl} className="w-full max-w-xs" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Use this recording"}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={uploading}
              className="px-3 py-1.5 rounded-md bg-gray-600 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
