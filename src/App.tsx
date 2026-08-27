import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconKey,
  IconLoader2,
  IconLock,
  IconPlayerPlay,
  IconScan,
  IconShield,
  IconVideo,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

type CheckState = "idle" | "checking" | "supported" | "unsupported";
type DRMId = "widevine" | "playready" | "fairplay";

type DRMProfile = {
  id: DRMId;
  name: string;
  vendor: string;
  keySystem: string;
  initDataType: string;
  robustness: string[];
};

type Result = {
  id: DRMId;
  name: string;
  vendor: string;
  state: CheckState;
  securityLevel: string;
  videoRobustness: string[];
  encryption: string[];
  encryptedPlayback: string[];
};

type EncryptionScheme = "cenc" | "cbcs" | "cbcs-1-9";

type PlaybackProbe = {
  label: string;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
  contentType: string;
};

type PlaybackCodec = {
  name: string;
  probes: PlaybackProbe[];
};

const drmProfiles: DRMProfile[] = [
  {
    id: "widevine",
    name: "Widevine",
    vendor: "Google",
    keySystem: "com.widevine.alpha",
    initDataType: "cenc",
    robustness: [
      "HW_SECURE_ALL",
      "HW_SECURE_DECODE",
      "HW_SECURE_CRYPTO",
      "SW_SECURE_DECODE",
      "SW_SECURE_CRYPTO",
    ],
  },
  {
    id: "playready",
    name: "PlayReady",
    vendor: "Microsoft",
    keySystem: "com.microsoft.playready",
    initDataType: "cenc",
    robustness: ["3000", "2000", "150"],
  },
  {
    id: "fairplay",
    name: "FairPlay",
    vendor: "Apple",
    keySystem: "com.apple.fps",
    initDataType: "sinf",
    robustness: [],
  },
];

const encryptionSchemes: EncryptionScheme[] = ["cenc", "cbcs", "cbcs-1-9"];
const baseVideoContentType = 'video/mp4; codecs="avc1.64002A"';

