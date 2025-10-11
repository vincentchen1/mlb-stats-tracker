// Chart instances
let profitChart = null;
let winRateChart = null;
let platformChart = null;
let typeChart = null;
let resultsChart = null;

// Initialize all charts
async function initializeCharts() {
    try {
        const response = await fetch('/api/bets');
        const bets = await response.json();

        if (bets.length === 0) {
            return;
        }

        // Process data for charts
        const monthlyData = processMonthlyData(bets);
        const platformData = processPlatformData(bets);
        const typeData = processTypeData(bets);
        const resultsData = processResultsData(bets);

        // Create charts
        createProfitChart(monthlyData);
        createWinRateChart(monthlyData);
        createPlatformChart(platformData);
        createTypeChart(typeData);
        createResultsChart(resultsData);
        createMonthlyBreakdownTable(monthlyData);
        populateMonthFilter(monthlyData);

    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

// Process monthly data
function processMonthlyData(bets) {
    const monthlyStats = {};

    bets.forEach(bet => {
        const date = new Date(bet.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
                label: monthLabel,
                totalBets: 0,
                won: 0,
                lost: 0,
                partial: 0,
                pending: 0,
                totalStaked: 0,
                totalProfit: 0,
                cumulativeProfit: 0
            };
        }

        const stats = monthlyStats[monthKey];
        stats.totalBets++;
        stats.totalStaked += bet.stake;
        stats.totalProfit += bet.profit || 0;

        if (bet.status === 'won') stats.won++;
        else if (bet.status === 'lost') stats.lost++;
        else if (bet.status === 'partial') stats.partial++;
        else if (bet.status === 'pending') stats.pending++;
    });

    // Sort by month and calculate cumulative profit
    const sortedMonths = Object.keys(monthlyStats).sort();
    let cumulativeProfit = 0;

    sortedMonths.forEach(month => {
        cumulativeProfit += monthlyStats[month].totalProfit;
        monthlyStats[month].cumulativeProfit = cumulativeProfit;
    });

    return monthlyStats;
}

// Process platform data
function processPlatformData(bets) {
    const platformStats = {};

    bets.forEach(bet => {
        if (!platformStats[bet.platform]) {
            platformStats[bet.platform] = 0;
        }
        platformStats[bet.platform]++;
    });

    return platformStats;
}

// Process type data
function processTypeData(bets) {
    const typeStats = {};

    bets.forEach(bet => {
        if (!typeStats[bet.entry_type]) {
            typeStats[bet.entry_type] = 0;
        }
        typeStats[bet.entry_type]++;
    });

    return typeStats;
}

// Process results data
function processResultsData(bets) {
    const resultsStats = {
        won: 0,
        lost: 0,
        partial: 0,
        pending: 0
    };

    bets.forEach(bet => {
        if (resultsStats.hasOwnProperty(bet.status)) {
            resultsStats[bet.status]++;
        }
    });

    return resultsStats;
}

// Create Profit/Loss Over Time Chart
function createProfitChart(monthlyData) {
    const ctx = document.getElementById('profitChart');
    if (!ctx) return;

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => monthlyData[month].label);
    const cumulativeProfits = sortedMonths.map(month => monthlyData[month].cumulativeProfit);
    const monthlyProfits = sortedMonths.map(month => monthlyData[month].totalProfit);

    // Destroy existing chart
    if (profitChart) {
        profitChart.destroy();
    }

    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Profit',
                data: cumulativeProfits,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 2
            }, {
                label: 'Monthly Profit',
                data: monthlyProfits,
                borderColor: 'rgb(255, 159, 64)',
                backgroundColor: 'rgba(255, 159, 64, 0.1)',
                tension: 0.3,
                fill: false,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
}

