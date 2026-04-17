/**
 * Worker Client - Messaging Bridge
 */
import { AppState } from './state';

export function initWorker(onReady, onResult, onError, onSuggestions) {
    // Vite handles the conversion of this URL automatically
    AppState.worker = new Worker(new URL('./worker/index.js', import.meta.url), { type: 'module' });

    AppState.worker.onmessage = (e) => {
        const { type, data, message } = e.data;
        if (type === 'READY') {
            onReady();
        } else if (type === 'RESULT') {
            onResult(data);
        } else if (type === 'SUGGESTIONS') {
            onSuggestions(data);
        } else if (type === 'ERROR') {
            onError(message);
        }
    };

    AppState.worker.postMessage({ type: 'INIT' });
}

export function requestProcess(lat, lng) {
    if (AppState.worker) {
        AppState.worker.postMessage({ type: 'PROCESS', lat, lng });
    }
}

export function requestConsumerSearch(number, lastLocation) {
    if (AppState.worker) {
        AppState.worker.postMessage({ type: 'PROCESS_CONSUMER', number, lastLocation });
    }
}

export function requestPlaceSearch(query) {
    if (AppState.worker) {
        AppState.worker.postMessage({ type: 'SEARCH_PLACE', query });
    }
}
