export interface BubbleCamera {
  getViewport(): {
    toScreen(x: number, y: number): { x: number; y: number };
    getVisibleBounds(): { x: number; y: number; width: number; height: number };
  };
}
export interface BubbleScreen { screen: { width: number; height: number }; }
