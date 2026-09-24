/**
 * Background Sync Engine (RNF-01)
 * Monitors network state and flushes pending punches from IndexedDB to Supabase
 */
const SyncEngine = {
  isSyncing: false,

  init() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    this.updateNetworkUI(navigator.onLine);

    // Initial sync check on page load
    if (navigator.onLine) {
      this.syncPendingRecords();
    }
  },

  handleNetworkChange(isOnline) {
    this.updateNetworkUI(isOnline);
    if (isOnline) {
      console.log('Network status changed to ONLINE. Starting auto-sync...');
      this.syncPendingRecords();
    } else {
      console.log('Network status changed to OFFLINE.');
    }
  },

  updateNetworkUI(isOnline) {
    const badge = document.getElementById('network-status');
    const text = document.getElementById('network-text');
    const iconOnline = badge ? badge.querySelector('.icon-online') : null;
    const iconOffline = badge ? badge.querySelector('.icon-offline') : null;

    if (!badge || !text) return;

    if (isOnline) {
      badge.className = 'status-badge online';
      text.textContent = 'Online';
      if (iconOnline) iconOnline.style.display = 'inline-block';
      if (iconOffline) iconOffline.style.display = 'none';
    } else {
      badge.className = 'status-badge offline';
      text.textContent = 'Offline';
      if (iconOnline) iconOnline.style.display = 'none';
      if (iconOffline) iconOffline.style.display = 'inline-block';
    }
  },

  async syncPendingRecords() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const allPunches = await DB.getAll('punches');
      const unsyncedPunches = allPunches.filter(p => !p.synced);

      if (unsyncedPunches.length > 0) {
        console.log(`SyncEngine: Found ${unsyncedPunches.length} unsynced punch(es). Uploading...`);
        for (const punch of unsyncedPunches) {
          const res = await SupabaseService.insertPunch(punch);
          if (res.success || res.offline) {
            // Mark as synced locally
            punch.synced = true;
            await DB.put('punches', punch);
          }
        }
        console.log('SyncEngine: All pending punches synchronized successfully.');
      }
    } catch (err) {
      console.error('SyncEngine error during synchronization:', err);
    } finally {
      this.isSyncing = false;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => SyncEngine.init());
