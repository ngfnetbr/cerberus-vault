import { useEffect, useRef, useCallback } from 'react';

const EVENTS: (keyof DocumentEventMap)[] = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function useAutoLock(onLock: () => void, timeoutMinutes: number = 5) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (timeoutMinutes <= 0) return;
    timerRef.current = setTimeout(() => {
      onLock();
    }, timeoutMinutes * 60 * 1000);
  }, [onLock, timeoutMinutes]);

  useEffect(() => {
    resetTimer();

    const handler = () => resetTimer();
    EVENTS.forEach(event => document.addEventListener(event, handler, true));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach(event => document.removeEventListener(event, handler, true));
    };
  }, [resetTimer]);
}
