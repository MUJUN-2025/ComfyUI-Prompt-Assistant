/**
 * ComfyUI 新版前端浮层兼容工具
 *
 * ComfyUI 0.44.0（前端包 1.57.6）起，设置面板改用 Reka UI 模态弹窗实现，会带来三个副作用：
 *
 * 1. body 被置为 pointer-events:none
 *    DismissableLayer 在 disableOutsidePointerEvents 为真时执行
 *    `document.body.style.pointerEvents = "none"`，只给 Reka 自己的 DialogContent 层恢复 auto。
 *    pointer-events 是可继承属性，因此通过 document.body.appendChild(...) 挂载的插件弹窗
 *    整棵子树都会继承 none，表现为"弹窗能看见但完全点不动"。
 *
 * 2. FocusScope 抢焦点
 *    trapFocus 为真时 FocusScope 在 document 上监听 focusin，一旦焦点目标不在弹窗容器内
 *    就立即把焦点抢回设置面板，表现为"输入框无法输入"。
 *
 * 3. pointerDownOutside 关闭宿主弹窗
 *    DismissableLayer 通过 [data-dismissable-layer] 与文档顺序判断"是否发生在层内"。
 *
 * 本模块提供的 markFloatLayer() 用于把插件挂载到 body 的浮层标记为"更高一层的弹窗"，
 * 并在 window 捕获阶段阻断跨层的 focusin/focusout，从而在不修改业务逻辑的前提下恢复交互。
 * 对旧版（PrimeVue 弹窗）前端完全无害：无 Reka 弹窗时焦点守卫自动不生效。
 */

import { logger } from './logger.js';

/** 插件自有标记，用于识别需要保护的浮层子树 */
const FLOAT_LAYER_ATTR = 'data-pa-float-layer';
/** Reka UI 用来判定层级的属性 */
const REKA_LAYER_ATTR = 'data-dismissable-layer';
/** 新版前端弹窗容器标记（Reka DialogContent / 全局弹窗栈） */
const REKA_DIALOG_SELECTOR = '[data-reka-dialog-content], [data-dialog-key]';

let focusGuardInstalled = false;

/**
 * 判断节点是否为 Element
 * @param {unknown} node
 * @returns {boolean}
 */
function isElement(node) {
    return typeof Element !== 'undefined' && node instanceof Element;
}

/**
 * 当前页面是否存在新版前端的模态弹窗
 * @returns {boolean}
 */
function isRekaDialogOpen() {
    if (typeof document === 'undefined' || !document.body) return false;
    return document.querySelector(REKA_DIALOG_SELECTOR) !== null;
}

/**
 * 判断节点是否位于插件浮层内
 * @param {unknown} node
 * @returns {boolean}
 */
function isInsideFloatLayer(node) {
    return isElement(node) && node.closest(`[${FLOAT_LAYER_ATTR}]`) !== null;
}

/**
 * 焦点守卫：在 window 捕获阶段拦截跨层焦点事件
 * FocusScope 的监听挂在 document 冒泡阶段，捕获阶段 stopPropagation 即可阻止其抢焦点。
 * @param {FocusEvent} event
 */
function handleFocusEvent(event) {
    // 只在存在新版前端模态弹窗时介入，旧版前端行为保持不变
    if (!isRekaDialogOpen()) return;

    const target = event.target;
    const relatedTarget = event.relatedTarget;
    if (isInsideFloatLayer(target) || isInsideFloatLayer(relatedTarget)) {
        event.stopPropagation();
    }
}

/**
 * 安装全局焦点守卫（幂等，只安装一次）
 */
function installFocusGuard() {
    if (focusGuardInstalled || typeof window === 'undefined') return;

    try {
        window.addEventListener('focusin', handleFocusEvent, true);
        window.addEventListener('focusout', handleFocusEvent, true);
        focusGuardInstalled = true;
    } catch (error) {
        logger.error(`浮层兼容 | 安装焦点守卫失败 | 错误:${error.message}`);
    }
}

/**
 * 将挂载到 body 的插件浮层标记为高优先级浮层
 *
 * @param {HTMLElement} element 浮层根节点
 * @param {Object} [options]
 * @param {boolean} [options.pointerEvents=true] 是否设置内联 pointer-events:auto
 *        下拉面板等有"隐藏态 pointer-events:none"逻辑的浮层应传 false，交由 CSS 控制
 * @returns {HTMLElement} 原节点，方便链式调用
 */
export function markFloatLayer(element, options = {}) {
    const { pointerEvents = true } = options;

    if (!isElement(element)) return element;

    try {
        element.setAttribute(FLOAT_LAYER_ATTR, '');
        // 让 Reka UI 的 isLayerExist() 把本浮层识别为"排在设置弹窗之后的高层"，
        // 避免点击浮层内部被判定为外部点击而关闭下方的 ComfyUI 设置弹窗
        element.setAttribute(REKA_LAYER_ATTR, '');

        // body 被置为 pointer-events:none 时需要显式恢复，否则整棵子树不可点击
        if (pointerEvents) {
            element.style.pointerEvents = 'auto';
        }

        installFocusGuard();
    } catch (error) {
        logger.error(`浮层兼容 | 标记浮层失败 | 错误:${error.message}`);
    }

    return element;
}

export { FLOAT_LAYER_ATTR, REKA_LAYER_ATTR };
