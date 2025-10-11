let pickCount = 0;
let currentBetId = null;
let currentBetData = null;

// Cache for API responses
const cache = {
    bets: null,
    betsTimestamp: 0,
    stats: null,
    statsTimestamp: 0,
    cacheDuration: 30000 // 30 seconds
};

// Payout multipliers
const PRIZEPICKS_POWER = {2: 3, 3: 6, 4: 12, 5: 20, 6: 37.5};
const PRIZEPICKS_FLEX = {3: 3, 4: 6, 5: 10, 6: 25};
const UNDERDOG_STANDARD = {2: 3, 3: 6, 4: 10, 5: 20};
const UNDERDOG_FLEX = {3: 6, 4: 6, 5: 20};

// Debounce function for filter changes
function debounce(func, wait) {
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

// Debounced filter function
const debouncedLoadBets = debounce(loadBets, 300);

document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadBets();
    loadPlayerAnalytics();

    // Filter change listeners with debouncing
    document.getElementById('status-filter').addEventListener('change', loadBets);
    document.getElementById('platform-filter').addEventListener('change', loadBets);
    document.getElementById('type-filter').addEventListener('change', loadBets);
    document.getElementById('start-date-filter').addEventListener('change', debouncedLoadBets);
    document.getElementById('end-date-filter').addEventListener('change', debouncedLoadBets);

    // Platform change listener
    document.getElementById('platform').addEventListener('change', updateEntryTypes);

    // Add pick button
    document.getElementById('add-pick-btn').addEventListener('click', addPickRow);

    // Entry type and pick changes for payout preview
    document.getElementById('entry-type').addEventListener('change', updatePayoutPreview);
    document.getElementById('stake').addEventListener('input', updatePayoutPreview);
    document.getElementById('multiplier').addEventListener('input', updatePayoutPreview);

    // Reset modal when closed
    document.getElementById('addBetModal').addEventListener('hidden.bs.modal', resetForm);
});

function updateEntryTypes() {
    const platform = document.getElementById('platform').value;
    const entryTypeSelect = document.getElementById('entry-type');

    entryTypeSelect.innerHTML = '<option value="">Choose type...</option>';

    if (platform === 'PrizePicks') {
        entryTypeSelect.innerHTML += '<option value="Power">Power Play</option>';
        entryTypeSelect.innerHTML += '<option value="Flex">Flex Play</option>';
    } else if (platform === 'Underdog') {
        entryTypeSelect.innerHTML += '<option value="Standard">Standard Entry</option>';
        entryTypeSelect.innerHTML += '<option value="Flex">Flex Entry</option>';
    }
}

function addPickRow() {
    pickCount++;
    const container = document.getElementById('picks-container');

    const pickRow = document.createElement('div');
    pickRow.className = 'pick-row mb-3 p-3 border rounded';
    pickRow.id = `pick-${pickCount}`;

    pickRow.innerHTML = `
        <div class="row">
            <div class="col-md-3">
                <label class="form-label">Player Name *</label>
                <input type="text" class="form-control pick-player" placeholder="e.g., Shohei Ohtani" required>
            </div>
            <div class="col-md-2">
                <label class="form-label">Team</label>
                <input type="text" class="form-control pick-team" placeholder="e.g., Dodgers">
            </div>
            <div class="col-md-2">
                <label class="form-label">Stat Type *</label>
                <select class="form-select pick-stat" required>
                    <option value="">Choose...</option>
                    <option value="Pts">Points</option>
                    <option value="Rebs">Rebounds</option>
                    <option value="Asts">Assists</option>
                    <option value="Hits">Hits</option>
                    <option value="HR">Home Runs</option>
                    <option value="RBI">RBIs</option>
                    <option value="K">Strikeouts (P)</option>
                    <option value="TB">Total Bases</option>
                    <option value="H+R+RBI">H+R+RBI</option>
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label">Line *</label>
                <input type="number" class="form-control pick-line" step="0.5" placeholder="e.g., 1.5" required>
            </div>
            <div class="col-md-2">
                <label class="form-label">Pick *</label>
                <select class="form-select pick-direction" required>
                    <option value="">Choose...</option>
                    <option value="higher">Higher</option>
                    <option value="lower">Lower</option>
                </select>
            </div>
            <div class="col-md-1 d-flex align-items-end">
                <button type="button" class="btn btn-danger btn-sm w-100" onclick="removePickRow(${pickCount})">✕</button>
            </div>
        </div>
    `;

    container.appendChild(pickRow);
    updatePickCount();
    updatePayoutPreview();
}

