/**
 * PWA Service Worker Registration & Update Handler
 */
import { registerSW } from 'virtual:pwa-register';

export function initPWA() {
    const updateBtn = document.getElementById('pwa-update-btn');
    const updateToast = document.getElementById('pwa-update-toast');

    if (!updateBtn || !updateToast) return;

    const updateSW = registerSW({
        onNeedRefresh() {
            // Show update toast
            updateToast.classList.remove('hidden');
            
            // Re-init lucide icons for the toast if needed
            if (window.lucide) {
                window.lucide.createIcons();
            }
        },
        onOfflineReady() {
            console.log('App ready for offline use.');
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        }
    });

    updateBtn.onclick = () => {
        updateSW(true);
    };
}
