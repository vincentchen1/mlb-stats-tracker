document.addEventListener('DOMContentLoaded', function() {
    loadTodaysGames();
    loadTeams();
    setupMatchupFunctionality();
});

async function loadTodaysGames() {
    try {
        // Update title with today's date
        const today = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('en-US', dateOptions);
        document.getElementById('games-title').textContent = `MLB Games - ${formattedDate}`;

        const response = await fetch('/api/games/today');
        const games = await response.json();

        const container = document.getElementById('games-container');

        if (games.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="no-data">
                        <h5>No games scheduled for today</h5>
                        <p>Check back later for updated schedules!</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = games.map(game => {
            // Convert game time to local timezone
            let gameTime = '';
            if (game.game_date) {
                const date = new Date(game.game_date);
                gameTime = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            }

            // Build inning display
            let inningDisplay = '';
            if (game.inning && game.status === 'live') {
                inningDisplay = `${game.inning_state || ''} ${game.inning}`.trim();
            }

            return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card game-card">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-5 text-center">
                                ${game.away_team_logo ? `<img src="${game.away_team_logo}" class="team-logo mb-2" alt="${game.away_team} logo" onerror="this.style.display='none'">` : ''}
                                <div class="team-name">${game.away_team}</div>
                                <div class="team-score">${game.away_score}</div>
                                ${game.away_pitcher ? `<div class="text-muted small mt-1">${game.away_pitcher}</div>` : ''}
                            </div>
                            <div class="col-2 text-center">
                                <div class="vs-divider">VS</div>
                            </div>
                            <div class="col-5 text-center">
                                ${game.home_team_logo ? `<img src="${game.home_team_logo}" class="team-logo mb-2" alt="${game.home_team} logo" onerror="this.style.display='none'">` : ''}
                                <div class="team-name">${game.home_team}</div>
                                <div class="team-score">${game.home_score}</div>
                                ${game.home_pitcher ? `<div class="text-muted small mt-1">${game.home_pitcher}</div>` : ''}
                            </div>
                        </div>
                        <div class="text-center mt-3">
                            <span class="badge bg-primary game-status status-${game.status}">
                                ${game.status_detail || game.status}
                            </span>
                            ${inningDisplay ? `<span class="badge bg-secondary ms-2">${inningDisplay}</span>` : ''}
                        </div>
                        <div class="text-center mt-3">
                            ${gameTime ? `<div class="text-muted small">🕐 ${gameTime}</div>` : ''}
                            ${game.venue ? `<div class="text-muted small">📍 ${game.venue}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading games:', error);
        document.getElementById('games-container').innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    Error loading games. Please try again later.
                </div>
            </div>
        `;
    }
}

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

        // Organize teams by division
        const divisions = [
            'AL East', 'AL Central', 'AL West',
            'NL East', 'NL Central', 'NL West'
        ];

        const teamsContainer = document.getElementById('teams-container');
        teamsContainer.innerHTML = divisions.map(division => {
            const divisionTeams = teams.filter(team => team.division === division);
            if (divisionTeams.length === 0) return '';

            // Sort teams by division rank
            divisionTeams.sort((a, b) => {
                const rankA = parseInt(a.division_rank) || 99;
                const rankB = parseInt(b.division_rank) || 99;
                return rankA - rankB;
            });

            return `
                <div class="col-12 mb-4">
                    <h4 class="division-header">${division}</h4>
                    <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-5 g-3">
                        ${divisionTeams.map(team => `
                            <div class="col">
                                <div class="card team-card h-100">
                                    <div class="card-body text-center d-flex flex-column">
                                        ${team.logo_url ? `<img src="${team.logo_url}" class="team-logo-large mb-3" alt="${team.city} ${team.name} logo" onerror="this.style.display='none'">` : ''}
                                        <h5 class="card-title">
                                            ${team.city ? team.city + ' ' : ''}${team.name}
                                            ${team.display_indicator ? `<span class="clinch-badge ${team.clinch_indicator === 'e' ? 'eliminated' : ''}">${team.display_indicator}</span>` : ''}
                                        </h5>
                                        ${team.wins !== undefined ? `
                                            <div class="standings-info mb-2">
                                                <div class="text-muted small">
                                                    <strong>Record:</strong> ${team.wins}-${team.losses}
                                                </div>
                                                <div class="text-muted small">
                                                    <strong>PCT:</strong> ${team.win_pct}
                                                </div>
                                                ${team.games_back !== '-' ? `<div class="text-muted small"><strong>GB:</strong> ${team.games_back}</div>` : ''}
                                            </div>
                                        ` : `
                                            <p class="card-text">
                                                <strong>Abbreviation:</strong> ${team.abbreviation}
                                            </p>
                                        `}
                                        <button class="btn btn-outline-primary btn-sm mt-auto" onclick="showTeamPlayers(${team.id})">
                                            View Players
                                        </button>
                                        <div id="players-${team.id}" class="player-list mt-3" style="display: none;"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

async function showTeamPlayers(teamId) {
    try {
        const playersDiv = document.getElementById(`players-${teamId}`);

        if (!playersDiv) {
            console.error('Players div not found for team:', teamId);
            return;
        }

        // If already showing, hide it
        if (playersDiv.style.display === 'block') {
            playersDiv.style.display = 'none';
            return;
        }

        // Fetch and show players
        const response = await fetch(`/api/players/${teamId}`);
        const players = await response.json();

        if (players.length === 0) {
            playersDiv.innerHTML = '<p class="text-muted">No players found</p>';
        } else {
            playersDiv.innerHTML = players.map(player => `
                <div class="border-bottom py-2">
                    <strong>${player.name}</strong> (${player.position})
                    <br>
                    <small class="text-muted">
                        ${player.position === 'P' ? `ERA: ${player.era}` : `AVG: ${player.batting_avg}`}
                    </small>
                </div>
            `).join('');
        }

        playersDiv.style.display = 'block';
    } catch (error) {
        console.error('Error loading players:', error);
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