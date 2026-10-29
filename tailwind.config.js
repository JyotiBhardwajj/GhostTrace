/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ghost: {
          bg: "#06080f",
          surface: "#0c111d",
          border: "#1a2436",
          muted: "#475569",
          green: "#00ff66",
          greenDim: "#00a340",
          amber: "#ffb000",
          cyan: "#00f0ff",
          purple: "#9d4edd",
          blood: "#ff2a5f",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Consolas",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        glowGreen: "0 0 15px rgba(0, 255, 102, 0.35)",
        glowAmber: "0 0 15px rgba(255, 176, 0, 0.35)",
        glowCyan: "0 0 15px rgba(0, 240, 255, 0.35)",
      },
      animation: {
        flicker: "flicker 0.15s infinite",
        pulseGlow: "pulseGlow 2.5s infinite ease-in-out",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: 0.8 },
          "50%": { opacity: 0.4 },
        },
      },
    },
  },
  plugins: [],
};
