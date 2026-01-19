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
            cellColors: ['#661450', '#AA1177', '#FF10F0', '#FF6B35']  // Heatmap gradient
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
            cellColors: ['#00441b', '#006d2c', '#238b45', '#00FF41']
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
        }
    };

    return {
        THEMES,
        TOAST_THEMES
    };
}));
