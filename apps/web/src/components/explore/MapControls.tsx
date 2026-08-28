"use client";

import type React from "react";
import { Button, ButtonStack, IconButton } from "@/components/ui";
import { LAYER_LABELS, type LayerVisibility } from "./layer-visibility";
import { CheckRow } from "@/components/ui";
import styles from "./explorer.module.css";

export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onBackToIndia,
  showBackToIndia,
  layers,
  onToggleLayer,
  layersOpen,
  onToggleLayersOpen,
}: {
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onReset: () => void;
  readonly onBackToIndia: () => void;
  readonly showBackToIndia: boolean;
  readonly layers: LayerVisibility;
  readonly onToggleLayer: (key: keyof LayerVisibility) => void;
  readonly layersOpen: boolean;
  readonly onToggleLayersOpen: () => void;
}): React.JSX.Element {
  return (
    <>
      {showBackToIndia && (
        <Button onClick={onBackToIndia}>
          <span aria-hidden="true">↖</span> Back to India
        </Button>
      )}
      <ButtonStack>
        <IconButton glyph="+" label="Zoom in" onClick={onZoomIn} />
        <IconButton glyph="−" label="Zoom out" onClick={onZoomOut} />
        <IconButton glyph="⤢" label="Reset view to current selection" onClick={onReset} />
      </ButtonStack>
      <Button
        onClick={onToggleLayersOpen}
        ariaExpanded={layersOpen}
        ariaControls="map-layers"
        variant={layersOpen ? "accent" : "default"}
      >
        <span aria-hidden="true">▤</span> Layers
      </Button>
      <div
        id="map-layers"
        className={styles.panel}
        hidden={!layersOpen}
        style={{ width: 268, textAlign: "left" }}
      >
        <div className={styles.panelBody}>
          <h2 className={styles.panelTitle}>Map layers</h2>
          {LAYER_LABELS.map((layer) => (
            <CheckRow
              key={layer.key}
              checked={layers[layer.key]}
              onChange={() => {
                onToggleLayer(layer.key);
              }}
            >
              {layer.label}
              <span style={{ display: "block", fontSize: 11, color: "var(--ld-text-tertiary)" }}>
                {layer.note}
              </span>
            </CheckRow>
          ))}
        </div>
      </div>
    </>
  );
}
