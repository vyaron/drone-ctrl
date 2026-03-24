import { useState, type ReactElement } from 'react';

export default function About(): ReactElement {
  const [imageHover, setImageHover] = useState(false);
  
  return (
    <div style={{
      height: '100%',
      background: 'linear-gradient(135deg, #000510 0%, #001020 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: 40,
      paddingTop: 80,
      fontFamily: "'Share Tech Mono', monospace",
      color: '#c8d4e0',
      overflow: 'auto',
    }}>
      {/* Logo/Image */}
      <div 
        style={{
          marginBottom: 32,
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0, 212, 255, 0.2)',
          border: '2px solid rgba(0, 212, 255, 0.3)',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setImageHover(true)}
        onMouseLeave={() => setImageHover(false)}
      >
        <img 
          src="./odin.webp" 
          alt="ODIN System" 
          style={{ 
            width: 280, 
            height: 'auto',
            display: 'block',
            borderRadius: 14,
            transition: 'filter 0.3s ease',
            filter: imageHover 
              ? 'none' 
              : 'grayscale(100%) brightness(1.1) sepia(100%) hue-rotate(160deg) saturate(2)',
          }} 
        />
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: 32,
        fontWeight: 700,
        color: '#00d4ff',
        letterSpacing: 4,
        marginBottom: 8,
        textShadow: '0 0 20px rgba(0, 212, 255, 0.4)',
      }}>
        ODIN
      </h1>
      
      <h2 style={{
        fontSize: 14,
        fontWeight: 400,
        color: '#8899aa',
        letterSpacing: 3,
        marginBottom: 32,
      }}>
        DRONE DETECTION & TRACKING SYSTEM
      </h2>

      {/* Description */}
      <div style={{
        maxWidth: 600,
        textAlign: 'center',
        lineHeight: 1.8,
        fontSize: 13,
      }}>
        <p style={{ marginBottom: 20 }}>
          ODIN provides real-time detection, tracking, and classification of unmanned aerial systems (UAS) 
          within protected airspace. Using advanced RF spectrum analysis and multi-sensor fusion, the system 
          delivers comprehensive situational awareness for critical infrastructure protection.
        </p>
        
        <p style={{ marginBottom: 20 }}>
          The platform integrates multiple sensor nodes for triangulated positioning, frequency monitoring, 
          and threat assessment. Detection confidence levels range from basic RF detection through 
          directional bearing to full geolocation tracking.
        </p>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 48,
        color: '#556677',
        fontSize: 11,
        letterSpacing: 1,
      }}>
        VERSION 2.4.1 · © 2026 R2 SYSTEMS
      </div>
    </div>
  );
}
