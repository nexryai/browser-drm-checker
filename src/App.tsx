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
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

type CheckState = "idle" | "checking" | "supported" | "unsupported";

type Result = {
  id: "widevine" | "playready" | "fairplay";
  name: string;
  vendor: string;
  state: CheckState;
  detail: string;
};

const videoContentType = 'video/mp4;codecs="avc1.42E01E"';

const initialResults: Result[] = [
  { id: "widevine", name: "Widevine", vendor: "Google", state: "idle", detail: "—" },
  { id: "playready", name: "PlayReady", vendor: "Microsoft", state: "idle", detail: "—" },
  { id: "fairplay", name: "FairPlay", vendor: "Apple", state: "idle", detail: "—" },
];

async function checkDRM(keySystem: string, configurations: MediaKeySystemConfiguration[]) {
  try {
    const access = await navigator.requestMediaKeySystemAccess(keySystem, configurations);
    return access.getConfiguration();
  } catch {
    return null;
  }
}

async function detectLevel(
  keySystem: string,
  levels: { name: string; robustness: string }[],
): Promise<string | null> {
  for (const level of levels) {
    const result = await checkDRM(keySystem, [
      {
        initDataTypes: ["cenc"],
        videoCapabilities: [{ contentType: videoContentType, robustness: level.robustness }],
      },
    ]);

    if (result) return level.name;
  }

  return null;
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

export default function App() {
  const [results, setResults] = useState(initialResults);
  const [running, setRunning] = useState(false);
  const emeAvailable = typeof navigator !== "undefined" && "requestMediaKeySystemAccess" in navigator;
  const secureContext = typeof window !== "undefined" && window.isSecureContext;

  const supportedCount = useMemo(
    () => results.filter((result) => result.state === "supported").length,
    [results],
  );

  const updateResult = (id: Result["id"], patch: Partial<Result>) => {
    setResults((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const runChecker = async () => {
    if (running) return;

    setRunning(true);
    setResults(initialResults.map((item) => ({ ...item, state: "checking", detail: "判定中…" })));

    if (!emeAvailable) {
      setResults(initialResults.map((item) => ({ ...item, state: "unsupported", detail: "EME API unavailable" })));
      setRunning(false);
      return;
    }

    const widevine = await detectLevel("com.widevine.alpha", [
      { name: "L1 candidate · HW_SECURE_ALL", robustness: "HW_SECURE_ALL" },
      { name: "L3 candidate · SW_SECURE_DECODE", robustness: "SW_SECURE_DECODE" },
    ]);
    updateResult("widevine", {
      state: widevine ? "supported" : "unsupported",
      detail: widevine ?? "利用可能な robustness を検出できませんでした",
    });

    const playready = await detectLevel("com.microsoft.playready", [
      { name: "SL3000 candidate · robustness 3000", robustness: "3000" },
      { name: "SL2000 candidate · robustness 2000", robustness: "2000" },
    ]);
    updateResult("playready", {
      state: playready ? "supported" : "unsupported",
      detail: playready ?? "利用可能な robustness を検出できませんでした",
    });

    const fairplay = await checkDRM("com.apple.fps", [
      {
        initDataTypes: ["sinf"],
        videoCapabilities: [{ contentType: videoContentType }],
      },
    ]);
    updateResult("fairplay", {
      state: fairplay ? "supported" : "unsupported",
      detail: fairplay ? "FairPlay key system available" : "Key system unavailable",
    });

    setRunning(false);
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Encrypted Media Extensions</p>
          <h1>Browser DRM Checker</h1>
          <p className="lead">
            このブラウザで利用できる DRM key system と、要求可能な robustness を EME API で確認します。
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
          <div className="mini-heading">
            <IconLock size={16} stroke={2} aria-hidden="true" />
            <span className="mini-label">Secure Context</span>
          </div>
          <strong>{secureContext ? "Available" : "Unavailable"}</strong>
          <span className="muted">HTTPS または localhost が必要です</span>
        </article>
        <article className="mini-card">
          <div className="mini-heading">
            <IconKey size={16} stroke={2} aria-hidden="true" />
            <span className="mini-label">EME API</span>
          </div>
          <strong>{emeAvailable ? "Available" : "Unavailable"}</strong>
          <span className="muted">requestMediaKeySystemAccess</span>
        </article>
        <article className="mini-card">
          <div className="mini-heading">
            <IconScan size={16} stroke={2} aria-hidden="true" />
            <span className="mini-label">Detected</span>
          </div>
          <strong>{supportedCount} / {results.length}</strong>
          <span className="muted">対応 key system</span>
        </article>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>DRM サポート状況</h2>
            <p>強い robustness から順に要求し、最初に成功したものを表示します。</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DRM System</th>
                <th>Status</th>
                <th>Detected Level / Robustness</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td>
                    <div className="drm-name">{result.name}</div>
                    <div className="muted">{result.vendor}</div>
                  </td>
                  <td><StatusBadge state={result.state} /></td>
                  <td className="mono">{result.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="notice">
        <div className="notice-title">
          <IconAlertTriangle size={18} stroke={2} aria-hidden="true" />
          <strong>注意</strong>
        </div>
        <p>
          この結果は EME の capability negotiation に基づく推定です。Widevine L1 や PlayReady SL3000 の実際の認証状態、
          HDCP、出力保護、デバイス証明書、配信サービス側の再生可否を直接保証するものではありません。
        </p>
      </section>
    </main>
  );
}
