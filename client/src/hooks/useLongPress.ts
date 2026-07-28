import { useCallback, useRef } from 'react';

export const useLongPress = (
  onLongPress: (e: any) => void,
  onClick: (e: any) => void,
  { shouldPreventDefault = true, delay = 500 } = {}
) => {
  const timeout = useRef<any>(null);
  const target = useRef<any>(null);

  const start = useCallback(
    (event: any) => {
      // Ignore interactions with buttons, inputs, or specifically marked elements
      if (event.target?.closest?.('button, input, .no-row-click')) return;

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
      shouldTriggerClick && onClick(event);
      if (shouldPreventDefault && target.current) {
        target.current.removeEventListener('touchend', preventDefault);
      }
    },
    [shouldPreventDefault, onClick]
  );

  return {
    onMouseDown: (e: any) => start(e),
    onTouchStart: (e: any) => start(e),
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
