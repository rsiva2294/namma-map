/**
 * IndexedDB Utility for Permanent Administrative Index (RAM Optimization)
 */
export const IDB = {
    dbName: 'TNEB_INDEX_DB',
    stores: {
        ADMIN: 'admin_index',
        PLACES: 'places_index'
    },
    version: 2,

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.stores.ADMIN)) {
                    db.createObjectStore(this.stores.ADMIN);
                }
                if (!db.objectStoreNames.contains(this.stores.PLACES)) {
                    db.createObjectStore(this.stores.PLACES);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async putAll(storeName, entries) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            for (const [key, value] of Object.entries(entries)) {
                store.put(value, key);
            }
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    },

    async getAll(storeName) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async count(storeName) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};
