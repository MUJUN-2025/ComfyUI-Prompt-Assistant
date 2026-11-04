/**
 * PrimeVue 设计令牌兼容层
 *
 * 插件样式大量使用 PrimeVue 4 的组件令牌（--p-dialog-*、--p-select-*、--p-button-* 等）。
 * 旧版 ComfyUI 前端使用了 PrimeVue 的 Dialog / Select / ContextMenu 等组件，这些令牌都会被定义；
 * 0.44.0（前端包 1.57.6）改用 Reka UI + Tailwind 后，宿主只保留了自身仍在使用的组件令牌，
 * 插件依赖的 69 个令牌变成"未定义"。
 *
 * 后果：`background: var(--p-dialog-background)` 这类声明在计算值阶段invalid → 表现为
 * 气泡框/右键菜单/下拉面板背景透明、边框变成 currentColor（白线）、按钮失去主色等。
 *
 * 处理方式：只在令牌确实缺失时，用宿主当前仍定义的令牌（主题自适应）推导出兜底值，
 * 写入 :root 的内联样式。旧版前端令牌本身存在，不会被覆盖，因此完全向后兼容。
 */

import { logger } from './logger.js';

/**
 * 缺失令牌 → 兜底值
 * 兜底值优先引用新版前端仍然定义的主题令牌，保证深/浅色主题都能跟随
 */
