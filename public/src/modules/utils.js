import { mutations } from '../mutations.js';

export function openModal(modalId) {
  mutations.OPEN_MODAL(modalId);
}

export function closeModal(modalId) {
  mutations.CLOSE_MODAL(modalId);
}

export function toggleModal(modalId) {
  mutations.TOGGLE_MODAL(modalId);
}

export function showNotification(message, type = 'info') {
  mutations.SHOW_NOTIFICATION(message, type);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    mutations.CLEAR_NOTIFICATION();
  }, 3000);
}

export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function formatTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function formatCurrency(value) {
  if (typeof value !== 'number') return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

export function formatNumber(value, decimals = 2) {
  if (typeof value !== 'number') return '-';
  return value.toFixed(decimals);
}

export function renderNotification() {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notification = window.__appState?.ui?.notifications;
  if (!notification || !notification.message) {
    container.innerHTML = '';
    return;
  }

  const bgColor = {
    'success': 'bg-green-500',
    'error': 'bg-red-500',
    'info': 'bg-blue-500',
    'warning': 'bg-yellow-500'
  }[notification.type] || 'bg-blue-500';

  container.innerHTML = `
    <div class="${bgColor} text-white px-4 py-3 rounded shadow-lg">
      ${notification.message}
    </div>
  `;
}

export function setupGlobalListeners() {
  // Close modals when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('modal') && e.target.classList?.contains('active')) {
      const modalName = Object.keys(window.__appState?.ui?.modals || {}).find(
        key => window.__appState.ui.modals[key] && document.getElementById(key) === e.target
      );
      if (modalName) mutations.CLOSE_MODAL(modalName);
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const state = window.__appState;
      if (state) {
        Object.keys(state.ui.modals).forEach(modalName => {
          if (state.ui.modals[modalName]) {
            mutations.CLOSE_MODAL(modalName);
          }
        });
      }
    }
  });
}

export function setupFormValidation() {
  const forms = document.querySelectorAll('[data-validate]');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;

      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          field.classList.add('border-red-500');
          isValid = false;
        } else {
          field.classList.remove('border-red-500');
        }
      });

      if (!isValid) {
        e.preventDefault();
        showNotification('Please fill in all required fields', 'error');
      }
    });
  });
}

export function initializeUI() {
  setupGlobalListeners();
  setupFormValidation();

  // Watch for state changes and re-render notifications
  setInterval(renderNotification, 100);
}

export function createPaginationHTML(currentPage, totalPages, onPageClick) {
  if (totalPages <= 1) return '';

  const buttons = [];
  for (let i = 1; i <= totalPages; i++) {
    buttons.push(`
      <button class="px-3 py-1 rounded ${i === currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
              onclick="${onPageClick}(${i})">
        ${i}
      </button>
    `);
  }

  return `<div class="flex gap-2 mt-4">${buttons.join('')}</div>`;
}

export async function fetchWithErrorHandling(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
    throw error;
  }
}

export function setupSearch(debounceTime = 300) {
  const searchInputs = document.querySelectorAll('[data-search]');
  searchInputs.forEach(input => {
    const handler = debounce(() => {
      const event = new CustomEvent('search', { detail: { query: input.value } });
      input.dispatchEvent(event);
    }, debounceTime);

    input.addEventListener('input', handler);
  });
}
