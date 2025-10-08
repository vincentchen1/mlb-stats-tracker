document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadBets();

    // Filter change listeners
    document.getElementById('status-filter').addEventListener('change', loadBets);
    document.getElementById('platform-filter').addEventListener('change', loadBets);
    document.getElementById('type-filter').addEventListener('change', loadBets);
});

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
        if (typeFilter) url += `bet_type=${typeFilter}&`;

        const response = await fetch(url);
        const bets = await response.json();

        const tbody = document.getElementById('bets-tbody');

        if (bets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        No bets found. Add your first bet to start tracking!
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = bets.map(bet => {
            const statusBadge = getStatusBadge(bet.status);
            const profitColor = bet.profit >= 0 ? 'text-success' : 'text-danger';
            const profitText = bet.profit !== null ? `$${bet.profit.toFixed(2)}` : '-';

            return `
                <tr>
                    <td>${formatDate(bet.date)}</td>
                    <td><span class="badge bg-info">${bet.platform}</span></td>
                    <td>
                        <strong>${bet.description}</strong>
                        ${bet.player_name ? `<br><small class="text-muted">${bet.player_name}</small>` : ''}
                    </td>
                    <td><span class="badge bg-secondary">${bet.pick.toUpperCase()}</span></td>
                    <td>$${bet.stake.toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td class="${profitColor}"><strong>${profitText}</strong></td>
                    <td>
                        ${bet.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="updateBetStatus(${bet.id}, 'won')">Won</button>
                            <button class="btn btn-sm btn-danger" onclick="updateBetStatus(${bet.id}, 'lost')">Lost</button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-secondary" onclick="viewBetDetails(${bet.id})">Details</button>
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge bg-warning">Pending</span>',
        'won': '<span class="badge bg-success">Won</span>',
        'lost': '<span class="badge bg-danger">Lost</span>',
        'push': '<span class="badge bg-secondary">Push</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
}

async function saveBet() {
    try {
        const betData = {
            bet_type: document.getElementById('bet-type').value,
            platform: document.getElementById('platform').value,
            description: document.getElementById('description').value,
            player_name: document.getElementById('player-name').value || null,
            team_name: document.getElementById('team-name').value || null,
            line: document.getElementById('line').value || null,
            pick: document.getElementById('pick').value,
            stake: parseFloat(document.getElementById('stake').value),
            odds: document.getElementById('odds').value ? parseFloat(document.getElementById('odds').value) : null,
            game_date: document.getElementById('game-date').value || null,
            notes: document.getElementById('notes').value || null
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

            // Reset form
            document.getElementById('add-bet-form').reset();

            // Reload data
            loadStats();
            loadBets();

            alert('Bet added successfully!');
        } else {
            const error = await response.json();
            alert('Error adding bet: ' + error.message);
        }

    } catch (error) {
        console.error('Error saving bet:', error);
        alert('Error saving bet. Please try again.');
    }
}

async function updateBetStatus(betId, status) {
    try {
        let payout = null;

        if (status === 'won') {
            const payoutInput = prompt('Enter the payout amount (total return including stake):');
            if (!payoutInput) return;
            payout = parseFloat(payoutInput);
        }

        const updateData = {
            status: status
        };

        if (payout !== null) {
            updateData.payout = payout;
        }

        const response = await fetch(`/api/bets/${betId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            loadStats();
            loadBets();
        } else {
            alert('Error updating bet status');
        }

    } catch (error) {
        console.error('Error updating bet status:', error);
        alert('Error updating bet status');
    }
}

async function deleteBet(betId) {
    if (!confirm('Are you sure you want to delete this bet?')) {
        return;
    }

    try {
        const response = await fetch(`/api/bets/${betId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadStats();
            loadBets();
            alert('Bet deleted successfully');
        } else {
            alert('Error deleting bet');
        }

    } catch (error) {
        console.error('Error deleting bet:', error);
        alert('Error deleting bet');
    }
}

async function viewBetDetails(betId) {
    try {
        const response = await fetch('/api/bets');
        const bets = await response.json();
        const bet = bets.find(b => b.id === betId);

        if (!bet) {
            alert('Bet not found');
            return;
        }

        let details = `
📊 Bet Details

Date: ${bet.date}
Platform: ${bet.platform}
Type: ${bet.bet_type}
Description: ${bet.description}
${bet.player_name ? `Player: ${bet.player_name}` : ''}
${bet.team_name ? `Team: ${bet.team_name}` : ''}
${bet.line ? `Line: ${bet.line}` : ''}
Pick: ${bet.pick.toUpperCase()}
Stake: $${bet.stake.toFixed(2)}
${bet.odds ? `Odds: ${bet.odds}` : ''}
Status: ${bet.status.toUpperCase()}
${bet.payout ? `Payout: $${bet.payout.toFixed(2)}` : ''}
${bet.profit !== null ? `Profit: $${bet.profit.toFixed(2)}` : ''}
${bet.result ? `Result: ${bet.result}` : ''}
${bet.notes ? `\nNotes: ${bet.notes}` : ''}
        `;

        alert(details.trim());

    } catch (error) {
        console.error('Error viewing bet details:', error);
    }
}
