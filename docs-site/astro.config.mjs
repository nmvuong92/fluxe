// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    site: 'https://fluxe.dev',   // đổi sang domain thật khi deploy (bật sitemap/canonical)
    integrations: [starlight({
        title: 'fluxe',
        description: 'Khung fullstack tối giản, một runtime TS — RCA: Resolved Cell Architecture.',
        social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/' }],
        sidebar: [
            {
                label: 'Bắt đầu',
                items: [
                    { label: 'fluxe là gì', slug: 'index' },
                    { label: 'Cài đặt', slug: 'guides/install' },
                    { label: 'Tổng quan tính năng', slug: 'guides/features' },
                    { label: 'Tutorial: từ 0 tới app nhỏ', slug: 'guides/tutorial', badge: 'Start' },
                    { label: 'RCA — Resolved Cell Architecture', slug: 'guides/rca' },
                ],
            },
            {
                label: 'Nâng cao',
                items: [
                    { label: 'Cell static — tối ưu 0 JS', slug: 'guides/static-cells', badge: 'Nâng cao' },
                    { label: 'Render cache', slug: 'guides/static-cache' },
                ],
            },
            {
                label: 'Tham khảo',
                items: [{ autogenerate: { directory: 'reference' } }],
            },
        ],
		}), react()],
});