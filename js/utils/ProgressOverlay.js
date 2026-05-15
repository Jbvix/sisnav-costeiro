/**
 * Overlay modal com barra de progresso (0–100 %) e mensagens de estado.
 * Uso: ProgressOverlay.show(título, subtítulo, %); ProgressOverlay.setProgress(%, título?, subtítulo?); ProgressOverlay.hide();
 */

const ProgressOverlay = {
    _el: null,
    _bar: null,
    _title: null,
    _sub: null,
    _pct: null,

    _ensure: function () {
        if (this._el) return;
        const wrap = document.createElement('div');
        wrap.id = 'sisnav-progress-overlay';
        wrap.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'sisnav-progress-title');
        wrap.style.display = 'none';
        wrap.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <h2 id="sisnav-progress-title" class="text-sm font-bold text-slate-900 tracking-tight">A processar…</h2>
                <p id="sisnav-progress-sub" class="text-xs text-slate-600 mt-1 mb-4 min-h-[2.5rem] leading-snug"></p>
                <div class="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="sisnav-progress-wrap">
                    <div id="sisnav-progress-bar" class="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-[width] duration-300 ease-out" style="width:0%"></div>
                </div>
                <p id="sisnav-progress-pct" class="text-right text-[11px] font-mono text-slate-500 mt-2">0%</p>
            </div>
        `;
        document.body.appendChild(wrap);
        this._el = wrap;
        this._bar = wrap.querySelector('#sisnav-progress-bar');
        this._title = wrap.querySelector('#sisnav-progress-title');
        this._sub = wrap.querySelector('#sisnav-progress-sub');
        this._pct = wrap.querySelector('#sisnav-progress-pct');
        this._wrap = wrap.querySelector('#sisnav-progress-wrap');
    },

    /**
     * @param {string} title
     * @param {string} [subtitle]
     * @param {number} [pct] 0–100
     */
    show: function (title, subtitle, pct) {
        this._ensure();
        this._el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this.setProgress(pct != null ? pct : 0, title, subtitle != null ? subtitle : '');
    },

    /**
     * @param {number} pct 0–100
     * @param {string} [title]
     * @param {string} [subtitle]
     */
    setProgress: function (pct, title, subtitle) {
        this._ensure();
        const p = Math.max(0, Math.min(100, Number(pct) || 0));
        if (this._bar) this._bar.style.width = p + '%';
        if (this._pct) this._pct.textContent = Math.round(p) + '%';
        if (this._wrap) this._wrap.setAttribute('aria-valuenow', String(Math.round(p)));
        if (title != null && this._title) this._title.textContent = title;
        if (subtitle != null && this._sub) this._sub.textContent = subtitle;
    },

    /** @param {number} [delayMs] fecho suave após conclusão */
    hide: function (delayMs) {
        const run = () => {
            try {
                if (this._el) this._el.style.display = 'none';
                document.body.style.overflow = '';
            } catch (e) { /* ignore */ }
        };
        const d = delayMs != null ? delayMs : 0;
        if (d > 0) setTimeout(run, d);
        else run();
    }
};

export default ProgressOverlay;
