import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  outDir: 'dist',
  outDirTemplate: '.',
  zip: {
    artifactTemplate: '../{{name}}-{{version}}-{{browser}}.zip',
  },
  modules: ['@wxt-dev/module-react'],
  dev: {
    server: {
      port: 3000,
      strictPort: true,
    },
  },
  manifest: {
    name: 'Push Row',
    short_name: 'Push Row',
    description: 'Push LinkedIn and CRM records to Clay tables from Chrome.',
    minimum_chrome_version: '102',
    permissions: ['activeTab', 'storage'],
    optional_host_permissions: ['https://api.clay.com/*'],
    action: {
      default_title: 'Send this record with Push Row',
    },
    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png',
    },
  },
});
