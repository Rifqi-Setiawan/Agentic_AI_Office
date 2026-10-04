import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useOfficeStore, type FlyingIconItem } from '../store/officeStore';

export const FlyingIconSingle: React.FC<{
  item: FlyingIconItem;
  onComplete: (id: string) => void;
}> = ({ item, onComplete }) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) {
      onComplete(item.id);
      return;
    }

    // Cek preferensi prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Hilangkan animasi terbang, segera selesai
      const t = setTimeout(() => {
        onComplete(item.id);
      }, 200);
      return () => clearTimeout(t);
    }

    const deltaX = item.targetX - item.startX;
    const deltaY = item.targetY - item.startY;

    // Animasi lengkung parabola halus menggunakan GSAP
    const tween = gsap.to(el, {
      x: deltaX,
      y: deltaY,
      scale: 0.85,
      opacity: 0.9,
      duration: 0.85,
      ease: 'power2.inOut',
      onComplete: () => {
        onComplete(item.id);
      },
    });

    return () => {
      tween.kill();
    };
  }, [item, onComplete]);

  return (
    <div
      ref={elRef}
      data-testid="flying-task-icon"
      data-agent={item.agentId}
      data-kind={item.kind}
      style={{
        position: 'fixed',
        left: `${item.startX}px`,
        top: `${item.startY}px`,
        transform: 'translate(-50%, -50%)',
        backgroundColor: item.color,
      }}
      className="z-50 pointer-events-none flex items-center justify-center w-8 h-8 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.6)] border-2 border-white/60 text-sm select-none"
    >
      <span>{item.symbol}</span>
    </div>
  );
};

export const FlyingIconLayer: React.FC = () => {
  const flyingIcons = useOfficeStore((s) => s.flyingIcons);
  const removeFlyingIcon = useOfficeStore((s) => s.removeFlyingIcon);

  return (
    <div
      id="flying-icon-layer"
      aria-hidden="true"
      className="fixed inset-0 z-40 pointer-events-none overflow-hidden"
    >
      {flyingIcons.map((item) => (
        <FlyingIconSingle
          key={item.id}
          item={item}
          onComplete={removeFlyingIcon}
        />
      ))}
    </div>
  );
};
