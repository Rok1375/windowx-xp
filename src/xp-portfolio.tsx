import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FileText,
  Folder,
  Github,
  Globe,
  Heart,
  Image,
  Mail,
  Minimize2,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Users,
  Volume2,
  X,
} from "lucide-react";

type Phase = "boot" | "login" | "desktop";
type WindowKind = "projects" | "resume" | "contact" | "recycle" | "games";

type Bounds = { x: number; y: number; width: number; height: number };

type AppWindow = {
  id: string;
  kind: WindowKind;
  title: string;
  icon: typeof Folder;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  restore?: Bounds;
};

type DesktopItem = {
  kind: WindowKind;
  label: string;
  icon: typeof Folder;
  hint: string;
  accent: string;
};

const TASKBAR_HEIGHT = 30;
const WINDOW_MIN_WIDTH = 280;
const WINDOW_MIN_HEIGHT = 200;

const WALLPAPER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="none">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#82c6ff"/>
      <stop offset="48%" stop-color="#99d4ff"/>
      <stop offset="100%" stop-color="#d9f1ff"/>
    </linearGradient>
    <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#58ad3f"/>
      <stop offset="100%" stop-color="#2f7b1f"/>
    </linearGradient>
    <linearGradient id="hillB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#67b94b"/>
      <stop offset="100%" stop-color="#317c22"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.76" cy="0.18" r="0.18">
      <stop offset="0%" stop-color="#fffde8" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#fffde8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <circle cx="1580" cy="180" r="200" fill="url(#glow)"/>
  <path d="M0 760 C 220 640, 430 620, 690 710 C 880 775, 1030 885, 1240 860 C 1460 835, 1590 720, 1920 760 L 1920 1080 L 0 1080 Z" fill="url(#hillA)"/>
  <path d="M0 820 C 180 760, 310 790, 510 865 C 720 940, 900 955, 1100 890 C 1350 810, 1600 805, 1920 900 L 1920 1080 L 0 1080 Z" fill="url(#hillB)"/>
  <path d="M0 760 C 220 640, 430 620, 690 710 C 880 775, 1030 885, 1240 860 C 1460 835, 1590 720, 1920 760" fill="none" stroke="#f1ffe0" stroke-opacity="0.45" stroke-width="8"/>
  <path d="M0 820 C 180 760, 310 790, 510 865 C 720 940, 900 955, 1100 890 C 1350 810, 1600 805, 1920 900" fill="none" stroke="#f1ffe0" stroke-opacity="0.22" stroke-width="6"/>
</svg>`;

const WALLPAPER_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(WALLPAPER_SVG)}`;

const desktopItems: DesktopItem[] = [
  { kind: "projects", label: "My Projects", icon: Folder, hint: "Open portfolio projects", accent: "#ffcd38" },
  { kind: "resume", label: "Resume.pdf", icon: FileText, hint: "Read my experience", accent: "#76c2ff" },
  { kind: "contact", label: "Contact Me", icon: Mail, hint: "Find me online", accent: "#ff8ed1" },
  { kind: "recycle", label: "Recycle Bin", icon: Trash2, hint: "Recently removed files", accent: "#8de05f" },
  { kind: "games", label: "Games", icon: Sparkles, hint: "Open the arcade", accent: "#e7b2ff" },
];

const startLinks = [
  { label: "Projects", kind: "projects" as const, icon: Folder },
  { label: "Contact", kind: "contact" as const, icon: Mail },
  { label: "Resume", kind: "resume" as const, icon: FileText },
  { label: "Games", kind: "games" as const, icon: Sparkles },
];

const systemFolders = [
  { label: "My Documents", kind: "projects" as const, icon: Folder },
  { label: "My Pictures", kind: "games" as const, icon: Image },
];

const projectCards = [
  { name: "Windows XP Portfolio", tech: "React + CSS", text: "A fully interactive retro desktop experience with draggable windows, taskbar state, and a boot/login flow." },
  { name: "AI Studio Theme", tech: "State Driven UI", text: "Global window manager, start menu orchestration, icon selection, and taskbar syncing for a computer-like feel." },
  { name: "Pixel Perfect Polish", tech: "Plain CSS", text: "Classic bevels, gradients, blocky scrollbars, and a wallpaper layer that feels like the real operating system." },
];

