// src/contexts/LoadingContext.tsx
import { createContext, useContext, useState, useMemo, ReactNode } from "react";

type LoadingContextType = {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  withLoading: <T>(promise: Promise<T>) => Promise<T>;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [count, setCount] = useState(0);
  const isLoading = count > 0;

  const startLoading = () => setCount((c) => c + 1);
  const stopLoading = () => setCount((c) => Math.max(0, c - 1));

  const withLoading = async <T,>(promise: Promise<T>): Promise<T> => {
    startLoading();
    try {
      return await promise;
    } finally {
      stopLoading();
    }
  };

  const value = useMemo(
    () => ({ isLoading, startLoading, stopLoading, withLoading }),
    [isLoading]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {/* PAS de <LoadingScreen /> ici */}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return ctx;
};
