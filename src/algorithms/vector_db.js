/**
 * VectorDB - Local Vector Store using IndexedDB
 * 
 * Stores embeddings and allows for cosine similarity search.
 * Zero-dependency implementation to work without a bundler.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.VectorDB = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const DB_NAME = 'LeetCodeSRSMistakeDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'vectors';

    let dbInstance = null;

    /**
     * Open (or create) the IndexedDB
     */
    function open() {
        return new Promise((resolve, reject) => {
            if (dbInstance) return resolve(dbInstance);

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("[VectorDB] Database error:", event.target.error);
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create an objectStore for this database
                // keyPath is 'id' (autoIncrement)
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    // Create an index to search by timestamp if needed
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                console.log("[VectorDB] Database opened successfully.");
                resolve(dbInstance);
            };
        });
    }

    /**
     * Compute Cosine Similarity between two vectors
     * @param {number[]} vecA 
     * @param {number[]} vecB 
     * @returns {number} Score between -1 and 1
     */
    function cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) return 0;
        let dot = 0.0;
        let normA = 0.0;
        let normB = 0.0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Add an entry to the Vector DB
     * @param {Object} entry
     * @param {number[]} entry.vector - Embedding vector
     * @param {string} entry.text - Original text/error
     * @param {string} entry.advice - Cached advice/solution
     * @param {Object} entry.metadata - Extra info (tags, category, problemId)
     */
    async function add(entry) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const record = {
                vector: entry.vector,
                text: entry.text,
                advice: entry.advice,
                metadata: entry.metadata || {},
                timestamp: Date.now()
            };

            const request = store.add(record);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search for similar vectors
     * @param {number[]} queryVector 
     * @param {number} limit - Max results
     * @param {number} threshold - Min similarity (0-1)
     */
    async function search(queryVector, limit = 3, threshold = 0.7) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();

            const results = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    const similarity = cosineSimilarity(queryVector, record.vector);

                    if (similarity >= threshold) {
                        results.push({ ...record, score: similarity });
                    }
                    cursor.continue();
                } else {
                    // Done iterating
                    // Sort by score descending
                    results.sort((a, b) => b.score - a.score);
                    resolve(results.slice(0, limit));
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all tags/stats for visualization
     */
    async function getStats() {
        const db = await open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const records = request.result;
                const stats = {
                    totalMistakes: records.length,
                    byCategory: {}, // Legacy support
                    byFamily: {},
                    byTag: {},
                    tree: {} // New Hierarchical Structure
                };

                records.forEach(r => {
                    const meta = r.metadata || {};
                    // Prefer family, fallback to category, then 'Uncategorized'
                    const family = (meta.family || meta.category || 'Uncategorized').toUpperCase();

                    // IF tag is present, use it. IF NOT, use 'GENERAL' (don't fallback to category name)
                    // This prevents "LOGIC -> LOGIC" redundancy for legacy data.
                    const tag = (meta.tag) ? meta.tag.toUpperCase() : 'GENERAL';

                    stats.byFamily[family] = (stats.byFamily[family] || 0) + 1;
                    stats.byCategory[family] = stats.byFamily[family]; // Sync for UI compatibility
                    stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;

                    // Build Tree
                    if (!stats.tree[family]) stats.tree[family] = {};
                    stats.tree[family][tag] = (stats.tree[family][tag] || 0) + 1;
                });
                resolve(stats);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Prune old records if DB gets too big
     * (Simple implementation: keep last N records)
     */
    async function prune(keepCount = 1000) {
        const db = await open();
        // This is a bit complex in pure IDB without index cursor dancing, 
        // sticking to simple logical deletion for now or skip implementation until needed.
        // For prototype, we mock this.
        return true;
    }

    return {
        add,
        search,
        getStats
    };

}));