const resumeSections = [
  {
    title: "Profile",
    body: "Frontend developer focused on immersive interfaces, polished interactions, and production-grade component systems.",
  },
  {
    title: "Strengths",
    body: "React, TypeScript, UI engineering, animation, responsive layout systems, and design token driven development.",
  },
  {
    title: "What this theme proves",
    body: "The desktop shell links icons, windows, taskbar, and start menu together so the user feels like they are operating a computer rather than browsing a webpage.",
  },
];

function makeId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
}

function formatClock(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = ((hours + 11) % 12) + 1;
  return `${displayHours.toString().padStart(2, "0")}:${minutes} ${suffix}`;
}

function getSpawnBounds(index: number): Bounds {
  const baseX = 110 + (index % 3) * 22;
  const baseY = 78 + (index % 3) * 18;
  return {
    x: baseX,
    y: baseY,
    width: 560,
    height: 390,
  };
}

function createWindow(kind: WindowKind, index: number, zIndex: number): AppWindow {
  const bounds = getSpawnBounds(index);
  const titles: Record<WindowKind, string> = {
    projects: "My Projects",
    resume: "Resume.pdf",
    contact: "Contact Me",
    recycle: "Recycle Bin",
    games: "Games",
  };
  return {
    id: makeId(kind),
    kind,
    title: titles[kind],
    icon: kind === "contact" ? Mail : kind === "resume" ? FileText : kind === "recycle" ? Trash2 : kind === "games" ? Sparkles : Folder,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minimized: false,
    maximized: false,
    zIndex,
  };
}

function clampWindow(bounds: Bounds, desktop: { width: number; height: number }) {
  const width = Math.max(WINDOW_MIN_WIDTH, Math.min(bounds.width, desktop.width));
  const height = Math.max(WINDOW_MIN_HEIGHT, Math.min(bounds.height, desktop.height));
  const x = Math.max(0, Math.min(bounds.x, Math.max(0, desktop.width - width)));
  const y = Math.max(0, Math.min(bounds.y, Math.max(0, desktop.height - height)));
  return { x, y, width, height };
}

