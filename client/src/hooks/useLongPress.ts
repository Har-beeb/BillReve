import { useCallback, useRef } from 'react';

export const useLongPress = (
  onLongPress: (e: React.PointerEvent<HTMLDivElement>) => void,
  onClick: (e: React.PointerEvent<HTMLDivElement>) => void,
  { shouldPreventDefault = true, delay = 500 } = {}
) => {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMoved = useRef(false);
  const isLongPressTriggered = useRef(false);
  const suppressClick = useRef(false);
  const startPos = useRef<{x: number, y: number} | null>(null);

  const isInteractiveTarget = (event: React.PointerEvent<HTMLDivElement>) =>
    Boolean(event.target instanceof Element && event.target.closest('button, input, a, textarea, select, .no-row-click'));

  const start = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event)) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    isMoved.current = false;
    isLongPressTriggered.current = false;
    suppressClick.current = false;
    startPos.current = { x: event.clientX, y: event.clientY };

    if (shouldPreventDefault) {
      event.currentTarget.style.userSelect = 'none';
    }

    timeout.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      suppressClick.current = true;
      onLongPress(event);
    }, delay);
  }, [delay, onLongPress, shouldPreventDefault]);

  const clear = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event)) return;

    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    startPos.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [onClick]);

  const move = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!startPos.current) return;

    const diffX = Math.abs(event.clientX - startPos.current.x);
    const diffY = Math.abs(event.clientY - startPos.current.y);

    if (diffX > 10 || diffY > 10) {
      isMoved.current = true;
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
    }
  }, []);

  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => start(e),
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => move(e),
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => clear(e),
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => clear(e),
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      if (isInteractiveTarget(e as unknown as React.PointerEvent<HTMLDivElement>)) return;
      if (suppressClick.current || isMoved.current) {
        suppressClick.current = false;
        return;
      }
      onClick(e as unknown as React.PointerEvent<HTMLDivElement>);
    }
  };
};
