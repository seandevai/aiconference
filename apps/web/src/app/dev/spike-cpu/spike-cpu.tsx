'use client';

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MicVAD } from '@ricky0123/vad-web';
import { useRef, useState } from 'react';
import { summarize } from './stats';

const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

type Report = {
  seconds: number;
  outboundFps: number;
  encodeMsPerFrame: number;
  qualityLimitation: string;
  hand: { count: number; p50: number; p95: number };
  vadFrames: number;
  longTasks: number;
};

// Encode WebRTC reale senza server: due peer connection nello stesso tab.
async function loopback(track: MediaStreamTrack): Promise<RTCPeerConnection> {
  const sender = new RTCPeerConnection();
  const receiver = new RTCPeerConnection();
  sender.onicecandidate = (e) => e.candidate && void receiver.addIceCandidate(e.candidate);
  receiver.onicecandidate = (e) => e.candidate && void sender.addIceCandidate(e.candidate);
  sender.addTrack(track);
  await sender.setLocalDescription(await sender.createOffer());
  await receiver.setRemoteDescription(sender.localDescription!);
  await receiver.setLocalDescription(await receiver.createAnswer());
  await sender.setRemoteDescription(receiver.localDescription!);
  return sender;
}

export function SpikeCpu() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function start() {
    setRunning(true);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, frameRate: 30 },
      audio: true,
    });
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();

    const sender = await loopback(stream.getVideoTracks()[0]!);

    const landmarker = await HandLandmarker.createFromOptions(
      await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM),
      {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
      },
    );
    const handMs: number[] = [];
    const onFrame = (now: number) => {
      const t0 = performance.now();
      landmarker.detectForVideo(video, now);
      handMs.push(performance.now() - t0);
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);

    let vadFrames = 0;
    const vad = await MicVAD.new({
      model: 'v5',
      baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.31/dist/',
      onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/',
      getStream: async () => stream,
      onFrameProcessed: () => {
        vadFrames += 1;
      },
    });
    vad.start();

    let longTasks = 0;
    new PerformanceObserver((list) => {
      longTasks += list.getEntries().length;
    }).observe({ type: 'longtask', buffered: true });

    const startedAt = performance.now();
    setInterval(async () => {
      const stats = await sender.getStats();
      let outboundFps = 0;
      let encodeMsPerFrame = 0;
      let qualityLimitation = 'unknown';
      stats.forEach((s) => {
        if (s.type === 'outbound-rtp' && s.kind === 'video') {
          outboundFps = s.framesPerSecond ?? 0;
          encodeMsPerFrame = s.framesEncoded ? (s.totalEncodeTime / s.framesEncoded) * 1000 : 0;
          qualityLimitation = s.qualityLimitationReason ?? 'unknown';
        }
      });
      setReport({
        seconds: Math.round((performance.now() - startedAt) / 1000),
        outboundFps,
        encodeMsPerFrame: Math.round(encodeMsPerFrame * 10) / 10,
        qualityLimitation,
        hand: summarize(handMs.slice(-600)),
        vadFrames,
        longTasks,
      });
    }, 1000);
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-xl font-semibold">Spike CPU — encode 720p + MediaPipe + VAD</h1>
      <video ref={videoRef} muted playsInline className="w-80 rounded" />
      {!running && (
        <button onClick={start} className="w-fit rounded bg-neutral-100 px-4 py-2 text-neutral-900">
          Avvia (2 minuti)
        </button>
      )}
      {report && (
        <>
          <pre className="rounded bg-neutral-900 p-3 text-sm">
            {JSON.stringify(report, null, 2)}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(report))}
            className="w-fit rounded bg-neutral-800 px-4 py-2"
          >
            Copia risultati
          </button>
        </>
      )}
    </main>
  );
}
