"use client";

import { useEffect, useState } from "react";
import { useConnectionStore } from "@/store/connection";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Terminal,
  Copy,
  Check,
  WindowsLogo,
  AppleLogo,
  LinuxLogo,
  DownloadSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CaptureView } from "@/components/capture/capture-view";

const CORE_WS_URL = "ws://127.0.0.1:9194/events";
const CORE_PORT = "9194";
const GITHUB_URL = "https://github.com/joachimhodana/vvvv";
const RELEASES_URL = `${GITHUB_URL}/releases`;

type DetectedOS = "macos" | "windows" | "linux";

function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}

const OS_META: Record<DetectedOS, { label: string; icon: typeof AppleLogo; asset: string }> = {
  macos: { label: "macOS", icon: AppleLogo, asset: "vvvv-core_darwin_arm64" },
  windows: { label: "Windows", icon: WindowsLogo, asset: "vvvv-core_windows_amd64.exe" },
  linux: { label: "Linux", icon: LinuxLogo, asset: "vvvv-core_linux_amd64" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" weight="bold" />
      ) : (
        <Copy className="size-3.5" weight="bold" />
      )}
    </button>
  );
}

function StatusIndicator({ status }: { status: string }) {
  if (status === "connecting") {
    return (
      <svg
        className="inline-block size-4 animate-spin text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  }

  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        status === "connected" ? "bg-emerald-400" : "bg-amber-500",
      )}
    />
  );
}

type InstallMethod = "curl" | "wget" | "powershell" | "bat";

