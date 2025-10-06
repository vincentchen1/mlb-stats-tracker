document.addEventListener('DOMContentLoaded', function() {
    loadTeams();
    setupMatchupFunctionality();
});

async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();

        // Populate team selects
        const team1Select = document.getElementById('team1-select');
        const team2Select = document.getElementById('team2-select');

        const teamOptions = teams.map(team =>
            `<option value="${team.id}">${team.city} ${team.name}</option>`
        ).join('');

        team1Select.innerHTML = '<option value="">Choose a team...</option>' + teamOptions;
        team2Select.innerHTML = '<option value="">Choose a team...</option>' + teamOptions;
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

function setupMatchupFunctionality() {
    const team1Select = document.getElementById('team1-select');
    const team2Select = document.getElementById('team2-select');
    const pitcherSelect = document.getElementById('pitcher-select');
    const batterSelect = document.getElementById('batter-select');
    const compareBtn = document.getElementById('compare-btn');

    team1Select.addEventListener('change', () => loadTeamPlayers(team1Select.value, 'pitcher'));
    team2Select.addEventListener('change', () => loadTeamPlayers(team2Select.value, 'batter'));

    pitcherSelect.addEventListener('change', checkMatchupReady);
    batterSelect.addEventListener('change', checkMatchupReady);

    compareBtn.addEventListener('click', compareMatchup);
}

async function loadTeamPlayers(teamId, type) {
    if (!teamId) {
        const select = type === 'pitcher' ? document.getElementById('pitcher-select') : document.getElementById('batter-select');
        select.innerHTML = `<option value="">Choose a ${type}...</option>`;
        return;
    }

    try {
        const response = await fetch(`/api/players/${teamId}`);
        const players = await response.json();

        const select = type === 'pitcher' ? document.getElementById('pitcher-select') : document.getElementById('batter-select');

        let filteredPlayers;
        if (type === 'pitcher') {
            // Include pitchers (P) and two-way players (TWP, Y)
            filteredPlayers = players.filter(player => ['P', 'TWP', 'Y'].includes(player.position));
        } else {
            // Include all non-pitchers (including two-way players for batting)
            filteredPlayers = players.filter(player => player.position !== 'P');
        }

        select.innerHTML = `<option value="">Choose a ${type}...</option>` +
            filteredPlayers.map(player =>
                `<option value="${player.id}">${player.name} (${player.position})</option>`
            ).join('');

        checkMatchupReady();
    } catch (error) {
        console.error(`Error loading ${type}s:`, error);
    }
}

function checkMatchupReady() {
    const pitcherSelect = document.getElementById('pitcher-select');
    const batterSelect = document.getElementById('batter-select');
    const compareBtn = document.getElementById('compare-btn');

    compareBtn.disabled = !pitcherSelect.value || !batterSelect.value;
}

async function compareMatchup() {
    const pitcherId = document.getElementById('pitcher-select').value;
    const batterId = document.getElementById('batter-select').value;
    const pitcherSelect = document.getElementById('pitcher-select');
    const batterSelect = document.getElementById('batter-select');
    const pitcherName = pitcherSelect.options[pitcherSelect.selectedIndex].text.split(' (')[0];
    const batterName = batterSelect.options[batterSelect.selectedIndex].text.split(' (')[0];
    const resultDiv = document.getElementById('matchup-result');

    try {
        const response = await fetch(`/api/matchup/${pitcherId}/${batterId}`);

        if (response.ok) {
            const matchup = await response.json();

            // Calculate singles from hits minus extra base hits
            const singles = matchup.hits - (matchup.doubles || 0) - (matchup.triples || 0) - (matchup.home_runs || 0);

            // MLB headshot URLs
            const pitcherImage = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
            const batterImage = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${batterId}/headshot/67/current`;

            resultDiv.innerHTML = `
                <div class="matchup-stats">
                    <div class="row mb-4">
                        <div class="col-md-5 text-center">
                            <img src="${pitcherImage}" alt="${pitcherName}" class="player-headshot mb-2" onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/0/headshot/67/current'">
                            <h5 class="text-white">${pitcherName}</h5>
                            <span class="badge bg-info">Pitcher</span>
                        </div>
                        <div class="col-md-2 d-flex align-items-center justify-content-center">
                            <div class="vs-badge">VS</div>
                        </div>
                        <div class="col-md-5 text-center">
                            <img src="${batterImage}" alt="${batterName}" class="player-headshot mb-2" onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/0/headshot/67/current'">
                            <h5 class="text-white">${batterName}</h5>
                            <span class="badge bg-warning">Batter</span>
                        </div>
                    </div>
                    <h4 class="text-center mb-4">Historical Matchup Statistics</h4>

                    <div class="row mb-3">
                        <div class="col-md-4 stat-item">
                            <span class="stat-value">${matchup.at_bats}</span>
                            <span class="stat-label">At Bats</span>
                        </div>
                        <div class="col-md-4 stat-item">
                            <span class="stat-value">${matchup.hits}</span>
                            <span class="stat-label">Hits</span>
                        </div>
                        <div class="col-md-4 stat-item">
                            <span class="stat-value">${matchup.avg}</span>
                            <span class="stat-label">Batting Average</span>
                        </div>
                    </div>

                    <div class="row mb-3">
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${singles}</span>
                            <span class="stat-label">Singles</span>
                        </div>
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${matchup.doubles || 0}</span>
                            <span class="stat-label">Doubles</span>
                        </div>
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${matchup.triples || 0}</span>
                            <span class="stat-label">Triples</span>
                        </div>
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${matchup.home_runs || 0}</span>
                            <span class="stat-label">Home Runs</span>
                        </div>
                    </div>

                    <div class="row mb-3">
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${matchup.rbi || 0}</span>
                            <span class="stat-label">RBIs</span>
                        </div>
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${matchup.walks || 0}</span>
                            <span class="stat-label">Walks</span>
                        </div>
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${matchup.strikeouts || 0}</span>
                            <span class="stat-label">Strikeouts</span>
                        </div>
                        <div class="col-md-3 stat-item">
                            <span class="stat-value">${matchup.total_bases || 0}</span>
                            <span class="stat-label">Total Bases</span>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-4 stat-item">
                            <span class="stat-value">${matchup.obp || '.000'}</span>
                            <span class="stat-label">On-Base %</span>
                        </div>
                        <div class="col-md-4 stat-item">
                            <span class="stat-value">${matchup.slg || '.000'}</span>
                            <span class="stat-label">Slugging %</span>
                        </div>
                        <div class="col-md-4 stat-item">
                            <span class="stat-value">${matchup.ops || '.000'}</span>
                            <span class="stat-label">OPS</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-info">
                    <h5>No Historical Data</h5>
                    <p>These players have never faced each other before, or no data is available for this matchup.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading matchup:', error);
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error loading matchup data. Please try again.
            </div>
        `;
    }
}
