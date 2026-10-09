export type EnhancementSettings = {
  enabled: boolean;
  gain: number; // 1.0 - 3.0
  presence: number; // 0 - 6 dB
  highpass: number; // 40 - 200 Hz
};

export const DEFAULT_SETTINGS: EnhancementSettings = {
  enabled: true,
  gain: 1.6,
  presence: 3,
  highpass: 85,
};

export type RecorderHandle = {
  stream: MediaStream;
  audioCtx: AudioContext;
  source: MediaStreamAudioSourceNode;
  destination: MediaStreamAudioDestinationNode;
  analyser: AnalyserNode;
  recorder: MediaRecorder;
  cleanup: () => void;
};

export function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  "",
  ];
  for (const c of candidates) {
    if (!c || typeof MediaRecorder === "undefined") return c;
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export async function requestMicStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器不支持录音，请使用 Safari 或 Chrome 打开。");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  });
}

export function buildGraph(
  stream: MediaStream,
  settings: EnhancementSettings,
): RecorderHandle {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const destination = audioCtx.createMediaStreamDestination();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;

  let tail: AudioNode = source;

  if (settings.enabled) {
    const hp = audioCtx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = settings.highpass;
    hp.Q.value = 0.7;

    const presence = audioCtx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3000;
    presence.Q.value = 0.9;
    presence.gain.value = settings.presence;

    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    const gain = audioCtx.createGain();
    gain.gain.value = settings.gain;

    source.connect(hp);
    hp.connect(presence);
    presence.connect(comp);
    comp.connect(gain);
    gain.connect(destination);
    tail = gain;
  } else {
    source.connect(destination);
  }

  tail.connect(analyser);

  const recorder = new MediaRecorder(destination.stream, {
    mimeType: pickMimeType() || undefined,
    audioBitsPerSecond: 128000,
  });

  const cleanup = () => {
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      /* ignore */
    }
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    try {
      source.disconnect();
    } catch {
      /* ignore */
    }
    try {
      audioCtx.close();
    } catch {
      /* ignore */
    }
  };

  return { stream, audioCtx, source, destination, analyser, recorder, cleanup };
}