function InstallToggle({
  selected,
  onSelect,
}: {
  selected: InstallMethod;
  onSelect: (v: InstallMethod) => void;
}) {
  const options: { value: InstallMethod; label: string }[] = [
    { value: "curl", label: "curl" },
    { value: "wget", label: "wget" },
    { value: "powershell", label: "PowerShell" },
    { value: "bat", label: "CMD" },
  ];

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            selected === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const INSTALL_COMMANDS: Record<InstallMethod, string> = {
  curl: "curl -fsSL https://vvvv.joachimhodana.com/install.sh | sh",
  wget: "wget -qO- https://vvvv.joachimhodana.com/install.sh | sh",
  powershell: "irm https://vvvv.joachimhodana.com/install.ps1 | iex",
  bat: "curl -fsSL -o install.bat https://vvvv.joachimhodana.com/install.bat && install.bat",
};

const NPX_CMD = "npx vvvv listen";

function InstallDialogBody({
  installMethod,
  setInstallMethod,
}: {
  installMethod: InstallMethod;
  setInstallMethod: (v: InstallMethod) => void;
}) {
  const [os] = useState<DetectedOS>(detectOS);
  const meta = OS_META[os];
  const OsIcon = meta.icon;
  const downloadURL = `${RELEASES_URL}/latest/download/${meta.asset}`;
  const cmd = INSTALL_COMMANDS[installMethod];

  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      {/* Install via script */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground">Install via script</p>
          <InstallToggle selected={installMethod} onSelect={setInstallMethod} />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5">
          <code className="flex-1 overflow-x-auto font-mono text-xs text-foreground">
            {cmd}
          </code>
          <CopyButton text={cmd} />
        </div>
      </div>

      {/* Quick run */}
      <div className="space-y-2">
        <p className="font-medium text-foreground">Quick run (coming soon)</p>
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5">
          <code className="flex-1 font-mono text-xs text-foreground">
            {NPX_CMD}
          </code>
          <CopyButton text={NPX_CMD} />
        </div>
        <p className="text-xs text-muted-foreground/70">
          Detects your OS, downloads the latest binary, and starts listening.
        </p>
      </div>

      {/* Direct download */}
      <div className="space-y-2">
        <a
          href={downloadURL}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <OsIcon className="size-4" weight="bold" />
          Download for {meta.label}
        </a>
        <p className="text-center text-xs text-muted-foreground/70">
          Not your OS?{" "}
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-foreground"
          >
            See all releases
          </a>
        </p>
      </div>

      <p className="text-xs text-muted-foreground/70">
        Once the core is running on port {CORE_PORT}, this page will
        automatically connect.
      </p>
    </div>
  );
}

export default function HomePage() {
  const { status, setStatus } = useConnectionStore();
  const [installOpen, setInstallOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [installMethod, setInstallMethod] = useState<InstallMethod>("curl");

  useEffect(() => {
    setStatus("connecting");

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(CORE_WS_URL);
      ws.onopen = () => setStatus("connected");
      ws.onerror = () => setStatus("error");
      ws.onclose = () => setStatus("error");
    } catch {
      setStatus("error");
    }

    return () => {
      ws?.close();
    };
  }, [setStatus]);

  if (status === "connected") {
    return <CaptureView />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-2xl space-y-10">
          <div className="space-y-3">
            <h1 className="text-2xl font-medium tracking-tight">
              Welcome to <span className="font-semibold">vvvv</span>
            </h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              Connecting to vvvv core on localhost:{CORE_PORT}
              <StatusIndicator status={status} />
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Terminal className="size-5 text-primary" weight="bold" />
                </div>
                <CardTitle>vvvv Core CLI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <p>Make sure vvvv core is running locally</p>
                <ol className="list-inside space-y-2">
                  <li>
                    1. Check out our{" "}
                    <button
                      type="button"
                      onClick={() => setInstallOpen(true)}
                      className="text-primary underline underline-offset-4 hover:text-foreground"
                    >
                      installation guide
                    </button>
                  </li>
                  <li>
                    2. Run{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
                      vvvv listen
                    </code>
                  </li>
                </ol>
                <p className="pt-2 text-xs text-muted-foreground/70">
                  Something not working?
                  <br />
                  Open an issue on{" "}
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4 hover:text-foreground"
                  >
                    GitHub
                  </a>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-1 flex items-center gap-2">
                  <img
                    src="/icons/safari.png"
                    alt="Safari"
                    className="h-10 w-auto"
                  />
                  <img
                    src="/icons/brave.png"
                    alt="Brave"
                    className="h-10 w-auto"
                  />
                </div>
                <CardTitle>Using Safari or Brave?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <p>
                  These browsers block localhost connections by default. You'll
                  need a trusted local certificate to let this page talk to the
                  core.
                </p>
                <ol className="list-inside space-y-2">
                  <li>
                    1. Follow the{" "}
                    <button
                      type="button"
                      onClick={() => setBrowserOpen(true)}
                      className="text-primary underline underline-offset-4 hover:text-foreground"
                    >
                      setup steps
                    </button>
                  </li>
                  <li>
                    2. Run{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
                      mkcert -install
                    </code>
                  </li>
                  <li>3. Restart your browser</li>
                </ol>
                <p className="pt-2 text-xs text-muted-foreground/70">
                  On Brave you can also just disable Brave Shields for this
                  page.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install vvvv core</DialogTitle>
            <DialogDescription>
              Download and install the binary with a single command.
            </DialogDescription>
          </DialogHeader>
          <InstallDialogBody installMethod={installMethod} setInstallMethod={setInstallMethod} />
        </DialogContent>
      </Dialog>

      <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img
                src="/icons/safari.png"
                alt="Safari"
                className="h-5 w-auto"
              />
              <img
                src="/icons/brave.png"
                alt="Brave"
                className="h-5 w-auto"
              />
              Browser setup
            </DialogTitle>
            <DialogDescription>
              Allow this page to connect to localhost.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Install mkcert</p>
              <code className="block rounded-lg bg-muted px-3 py-2.5 font-mono text-xs text-foreground">
                brew install mkcert
              </code>
              <p className="text-xs text-muted-foreground/70">
                On Linux use{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                  apt install mkcert
                </code>{" "}
                or see the{" "}
                <a
                  href="https://github.com/FiloSottile/mkcert#installation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-foreground"
                >
                  full install instructions
                </a>
                .
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                Generate and trust a local CA
              </p>
              <code className="block rounded-lg bg-muted px-3 py-2.5 font-mono text-xs text-foreground">
                mkcert -install
              </code>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                Restart your browser
              </p>
              <p className="text-xs text-muted-foreground/70">
                Safari and Brave will now trust localhost connections. On Brave
                you can alternatively disable Brave Shields for this page.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
