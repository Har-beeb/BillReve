import { useCallback, useRef } from 'react';

export const useLongPress = (
  onLongPress: (e: any) => void,
  onClick: (e: any) => void,
  { shouldPreventDefault = true, delay = 500 } = {}
) => {
  const timeout = useRef<any>(null);
  const target = useRef<any>(null);
  const isMoved = useRef(false);
  const startPos = useRef<{x: number, y: number} | null>(null);

  const start = useCallback(
    (event: any) => {
      // Ignore interactions with buttons, inputs, or specifically marked elements
      if (event.target?.closest?.('button, input, .no-row-click')) return;

      isMoved.current = false;
      
      if (isTouchEvent(event)) {
        startPos.current = {
          x: (event as unknown as TouchEvent).touches[0].clientX,
          y: (event as unknown as TouchEvent).touches[0].clientY
        };
      } else {
        startPos.current = { x: event.clientX, y: event.clientY };
      }

      if (shouldPreventDefault && event.target) {
        event.target.addEventListener('touchend', preventDefault, {
          passive: false
        });
        target.current = event.target;
      }
      timeout.current = setTimeout(() => {
        onLongPress(event);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (event: any, shouldTriggerClick = true) => {
      // Ignore interactions with buttons, inputs, or specifically marked elements
      if (event.target?.closest?.('button, input, .no-row-click')) return;

      timeout.current && clearTimeout(timeout.current);
      if (shouldTriggerClick && !isMoved.current) {
        onClick(event);
      }
      if (shouldPreventDefault && target.current) {
        target.current.removeEventListener('touchend', preventDefault);
      }
      startPos.current = null;
    },
    [shouldPreventDefault, onClick]
  );

  const move = useCallback((event: any) => {
    if (!startPos.current) return;
    
    let currentX, currentY;
    if (isTouchEvent(event)) {
      currentX = (event as unknown as TouchEvent).touches[0].clientX;
      currentY = (event as unknown as TouchEvent).touches[0].clientY;
    } else {
      currentX = event.clientX;
      currentY = event.clientY;
    }

    const diffX = Math.abs(currentX - startPos.current.x);
    const diffY = Math.abs(currentY - startPos.current.y);

    // If moved more than 10 pixels, consider it a scroll/swipe
    if (diffX > 10 || diffY > 10) {
      isMoved.current = true;
      timeout.current && clearTimeout(timeout.current);
    }
  }, []);

  return {
    onMouseDown: (e: any) => start(e),
    onTouchStart: (e: any) => start(e),
    onMouseMove: (e: any) => move(e),
    onTouchMove: (e: any) => move(e),
    onMouseUp: (e: any) => clear(e),
    onMouseLeave: (e: any) => clear(e, false),
    onTouchEnd: (e: any) => clear(e)
  };
};

const isTouchEvent = (event: Event) => {
  return 'touches' in event;
};

const preventDefault = (event: Event) => {
  if (!isTouchEvent(event)) return;

  if ((event as TouchEvent).touches.length < 2 && event.preventDefault) {
    event.preventDefault();
  }
};
