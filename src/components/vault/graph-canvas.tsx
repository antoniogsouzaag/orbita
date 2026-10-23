"use client";

import * as React from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";

/** Envolve o ForceGraph2D para ajustar o zoom ao terminar a simulação. */
export default function GraphCanvas(props: React.ComponentProps<typeof ForceGraph2D>) {
  const ref = React.useRef<ForceGraphMethods | undefined>(undefined);
  const fitted = React.useRef(false);
  React.useEffect(() => {
    const fg = ref.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-90);
    fg.d3Force("link")?.distance?.(45);
  }, []);
  return (
    <ForceGraph2D
      {...props}
      ref={ref}
      onEngineStop={() => {
        if (!fitted.current) {
          fitted.current = true;
          ref.current?.zoomToFit(500, 50);
        }
      }}
    />
  );
}
