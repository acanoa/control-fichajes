const APP_VERSION = 'v1.0.0';

export function VersionBadge() {
  return (
    <div
      aria-label={`Versión de la aplicación ${APP_VERSION}`}
      className="fixed bottom-3 right-3 z-40 rounded-full border border-brand-border/60 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-brand-subtext shadow-sm backdrop-blur-sm pointer-events-none"
    >
      versión {APP_VERSION}
    </div>
  );
}