const playbackCodecs: PlaybackCodec[] = [
  {
    name: "H.264",
    probes: [
      { label: "8K", width: 7680, height: 4320, bitrate: 80_000_000, framerate: 60, contentType: 'video/mp4; codecs="avc1.64003E"' },
      { label: "4K", width: 3840, height: 2160, bitrate: 25_000_000, framerate: 60, contentType: 'video/mp4; codecs="avc1.640033"' },
      { label: "1080p", width: 1920, height: 1080, bitrate: 8_000_000, framerate: 60, contentType: 'video/mp4; codecs="avc1.64002A"' },
      { label: "720p", width: 1280, height: 720, bitrate: 5_000_000, framerate: 30, contentType: 'video/mp4; codecs="avc1.64001F"' },
    ],
  },
  {
    name: "AV1",
    probes: [
      { label: "8K", width: 7680, height: 4320, bitrate: 60_000_000, framerate: 60, contentType: 'video/mp4; codecs="av01.0.16M.08"' },
      { label: "4K", width: 3840, height: 2160, bitrate: 20_000_000, framerate: 60, contentType: 'video/mp4; codecs="av01.0.13M.08"' },
      { label: "1080p", width: 1920, height: 1080, bitrate: 6_000_000, framerate: 60, contentType: 'video/mp4; codecs="av01.0.08M.08"' },
      { label: "720p", width: 1280, height: 720, bitrate: 4_000_000, framerate: 30, contentType: 'video/mp4; codecs="av01.0.05M.08"' },
    ],
  },
  {
    name: "VP9",
    probes: [
      { label: "8K", width: 7680, height: 4320, bitrate: 60_000_000, framerate: 60, contentType: 'video/webm; codecs="vp09.00.62.08"' },
      { label: "4K", width: 3840, height: 2160, bitrate: 20_000_000, framerate: 60, contentType: 'video/webm; codecs="vp09.00.51.08"' },
      { label: "1080p", width: 1920, height: 1080, bitrate: 6_000_000, framerate: 60, contentType: 'video/webm; codecs="vp09.00.41.08"' },
      { label: "720p", width: 1280, height: 720, bitrate: 4_000_000, framerate: 30, contentType: 'video/webm; codecs="vp09.00.31.08"' },
    ],
  },
  {
    name: "HEVC",
    probes: [
      { label: "8K", width: 7680, height: 4320, bitrate: 80_000_000, framerate: 60, contentType: 'video/mp4; codecs="hvc1.1.6.L186.B0"' },
      { label: "4K", width: 3840, height: 2160, bitrate: 25_000_000, framerate: 60, contentType: 'video/mp4; codecs="hvc1.1.6.L153.B0"' },
      { label: "1080p", width: 1920, height: 1080, bitrate: 8_000_000, framerate: 60, contentType: 'video/mp4; codecs="hvc1.1.6.L123.B0"' },
      { label: "720p", width: 1280, height: 720, bitrate: 5_000_000, framerate: 30, contentType: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
    ],
  },
];

const initialResults: Result[] = drmProfiles.map((profile) => ({
  id: profile.id,
  name: profile.name,
  vendor: profile.vendor,
  state: "idle",
  securityLevel: "—",
  videoRobustness: [],
  encryption: [],
  encryptedPlayback: [],
}));

function mediaCapability(
  contentType: string,
  robustness?: string,
  encryptionScheme?: EncryptionScheme,
): MediaKeySystemMediaCapability {
  return {
    contentType,
    ...(robustness ? { robustness } : {}),
    ...(encryptionScheme ? { encryptionScheme } : {}),
  } as MediaKeySystemMediaCapability;
}

async function checkDRM(keySystem: string, configurations: MediaKeySystemConfiguration[]) {
  try {
    const access = await navigator.requestMediaKeySystemAccess(keySystem, configurations);
    return access.getConfiguration();
  } catch {
    return null;
  }
}

async function supportsCapability(
  profile: DRMProfile,
  contentType = baseVideoContentType,
  robustness?: string,
  encryptionScheme?: EncryptionScheme,
) {
  return Boolean(await checkDRM(profile.keySystem, [
    {
      initDataTypes: [profile.initDataType],
      videoCapabilities: [mediaCapability(contentType, robustness, encryptionScheme)],
    },
  ]));
}

async function detectRobustness(profile: DRMProfile) {
  const supported: string[] = [];

  for (const robustness of profile.robustness) {
    if (await supportsCapability(profile, baseVideoContentType, robustness)) {
      supported.push(robustness);
    }
  }

  return supported;
}

async function detectEncryption(profile: DRMProfile, robustness?: string) {
  const supported: EncryptionScheme[] = [];

  for (const scheme of encryptionSchemes) {
    if (await supportsCapability(profile, baseVideoContentType, robustness, scheme)) {
      supported.push(scheme);
    }
  }

  return supported;
}

async function supportsEncryptedDecoding(
  profile: DRMProfile,
  probe: PlaybackProbe,
  robustness: string | undefined,
  encryptionScheme: EncryptionScheme | undefined,
) {
  if (!("mediaCapabilities" in navigator) || !navigator.mediaCapabilities?.decodingInfo) {
    return null;
  }

  const keyVideo = {
    ...(robustness ? { robustness } : {}),
    ...(encryptionScheme ? { encryptionScheme } : {}),
  };

  const configuration = {
    type: "media-source",
    video: {
      contentType: probe.contentType,
      width: probe.width,
      height: probe.height,
      bitrate: probe.bitrate,
      framerate: probe.framerate,
    },
    keySystemConfiguration: {
      keySystem: profile.keySystem,
      initDataType: profile.initDataType,
      distinctiveIdentifier: "optional",
      persistentState: "optional",
      sessionTypes: ["temporary"],
      video: keyVideo,
    },
  };

  try {
    const result = await (navigator.mediaCapabilities as unknown as {
      decodingInfo: (config: unknown) => Promise<{ supported: boolean; keySystemAccess?: MediaKeySystemAccess | null }>;
    }).decodingInfo(configuration);

    return result.supported && Boolean(result.keySystemAccess);
  } catch {
    return false;
  }
}

async function detectEncryptedPlayback(
  profile: DRMProfile,
  robustness: string | undefined,
  schemes: EncryptionScheme[],
) {
  const detected: string[] = [];
  const hasMediaCapabilities = "mediaCapabilities" in navigator && Boolean(navigator.mediaCapabilities?.decodingInfo);
  const schemeCandidates: (EncryptionScheme | undefined)[] = schemes.length ? schemes : [undefined];

  for (const codec of playbackCodecs) {
    let match: string | null = null;

    if (hasMediaCapabilities) {
      for (const probe of codec.probes) {
        for (const scheme of schemeCandidates) {
          if (await supportsEncryptedDecoding(profile, probe, robustness, scheme)) {
            match = `${codec.name} ≤${probe.label}`;
            break;
          }
        }
        if (match) break;
      }
    } else {
      const fallbackProbe = codec.probes.find((probe) => probe.label === "1080p") ?? codec.probes.at(-1);
      if (fallbackProbe) {
        for (const scheme of schemeCandidates) {
          if (await supportsCapability(profile, fallbackProbe.contentType, robustness, scheme)) {
            match = codec.name;
            break;
          }
        }
      }
    }

    if (match) detected.push(match);
  }

  return detected;
}

function securityLevel(id: DRMId, robustness: string[]) {
  if (id === "widevine") {
    if (robustness.includes("HW_SECURE_ALL")) return "L1 candidate";
    if (robustness.some((value) => value.startsWith("HW_SECURE_"))) return "Hardware-secure candidate";
    if (robustness.some((value) => value.startsWith("SW_SECURE_"))) return "L3 candidate";
    return "Available";
  }

  if (id === "playready") {
    if (robustness.includes("3000")) return "SL3000 candidate";
    if (robustness.includes("2000")) return "SL2000 candidate";
    if (robustness.includes("150")) return "SL150 candidate";
    return "Available";
  }

  return "Platform-managed";
}

function StatusBadge({ state }: { state: CheckState }) {
  const label = {
    idle: "未チェック",
    checking: "確認中",
    supported: "対応",
    unsupported: "非対応",
  }[state];

  const icon = {
    idle: <IconCircleDashed size={14} stroke={2} aria-hidden="true" />,
    checking: <IconLoader2 className="spin" size={14} stroke={2} aria-hidden="true" />,
    supported: <IconCircleCheck size={14} stroke={2} aria-hidden="true" />,
    unsupported: <IconCircleX size={14} stroke={2} aria-hidden="true" />,
  }[state];

  return <span className={`badge badge-${state}`}>{icon}{label}</span>;
}

function CapabilityValues({ values, fallback = "—" }: { values: string[]; fallback?: string }) {
  if (!values.length) return <span className="capability-empty">{fallback}</span>;

  return (
    <div className="tag-list">
      {values.map((value) => <span className="capability-tag mono" key={value}>{value}</span>)}
    </div>
  );
}

export default function App() {
  const [results, setResults] = useState(initialResults);
  const [running, setRunning] = useState(false);
  const emeAvailable = typeof navigator !== "undefined" && "requestMediaKeySystemAccess" in navigator;
  const secureContext = typeof window !== "undefined" && window.isSecureContext;
  const mediaCapabilitiesAvailable = typeof navigator !== "undefined" && "mediaCapabilities" in navigator;

  const supportedCount = useMemo(
    () => results.filter((result) => result.state === "supported").length,
    [results],
  );

  const updateResult = (id: DRMId, patch: Partial<Result>) => {
    setResults((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const runChecker = async () => {
    if (running) return;

    setRunning(true);
    setResults(initialResults.map((item) => ({ ...item, state: "checking" })));

    if (!emeAvailable) {
      setResults(initialResults.map((item) => ({ ...item, state: "unsupported", securityLevel: "EME API unavailable" })));
      setRunning(false);
      return;
    }

    try {
      for (const profile of drmProfiles) {
        const available = await supportsCapability(profile);

        if (!available) {
          updateResult(profile.id, { state: "unsupported", securityLevel: "Key system unavailable" });
          continue;
        }

        const robustness = await detectRobustness(profile);
        const preferredRobustness = robustness[0];
        const encryption = await detectEncryption(profile, preferredRobustness);
        const encryptedPlayback = await detectEncryptedPlayback(profile, preferredRobustness, encryption);

        updateResult(profile.id, {
          state: "supported",
          securityLevel: securityLevel(profile.id, robustness),
          videoRobustness: robustness,
          encryption,
          encryptedPlayback,
        });
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Encrypted Media Extensions</p>
          <h1>Browser DRM Checker</h1>
          <p className="lead">
            EME と Media Capabilities API を使い、DRM key system、video robustness、暗号方式、暗号化再生能力を確認します。
          </p>
        </div>

        <button className="primary-button" type="button" onClick={runChecker} disabled={running}>
          {running ? (
            <><IconLoader2 className="spin" size={18} stroke={2} aria-hidden="true" />チェック中…</>
          ) : (
            <><IconPlayerPlay size={18} stroke={2} aria-hidden="true" />DRM をチェック</>
          )}
        </button>
      </section>

      <section className="status-grid" aria-label="Environment status">
        <article className="mini-card">
          <div className="mini-heading"><IconLock size={16} stroke={2} aria-hidden="true" /><span className="mini-label">Secure Context</span></div>
          <strong>{secureContext ? "Available" : "Unavailable"}</strong>
          <span className="muted">HTTPS または localhost が必要です</span>
        </article>
        <article className="mini-card">
          <div className="mini-heading"><IconKey size={16} stroke={2} aria-hidden="true" /><span className="mini-label">EME API</span></div>
          <strong>{emeAvailable ? "Available" : "Unavailable"}</strong>
          <span className="muted">requestMediaKeySystemAccess</span>
        </article>
        <article className="mini-card">
          <div className="mini-heading"><IconVideo size={16} stroke={2} aria-hidden="true" /><span className="mini-label">Media Capabilities</span></div>
          <strong>{mediaCapabilitiesAvailable ? "Available" : "Unavailable"}</strong>
          <span className="muted">Encrypted playback probing</span>
        </article>
        <article className="mini-card">
          <div className="mini-heading"><IconScan size={16} stroke={2} aria-hidden="true" /><span className="mini-label">Detected</span></div>
          <strong>{supportedCount} / {results.length}</strong>
          <span className="muted">対応 key system</span>
        </article>
      </section>

      <section className="card results-card">
        <div className="card-header">
          <div>
            <h2>DRM サポート状況</h2>
            <p>各 capability を個別に要求し、ブラウザが受理した構成だけを表示します。</p>
          </div>
        </div>

        <div className="drm-list">
          {results.map((result) => (
            <article className="drm-card" key={result.id}>
              <header className="drm-card-header">
                <div>
                  <div className="drm-name">{result.name}</div>
                  <div className="muted">{result.vendor}</div>
                </div>
                <StatusBadge state={result.state} />
              </header>

              <div className="capability-grid">
                <div className="capability-item">
                  <div className="capability-label"><IconShield size={16} stroke={2} aria-hidden="true" />Security Level</div>
                  <div className="capability-content">{result.securityLevel}</div>
                </div>
                <div className="capability-item">
                  <div className="capability-label"><IconShield size={16} stroke={2} aria-hidden="true" />Video Robustness</div>
                  <CapabilityValues values={result.videoRobustness} fallback={result.id === "fairplay" && result.state === "supported" ? "Not exposed" : "—"} />
                </div>
                <div className="capability-item">
                  <div className="capability-label"><IconLock size={16} stroke={2} aria-hidden="true" />Encryption</div>
                  <CapabilityValues values={result.encryption} fallback={result.state === "supported" ? "Not exposed" : "—"} />
                </div>
                <div className="capability-item capability-playback">
                  <div className="capability-label"><IconPlayerPlay size={16} stroke={2} aria-hidden="true" />Encrypted Playback</div>
                  <CapabilityValues values={result.encryptedPlayback} fallback={result.state === "supported" ? "No tested codec profile detected" : "—"} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="notice">
        <div className="notice-title"><IconAlertTriangle size={18} stroke={2} aria-hidden="true" /><strong>注意</strong></div>
        <p>
          Video Robustness と Encryption は EME capability negotiation、Encrypted Playback は可能な場合 Media Capabilities API の暗号化構成で検査します。
          「≤8K」などはこのページが用意した codec/profile・bitrate・framerate のテスト構成で通った最大解像度であり、配信サービスでの再生可否を保証しません。
          Widevine L1 / PlayReady SL3000 表示も認証状態そのものではなく candidate 判定です。
        </p>
      </section>
    </main>
  );
}
