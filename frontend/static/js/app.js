let currentDate = new Date();

// MLB Team color mapping (based on ESPN/official team colors)
const teamColors = {
    'Los Angeles Dodgers': '#005A9C',
    'New York Yankees': '#0C2340',
    'Houston Astros': '#EB6E1F',
    'Atlanta Braves': '#CE1141',
    'Philadelphia Phillies': '#E81828',
    'San Diego Padres': '#FFC425',
    'New York Mets': '#002D72',
    'St. Louis Cardinals': '#C41E3A',
    'Seattle Mariners': '#005C5C',
    'Toronto Blue Jays': '#134A8E',
    'Tampa Bay Rays': '#8FBCE6',
    'Boston Red Sox': '#BD3039',
    'Cleveland Guardians': '#E31937',
    'Chicago White Sox': '#27251F',
    'Minnesota Twins': '#002B5C',
    'Detroit Tigers': '#0C2340',
    'Kansas City Royals': '#004687',
    'Los Angeles Angels': '#BA0021',
    'Texas Rangers': '#003278',
    'Oakland Athletics': '#003831',
    'Milwaukee Brewers': '#FFC52F',
    'Chicago Cubs': '#0E3386',
    'Cincinnati Reds': '#C6011F',
    'Pittsburgh Pirates': '#FDB827',
    'Arizona Diamondbacks': '#A71930',
    'Colorado Rockies': '#33006F',
    'San Francisco Giants': '#FD5A1E',
    'Washington Nationals': '#AB0003',
    'Miami Marlins': '#00A3E0',
    'Baltimore Orioles': '#DF4601'
};

// Get contrasting colors if teams have similar colors
function getContrastingColors(team1, team2) {
    const color1 = teamColors[team1] || '#DC3545';
    const color2 = teamColors[team2] || '#10B981';

    // Check if colors are similar (very basic check)
    const areSimilar = color1.substring(0, 3) === color2.substring(0, 3);

    if (areSimilar) {
        // Return contrasting versions
        return {
            color1: adjustBrightness(color1, -40),
            color2: adjustBrightness(color2, 60)
        };
    }

    return { color1, color2 };
}

// Adjust color brightness
function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

document.addEventListener('DOMContentLoaded', function() {
    setupDatePicker();
    loadGamesForDate(currentDate);
    loadTeams();
    setupThemeToggle();

    // Auto-refresh games every 15 seconds (only if viewing today)
    setInterval(() => {
        const today = new Date();
        if (currentDate.toDateString() === today.toDateString()) {
            loadGamesForDate(currentDate);
        }
    }, 15000);
});

function setupDatePicker() {
    const datePicker = document.getElementById('date-picker');
    const prevBtn = document.getElementById('prev-day-btn');
    const nextBtn = document.getElementById('next-day-btn');
    const todayBtn = document.getElementById('today-btn');

    // Set initial date
    datePicker.valueAsDate = currentDate;

    // Date picker change
    datePicker.addEventListener('change', function() {
        currentDate = new Date(this.value);
        loadGamesForDate(currentDate);
    });

    // Previous day button
    prevBtn.addEventListener('click', function() {
        currentDate.setDate(currentDate.getDate() - 1);
        datePicker.valueAsDate = currentDate;
        loadGamesForDate(currentDate);
    });

    // Next day button
    nextBtn.addEventListener('click', function() {
        currentDate.setDate(currentDate.getDate() + 1);
        datePicker.valueAsDate = currentDate;
        loadGamesForDate(currentDate);
    });

    // Today button
    todayBtn.addEventListener('click', function() {
        currentDate = new Date();
        datePicker.valueAsDate = currentDate;
        loadGamesForDate(currentDate);
    });
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    // Check for saved theme preference or default to dark mode
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light-mode');
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    }

    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('light-mode');

        if (document.body.classList.contains('light-mode')) {
            themeIcon.textContent = '☀️';
            themeText.textContent = 'Light Mode';
            localStorage.setItem('theme', 'light');
        } else {
            themeIcon.textContent = '🌙';
            themeText.textContent = 'Dark Mode';
            localStorage.setItem('theme', 'dark');
        }
    });
}

