let pickCount = 0;
let currentBetId = null;
let currentBetData = null;

// Payout multipliers
const PRIZEPICKS_POWER = {2: 3, 3: 6, 4: 12, 5: 20, 6: 37.5};
const PRIZEPICKS_FLEX = {3: 3, 4: 6, 5: 10, 6: 25};
const UNDERDOG_STANDARD = {2: 3, 3: 6, 4: 10, 5: 20};
const UNDERDOG_FLEX = {3: 6, 4: 10, 5: 20};

document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadBets();

    // Filter change listeners
    document.getElementById('status-filter').addEventListener('change', loadBets);
    document.getElementById('platform-filter').addEventListener('change', loadBets);
    document.getElementById('type-filter').addEventListener('change', loadBets);

    // Platform change listener
    document.getElementById('platform').addEventListener('change', updateEntryTypes);

    // Add pick button
    document.getElementById('add-pick-btn').addEventListener('click', addPickRow);

    // Entry type and pick changes for payout preview
    document.getElementById('entry-type').addEventListener('change', updatePayoutPreview);
    document.getElementById('stake').addEventListener('input', updatePayoutPreview);

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
    const platform = document.getElementById('platform').value;
    const entryType = document.getElementById('entry-type').value;
    const stake = parseFloat(document.getElementById('stake').value) || 0;
    const numPicks = document.querySelectorAll('.pick-row').length;

    if (!platform || !entryType || stake <= 0 || numPicks < 2) {
        document.getElementById('payout-preview').style.display = 'none';
        return;
    }

    let multiplier = 0;
    let payoutText = '';

    if (platform === 'PrizePicks') {
        if (entryType === 'Power') {
            multiplier = PRIZEPICKS_POWER[numPicks] || 0;
            payoutText = `${numPicks}-Pick Power Play: Win all ${numPicks} = ${multiplier}x ($${(stake * multiplier).toFixed(2)})`;
        } else if (entryType === 'Flex') {
            const allMultiplier = PRIZEPICKS_FLEX[numPicks] || 0;
            payoutText = `${numPicks}-Pick Flex Play: ${numPicks}/${numPicks} = ${allMultiplier}x ($${(stake * allMultiplier).toFixed(2)})`;

            if (numPicks === 4) payoutText += `, 3/4 = 0.4x ($${(stake * 0.4).toFixed(2)})`;
            if (numPicks === 5) payoutText += `, 4/5 = 1.5x ($${(stake * 1.5).toFixed(2)})`;
            if (numPicks === 6) payoutText += `, 5/6 = 2x ($${(stake * 2).toFixed(2)})`;
        }
    } else if (platform === 'Underdog') {
        if (entryType === 'Standard') {
            multiplier = UNDERDOG_STANDARD[numPicks] || 0;
            payoutText = `${numPicks}-Pick Standard: Win all ${numPicks} = ${multiplier}x ($${(stake * multiplier).toFixed(2)})`;
        } else if (entryType === 'Flex') {
            const allMultiplier = UNDERDOG_FLEX[numPicks] || 0;
            payoutText = `${numPicks}-Pick Flex: ${numPicks}/${numPicks} = ${allMultiplier}x ($${(stake * allMultiplier).toFixed(2)})`;

            if (numPicks === 4) payoutText += `, 3/4 = 2x ($${(stake * 2).toFixed(2)})`;
            if (numPicks === 5) payoutText += `, 4/5 = 3x ($${(stake * 3).toFixed(2)})`;
        }
    }

    document.getElementById('payout-text').textContent = payoutText;
    document.getElementById('payout-preview').style.display = payoutText ? 'block' : 'none';
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

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadBets() {
    try {
        const statusFilter = document.getElementById('status-filter').value;
        const platformFilter = document.getElementById('platform-filter').value;
        const typeFilter = document.getElementById('type-filter').value;

        let url = '/api/bets?';
        if (statusFilter) url += `status=${statusFilter}&`;
        if (platformFilter) url += `platform=${platformFilter}&`;
        if (typeFilter) url += `entry_type=${typeFilter}&`;

        const response = await fetch(url);
        const bets = await response.json();

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

        tbody.innerHTML = bets.map(bet => {
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
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteBet(${bet.id})">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading bets:', error);
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
        const gameDate = document.getElementById('game-date').value;
        const notes = document.getElementById('notes').value;

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

            // Reload data
            loadStats();
            loadBets();

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
                            <th>Actual</th>
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
                                    <select class="form-select form-select-sm pick-result" data-pick-id="${pick.id}" ${bet.status !== 'pending' ? 'disabled' : ''}>
                                        <option value="pending" ${pick.result === 'pending' ? 'selected' : ''}>Pending</option>
                                        <option value="hit" ${pick.result === 'hit' ? 'selected' : ''}>Hit ✓</option>
                                        <option value="miss" ${pick.result === 'miss' ? 'selected' : ''}>Miss ✗</option>
                                    </select>
                                </td>
                                <td>
                                    <input type="number" class="form-control form-control-sm pick-actual" data-pick-id="${pick.id}"
                                           value="${pick.actual_value || ''}" step="0.5" placeholder="-" ${bet.status !== 'pending' ? 'disabled' : ''}>
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
        const actualInputs = document.querySelectorAll('.pick-actual');

        resultSelects.forEach((select, idx) => {
            const pickId = parseInt(select.dataset.pickId);
            const result = select.value;
            const actualValue = actualInputs[idx].value ? parseFloat(actualInputs[idx].value) : null;

            pickResults.push({
                id: pickId,
                result: result,
                actual_value: actualValue
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

            // Reload data
            loadStats();
            loadBets();

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
            loadStats();
            loadBets();
            alert('Entry deleted successfully');
        } else {
            alert('Error deleting entry');
        }

    } catch (error) {
        console.error('Error deleting bet:', error);
        alert('Error deleting entry');
    }
}

function resetForm() {
    document.getElementById('add-bet-form').reset();
    document.getElementById('picks-container').innerHTML = '';
    pickCount = 0;
    updatePickCount();
    document.getElementById('payout-preview').style.display = 'none';
}
