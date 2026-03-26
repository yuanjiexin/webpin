// 将 annotation.css 内联到 SDK bundle 中
// 这个文件在构建时由 rollup 内联为字符串
export const ANNOTATION_CSS = `
:host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.5; box-sizing: border-box; }
*, *::before, *::after { box-sizing: border-box; }
.webpin-highlight { outline: 2px solid #FF6B35 !important; outline-offset: 2px !important; cursor: crosshair !important; }
.webpin-pin { position: absolute; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.25); border: 2px solid rgba(255,255,255,0.8); transition: transform 0.15s; z-index: 2147483640; display: flex; align-items: center; justify-content: center; }
.webpin-pin:hover { transform: rotate(-45deg) scale(1.15); }
.webpin-pin.resolved { opacity: 0.5; }
.webpin-pin-number { transform: rotate(45deg); font-size: 11px; font-weight: 700; color: white; pointer-events: none; }
.webpin-bubble { position: fixed; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); width: 300px; z-index: 2147483641; overflow: hidden; animation: webpin-fade-in 0.15s ease; }
@keyframes webpin-fade-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.webpin-bubble-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px 8px; border-bottom: 1px solid #f0f0f0; }
.webpin-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600; flex-shrink: 0; overflow: hidden; }
.webpin-author-name { font-size: 13px; font-weight: 600; color: #1a1a1a; }
.webpin-bubble textarea { width: 100%; border: none; outline: none; resize: none; padding: 10px 14px; font-size: 14px; font-family: inherit; min-height: 72px; color: #333; background: transparent; }
.webpin-bubble textarea::placeholder { color: #aaa; }
.webpin-bubble-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px 12px; border-top: 1px solid #f0f0f0; }
.webpin-colors { display: flex; gap: 6px; }
.webpin-color-dot { width: 18px; height: 18px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: border-color 0.1s, transform 0.1s; }
.webpin-color-dot:hover, .webpin-color-dot.active { border-color: rgba(0,0,0,0.4); transform: scale(1.2); }
.webpin-bubble-actions { display: flex; gap: 8px; }
.webpin-btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.1s; }
.webpin-btn-cancel { background: #f5f5f5; color: #666; }
.webpin-btn-cancel:hover { background: #ebebeb; }
.webpin-btn-submit { background: #FF6B35; color: white; }
.webpin-btn-submit:hover { background: #E64E1C; }
.webpin-btn-submit:disabled { background: #ffb09a; cursor: not-allowed; }
`;