function XPLogo() {
  return (
    <span className="xp-logo" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function SectionBadge({ icon: Icon, label }: { icon: typeof Folder; label: string }) {
  return (
    <div className="xp-section-badge">
      <Icon size={13} />
      <span>{label}</span>
    </div>
  );
}

function WindowBody({ kind }: { kind: WindowKind }) {
  if (kind === "projects") {
    return (
      <div className="xp-window-body xp-selectable">
        <div className="xp-hero-panel">
          <div>
            <p className="xp-kicker">Developer portfolio</p>
            <h2>Windows XP. But make it a living portfolio.</h2>
            <p>
              Everything is wired together like a real OS: desktop icons, windows, taskbar buttons,
              start menu, and responsive shell behavior.
            </p>
          </div>
          <div className="xp-hero-stack">
            <div className="xp-stat">
              <strong>Interactive</strong>
              <span>Window manager</span>
            </div>
            <div className="xp-stat">
              <strong>Retro</strong>
              <span>XP visual system</span>
            </div>
            <div className="xp-stat">
              <strong>Responsive</strong>
              <span>Desktop-first layout</span>
            </div>
          </div>
        </div>

        <div className="xp-card-grid">
          {projectCards.map((project) => (
            <article className="xp-card" key={project.name}>
              <div className="xp-card-head">
                <strong>{project.name}</strong>
                <span>{project.tech}</span>
              </div>
              <p>{project.text}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "resume") {
    return (
      <div className="xp-window-body xp-selectable xp-document">
        <div className="xp-doc-header">
          <h2>Developer — Resume.pdf</h2>
          <p>Classic text document view, fully selectable.</p>
        </div>
        {resumeSections.map((section) => (
          <section key={section.title} className="xp-doc-section">
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </section>
        ))}
        <section className="xp-doc-section">
          <h3>Skills</h3>
          <p>React, TypeScript, CSS architecture, state management, motion design, and systems thinking.</p>
        </section>
      </div>
    );
  }

  if (kind === "contact") {
    return (
      <div className="xp-window-body xp-selectable">
        <div className="xp-contact-layout">
          <div className="xp-contact-card">
            <SectionBadge icon={Mail} label="Email" />
            <p>hello@developer.example</p>
          </div>
          <div className="xp-contact-card">
            <SectionBadge icon={Github} label="GitHub" />
            <p>/developer</p>
          </div>
          <div className="xp-contact-card">
            <SectionBadge icon={Globe} label="LinkedIn" />
            <p>/in/developer</p>
          </div>
          <div className="xp-contact-card xp-contact-cta">
            <SectionBadge icon={Users} label="Let's build" />
            <p>Use the taskbar, start menu, and desktop icons to jump around the portfolio instantly.</p>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "games") {
    return (
      <div className="xp-window-body xp-selectable">
        <div className="xp-game-grid">
          <div className="xp-game-slot">
            <SectionBadge icon={Sparkles} label="Arcade" />
            <p>Animated background, keyboard-ready layout, and room for future minigames like Snake or Pong.</p>
          </div>
          <div className="xp-game-slot">
            <SectionBadge icon={Terminal} label="Developer Console" />
            <p>Perfect for adding playful terminal-style mini challenges or easter eggs later.</p>
          </div>
          <div className="xp-game-slot xp-game-banner">
            <SectionBadge icon={Heart} label="Interactive" />
            <p>Link games to the start menu so the desktop feels like an actual computer interface.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="xp-window-body xp-selectable">
      <div className="xp-recycle">
        <Trash2 size={28} />
        <h2>Recycle Bin</h2>
        <p>Nothing to delete right now. This desktop is clean and ready for future portfolio files.</p>
      </div>
    </div>
  );
}

function DesktopWindow({
  window,
  desktopSize,
  active,
  onBringToFront,
  onClose,
  onMinimize,
  onToggleMaximize,
  onMove,
  onResize,
}: {
  window: AppWindow;
  desktopSize: { width: number; height: number };
  active: boolean;
  onBringToFront: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  onMove: (id: string, next: Bounds) => void;
  onResize: (id: string, next: Bounds) => void;
}) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resizeRef = useRef<{
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      if (dragRef.current && !window.maximized) {
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        const next = clampWindow(
          {
            x: dragRef.current.originX + dx,
            y: dragRef.current.originY + dy,
            width: window.width,
            height: window.height,
          },
          desktopSize,
        );
        onMove(window.id, next);
      }

      if (resizeRef.current && !window.maximized) {
        const dx = event.clientX - resizeRef.current.startX;
        const dy = event.clientY - resizeRef.current.startY;
        const next = clampWindow(
          {
            x: window.x,
            y: window.y,
            width: resizeRef.current.originWidth + dx,
            height: resizeRef.current.originHeight + dy,
          },
          desktopSize,
        );
        onResize(window.id, next);
      }
    }

    function handleUp() {
      dragRef.current = null;
      resizeRef.current = null;
      document.body.style.cursor = "default";
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [desktopSize, onMove, onResize, window.height, window.id, window.maximized, window.width, window.x]);

  const style = window.maximized
    ? {
        left: 0,
        top: 0,
        width: desktopSize.width,
        height: desktopSize.height,
        zIndex: window.zIndex,
      }
    : {
        left: window.x,
        top: window.y,
        width: window.width,
        height: window.height,
        zIndex: window.zIndex,
      };

  return (
    <div
      className={`xp-window ${active ? "is-active" : ""}`}
      style={style}
      onPointerDown={() => onBringToFront(window.id)}
      onDoubleClick={(event) => event.stopPropagation()}
      role="presentation"
    >
      <div
        className="xp-titlebar"
        onPointerDown={(event) => {
          event.stopPropagation();
          onBringToFront(window.id);
          if (window.maximized) return;
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: window.x,
            originY: window.y,
          };
          document.body.style.cursor = "move";
        }}
      >
        <div className="xp-title-left">
          <window.icon size={14} />
          <span>{window.title}</span>
        </div>
        <div className="xp-controls">
          <button type="button" aria-label="Minimize" onClick={(event) => {
            event.stopPropagation();
            onMinimize(window.id);
          }}>
            <Minimize2 size={10} />
          </button>
          <button type="button" aria-label="Maximize or restore" onClick={(event) => {
            event.stopPropagation();
            onToggleMaximize(window.id);
          }}>
            <Square size={9} />
          </button>
          <button type="button" aria-label="Close" onClick={(event) => {
            event.stopPropagation();
            onClose(window.id);
          }}>
            <X size={11} />
          </button>
        </div>
      </div>

      <div className="xp-window-shell">
        <div className="xp-toolbar">
          <span className="xp-toolbar-dot" />
          <span>Windows XP shell</span>
          <span className="xp-toolbar-spacer" />
          <span>Active window</span>
        </div>
        <WindowBody kind={window.kind} />
      </div>

      <div
        className="xp-resize-handle"
        onPointerDown={(event) => {
          event.stopPropagation();
          if (window.maximized) return;
          onBringToFront(window.id);
          resizeRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originWidth: window.width,
            originHeight: window.height,
          };
          document.body.style.cursor = "nwse-resize";
        }}
      />
    </div>
  );
}

function StartMenu({
  onOpen,
  onClose,
}: {
  onOpen: (kind: WindowKind) => void;
  onClose: () => void;
}) {
  return (
    <div className="xp-start-menu" onPointerDown={(event) => event.stopPropagation()}>
      <div className="xp-start-banner">
        <div className="xp-avatar">D</div>
        <div>
          <strong>Developer</strong>
          <span>Windows XP Portfolio</span>
        </div>
      </div>

      <div className="xp-start-columns">
        <div className="xp-start-left">
          {startLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} type="button" className="xp-start-item" onClick={() => onOpen(item.kind)}>
                <Icon size={15} />
                <span>{item.label}</span>
                <ChevronRight size={12} />
              </button>
            );
          })}
        </div>
        <div className="xp-start-right">
          {systemFolders.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} type="button" className="xp-folder-item" onClick={() => onOpen(item.kind)}>
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="xp-start-footer">
        <button type="button" className="xp-footer-btn ghost" onClick={onClose}>
          Log Off
        </button>
        <button type="button" className="xp-footer-btn danger" onClick={onClose}>
          Shut Down
        </button>
      </div>
    </div>
  );
}

function BootScreen() {
  return (
    <div className="xp-boot-screen" aria-label="Windows XP boot screen">
      <div className="xp-boot-logo">
        <span>Microsoft</span>
        <strong>Windows XP</strong>
      </div>
      <div className="xp-boot-loading">
        <div className="xp-boot-track">
          <div className="xp-boot-bar" />
        </div>
        <p>Starting up the portfolio shell...</p>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <button className="xp-login-screen" type="button" onClick={onLogin}>
      <div className="xp-login-card">
        <div className="xp-login-avatar">D</div>
        <div>
          <h1>Developer</h1>
          <p>Click your profile to log on</p>
        </div>
      </div>
    </button>
  );
}

export default function WindowsXpPortfolio() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<WindowKind | null>(null);
  const [windows, setWindows] = useState<AppWindow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zCounter, setZCounter] = useState(10);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const startMenuRef = useRef<HTMLDivElement | null>(null);
  const [desktopSize, setDesktopSize] = useState({ width: window.innerWidth, height: window.innerHeight - TASKBAR_HEIGHT });

  useEffect(() => {
    document.title = "Developer • Windows XP Portfolio";
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase("login"), 2200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(formatClock(new Date())), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = desktopRef.current?.clientWidth ?? window.innerWidth;
      const height = (desktopRef.current?.clientHeight ?? window.innerHeight) - TASKBAR_HEIGHT;
      setDesktopSize({ width, height });
      setWindows((current) =>
        current.map((item) => {
          if (!item.maximized) {
            return { ...item, ...clampWindow({ x: item.x, y: item.y, width: item.width, height: item.height }, { width, height }) };
          }
          return { ...item, width, height };
        }),
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const inMenu = !!startMenuRef.current?.contains(target);
      const inButton = !!startButtonRef.current?.contains(target);
      if (!inMenu && !inButton) {
        setStartMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const openWindow = useCallback((kind: WindowKind) => {
    setSelectedIcon(kind);
    setStartMenuOpen(false);
    setWindows((current) => {
      const found = current.find((item) => item.kind === kind);
      const nextZ = zCounter + 1;
      setZCounter(nextZ);
      if (found) {
        setActiveId(found.id);
        return current.map((item) =>
          item.kind === kind
            ? {
                ...item,
                minimized: false,
                maximized: false,
                zIndex: nextZ,
                ...(item.restore ?? {}),
              }
            : item,
        );
      }
      const spawned = createWindow(kind, current.length, nextZ);
      setActiveId(spawned.id);
      return [...current, spawned];
    });
  }, [zCounter]);

  const bringToFront = useCallback((id: string) => {
    setWindows((current) => {
      const nextZ = zCounter + 1;
      setZCounter(nextZ);
      return current.map((item) => (item.id === id ? { ...item, zIndex: nextZ, minimized: false } : item));
    });
    setActiveId(id);
  }, [zCounter]);

  const closeWindow = useCallback((id: string) => {
    setWindows((current) => current.filter((item) => item.id !== id));
    setActiveId((current) => (current === id ? null : current));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, minimized: true } : item)));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (item.maximized) {
          const restore = item.restore ?? { x: 90, y: 70, width: 560, height: 390 };
          return {
            ...item,
            maximized: false,
            ...clampWindow(restore, desktopSize),
          };
        }
        return {
          ...item,
          maximized: true,
          restore: { x: item.x, y: item.y, width: item.width, height: item.height },
          x: 0,
          y: 0,
          width: desktopSize.width,
          height: desktopSize.height,
          zIndex: item.zIndex + 1,
        };
      }),
    );
    setActiveId(id);
  }, [desktopSize]);

  const moveWindow = useCallback((id: string, next: Bounds) => {
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  const resizeWindow = useCallback((id: string, next: Bounds) => {
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  const taskbarItems = useMemo(() => windows, [windows]);

  if (phase === "boot") {
    return <BootScreen />;
  }

  if (phase === "login") {
    return <LoginScreen onLogin={() => setPhase("desktop")} />;
  }

  return (
    <div className="xp-shell">
      <div
        ref={desktopRef}
        className="xp-desktop"
        style={{ backgroundImage: `url(${WALLPAPER_URL})` }}
        onPointerDown={() => setStartMenuOpen(false)}
      >
        <div className="xp-desktop-overlay" />
        <div className="xp-desktop-icons">
          {desktopItems.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedIcon === item.kind;
            return (
              <button
                key={item.kind}
                type="button"
                className={`xp-desktop-icon ${isSelected ? "selected" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedIcon(item.kind);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  openWindow(item.kind);
                }}
              >
                <span className="xp-icon-frame" style={{ background: item.accent }}>
                  <Icon size={22} />
                </span>
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            );
          })}
        </div>

        {windows.map((item) => (
          <DesktopWindow
            key={item.id}
            window={item}
            desktopSize={desktopSize}
            active={activeId === item.id}
            onBringToFront={bringToFront}
            onClose={closeWindow}
            onMinimize={minimizeWindow}
            onToggleMaximize={toggleMaximize}
            onMove={moveWindow}
            onResize={resizeWindow}
          />
        ))}

        {startMenuOpen ? <div ref={startMenuRef}><StartMenu onOpen={openWindow} onClose={() => setStartMenuOpen(false)} /></div> : null}
      </div>

      <div className="xp-taskbar" onPointerDown={() => setStartMenuOpen(false)}>
        <button
          ref={startButtonRef}
          type="button"
          className={`xp-start-button ${startMenuOpen ? "open" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setStartMenuOpen((current) => !current)}
        >
          <XPLogo />
          <span>Start</span>
        </button>

        <div className="xp-taskbar-apps" onPointerDown={(event) => event.stopPropagation()}>
          {taskbarItems.map((item) => {
            const Icon = item.icon;
            const active = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`xp-taskbar-item ${active ? "active" : ""}`}
                onClick={() => {
                  if (item.minimized) {
                    setWindows((current) => {
                      const nextZ = zCounter + 1;
                      setZCounter(nextZ);
                      setActiveId(item.id);
                      return current.map((windowItem) =>
                        windowItem.id === item.id
                          ? { ...windowItem, minimized: false, zIndex: nextZ }
                          : windowItem,
                      );
                    });
                    return;
                  }
                  minimizeWindow(item.id);
                  setActiveId(null);
                }}
              >
                <Icon size={13} />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        <div className="xp-tray">
          <div className="xp-tray-inner">
            <Volume2 size={13} />
            <span>{clock}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
