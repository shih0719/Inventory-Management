import { state } from '../state.js';
import { mutations } from '../mutations.js';

export async function handleCSVImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    mutations.SET_LOADING('products', true);

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/csv/import', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Import failed');
    }

    const result = await response.json();
    mutations.SHOW_NOTIFICATION(`Imported ${result.count} products successfully`, 'success');

    // Reload products
    const productsModule = window.__modules?.products;
    if (productsModule?.loadProducts) {
      await productsModule.loadProducts();
    }

    e.target.value = '';
  } catch (error) {
    console.error('Error importing CSV:', error);
    mutations.SHOW_NOTIFICATION(`Import failed: ${error.message}`, 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export async function handleCSVExport() {
  try {
    mutations.SET_LOADING('products', true);

    const response = await fetch('/api/csv/export', {
      method: 'GET'
    });

    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    mutations.SHOW_NOTIFICATION('Products exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    mutations.SHOW_NOTIFICATION('Export failed', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export async function handleCSVTemplateDownload() {
  try {
    const response = await fetch('/api/csv/template');
    if (!response.ok) throw new Error('Download template failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    mutations.SHOW_NOTIFICATION('Template downloaded successfully', 'success');
  } catch (error) {
    console.error('Error downloading template:', error);
    mutations.SHOW_NOTIFICATION('Download template failed', 'error');
  }
}
