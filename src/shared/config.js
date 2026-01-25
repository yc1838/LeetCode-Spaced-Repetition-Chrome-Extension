/**
 * LeetCode EasyRepeat - Shared Configuration
 * 
 * Contains shared constants and configuration for the extension.
 * Supported Themes: Sakura (Pink), Matrix (Green)
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory();
    } else {
        // Browser
        const exported = factory();
        for (const key in exported) {
            root[key] = exported[key];
        }
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const THEMES = {
        sakura: {
            name: 'Sakura',
            terminal: '#FF10F0',           // Primary color (hot pink)
            electric: '#FF6B35',           // Secondary color (orange)
            accent: '#FF85A2',             // Accent color (light pink)
            borderGlow: 'rgba(255, 16, 240, 0.4)',
            borderDim: 'rgba(255, 107, 53, 0.25)',
            statusBg: 'rgba(255, 16, 240, 0.05)',
            hoverBg: 'rgba(255, 16, 240, 0.08)',
            containerShadow: 'rgba(255, 16, 240, 0.2)',
            glass: 'rgba(20, 10, 15, 0.85)',
            cellColors: ['#661450', '#AA1177', '#FF10F0', '#FF6B35'],
            // Styling Props
            bgMain: '#0A0A0A',
            fontMain: "'JetBrains Mono', monospace",
            fontData: "'Fira Code', monospace",
            borderRadius: '0px',
            scanlineOpacity: '1',
            glassOpacity: '0.85',
            backdropFilter: 'blur(5px)'
        },
        matrix: {
            name: 'Matrix',
            terminal: '#00FF41',           // Primary (neon green)
            electric: '#2DE2E6',           // Secondary (cyan)
            accent: '#00FF41',             // Accent (same as primary)
            borderGlow: 'rgba(0, 255, 65, 0.4)',
            borderDim: 'rgba(45, 226, 230, 0.2)',
            statusBg: 'rgba(0, 255, 65, 0.05)',
            hoverBg: 'rgba(0, 255, 65, 0.05)',
            containerShadow: 'rgba(0, 255, 65, 0.15)',
            glass: 'rgba(0, 20, 10, 0.85)',
            cellColors: ['#00441b', '#006d2c', '#238b45', '#00FF41'],
            // Styling Props
            bgMain: '#0A0A0A',
            fontMain: "'JetBrains Mono', monospace",
            fontData: "'Fira Code', monospace",
            borderRadius: '0px',
            scanlineOpacity: '0.5',
            glassOpacity: '0.85',
            backdropFilter: 'blur(5px)'
        },
        typography: {
            name: 'Typography',
            terminal: '#2b2b2b',           // Ink
            electric: '#b87333',           // Copper
            accent: '#e8e4d9',             // Paper
            borderGlow: '#2b2b2b',         // Solid Ink Border (no glow)
            borderDim: '#c4c0b5',          // Line
            statusBg: '#e8e4d9',           // Paper
            hoverBg: 'rgba(255, 255, 255, 0.5)',
            containerShadow: 'rgba(0, 0, 0, 0.1)',
            glass: '#ffffff',              // White Card Background
            cellColors: ['#e8e4d9', '#c4c0b5', '#b87333', '#a33b3b'], // Paper -> Line -> Copper -> Stamp Red
            // Styling Props - Mapped from User Spec
            bgMain: '#dcd7c9',             // Background
            fontMain: "'Courier Prime', monospace",
            fontData: "'Courier Prime', monospace",
            borderRadius: '0px',
            scanlineOpacity: '0',
            glassOpacity: '1',             // Solid cards
            backdropFilter: 'none'
        }
    };

    const TOAST_THEMES = {
        sakura: {
            terminal: '#FF10F0',
            electric: '#FF6B35',
            borderGlow: 'rgba(255, 16, 240, 0.4)',
            shadowMid: 'rgba(255, 16, 240, 0.2)',
            shadowInner: 'rgba(255, 16, 240, 0.05)',
            textShadow: 'rgba(255, 16, 240, 0.5)',
            electricShadow: 'rgba(255, 107, 53, 0.4)',
            electricBorderDash: 'rgba(255, 107, 53, 0.3)'
        },
        matrix: {
            terminal: '#00FF41',
            electric: '#2DE2E6',
            borderGlow: 'rgba(0, 255, 65, 0.4)',
            shadowMid: 'rgba(0, 255, 65, 0.2)',
            shadowInner: 'rgba(0, 255, 65, 0.05)',
            textShadow: 'rgba(0, 255, 65, 0.5)',
            electricShadow: 'rgba(45, 226, 230, 0.4)',
            electricBorderDash: 'rgba(45, 226, 230, 0.3)'
        },
        typography: {
            terminal: '#2b2b2b', // Ink
            electric: '#b87333', // Copper
            borderGlow: '#2b2b2b',
            shadowMid: 'rgba(184, 115, 51, 0.2)',
            shadowInner: 'rgba(184, 115, 51, 0.05)',
            textShadow: 'none',
            electricShadow: 'none',
            electricBorderDash: '#c4c0b5'
        }
    };

    return {
        THEMES,
        TOAST_THEMES
    };
}));
