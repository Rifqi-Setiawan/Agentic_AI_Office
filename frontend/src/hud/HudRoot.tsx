import React from 'react';
import { TopBar } from './TopBar';
import { AgentStatusBar } from './AgentStatusBar';
import { ActivityFeed } from './ActivityFeed';
import { SnapshotInspector } from './SnapshotInspector';
import { AgentInspector } from './AgentInspector';

/**
 * Root komponen HUD terpisah.
 * Container utama memiliki pointer-events-none sehingga event mouse/keyboard
 * pada area kanvas di bawahnya tidak terhalangi, sedangkan kontrol HUD
 * memiliki pointer-events-auto.
 */
export const HudRoot: React.FC = () => {
  return (
    <div className="relative w-full h-full flex flex-col justify-between pointer-events-none select-none overflow-hidden">
      {/* Bagian Atas: TopBar & AgentStatusBar */}
      <div className="flex flex-col w-full z-10">
        <TopBar />
        <AgentStatusBar />
      </div>

      {/* Panel Inspector Agen Terpilih */}
      <AgentInspector />

      {/* Bagian Bawah: ActivityFeed & SnapshotInspector */}
      <div className="w-full relative z-10">
        <SnapshotInspector />
        <ActivityFeed />
      </div>
    </div>
  );
};
