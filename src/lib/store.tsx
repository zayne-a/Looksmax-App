"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AscendPlan, FaceMeasurements, QuizAnswers } from "./types";
import { getSupabase } from "./supabase";
import { fetchProfile, type Profile } from "./account";

export interface SessionUser {
  id: string;
  email: string;
}

interface AppState {
  quiz: QuizAnswers | null;
  measurements: FaceMeasurements | null;
  plan: AscendPlan | null;
  planLoading: boolean;
  planError: string | null;
  /** Front-scan photo as a data URL (set on /scan, used for the glow-up preview on /plan). */
  frontPhoto: string | null;
  /** Supabase session user, null when logged out or accounts unconfigured. */
  user: SessionUser | null;
  /** The user's profile row (admin/premium flags), null until loaded. */
  profile: Profile | null;
  /** Id of the scans row the current measurements were saved to. */
  savedScanId: string | null;
  setQuiz: (q: QuizAnswers) => void;
  setMeasurements: (m: FaceMeasurements | null) => void;
  setPlan: (p: AscendPlan | null) => void;
  setPlanLoading: (b: boolean) => void;
  setPlanError: (e: string | null) => void;
  setFrontPhoto: (url: string | null) => void;
  setSavedScanId: (id: string | null) => void;
  signOut: () => Promise<void>;
  reset: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [quiz, setQuiz] = useState<QuizAnswers | null>(null);
  const [measurements, setMeasurements] = useState<FaceMeasurements | null>(null);
  const [plan, setPlan] = useState<AscendPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);

  // Auth hydration: mirror the Supabase session into the store and keep
  // it live. No-ops entirely when Supabase isn't configured.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;

    const sync = async (userId: string | null, email?: string) => {
      if (!userId) {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setSavedScanId(null);
        }
        return;
      }
      if (!cancelled) setUser({ id: userId, email: email ?? "" });
      const p = await fetchProfile(userId);
      if (!cancelled) setProfile(p);
    };

    void sb.auth.getSession().then(({ data }) => {
      void sync(
        data.session?.user?.id ?? null,
        data.session?.user?.email ?? undefined,
      );
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      void sync(session?.user?.id ?? null, session?.user?.email ?? undefined);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setProfile(null);
    setSavedScanId(null);
  };

  const reset = () => {
    setQuiz(null);
    setMeasurements(null);
    setPlan(null);
    setPlanLoading(false);
    setPlanError(null);
    setFrontPhoto(null);
    setSavedScanId(null);
  };

  return (
    <AppContext.Provider
      value={{
        quiz,
        measurements,
        plan,
        planLoading,
        planError,
        setQuiz,
        setMeasurements,
        setPlan,
        setPlanLoading,
        setPlanError,
        frontPhoto,
        setFrontPhoto,
        user,
        profile,
        savedScanId,
        setSavedScanId,
        signOut,
        reset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
