import type { SeverityLevel } from '../../utils/droneUtils';

// Extend Window interface for Google Maps callback
declare global {
  interface Window {
    initGoogleMap?: () => void;
    google?: typeof google;
  }
}

export type DroneOverlayInstance = google.maps.OverlayView & {
  update: (position: google.maps.LatLng, color: string, severity: SeverityLevel, isSelected: boolean) => void;
};

export type DroneOverlayConstructor = new (
  position: google.maps.LatLng,
  color: string,
  severity: SeverityLevel,
  isSelected: boolean,
  onClick: () => void
) => DroneOverlayInstance;

let DroneOverlayClass: DroneOverlayConstructor | null = null;

export function getDroneOverlayClass(): DroneOverlayConstructor | null {
  if (DroneOverlayClass) return DroneOverlayClass;
  if (!window.google?.maps?.OverlayView) return null;
  
  DroneOverlayClass = class extends window.google.maps.OverlayView {
    position: google.maps.LatLng;
    color: string;
    severity: SeverityLevel;
    isSelected: boolean;
    onClick: () => void;
    div: HTMLDivElement | null = null;

    constructor(
      position: google.maps.LatLng, 
      color: string, 
      severity: SeverityLevel, 
      isSelected: boolean, 
      onClick: () => void
    ) {
      super();
      this.position = position;
      this.color = color;
      this.severity = severity;
      this.isSelected = isSelected;
      this.onClick = onClick;
    }
    
    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.cursor = 'pointer';
      this.div.addEventListener('click', () => this.onClick?.());
      this.updateContent();
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(this.div);
    }
    
    updateContent() {
      if (!this.div) return;
      const rings = this.severity === 'critical' ? 3 : this.severity === 'high' ? 2 : 1;
      const size = 60;
      const center = size / 2;
      const iconSize = this.isSelected ? 32 : 26;
      
      this.div.innerHTML = `
        <svg width="${size}" height="${size}" style="overflow:visible;position:absolute;left:-${center}px;top:-${center}px;">
          <style>
            @keyframes pulse-ring {
              0% { r: 8; opacity: 0.6; }
              100% { r: 22; opacity: 0; }
            }
            .pulse-ring { animation: pulse-ring 2s ease-out infinite; }
            .pulse-ring-1 { animation-delay: 0s; }
            .pulse-ring-2 { animation-delay: 0.66s; }
            .pulse-ring-3 { animation-delay: 1.33s; }
          </style>
          ${Array.from({length: rings}, (_, i) => `
            <circle class="pulse-ring pulse-ring-${i+1}" cx="${center}" cy="${center}" r="8" 
              fill="none" stroke="${this.color}" stroke-width="1.5"/>
          `).join('')}
          <image href="img/drone.svg" x="${center - iconSize/2}" y="${center - iconSize/2}" 
            width="${iconSize}" height="${iconSize}"
            style="filter: drop-shadow(0 0 ${this.isSelected ? 8 : 4}px ${this.color});"/>
          ${this.isSelected ? `<circle cx="${center}" cy="${center}" r="${iconSize/2 + 4}" fill="none" stroke="#ffffff" stroke-width="1.5"/>` : ''}
        </svg>
      `;
    }
    
    update(position: google.maps.LatLng, color: string, severity: SeverityLevel, isSelected: boolean) {
      this.position = position;
      const needsRedraw = this.color !== color || this.severity !== severity || this.isSelected !== isSelected;
      this.color = color;
      this.severity = severity;
      this.isSelected = isSelected;
      if (needsRedraw) this.updateContent();
      this.draw();
    }
    
    draw() {
      if (!this.div) return;
      const overlayProjection = this.getProjection();
      if (!overlayProjection) return;
      const pos = overlayProjection.fromLatLngToDivPixel(this.position);
      if (pos) {
        this.div.style.left = pos.x + 'px';
        this.div.style.top = pos.y + 'px';
      }
    }
    
    onRemove() {
      if (this.div) {
        this.div.parentNode?.removeChild(this.div);
        this.div = null;
      }
    }
  };
  
  return DroneOverlayClass;
}