function removePickRow(id) {
    const row = document.getElementById(`pick-${id}`);
    if (row) {
        row.remove();
        updatePickCount();
        updatePayoutPreview();
    }
}

function updatePickCount() {
    const picks = document.querySelectorAll('.pick-row').length;
    document.getElementById('pick-count').textContent = `${picks} pick${picks !== 1 ? 's' : ''} added`;
}

function updatePayoutPreview() {
    const stake = parseFloat(document.getElementById('stake').value) || 0;
    const multiplier = parseFloat(document.getElementById('multiplier').value) || 0;

    if (stake <= 0 || multiplier <= 0) {
        document.getElementById('payout-preview').style.display = 'none';
        return;
    }

    const totalPayout = stake * multiplier;
    const profit = totalPayout - stake;

    const payoutText = `${multiplier}x Multiplier: Stake $${stake.toFixed(2)} × ${multiplier} = Total Payout: $${totalPayout.toFixed(2)} (Profit: $${profit.toFixed(2)})`;

    document.getElementById('payout-text').textContent = payoutText;
    document.getElementById('payout-preview').style.display = 'block';
}

async function loadStats() {
    try {
        const response = await fetch('/api/bets/stats');
        const stats = await response.json();

        document.getElementById('total-profit').textContent = `$${stats.total_profit.toFixed(2)}`;
        document.getElementById('total-profit').style.color = stats.total_profit >= 0 ? '#28a745' : '#dc3545';

        document.getElementById('roi').textContent = `${stats.roi.toFixed(1)}%`;
        document.getElementById('roi').style.color = stats.roi >= 0 ? '#28a745' : '#dc3545';

        document.getElementById('win-rate').textContent = `${stats.win_rate.toFixed(1)}%`;
        document.getElementById('total-bets').textContent = stats.total_bets;

        // Load analytics by type
        await loadAnalyticsByType();

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadAnalyticsByType() {
    try {
        const response = await fetch('/api/bets');
        const bets = await response.json();

        const typeStats = {
            'Power': { wins: 0, total: 0, profit: 0, stake: 0 },
            'Flex': { wins: 0, total: 0, profit: 0, stake: 0 },
            'Standard': { wins: 0, total: 0, profit: 0, stake: 0 }
        };

        bets.forEach(bet => {
            if (bet.status === 'won' || bet.status === 'lost') {
                // Merge Power and Standard together
                const type = (bet.entry_type === 'Power') ? 'Standard' : bet.entry_type;
                if (typeStats[type]) {
                    typeStats[type].total++;
                    typeStats[type].stake += bet.stake;
                    typeStats[type].profit += bet.profit || 0;
                    if (bet.status === 'won') {
                        typeStats[type].wins++;
                    }
                }
            }
        });

        // Update Flex Play
        const flexWinRate = typeStats['Flex'].total > 0
            ? (typeStats['Flex'].wins / typeStats['Flex'].total * 100).toFixed(1)
            : '0.0';
        const flexROI = typeStats['Flex'].stake > 0
            ? (typeStats['Flex'].profit / typeStats['Flex'].stake * 100).toFixed(1)
            : '0.0';
        document.getElementById('flex-win-rate').textContent = `${flexWinRate}%`;
        document.getElementById('flex-record').textContent = `${typeStats['Flex'].wins}-${typeStats['Flex'].total - typeStats['Flex'].wins}`;
        document.getElementById('flex-roi').textContent = `ROI: ${flexROI}%`;
        document.getElementById('flex-roi').style.color = typeStats['Flex'].profit >= 0 ? '#28a745' : '#dc3545';

        // Update Standard
        const standardWinRate = typeStats['Standard'].total > 0
            ? (typeStats['Standard'].wins / typeStats['Standard'].total * 100).toFixed(1)
            : '0.0';
        const standardROI = typeStats['Standard'].stake > 0
            ? (typeStats['Standard'].profit / typeStats['Standard'].stake * 100).toFixed(1)
            : '0.0';
        document.getElementById('standard-win-rate').textContent = `${standardWinRate}%`;
        document.getElementById('standard-record').textContent = `${typeStats['Standard'].wins}-${typeStats['Standard'].total - typeStats['Standard'].wins}`;
        document.getElementById('standard-roi').textContent = `ROI: ${standardROI}%`;
        document.getElementById('standard-roi').style.color = typeStats['Standard'].profit >= 0 ? '#28a745' : '#dc3545';

    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

async function loadBets() {
    try {
        const statusFilter = document.getElementById('status-filter').value;
        const platformFilter = document.getElementById('platform-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        const startDate = document.getElementById('start-date-filter').value;
        const endDate = document.getElementById('end-date-filter').value;

        let url = '/api/bets?';
        if (statusFilter) url += `status=${statusFilter}&`;
        if (platformFilter) url += `platform=${platformFilter}&`;
        if (typeFilter) url += `entry_type=${typeFilter}&`;
        if (startDate) url += `start_date=${startDate}&`;
        if (endDate) url += `end_date=${endDate}&`;

        // Check cache for unfiltered requests
        const now = Date.now();
        const isUnfiltered = !statusFilter && !platformFilter && !typeFilter && !startDate && !endDate;
        if (isUnfiltered && cache.bets && (now - cache.betsTimestamp) < cache.cacheDuration) {
            renderBets(cache.bets);
            return;
        }

        const response = await fetch(url);
        const bets = await response.json();

        // Cache unfiltered results
        if (isUnfiltered) {
            cache.bets = bets;
            cache.betsTimestamp = now;
        }

        renderBets(bets);
    } catch (error) {
        console.error('Error loading bets:', error);
    }
}

function renderBets(bets) {
    try {
        const tbody = document.getElementById('bets-tbody');

        if (bets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted">
                        No parlay entries found. Add your first entry to start tracking!
                    </td>
                </tr>
            `;
            return;
        }

        // Use DocumentFragment for efficient DOM updates
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = '<table><tbody>' + bets.map(bet => {
            const statusBadge = getStatusBadge(bet.status);
            const profitColor = bet.profit >= 0 ? 'text-success' : 'text-danger';
            const profitText = bet.profit !== 0 ? `$${bet.profit.toFixed(2)}` : '-';
            const payoutText = bet.payout > 0 ? `$${bet.payout.toFixed(2)}` : '-';

            const picksPreview = bet.picks.slice(0, 2).map(p =>
                `${p.player_name} ${p.pick === 'higher' ? '>' : '<'} ${p.line} ${p.stat_type}`
            ).join(', ') + (bet.picks.length > 2 ? ` +${bet.picks.length - 2} more` : '');

            return `
                <tr>
                    <td>${formatDate(bet.date)}</td>
                    <td><span class="badge bg-info">${bet.platform}</span></td>
                    <td><span class="badge bg-secondary">${bet.entry_type}</span></td>
                    <td>
                        <small>${bet.hits}/${bet.num_picks} hits</small><br>
                        <small class="text-muted">${picksPreview}</small>
                    </td>
                    <td>$${bet.stake.toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td>${payoutText}</td>
                    <td class="${profitColor}"><strong>${profitText}</strong></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewBetDetails(${bet.id})">View</button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editBet(${bet.id})">Edit</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteBet(${bet.id})">Delete</button>
                    </td>
                </tr>
            `;
        }).join('') + '</tbody></table>';

        // Extract tbody content and append efficiently
        tbody.innerHTML = '';
        while (tempDiv.firstChild.firstChild.firstChild) {
            tbody.appendChild(tempDiv.firstChild.firstChild.firstChild);
        }
    } catch (error) {
        console.error('Error rendering bets:', error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge bg-warning text-dark">Pending</span>',
        'won': '<span class="badge bg-success">Won</span>',
        'lost': '<span class="badge bg-danger">Lost</span>',
        'partial': '<span class="badge bg-info">Partial Hit</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
}

async function saveBet() {
    try {
        const platform = document.getElementById('platform').value;
        const entryType = document.getElementById('entry-type').value;
        const stake = parseFloat(document.getElementById('stake').value);
        const multiplier = parseFloat(document.getElementById('multiplier').value);
        const gameDate = document.getElementById('game-date').value;
        const notes = document.getElementById('notes').value;

        // Validate multiplier
        if (!multiplier || multiplier <= 0) {
            alert('Please enter a valid multiplier');
            return;
        }

        // Collect all picks
        const pickRows = document.querySelectorAll('.pick-row');
        const picks = [];

        for (const row of pickRows) {
            const player = row.querySelector('.pick-player').value.trim();
            const team = row.querySelector('.pick-team').value.trim();
            const statType = row.querySelector('.pick-stat').value;
            const line = parseFloat(row.querySelector('.pick-line').value);
            const pick = row.querySelector('.pick-direction').value;

            if (!player || !statType || !line || !pick) {
                alert('Please fill in all required fields for each pick');
                return;
            }

            picks.push({
                player_name: player,
                team_name: team || null,
                stat_type: statType,
                line: line,
                pick: pick
            });
        }

        if (picks.length < 2) {
            alert('Minimum 2 picks required for a parlay entry');
            return;
        }

        const betData = {
            platform: platform,
            entry_type: entryType,
            stake: stake,
            multiplier: multiplier,
            game_date: gameDate || null,
            notes: notes || null,
            picks: picks
        };

        const response = await fetch('/api/bets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(betData)
        });

        if (response.ok) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addBetModal'));
            modal.hide();

            // Reload data and refresh charts
            loadStats();
            loadBets();
            loadPlayerAnalytics();

            // Refresh charts if the function exists
            if (typeof refreshChartsAndAnalytics === 'function') {
                refreshChartsAndAnalytics();
            }

            alert('Parlay entry added successfully!');
        } else {
            const error = await response.json();
            alert('Error adding entry: ' + error.message);
        }

    } catch (error) {
        console.error('Error saving bet:', error);
        alert('Error saving entry. Please try again.');
    }
}

async function viewBetDetails(betId) {
    try {
        const response = await fetch('/api/bets');
        const bets = await response.json();
        const bet = bets.find(b => b.id === betId);

        if (!bet) {
            alert('Entry not found');
            return;
        }

        currentBetId = betId;
        currentBetData = bet;

        const content = document.getElementById('view-bet-content');
        content.innerHTML = `
            <div class="row mb-3">
                <div class="col-md-6">
                    <p><strong>Date:</strong> ${formatDate(bet.date)}</p>
                    <p><strong>Platform:</strong> ${bet.platform}</p>
                    <p><strong>Entry Type:</strong> ${bet.entry_type}</p>
                    <p><strong>Stake:</strong> $${bet.stake.toFixed(2)}</p>
                    ${bet.multiplier ? `<p><strong>Multiplier:</strong> ${bet.multiplier}x</p>` : ''}
                </div>
                <div class="col-md-6">
                    <p><strong>Status:</strong> ${bet.status}</p>
                    <p><strong>Hits:</strong> ${bet.hits}/${bet.num_picks}</p>
                    <p><strong>Payout:</strong> $${bet.payout.toFixed(2)}</p>
                    <p><strong>Profit:</strong> <span class="${bet.profit >= 0 ? 'text-success' : 'text-danger'}">$${bet.profit.toFixed(2)}</span></p>
                </div>
            </div>

            ${bet.notes ? `<div class="alert alert-info"><strong>Notes:</strong> ${bet.notes}</div>` : ''}

            <h6 class="mt-4 mb-3">Individual Picks:</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th>Player</th>
                            <th>Team</th>
                            <th>Stat</th>
                            <th>Line</th>
                            <th>Pick</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bet.picks.map((pick, idx) => `
                            <tr>
                                <td>${pick.player_name}</td>
                                <td>${pick.team_name || '-'}</td>
                                <td>${pick.stat_type}</td>
                                <td>${pick.line}</td>
                                <td>${pick.pick === 'higher' ? 'Higher ▲' : 'Lower ▼'}</td>
                                <td>
                                    <select class="form-select form-select-sm pick-result" data-pick-id="${pick.id}">
                                        <option value="pending" ${pick.result === 'pending' ? 'selected' : ''}>Pending</option>
                                        <option value="hit" ${pick.result === 'hit' ? 'selected' : ''}>Hit ✓</option>
                                        <option value="miss" ${pick.result === 'miss' ? 'selected' : ''}>Miss ✗</option>
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const modal = new bootstrap.Modal(document.getElementById('viewBetModal'));
        modal.show();

    } catch (error) {
        console.error('Error viewing bet details:', error);
    }
}

async function updateBetResults() {
    try {
        if (!currentBetId || !currentBetData) return;

        const pickResults = [];
        const resultSelects = document.querySelectorAll('.pick-result');

        resultSelects.forEach((select) => {
            const pickId = parseInt(select.dataset.pickId);
            const result = select.value;

            pickResults.push({
                id: pickId,
                result: result
            });
        });

        const updateData = {
            picks: pickResults
        };

        const response = await fetch(`/api/bets/${currentBetId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            const result = await response.json();

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('viewBetModal'));
            modal.hide();

            // Reload data and refresh charts
            loadStats();
            loadBets();
            loadPlayerAnalytics();

            // Refresh charts if the function exists
            if (typeof refreshChartsAndAnalytics === 'function') {
                refreshChartsAndAnalytics();
            }

            alert(`Entry updated! Status: ${result.status}, Hits: ${result.hits}/${currentBetData.num_picks}, Payout: $${result.payout.toFixed(2)}, Profit: $${result.profit.toFixed(2)}`);
        } else {
            alert('Error updating entry');
        }

    } catch (error) {
        console.error('Error updating bet results:', error);
        alert('Error updating entry results');
    }
}

async function deleteBet(betId) {
    if (!confirm('Are you sure you want to delete this parlay entry?')) {
        return;
    }

    try {
        const response = await fetch(`/api/bets/${betId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Reload data and refresh charts
            loadStats();
            loadBets();
            loadPlayerAnalytics();

            // Refresh charts if the function exists
            if (typeof refreshChartsAndAnalytics === 'function') {
                refreshChartsAndAnalytics();
            }

            alert('Entry deleted successfully');
        } else {
            alert('Error deleting entry');
        }

    } catch (error) {
        console.error('Error deleting bet:', error);
        alert('Error deleting entry');
    }
}

async function editBet(betId) {
    try {
        const response = await fetch('/api/bets');
        const bets = await response.json();
        const bet = bets.find(b => b.id === betId);

        if (!bet) {
            alert('Entry not found');
            return;
        }

        // Reset form first
        resetForm();

        // Populate form with bet data
        document.getElementById('platform').value = bet.platform;
        updateEntryTypes(); // Load entry types for selected platform

        // Use setTimeout to ensure entry types are loaded before setting value
        setTimeout(() => {
            document.getElementById('entry-type').value = bet.entry_type;
            document.getElementById('stake').value = bet.stake;
            document.getElementById('multiplier').value = bet.multiplier || '';
            document.getElementById('game-date').value = bet.game_date || '';
            document.getElementById('notes').value = bet.notes || '';

            // Add picks
            bet.picks.forEach(pick => {
                pickCount++;
                const container = document.getElementById('picks-container');
                const pickRow = document.createElement('div');
                pickRow.className = 'pick-row mb-3 p-3 border rounded';
                pickRow.id = `pick-${pickCount}`;

                pickRow.innerHTML = `
                    <div class="row">
                        <div class="col-md-3">
                            <label class="form-label">Player Name *</label>
                            <input type="text" class="form-control pick-player" value="${pick.player_name}" required>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Team</label>
                            <input type="text" class="form-control pick-team" value="${pick.team_name || ''}">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Stat Type *</label>
                            <select class="form-select pick-stat" required>
                                <option value="">Choose...</option>
                                <option value="Pts" ${pick.stat_type === 'Pts' ? 'selected' : ''}>Points</option>
                                <option value="Rebs" ${pick.stat_type === 'Rebs' ? 'selected' : ''}>Rebounds</option>
                                <option value="Asts" ${pick.stat_type === 'Asts' ? 'selected' : ''}>Assists</option>
                                <option value="Hits" ${pick.stat_type === 'Hits' ? 'selected' : ''}>Hits</option>
                                <option value="HR" ${pick.stat_type === 'HR' ? 'selected' : ''}>Home Runs</option>
                                <option value="RBI" ${pick.stat_type === 'RBI' ? 'selected' : ''}>RBIs</option>
                                <option value="K" ${pick.stat_type === 'K' ? 'selected' : ''}>Strikeouts (P)</option>
                                <option value="TB" ${pick.stat_type === 'TB' ? 'selected' : ''}>Total Bases</option>
                                <option value="H+R+RBI" ${pick.stat_type === 'H+R+RBI' ? 'selected' : ''}>H+R+RBI</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Line *</label>
                            <input type="number" class="form-control pick-line" value="${pick.line}" step="0.5" required>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Pick *</label>
                            <select class="form-select pick-direction" required>
                                <option value="">Choose...</option>
                                <option value="higher" ${pick.pick === 'higher' ? 'selected' : ''}>Higher</option>
                                <option value="lower" ${pick.pick === 'lower' ? 'selected' : ''}>Lower</option>
                            </select>
                        </div>
                        <div class="col-md-1 d-flex align-items-end">
                            <button type="button" class="btn btn-danger btn-sm w-100" onclick="removePickRow(${pickCount})">✕</button>
                        </div>
                    </div>
                `;

                container.appendChild(pickRow);
            });

            updatePickCount();
            updatePayoutPreview();

            // Store bet ID for updating
            currentBetId = betId;

            // Change modal title and button
            document.getElementById('addBetModalLabel').textContent = 'Edit Parlay Entry';
            document.querySelector('#addBetModal .modal-footer .btn-primary').textContent = 'Update Entry';
            document.querySelector('#addBetModal .modal-footer .btn-primary').setAttribute('onclick', 'updateExistingBet()');

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('addBetModal'));
            modal.show();
        }, 100);

    } catch (error) {
        console.error('Error editing bet:', error);
        alert('Error loading entry for editing');
    }
}

async function updateExistingBet() {
    try {
        const platform = document.getElementById('platform').value;
        const entryType = document.getElementById('entry-type').value;
        const stake = parseFloat(document.getElementById('stake').value);
        const multiplier = parseFloat(document.getElementById('multiplier').value);
        const gameDate = document.getElementById('game-date').value;
        const notes = document.getElementById('notes').value;

        // Validate multiplier
        if (!multiplier || multiplier <= 0) {
            alert('Please enter a valid multiplier');
            return;
        }

        // Collect all picks
        const pickRows = document.querySelectorAll('.pick-row');
        const picks = [];

        for (const row of pickRows) {
            const player = row.querySelector('.pick-player').value.trim();
            const team = row.querySelector('.pick-team').value.trim();
            const statType = row.querySelector('.pick-stat').value;
            const line = parseFloat(row.querySelector('.pick-line').value);
            const pick = row.querySelector('.pick-direction').value;

            if (!player || !statType || !line || !pick) {
                alert('Please fill in all required fields for each pick');
                return;
            }

            picks.push({
                player_name: player,
                team_name: team || null,
                stat_type: statType,
                line: line,
                pick: pick
            });
        }

        if (picks.length < 2) {
            alert('Minimum 2 picks required for a parlay entry');
            return;
        }

        const betData = {
            platform: platform,
            entry_type: entryType,
            stake: stake,
            multiplier: multiplier,
            game_date: gameDate || null,
            notes: notes || null,
            picks: picks
        };

        // Delete old bet and create new one
        await fetch(`/api/bets/${currentBetId}`, {
            method: 'DELETE'
        });

        const response = await fetch('/api/bets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(betData)
        });

        if (response.ok) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addBetModal'));
            modal.hide();

            // Reset modal title and button
            document.getElementById('addBetModalLabel').textContent = 'Add New Parlay Entry';
            document.querySelector('#addBetModal .modal-footer .btn-primary').textContent = 'Save Parlay Entry';
            document.querySelector('#addBetModal .modal-footer .btn-primary').setAttribute('onclick', 'saveBet()');

            // Clear currentBetId
            currentBetId = null;

            // Reload data and refresh charts
            loadStats();
            loadBets();
            loadPlayerAnalytics();

            // Refresh charts if the function exists
            if (typeof refreshChartsAndAnalytics === 'function') {
                refreshChartsAndAnalytics();
            }

            alert('Parlay entry updated successfully!');
        } else {
            const error = await response.json();
            alert('Error updating entry: ' + error.message);
        }

    } catch (error) {
        console.error('Error updating bet:', error);
        alert('Error updating entry. Please try again.');
    }
}

function resetForm() {
    document.getElementById('add-bet-form').reset();
    document.getElementById('picks-container').innerHTML = '';
    pickCount = 0;
    updatePickCount();
    document.getElementById('payout-preview').style.display = 'none';

    // Reset modal title and button in case it was changed by edit
    document.getElementById('addBetModalLabel').textContent = 'Add New Parlay Entry';
    document.querySelector('#addBetModal .modal-footer .btn-primary').textContent = 'Save Parlay Entry';
    document.querySelector('#addBetModal .modal-footer .btn-primary').setAttribute('onclick', 'saveBet()');
    currentBetId = null;
}

async function exportToCSV() {
    try {
        const response = await fetch('/api/bets');
        const bets = await response.json();

        if (bets.length === 0) {
            alert('No bets to export!');
            return;
        }

        // CSV Headers
        const headers = ['Date', 'Platform', 'Entry Type', 'Picks', 'Stake', 'Status', 'Payout', 'Profit', 'Notes'];

        // Convert bets to CSV rows
        const rows = bets.map(bet => {
            const date = new Date(bet.created_at).toLocaleDateString();
            const picks = bet.picks ? bet.picks.map(p =>
                `${p.player} (${p.stat} ${p.direction} ${p.line})`
            ).join('; ') : '';
            const profit = bet.profit ? bet.profit.toFixed(2) : '0.00';
            const payout = bet.payout ? bet.payout.toFixed(2) : '0.00';

            return [
                date,
                bet.platform,
                bet.entry_type,
                picks,
                bet.stake.toFixed(2),
                bet.status,
                payout,
                profit,
                bet.notes || ''
            ];
        });

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `betting-history-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3';
        successMsg.style.zIndex = '9999';
        successMsg.innerHTML = '✅ Betting history exported successfully!';
        document.body.appendChild(successMsg);

        setTimeout(() => {
            successMsg.remove();
        }, 3000);

    } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Error exporting data. Please try again.');
    }
}

async function loadPlayerAnalytics() {
    try {
        // Use cached bets if available
        let bets;
        const now = Date.now();
        if (cache.bets && (now - cache.betsTimestamp) < cache.cacheDuration) {
            bets = cache.bets;
        } else {
            const response = await fetch('/api/bets');
            bets = await response.json();
            cache.bets = bets;
            cache.betsTimestamp = now;
        }

        // Analyze player performance
        const playerStats = {};
        const statTypeStats = {};

        bets.forEach(bet => {
            if (bet.picks) {
                bet.picks.forEach(pick => {
                    // Track player performance
                    if (!playerStats[pick.player_name]) {
                        playerStats[pick.player_name] = { hits: 0, total: 0, hitRate: 0 };
                    }
                    playerStats[pick.player_name].total++;
                    if (pick.result === 'hit') {
                        playerStats[pick.player_name].hits++;
                    }

                    // Track stat type performance
                    if (!statTypeStats[pick.stat_type]) {
                        statTypeStats[pick.stat_type] = { hits: 0, total: 0, hitRate: 0 };
                    }
                    statTypeStats[pick.stat_type].total++;
                    if (pick.result === 'hit') {
                        statTypeStats[pick.stat_type].hits++;
                    }
                });
            }
        });

        // Calculate hit rates
        Object.keys(playerStats).forEach(player => {
            playerStats[player].hitRate = (playerStats[player].hits / playerStats[player].total * 100).toFixed(1);
        });
        Object.keys(statTypeStats).forEach(stat => {
            statTypeStats[stat].hitRate = (statTypeStats[stat].hits / statTypeStats[stat].total * 100).toFixed(1);
        });

        // Sort and display top players (min 2 picks)
        const topPlayers = Object.entries(playerStats)
            .filter(([_, stats]) => stats.total >= 2)
            .sort((a, b) => b[1].hitRate - a[1].hitRate)
            .slice(0, 5);

        const topPlayersHtml = topPlayers.length > 0
            ? topPlayers.map(([player, stats]) =>
                `<div class="d-flex justify-content-between mb-1">
                    <span>${player}</span>
                    <span class="badge bg-success">${stats.hits}/${stats.total} (${stats.hitRate}%)</span>
                </div>`
              ).join('')
            : '<div class="text-muted">No data yet</div>';

        document.getElementById('top-players').innerHTML = topPlayersHtml;

        // Sort and display best stat types
        const bestStats = Object.entries(statTypeStats)
            .sort((a, b) => b[1].hitRate - a[1].hitRate)
            .slice(0, 5);

        const bestStatsHtml = bestStats.length > 0
            ? bestStats.map(([stat, stats]) =>
                `<div class="d-flex justify-content-between mb-1">
                    <span>${stat}</span>
                    <span class="badge bg-info">${stats.hits}/${stats.total} (${stats.hitRate}%)</span>
                </div>`
              ).join('')
            : '<div class="text-muted">No data yet</div>';

        document.getElementById('best-stats').innerHTML = bestStatsHtml;

        // Calculate streaks
        const completedBets = bets
            .filter(bet => bet.status === 'won' || bet.status === 'lost')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        let currentStreak = 0;
        let longestWinStreak = 0;
        let tempWinStreak = 0;

        for (const bet of completedBets) {
            if (bet.status === 'won') {
                if (currentStreak >= 0) {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                }
                tempWinStreak++;
                longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
            } else {
                tempWinStreak = 0;
                if (currentStreak <= 0) {
                    currentStreak--;
                } else {
                    currentStreak = -1;
                }
            }
        }

        const streakHtml = `
            <div class="mb-2">
                <strong>Current:</strong>
                <span class="badge ${currentStreak > 0 ? 'bg-success' : currentStreak < 0 ? 'bg-danger' : 'bg-secondary'}">
                    ${currentStreak > 0 ? `${currentStreak}W` : currentStreak < 0 ? `${Math.abs(currentStreak)}L` : 'None'}
                </span>
            </div>
            <div>
                <strong>Best Win Streak:</strong>
                <span class="badge bg-primary">${longestWinStreak}W</span>
            </div>
        `;

        document.getElementById('streak-info').innerHTML = streakHtml;

    } catch (error) {
        console.error('Error loading player analytics:', error);
    }
}