async function loadGamesForDate(date) {
    try {
        // Update title with selected date
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = date.toLocaleDateString('en-US', dateOptions);
        document.getElementById('games-title').textContent = `MLB Games - ${formattedDate}`;

        // Format date as YYYY-MM-DD for API
        const dateStr = date.toISOString().split('T')[0];
        const response = await fetch(`/api/games/${dateStr}`);
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

            // Build series display (for playoffs)
            let seriesDisplay = '';
            if (game.series && game.series.series_description) {
                const seriesResult = game.series.series_result || `Game ${game.series.series_game_number}`;
                seriesDisplay = `
                    <div class="series-info mb-3">
                        <div class="series-header">${game.series.series_description} - Game ${game.series.series_game_number}</div>
                        <div class="series-record">${seriesResult}</div>
                    </div>
                `;
            }

            // Build weather display
            let weatherDisplay = '';
            if (game.weather && game.weather.condition) {
                weatherDisplay = `
                    <div class="weather-info mt-2 p-2">
                        <div class="small text-muted">
                            <strong>⛅ Weather:</strong> ${game.weather.condition}
                            ${game.weather.temp !== 'N/A' ? `, ${game.weather.temp}°F` : ''}
                            ${game.weather.wind !== 'N/A' ? ` | 🌬️ ${game.weather.wind}` : ''}
                        </div>
                    </div>
                `;
            }

            // Build win probability display
            let winProbDisplay = '';
            if (game.win_probability !== undefined && (game.status === 'live' || game.status === 'final')) {
                const homeProb = game.win_probability;
                const awayProb = 100 - homeProb;

                // Handle 100% case - only show that team, no minimum width
                let homeWidth, awayWidth, showAwayText, showHomeText;

                if (homeProb === 100) {
                    homeWidth = 100;
                    awayWidth = 0;
                    showAwayText = false;
                    showHomeText = true;
                } else if (awayProb === 100) {
                    homeWidth = 0;
                    awayWidth = 100;
                    showAwayText = true;
                    showHomeText = false;
                } else {
                    // Normal case - show both with minimum 8% for visibility
                    homeWidth = Math.max(homeProb, 8);
                    awayWidth = Math.max(awayProb, 8);
                    showAwayText = awayProb > 5;
                    showHomeText = homeProb > 5;
                }

                // Get team-specific colors
                const colors = getContrastingColors(game.away_team, game.home_team);

                winProbDisplay = `
                    <div class="win-probability-container mt-3">
                        <div class="small text-muted mb-1 text-center"><strong>📊 Win Probability</strong></div>
                        <div class="win-prob-bar-container">
                            <div class="win-prob-bar">
                                ${awayWidth > 0 ? `
                                    <div class="win-prob-away" style="width: ${awayWidth}%; background: ${colors.color1};">
                                        ${showAwayText ? `
                                            <div class="win-prob-team-info">
                                                <img src="${game.away_team_logo}" class="win-prob-logo" alt="${game.away_team}" onerror="this.style.display='none'">
                                                <span class="win-prob-text">${awayProb.toFixed(1)}%</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                                ${homeWidth > 0 ? `
                                    <div class="win-prob-home" style="width: ${homeWidth}%; background: ${colors.color2};">
                                        ${showHomeText ? `
                                            <div class="win-prob-team-info">
                                                <span class="win-prob-text">${homeProb.toFixed(1)}%</span>
                                                <img src="${game.home_team_logo}" class="win-prob-logo" alt="${game.home_team}" onerror="this.style.display='none'">
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="d-flex justify-content-between small text-muted mt-2">
                            <span style="font-weight: 600;">${game.away_team}</span>
                            <span style="font-weight: 600;">${game.home_team}</span>
                        </div>
                    </div>
                `;
            }

            // Build live game data display (current pitcher, batter, count)
            let liveGameDisplay = '';
            if (game.live_data && game.live_data.current_pitcher && game.status === 'live') {
                const pitcherImage = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${game.live_data.current_pitcher_id}/headshot/67/current`;
                const batterImage = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${game.live_data.current_batter_id}/headshot/67/current`;

                liveGameDisplay = `
                    <div class="live-game-data mt-3 p-3">
                        <div class="count-display mb-3">
                            <span class="count-label">Count:</span>
                            <span class="count-balls">${game.live_data.balls}</span>-<span class="count-strikes">${game.live_data.strikes}</span>
                            <span class="count-label ms-3">Outs:</span>
                            <span class="count-outs">${game.live_data.outs}</span>
                        </div>
                        <div class="current-matchup-container">
                            <div class="small text-muted mb-2 text-center"><strong>⚡ Current At-Bat</strong></div>
                            <div class="row">
                                <div class="col-6 text-center">
                                    <img src="${pitcherImage}" alt="${game.live_data.current_pitcher}" class="live-player-photo mb-1" onerror="this.style.display='none'">
                                    <div class="small"><strong>Pitcher</strong></div>
                                    <div class="player-name-small">${game.live_data.current_pitcher}</div>
                                </div>
                                <div class="col-6 text-center">
                                    <img src="${batterImage}" alt="${game.live_data.current_batter}" class="live-player-photo mb-1" onerror="this.style.display='none'">
                                    <div class="small"><strong>Batter</strong></div>
                                    <div class="player-name-small">${game.live_data.current_batter}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Split team names into city and name for consistent display
            const awayTeamParts = game.away_team.split(' ');
            const awayCity = awayTeamParts.slice(0, -1).join(' ');
            const awayName = awayTeamParts[awayTeamParts.length - 1];

            const homeTeamParts = game.home_team.split(' ');
            const homeCity = homeTeamParts.slice(0, -1).join(' ');
            const homeName = homeTeamParts[homeTeamParts.length - 1];

            return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card game-card">
                    <div class="card-body">
                        ${seriesDisplay}
                        <div class="row align-items-center">
                            <div class="col-5 text-center">
                                ${game.away_team_logo ? `<img src="${game.away_team_logo}" class="team-logo mb-2" alt="${game.away_team} logo" onerror="this.style.display='none'">` : ''}
                                <div class="team-name">${awayCity}<br>${awayName}</div>
                                <div class="team-score">${game.away_score}</div>
                                ${game.away_pitcher ? `<div class="text-muted small mt-1">${game.away_pitcher}</div>` : ''}
                            </div>
                            <div class="col-2 text-center">
                                <div class="vs-divider">@</div>
                            </div>
                            <div class="col-5 text-center">
                                ${game.home_team_logo ? `<img src="${game.home_team_logo}" class="team-logo mb-2" alt="${game.home_team} logo" onerror="this.style.display='none'">` : ''}
                                <div class="team-name">${homeCity}<br>${homeName}</div>
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
                        ${weatherDisplay}
                        ${winProbDisplay}
                        ${liveGameDisplay}
                        <div class="text-center mt-3">
                            <button class="btn btn-sm btn-outline-primary" onclick="showLineups(${game.id}, '${game.away_team}', '${game.home_team}')">
                                📋 View Lineups
                            </button>
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
                                            ${team.postseason_status === 'WS_CHAMP' ? '<span class="clinch-badge advanced">🏆 CHAMP</span>' : ''}
                                            ${team.postseason_status && team.postseason_status.startsWith('ELIM_') ? `<span class="clinch-badge postseason-elim" title="${team.postseason_description}">${team.postseason_round}</span>` : ''}
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

async function showLineups(gameId, awayTeam, homeTeam) {
    try {
        const response = await fetch(`/api/game/${gameId}/lineups`);
        const lineups = await response.json();

        if (response.status === 404 || !lineups.home || !lineups.away) {
            alert('Lineups not available for this game yet.');
            return;
        }

        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="lineupsModal" tabindex="-1" aria-labelledby="lineupsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="lineupsModalLabel">Starting Lineups</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-center mb-3">${awayTeam}</h6>
                                    ${lineups.away_pitcher ? `
                                        <div class="text-center mb-3 p-2 bg-light rounded">
                                            <strong>Starting Pitcher</strong><br>
                                            ${lineups.away_pitcher.name} ${lineups.away_pitcher.jersey_number ? `#${lineups.away_pitcher.jersey_number}` : ''}
                                        </div>
                                    ` : ''}
                                    <div class="lineup-list">
                                        ${lineups.away.map(player => `
                                            <div class="lineup-player">
                                                <span class="lineup-order">${player.order}</span>
                                                <div class="lineup-info">
                                                    <div class="lineup-name">${player.name}</div>
                                                    <div class="lineup-position">${player.position} ${player.jersey_number ? `#${player.jersey_number}` : ''}</div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-center mb-3">${homeTeam}</h6>
                                    ${lineups.home_pitcher ? `
                                        <div class="text-center mb-3 p-2 bg-light rounded">
                                            <strong>Starting Pitcher</strong><br>
                                            ${lineups.home_pitcher.name} ${lineups.home_pitcher.jersey_number ? `#${lineups.home_pitcher.jersey_number}` : ''}
                                        </div>
                                    ` : ''}
                                    <div class="lineup-list">
                                        ${lineups.home.map(player => `
                                            <div class="lineup-player">
                                                <span class="lineup-order">${player.order}</span>
                                                <div class="lineup-info">
                                                    <div class="lineup-name">${player.name}</div>
                                                    <div class="lineup-position">${player.position} ${player.jersey_number ? `#${player.jersey_number}` : ''}</div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('lineupsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('lineupsModal'));
        modal.show();

        // Clean up modal when closed
        document.getElementById('lineupsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });

    } catch (error) {
        console.error('Error loading lineups:', error);
        alert('Error loading lineups. Please try again later.');
    }
}