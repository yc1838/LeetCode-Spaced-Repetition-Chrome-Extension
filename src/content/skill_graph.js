/**
 * Skill Graph Component
 * 
 * SVG-based visualization of the Skill DNA as a node graph.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SkillGraph = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const DEFAULT_WIDTH = 300;
    const DEFAULT_HEIGHT = 300;
    const FAMILY_NODE_RADIUS = 25;
    const SKILL_NODE_RADIUS = 12;

    /**
     * Create SVG container element.
     */
    function createSVG(options = {}) {
        const width = options.width || DEFAULT_WIDTH;
        const height = options.height || DEFAULT_HEIGHT;

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('class', 'skill-graph');

        return svg;
    }

    /**
     * Get color based on confidence level.
     */
    function getConfidenceColor(confidence) {
        if (confidence >= 0.7) {
            return '#22c55e'; // Green
        } else if (confidence >= 0.4) {
            return '#eab308'; // Yellow
        } else {
            return '#ef4444'; // Red
        }
    }

    /**
     * Create a skill node (circle + label).
     */
    function createNode(options) {
        const { id, label, x, y, confidence, isFamily = false } = options;

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'skill-node');
        g.setAttribute('data-skill-id', id);

        const radius = isFamily ? FAMILY_NODE_RADIUS : SKILL_NODE_RADIUS;
        const color = getConfidenceColor(confidence);

        // Circle
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        g.appendChild(circle);

        // Label
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y + radius + 14);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', isFamily ? '12' : '10');
        text.setAttribute('fill', '#333');
        text.textContent = truncateLabel(label, isFamily ? 15 : 10);
        g.appendChild(text);

        return g;
    }

    /**
     * Truncate label if too long.
     */
    function truncateLabel(label, maxLen) {
        if (!label) return '';
        return label.length > maxLen ? label.substring(0, maxLen - 2) + '…' : label;
    }

    /**
     * Create an edge (line between nodes).
     */
    function createEdge(options) {
        const { fromX, fromY, toX, toY } = options;

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', fromX);
        line.setAttribute('y1', fromY);
        line.setAttribute('x2', toX);
        line.setAttribute('y2', toY);
        line.setAttribute('stroke', '#e5e7eb');
        line.setAttribute('stroke-width', '1');

        return line;
    }

    /**
     * Calculate circular layout positions.
     */
    function calculateCircularLayout(count, centerX, centerY, radius) {
        const positions = [];
        for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count - Math.PI / 2;
            positions.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }
        return positions;
    }

    /**
     * Aggregate skill confidences per family.
     */
    function aggregateFamilyConfidence(skills) {
        const families = {};

        for (const [skillId, skill] of Object.entries(skills)) {
            const familyId = skill.familyId || skillId.split('_')[0];
            if (!families[familyId]) {
                families[familyId] = { id: familyId, name: formatFamilyName(familyId), confidences: [] };
            }
            families[familyId].confidences.push(skill.confidence || 0.5);
        }

        // Calculate averages
        return Object.values(families).map(f => ({
            id: f.id,
            name: f.name,
            confidence: f.confidences.reduce((a, b) => a + b, 0) / f.confidences.length
        }));
    }

    /**
     * Format family ID to readable name.
     */
    function formatFamilyName(id) {
        return id
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Render the complete skill graph.
     */
    function renderGraph(skillData, options = {}) {
        const width = options.width || DEFAULT_WIDTH;
        const height = options.height || DEFAULT_HEIGHT;
        const centerX = width / 2;
        const centerY = height / 2;
        const layoutRadius = Math.min(width, height) / 2 - 50;

        const svg = createSVG({ width, height });
        const families = skillData.families || [];

        // Calculate positions
        const positions = calculateCircularLayout(families.length, centerX, centerY, layoutRadius);

        // Draw edges from center
        families.forEach((family, i) => {
            const edge = createEdge({
                fromX: centerX,
                fromY: centerY,
                toX: positions[i].x,
                toY: positions[i].y
            });
            svg.appendChild(edge);
        });

        // Draw nodes
        families.forEach((family, i) => {
            const node = createNode({
                id: family.id,
                label: family.name,
                x: positions[i].x,
                y: positions[i].y,
                confidence: family.confidence,
                isFamily: true
            });
            svg.appendChild(node);
        });

        // Center node (brain icon placeholder)
        const centerNode = createNode({
            id: 'center',
            label: 'DNA',
            x: centerX,
            y: centerY,
            confidence: 1,
            isFamily: true
        });
        svg.appendChild(centerNode);

        return svg;
    }

    // Styles for the graph
    const styles = `
        .skill-graph {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .skill-node circle {
            cursor: pointer;
            transition: transform 0.2s, opacity 0.2s;
        }
        
        .skill-node:hover circle {
            opacity: 0.8;
            transform: scale(1.1);
        }
        
        .skill-node text {
            pointer-events: none;
        }
    `;

    return {
        createSVG,
        createNode,
        createEdge,
        getConfidenceColor,
        renderGraph,
        aggregateFamilyConfidence,
        calculateCircularLayout,
        styles
    };
}));
