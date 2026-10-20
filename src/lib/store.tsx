"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { AscendPlan, FaceMeasurements, QuizAnswers } from "./types";

interface AppState {
  quiz: QuizAnswers | null;
  measurements: FaceMeasurements | null;
  plan: AscendPlan | null;
  planLoading: boolean;
  planError: string | null;
  /** Front-scan photo as a data URL (set on /scan, used for the glow-up preview on /plan). */
  frontPhoto: string | null;
  setQuiz: (q: QuizAnswers) => void;
  setMeasurements: (m: FaceMeasurements | null) => void;
  setPlan: (p: AscendPlan | null) => void;
  setPlanLoading: (b: boolean) => void;
  setPlanError: (e: string | null) => void;
  setFrontPhoto: (url: string | null) => void;
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

  const reset = () => {
    setQuiz(null);
    setMeasurements(null);
    setPlan(null);
    setPlanLoading(false);
    setPlanError(null);
    setFrontPhoto(null);
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
