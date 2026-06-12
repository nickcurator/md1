"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasUnseenChangelog, markChangelogSeen } from "@/lib/changelog";
import WhatsNewToast from "@/app/WhatsNewToast";

const WHATS_NEW_PATH = "/whats-new";

type WhatsNewContextValue = {
  openWhatsNew: () => void;
  markSeen: () => void;
  hasUnseen: boolean;
};

const WhatsNewContext = createContext<WhatsNewContextValue>({
  openWhatsNew: () => {},
  markSeen: () => {},
  hasUnseen: false,
});

export function useWhatsNew() {
  return useContext(WhatsNewContext);
}

const TOAST_DELAY_MS = 2000;

function isToastSuppressed(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === WHATS_NEW_PATH ||
    pathname.startsWith("/d/")
  );
}

export default function WhatsNewProvider({
  children,
  loggedIn,
}: {
  children: React.ReactNode;
  loggedIn: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [unseen, setUnseen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!loggedIn) {
      setUnseen(false);
      return;
    }
    setUnseen(hasUnseenChangelog());
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || !unseen || isToastSuppressed(pathname)) {
      setShowToast(false);
      return;
    }
    const t = setTimeout(() => setShowToast(true), TOAST_DELAY_MS);
    return () => clearTimeout(t);
  }, [loggedIn, unseen, pathname]);

  const markSeen = useCallback(() => {
    markChangelogSeen();
    setUnseen(false);
    setShowToast(false);
  }, []);

  const openWhatsNew = useCallback(() => {
    setShowToast(false);
    router.push(WHATS_NEW_PATH);
  }, [router]);

  const dismissToast = useCallback(() => {
    markChangelogSeen();
    setUnseen(false);
    setShowToast(false);
  }, []);

  const value = useMemo(
    () => ({ openWhatsNew, markSeen, hasUnseen: unseen }),
    [openWhatsNew, markSeen, unseen],
  );

  return (
    <WhatsNewContext.Provider value={value}>
      {children}
      {showToast && (
        <WhatsNewToast onOpen={openWhatsNew} onClose={dismissToast} />
      )}
    </WhatsNewContext.Provider>
  );
}
