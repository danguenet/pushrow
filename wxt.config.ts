import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  dev: {
    server: {
      port: 3000,
      strictPort: true,
    },
  },
  manifest: {
    name: 'Posthook',
    short_name: 'Posthook',
    description: 'Send LinkedIn and CRM records to your Clay tables.',
    minimum_chrome_version: '102',
    permissions: ['activeTab', 'storage'],
    optional_host_permissions: ['https://api.clay.com/*'],
    action: {
      default_title: 'Send this record with Posthook',
    },
    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png',
    },
  },
});
