"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useConnectionStore } from "@/store/connection";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Terminal } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CaptureView } from "@/components/capture/capture-view";

const CORE_WS_URL = "ws://127.0.0.1:9194/events";
const CORE_PORT = "9194";
const GITHUB_URL = "https://github.com/joachimhodana/vvvv";

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

function InstallToggle({
  selected,
  onSelect,
}: {
  selected: "curl" | "wget";
  onSelect: (v: "curl" | "wget") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onSelect("curl")}
        className={cn(
          "rounded-md px-2.5 py-1 font-medium transition-colors",
          selected === "curl"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        curl
      </button>
      <button
        type="button"
        onClick={() => onSelect("wget")}
        className={cn(
          "rounded-md px-2.5 py-1 font-medium transition-colors",
          selected === "wget"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        wget
      </button>
    </div>
  );
}

const CURL_CMD = "curl -fsSL https://get.vvvv.dev | sh";
const WGET_CMD = "wget -qO- https://get.vvvv.dev | sh";

export default function HomePage() {
  const { status, setStatus } = useConnectionStore();
  const [installOpen, setInstallOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [installMethod, setInstallMethod] = useState<"curl" | "wget">("curl");

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
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">Download binary</p>
              <InstallToggle
                selected={installMethod}
                onSelect={setInstallMethod}
              />
            </div>
            <code className="block rounded-lg bg-muted px-3 py-2.5 font-mono text-xs text-foreground">
              {installMethod === "curl" ? CURL_CMD : WGET_CMD}
            </code>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                Quick run (coming soon)
              </p>
              <code className="block rounded-lg bg-muted px-3 py-2.5 font-mono text-xs text-foreground">
                npx vvvv listen
              </code>
              <p className="text-xs text-muted-foreground/70">
                Detects your OS, downloads the latest binary, and starts
                listening.
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70">
              Once the core is running on port {CORE_PORT}, this page will
              automatically connect.
            </p>
          </div>
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
