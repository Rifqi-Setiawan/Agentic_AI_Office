import React from 'react';
import { HudRoot } from './hud/HudRoot';

/**
 * Root komponen aplikasi HUD React.
 * Terpisah dari loop render kanvas PixiJS.
 */
export const App: React.FC = () => {
  return <HudRoot />;
};