const TOKEN_FALLBACKS = {
    // --- 弹窗 / 面板 ---
    '--p-dialog-background': 'var(--p-content-background, #18181b)',
    '--p-dialog-border-color': 'var(--p-content-border-color, #4e4e4e)',
    '--p-dialog-border-radius': '12px',
    '--p-dialog-color': 'var(--p-text-color, #ffffff)',
    '--p-dialog-header-color': 'var(--p-text-color, #ffffff)',
    '--p-dialog-header-padding': '1rem 1.5rem',
    '--p-dialog-shadow': '0 16px 48px rgba(0, 0, 0, 0.4)',
    '--p-panel-border-color': 'var(--p-content-border-color, #4e4e4e)',
    '--p-divider-color': 'var(--p-content-border-color, #4e4e4e)',
    '--p-divider-border-color': 'var(--p-content-border-color, #4e4e4e)',
    '--p-scrollpanel-bar-background': 'color-mix(in srgb, var(--p-text-color, #ffffff) 22%, transparent)',

    // --- 按钮 ---
    '--p-button-border-radius': '6px',
    '--p-button-primary-background': 'var(--p-primary-color, #3b82f6)',
    '--p-button-primary-border-color': 'var(--p-primary-color, #3b82f6)',
    '--p-button-primary-color': '#ffffff',
    '--p-button-primary-hover-background': 'var(--p-primary-hover-color, #2563eb)',
    '--p-button-primary-hover-border-color': 'var(--p-primary-hover-color, #2563eb)',
    '--p-button-primary-hover-color': '#ffffff',
    '--p-button-text-primary-color': 'var(--p-primary-color, #3b82f6)',
    '--p-button-secondary-background': 'color-mix(in srgb, var(--p-text-color, #ffffff) 8%, transparent)',
    '--p-button-secondary-border-color': 'var(--p-content-border-color, #4e4e4e)',
    '--p-button-secondary-color': 'var(--p-text-color, #ffffff)',
    '--p-button-secondary-hover-background': 'color-mix(in srgb, var(--p-text-color, #ffffff) 14%, transparent)',
    '--p-button-text-secondary-color': 'var(--p-text-muted-color, #a1a1aa)',
    '--p-button-text-secondary-hover-background': 'color-mix(in srgb, var(--p-text-color, #ffffff) 8%, transparent)',
    '--p-button-danger-background': 'var(--p-red-500, #ef4444)',
    '--p-button-danger-border-color': 'var(--p-red-500, #ef4444)',
    '--p-button-danger-color': '#ffffff',
    '--p-button-danger-hover-background': 'var(--p-red-600, #dc2626)',
    '--p-button-danger-hover-border-color': 'var(--p-red-600, #dc2626)',
    '--p-button-danger-active-border-color': 'var(--p-red-600, #dc2626)',

    // --- 下拉选择器（触发器） ---
    '--p-select-background': 'var(--p-inputtext-background, #09090b)',
    '--p-select-border-color': 'var(--p-inputtext-border-color, #52525b)',
    '--p-select-border-radius': '6px',
    '--p-select-color': 'var(--p-text-color, #ffffff)',
    '--p-select-shadow': 'none',
    '--p-select-padding-x': '0.75rem',
    '--p-select-padding-y': '0.5rem',
    '--p-select-list-gap': '2px',
    '--p-select-option-border-radius': '4px',

    // --- 下拉浮层 ---
    '--p-select-overlay-background': 'var(--p-content-background, #18181b)',
    '--p-select-overlay-border-color': 'var(--p-content-border-color, #4e4e4e)',
    '--p-select-overlay-border-radius': '6px',
    '--p-select-overlay-shadow': '0 4px 16px rgba(0, 0, 0, 0.3)',
    '--p-select-option-color': 'var(--p-text-color, #ffffff)',
    '--p-select-option-focus-background': 'var(--p-list-option-focus-background, color-mix(in srgb, var(--p-text-color, #ffffff) 8%, transparent))',
    '--p-select-option-focus-color': 'var(--p-text-color, #ffffff)',
    '--p-select-option-selected-background': 'color-mix(in srgb, var(--p-primary-color, #3b82f6) 22%, transparent)',
    '--p-select-option-selected-color': 'var(--p-text-color, #ffffff)',

    // --- 列表 / 复选框 ---
    // PrimeVue 原主题中 listbox 底色取表单域底色（比弹窗底色更深），表格区域才有明确的边界
    '--p-listbox-background': 'var(--p-inputtext-background, #09090b)',
    '--p-listbox-option-selected-color': 'var(--p-text-color, #ffffff)',
    '--p-list-item-color': 'var(--p-text-color, #ffffff)',
    '--p-list-item-padding': '0.5rem 0.75rem',
    '--p-input-background': 'var(--p-inputtext-background, #09090b)',
    '--p-checkbox-background': 'var(--p-inputtext-background, #09090b)',
    '--p-checkbox-border-color': 'var(--p-inputtext-border-color, #52525b)',
    '--p-checkbox-border-radius': '4px',
    '--p-checkbox-checked-background': 'var(--p-primary-color, #3b82f6)',
    '--p-checkbox-checked-border-color': 'var(--p-primary-color, #3b82f6)',
    '--p-checkbox-checked-hover-background': 'var(--p-primary-hover-color, #2563eb)',
    '--p-checkbox-checked-hover-border-color': 'var(--p-primary-hover-color, #2563eb)',
    '--p-checkbox-hover-border-color': 'var(--p-primary-color, #3b82f6)',
    '--p-checkbox-icon-checked-color': '#ffffff',

    // --- 消息提示 ---
    '--p-message-info-background': 'color-mix(in srgb, var(--p-primary-color, #3b82f6) 15%, transparent)',
    '--p-message-info-border-color': 'color-mix(in srgb, var(--p-primary-color, #3b82f6) 40%, transparent)',
    '--p-message-info-color': 'var(--p-text-color, #ffffff)',
    '--p-message-success-color': 'var(--p-green-500, #22c55e)',
    '--p-message-error-color': 'var(--p-red-500, #ef4444)',
    '--p-message-warn-color': 'var(--p-orange-500, #f59e0b)'
};

let installed = false;

/**
 * 补全新版前端缺失的 PrimeVue 组件令牌（幂等）
 * 仅对"宿主未定义"的令牌写入兜底值，不覆盖宿主已有取值
 * @returns {number} 本次实际补全的令牌数量
 */
export function installThemeTokenFallbacks() {
    if (installed) return 0;
    if (typeof document === 'undefined' || !document.documentElement) return 0;

    installed = true;
    let applied = 0;

    try {
        const root = document.documentElement;
        const computed = window.getComputedStyle(root);

        Object.entries(TOKEN_FALLBACKS).forEach(([token, value]) => {
            if (computed.getPropertyValue(token).trim() !== '') return;
            root.style.setProperty(token, value);
            applied++;
        });

        if (applied > 0) {
            logger.debug(`主题兼容 | 补全缺失的 PrimeVue 令牌 | 数量:${applied}`);
        }
    } catch (error) {
        logger.error(`主题兼容 | 补全设计令牌失败 | 错误:${error.message}`);
    }

    return applied;
}

export { TOKEN_FALLBACKS };