// Create Win Rate Trend Chart
function createWinRateChart(monthlyData) {
    const ctx = document.getElementById('winRateChart');
    if (!ctx) return;

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => monthlyData[month].label);
    const winRates = sortedMonths.map(month => {
        const stats = monthlyData[month];
        const completed = stats.won + stats.lost + stats.partial;
        return completed > 0 ? (stats.won / completed * 100) : 0;
    });

    // Destroy existing chart
    if (winRateChart) {
        winRateChart.destroy();
    }

    winRateChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Win Rate %',
                data: winRates,
                backgroundColor: winRates.map(rate =>
                    rate >= 60 ? 'rgba(40, 167, 69, 0.6)' :
                    rate >= 40 ? 'rgba(255, 193, 7, 0.6)' :
                    'rgba(220, 53, 69, 0.6)'
                ),
                borderColor: winRates.map(rate =>
                    rate >= 60 ? 'rgb(40, 167, 69)' :
                    rate >= 40 ? 'rgb(255, 193, 7)' :
                    'rgb(220, 53, 69)'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Win Rate: ' + context.parsed.y.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// Create Platform Distribution Chart
function createPlatformChart(platformData) {
    const ctx = document.getElementById('platformChart');
    if (!ctx) return;

    const labels = Object.keys(platformData);
    const data = Object.values(platformData);

    // Destroy existing chart
    if (platformChart) {
        platformChart.destroy();
    }

    platformChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(255, 206, 86, 0.6)'
                ],
                borderColor: [
                    'rgb(54, 162, 235)',
                    'rgb(255, 99, 132)',
                    'rgb(255, 206, 86)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Create Type Distribution Chart
function createTypeChart(typeData) {
    const ctx = document.getElementById('typeChart');
    if (!ctx) return;

    const labels = Object.keys(typeData);
    const data = Object.values(typeData);

    // Destroy existing chart
    if (typeChart) {
        typeChart.destroy();
    }

    typeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(255, 159, 64, 0.6)'
                ],
                borderColor: [
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)',
                    'rgb(255, 159, 64)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Create Results Distribution Chart
function createResultsChart(resultsData) {
    const ctx = document.getElementById('resultsChart');
    if (!ctx) return;

    const labels = ['Won', 'Lost', 'Partial', 'Pending'];
    const data = [
        resultsData.won,
        resultsData.lost,
        resultsData.partial,
        resultsData.pending
    ];

    // Destroy existing chart
    if (resultsChart) {
        resultsChart.destroy();
    }

    resultsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(40, 167, 69, 0.6)',
                    'rgba(220, 53, 69, 0.6)',
                    'rgba(23, 162, 184, 0.6)',
                    'rgba(255, 193, 7, 0.6)'
                ],
                borderColor: [
                    'rgb(40, 167, 69)',
                    'rgb(220, 53, 69)',
                    'rgb(23, 162, 184)',
                    'rgb(255, 193, 7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Create Monthly Breakdown Table
function createMonthlyBreakdownTable(monthlyData) {
    const tbody = document.getElementById('monthly-stats-body');
    if (!tbody) return;

    const sortedMonths = Object.keys(monthlyData).sort().reverse(); // Most recent first

    if (sortedMonths.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = sortedMonths.map(month => {
        const stats = monthlyData[month];
        const completed = stats.won + stats.lost + stats.partial;
        const winRate = completed > 0 ? (stats.won / completed * 100).toFixed(1) : '0.0';
        const roi = stats.totalStaked > 0 ? (stats.totalProfit / stats.totalStaked * 100).toFixed(1) : '0.0';

        const winRateColor = parseFloat(winRate) >= 50 ? 'text-success' : 'text-danger';
        const roiColor = parseFloat(roi) >= 0 ? 'text-success' : 'text-danger';
        const profitColor = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';

        return `
            <tr>
                <td><strong>${stats.label}</strong></td>
                <td>${stats.totalBets}</td>
                <td>${stats.won}</td>
                <td>${stats.lost}</td>
                <td class="${winRateColor}">${winRate}%</td>
                <td>$${stats.totalStaked.toFixed(2)}</td>
                <td class="${profitColor}"><strong>$${stats.totalProfit.toFixed(2)}</strong></td>
                <td class="${roiColor}"><strong>${roi}%</strong></td>
            </tr>
        `;
    }).join('');
}

// Populate month filter dropdown
function populateMonthFilter(monthlyData) {
    const monthFilter = document.getElementById('month-filter');
    if (!monthFilter) return;

    const sortedMonths = Object.keys(monthlyData).sort().reverse();

    // Clear existing options except "All Months"
    monthFilter.innerHTML = '<option value="">All Months</option>';

    sortedMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = monthlyData[month].label;
        monthFilter.appendChild(option);
    });

    // Add event listener for month filter
    monthFilter.addEventListener('change', filterByMonth);
}

// Filter bets by selected month
async function filterByMonth() {
    const monthFilter = document.getElementById('month-filter').value;

    if (!monthFilter) {
        // Load all bets
        loadBets();
        return;
    }

    try {
        const response = await fetch('/api/bets');
        const allBets = await response.json();

        // Filter bets by selected month
        const filteredBets = allBets.filter(bet => {
            const date = new Date(bet.date);
            const betMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return betMonth === monthFilter;
        });

        renderBets(filteredBets);
    } catch (error) {
        console.error('Error filtering by month:', error);
    }
}

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for bets to load first
    setTimeout(initializeCharts, 500);
});
