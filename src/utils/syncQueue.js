import { api } from '../api';
import toast from 'react-hot-toast';

const QUEUE_KEY = 'gurmad_offline_queue';

export const syncQueue = {
  add: (action, data) => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    queue.push({ action, data, timestamp: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    toast.success('Offline: Action saved to queue');
  },

  process: async () => {
    if (!navigator.onLine) return;
    
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    toast.loading(`Syncing ${queue.length} offline actions...`, { id: 'sync' });

    const remaining = [];
    for (const item of queue) {
      try {
        // Map action names to API calls
        switch (item.action) {
          case 'addCustomer': await api.addCustomer(item.data); break;
          case 'addInvoice': await api.addInvoice(item.data); break;
          case 'addExpense': await api.addExpense(item.data); break;
          case 'markCollected': await api.markCustomerCollected(item.data.taskId, item.data.customerId, item.data.collected); break;
          default: console.warn('Unknown sync action:', item.action);
        }
      } catch (err) {
        console.error('Sync failed for item:', item, err);
        remaining.push(item);
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    
    if (remaining.length === 0) {
      toast.success('All offline data synced!', { id: 'sync' });
    } else {
      toast.error(`${remaining.length} items failed to sync.`, { id: 'sync' });
    }
  }
};

// Auto-process when coming online
window.addEventListener('online', () => syncQueue.process());
