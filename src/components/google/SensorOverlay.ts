export type SensorOverlayInstance = google.maps.OverlayView & {
  update: (position: google.maps.LatLng) => void;
};

export type SensorOverlayConstructor = new (
  position: google.maps.LatLng,
  id: string,
  isPatrol: boolean,
  color?: string
) => SensorOverlayInstance;

let SensorOverlayClass: SensorOverlayConstructor | null = null;

// Static sensor icon path (sensor1.svg - antenna with signal waves)
const STATIC_SENSOR_PATH = `M336,474.5v32H176v-32c0-17.688,14.313-32,32-32h32V231.563c-18.625-6.625-32-24.188-32-45.063c0-26.5,21.5-48,48-48
s48,21.5,48,48c0,20.875-13.438,38.438-32,45.063V442.5h32C321.688,442.5,336,456.813,336,474.5z M176.813,265.688L188.063,277
l22.688-22.625l-11.313-11.313c-31.188-31.188-31.188-81.938,0-113.125l11.313-11.313L188.125,96l-11.313,11.313
C133.125,150.938,133.125,222,176.813,265.688z M154.188,84.688L165.5,73.375L142.875,50.75l-11.313,11.313
c-68.625,68.625-68.625,180.25,0,248.875l11.313,11.313l22.625-22.625l-11.313-11.313C98,232.188,98,140.813,154.188,84.688z
M108.938,39.438l11.313-11.313L97.625,5.5L86.313,16.813c-93.563,93.563-93.563,245.813,0,339.438l11.313,11.313l22.625-22.625
l-11.313-11.313C27.813,252.5,27.813,120.5,108.938,39.438z M312.563,243.063l-11.313,11.313L323.938,277l11.25-11.313
c43.688-43.688,43.688-114.75,0-158.375L323.875,96l-22.625,22.625l11.313,11.313C343.75,161.125,343.75,211.875,312.563,243.063z
M380.438,62.063L369.125,50.75L346.5,73.375l11.313,11.313c56.125,56.125,56.125,147.5,0,203.625L346.5,299.625l22.625,22.625
l11.313-11.313C449.063,242.313,449.063,130.688,380.438,62.063z M425.688,16.813L414.375,5.5L391.75,28.125l11.313,11.313
c81.063,81.063,81.063,213,0,294.188l-11.313,11.313l22.625,22.625l11.313-11.313C519.25,262.625,519.25,110.313,425.688,16.813z`;

// Moving/patrol sensor icon path (sensor.svg - radar/signal icon)
const PATROL_SENSOR_PATH = `M12 5c-3.87 0-7 3.13-7 7h2c0-2.76 2.24-5 5-5s5 2.24 5 5h2c0-3.87-3.13-7-7-7zm1 9.29c.88-.39 1.5-1.26 1.5-2.29 0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12c0 1.02.62 1.9 1.5 2.29v3.3L7.59 21 9 22.41l3-3 3 3L16.41 21 13 17.59v-3.3zM12 1C5.93 1 1 5.93 1 12h2c0-4.97 4.03-9 9-9s9 4.03 9 9h2c0-6.07-4.93-11-11-11z`;

export function getSensorOverlayClass(): SensorOverlayConstructor | null {
  if (SensorOverlayClass) return SensorOverlayClass;
  if (!window.google?.maps?.OverlayView) return null;

  SensorOverlayClass = class extends window.google.maps.OverlayView {
    position: google.maps.LatLng;
    id: string;
    isPatrol: boolean;
    color: string;
    div: HTMLDivElement | null = null;

    constructor(
      position: google.maps.LatLng,
      id: string,
      isPatrol: boolean,
      color: string = '#00d4ff'
    ) {
      super();
      this.position = position;
      this.id = id;
      this.isPatrol = isPatrol;
      this.color = color;
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.cursor = 'pointer';
      this.updateContent();
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(this.div);
    }

    updateContent() {
      if (!this.div) return;

      const size = 48;
      const center = size / 2;
      const iconPath = this.isPatrol ? PATROL_SENSOR_PATH : STATIC_SENSOR_PATH;
      const viewBox = this.isPatrol ? '0 0 24 24' : '0 0 512 512';
      const iconSize = this.isPatrol ? 22 : 24;
      const iconOffset = (size - iconSize) / 2;

      this.div.innerHTML = `
        <svg width="${size}" height="${size}" style="overflow:visible;position:absolute;left:-${center}px;top:-${center}px;">
          <defs>
            <filter id="sensor-glow-${this.id}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <style>
            @keyframes sensor-pulse-${this.id} {
              0% { r: 12; opacity: 0.6; }
              100% { r: 24; opacity: 0; }
            }
            .sensor-pulse-ring-${this.id} {
              animation: sensor-pulse-${this.id} 2s ease-out infinite;
            }
          </style>
          
          <!-- Pulse rings -->
          <circle class="sensor-pulse-ring-${this.id}" cx="${center}" cy="${center}" r="12" 
            fill="none" stroke="${this.color}" stroke-width="1" style="animation-delay: 0s;"/>
          <circle class="sensor-pulse-ring-${this.id}" cx="${center}" cy="${center}" r="12" 
            fill="none" stroke="${this.color}" stroke-width="1" style="animation-delay: 0.66s;"/>
          ${this.isPatrol ? `
          <circle class="sensor-pulse-ring-${this.id}" cx="${center}" cy="${center}" r="12" 
            fill="none" stroke="${this.color}" stroke-width="1" style="animation-delay: 1.33s;"/>
          ` : ''}
          
          <!-- Sensor icon -->
          <g filter="url(#sensor-glow-${this.id})">
            <svg x="${iconOffset}" y="${iconOffset}" width="${iconSize}" height="${iconSize}" viewBox="${viewBox}">
              <path fill="${this.color}" d="${iconPath}"/>
            </svg>
          </g>
          
          <!-- Range indicator for patrol sensors -->
          ${this.isPatrol ? `
          <circle cx="${center}" cy="${center}" r="20" 
            fill="none" stroke="${this.color}" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.5"/>
          ` : ''}}
        </svg>
      `;
    }

    update(position: google.maps.LatLng) {
      this.position = position;
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

  return SensorOverlayClass;
}
