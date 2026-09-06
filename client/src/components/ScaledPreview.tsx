import React, { useRef, useEffect, useState } from 'react';

interface ScaledPreviewProps {
  children: React.ReactNode;
  targetWidth?: number;
}

export const ScaledPreview: React.FC<ScaledPreviewProps> = ({ children, targetWidth = 850 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth;
        // Add a little padding (e.g., 32px total)
        const newScale = Math.min((availableWidth - 32) / targetWidth, 1);
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [targetWidth]);

  return (
    <div ref={containerRef} className="w-full flex justify-center overflow-hidden" style={{ height: 842 * scale }}>
      <div 
        style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'top center',
          width: targetWidth,
          height: 842
        }}
      >
        {children}
      </div>
    </div>
  );
};
