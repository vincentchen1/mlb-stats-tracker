from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, timedelta
import requests
import os
import json

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///baseball_stats.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)

# MLB Stats API Base URL
MLB_API_BASE = 'https://statsapi.mlb.com/api/v1'

# Team logo URL generator
def get_team_logo_url(team_id):
    """Generate team logo URL from MLB team ID"""
    return f'https://www.mlbstatic.com/team-logos/{team_id}.svg'

# Database Models
class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    abbreviation = db.Column(db.String(10), nullable=False)
    city = db.Column(db.String(100), nullable=False)

class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    position = db.Column(db.String(20), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    batting_avg = db.Column(db.Float, default=0.0)
    era = db.Column(db.Float, default=0.0)
    team = db.relationship('Team', backref=db.backref('players', lazy=True))

class Game(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    home_team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    away_team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    home_score = db.Column(db.Integer, default=0)
    away_score = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='scheduled')
    home_team = db.relationship('Team', foreign_keys=[home_team_id])
    away_team = db.relationship('Team', foreign_keys=[away_team_id])

class PitcherBatterMatchup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pitcher_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    batter_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    at_bats = db.Column(db.Integer, default=0)
    hits = db.Column(db.Integer, default=0)
    home_runs = db.Column(db.Integer, default=0)
    strikeouts = db.Column(db.Integer, default=0)
    pitcher = db.relationship('Player', foreign_keys=[pitcher_id])
    batter = db.relationship('Player', foreign_keys=[batter_id])

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/matchup')
def matchup():
    return render_template('matchup.html')

@app.route('/api/teams')
def get_teams():
    return get_live_teams()

def get_live_teams():
    try:
        current_year = datetime.now().year

        # Fetch teams data
        url = f'{MLB_API_BASE}/teams?sportId=1'
        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            return get_fallback_teams()

        # Fetch standings data
        standings_response = requests.get(f'{MLB_API_BASE}/standings?leagueId=103,104&season={current_year}', timeout=10)
        standings_data = {}

        if standings_response.status_code == 200:
            standings_json = standings_response.json()

            # First pass: collect all teams with playoff spots
            playoff_teams = set()
            for record in standings_json.get('records', []):
                for team_record in record.get('teamRecords', []):
                    clinch_indicator = team_record.get('clinchIndicator', '')
                    if clinch_indicator in ['x', 'y', 'z', 'w']:
                        team_id = team_record.get('team', {}).get('id')
                        if team_id:
                            playoff_teams.add(team_id)

            # Second pass: determine status for all teams
            for record in standings_json.get('records', []):
                for team_record in record.get('teamRecords', []):
                    team_id = team_record.get('team', {}).get('id')
                    if team_id:
                        # Determine playoff status and display indicator
                        playoff_status = None
                        display_indicator = None
                        clinch_indicator = team_record.get('clinchIndicator', '')
                        wild_card_elim = team_record.get('wildCardEliminationNumber', '')
                        elim_number_sport = team_record.get('eliminationNumberSport', '')

                        if clinch_indicator == 'x':
                            playoff_status = 'Clinched Playoff Spot'
                            display_indicator = 'PO'
                        elif clinch_indicator == 'y':
                            playoff_status = 'Clinched Division'
                            display_indicator = 'DIV'
                        elif clinch_indicator == 'z':
                            playoff_status = 'Clinched Best Record'
                            display_indicator = 'BR'
                        elif clinch_indicator == 'w':
                            playoff_status = 'Clinched Wild Card'
                            display_indicator = 'WC'
                        elif clinch_indicator == 'e':
                            playoff_status = 'Eliminated from Playoffs'
                            display_indicator = 'E'
                        # Check if team is eliminated (wildCardEliminationNumber = 'E' or eliminationNumberSport = 'E')
                        elif not clinch_indicator and (wild_card_elim == 'E' or elim_number_sport == 'E'):
                            playoff_status = 'Eliminated from Playoffs'
                            display_indicator = 'E'
                            clinch_indicator = 'e'

                        standings_data[team_id] = {
                            'wins': team_record.get('wins', 0),
                            'losses': team_record.get('losses', 0),
                            'win_pct': team_record.get('winningPercentage', '.000'),
                            'games_back': team_record.get('gamesBack', '-'),
                            'division_rank': team_record.get('divisionRank', '-'),
                            'playoff_status': playoff_status,
                            'clinch_indicator': clinch_indicator,
                            'display_indicator': display_indicator
                        }

        data = response.json()
        teams = []

        # Team name normalization mapping with league/division
        team_name_map = {
            109: {'name': 'Diamondbacks', 'city': 'Arizona', 'league': 'National League', 'division': 'NL West'},
            144: {'name': 'Braves', 'city': 'Atlanta', 'league': 'National League', 'division': 'NL East'},
            110: {'name': 'Orioles', 'city': 'Baltimore', 'league': 'American League', 'division': 'AL East'},
            111: {'name': 'Red Sox', 'city': 'Boston', 'league': 'American League', 'division': 'AL East'},
            112: {'name': 'Cubs', 'city': 'Chicago', 'league': 'National League', 'division': 'NL Central'},
            145: {'name': 'White Sox', 'city': 'Chicago', 'league': 'American League', 'division': 'AL Central'},
            113: {'name': 'Reds', 'city': 'Cincinnati', 'league': 'National League', 'division': 'NL Central'},
            114: {'name': 'Guardians', 'city': 'Cleveland', 'league': 'American League', 'division': 'AL Central'},
            115: {'name': 'Rockies', 'city': 'Colorado', 'league': 'National League', 'division': 'NL West'},
            116: {'name': 'Tigers', 'city': 'Detroit', 'league': 'American League', 'division': 'AL Central'},
            117: {'name': 'Astros', 'city': 'Houston', 'league': 'American League', 'division': 'AL West'},
            118: {'name': 'Royals', 'city': 'Kansas City', 'league': 'American League', 'division': 'AL Central'},
            108: {'name': 'Angels', 'city': 'Los Angeles', 'league': 'American League', 'division': 'AL West'},
            119: {'name': 'Dodgers', 'city': 'Los Angeles', 'league': 'National League', 'division': 'NL West'},
            146: {'name': 'Marlins', 'city': 'Miami', 'league': 'National League', 'division': 'NL East'},
            158: {'name': 'Brewers', 'city': 'Milwaukee', 'league': 'National League', 'division': 'NL Central'},
            142: {'name': 'Twins', 'city': 'Minnesota', 'league': 'American League', 'division': 'AL Central'},
            121: {'name': 'Mets', 'city': 'New York', 'league': 'National League', 'division': 'NL East'},
            147: {'name': 'Yankees', 'city': 'New York', 'league': 'American League', 'division': 'AL East'},
            133: {'name': 'Athletics', 'city': '', 'league': 'American League', 'division': 'AL West'},
            143: {'name': 'Phillies', 'city': 'Philadelphia', 'league': 'National League', 'division': 'NL East'},
            134: {'name': 'Pirates', 'city': 'Pittsburgh', 'league': 'National League', 'division': 'NL Central'},
            135: {'name': 'Padres', 'city': 'San Diego', 'league': 'National League', 'division': 'NL West'},
            137: {'name': 'Giants', 'city': 'San Francisco', 'league': 'National League', 'division': 'NL West'},
            136: {'name': 'Mariners', 'city': 'Seattle', 'league': 'American League', 'division': 'AL West'},
            138: {'name': 'Cardinals', 'city': 'St. Louis', 'league': 'National League', 'division': 'NL Central'},
            139: {'name': 'Rays', 'city': 'Tampa Bay', 'league': 'American League', 'division': 'AL East'},
            140: {'name': 'Rangers', 'city': 'Texas', 'league': 'American League', 'division': 'AL West'},
            141: {'name': 'Blue Jays', 'city': 'Toronto', 'league': 'American League', 'division': 'AL East'},
            120: {'name': 'Nationals', 'city': 'Washington', 'league': 'National League', 'division': 'NL East'}
        }

        for team in data.get('teams', []):
            if team.get('sport', {}).get('id') == 1:  # MLB only
                team_id = team.get('id')

                # Use our normalized names if available, otherwise use API data
                if team_id in team_name_map:
                    normalized = team_name_map[team_id]
                    team_info = {
                        'id': team_id,
                        'name': normalized['name'],
                        'abbreviation': team.get('abbreviation', ''),
                        'city': normalized['city'],
                        'league': normalized['league'],
                        'division': normalized['division'],
                        'logo_url': get_team_logo_url(team_id)
                    }
                else:
                    team_info = {
                        'id': team_id,
                        'name': team.get('teamName', ''),
                        'abbreviation': team.get('abbreviation', ''),
                        'city': team.get('locationName', ''),
                        'league': 'Unknown',
                        'division': 'Unknown',
                        'logo_url': get_team_logo_url(team_id)
                    }

                # Add standings data if available
                if team_id in standings_data:
                    team_info.update(standings_data[team_id])

                teams.append(team_info)

        return jsonify(teams if teams else get_fallback_teams_data())

    except Exception as e:
        print(f"Error fetching live teams: {e}")
        return get_fallback_teams()

def get_fallback_teams():
    teams = Team.query.all()
    return jsonify([{
        'id': team.id,
        'name': team.name,
        'abbreviation': team.abbreviation,
        'city': team.city,
        'logo_url': get_team_logo_url(team.id)
    } for team in teams])

def get_fallback_teams_data():
    teams = [
        {'id': 109, 'name': 'Diamondbacks', 'abbreviation': 'ARI', 'city': 'Arizona'},
        {'id': 144, 'name': 'Braves', 'abbreviation': 'ATL', 'city': 'Atlanta'},
        {'id': 110, 'name': 'Orioles', 'abbreviation': 'BAL', 'city': 'Baltimore'},
        {'id': 111, 'name': 'Red Sox', 'abbreviation': 'BOS', 'city': 'Boston'},
        {'id': 112, 'name': 'Cubs', 'abbreviation': 'CHC', 'city': 'Chicago'},
        {'id': 145, 'name': 'White Sox', 'abbreviation': 'CWS', 'city': 'Chicago'},
        {'id': 113, 'name': 'Reds', 'abbreviation': 'CIN', 'city': 'Cincinnati'},
        {'id': 114, 'name': 'Guardians', 'abbreviation': 'CLE', 'city': 'Cleveland'},
        {'id': 115, 'name': 'Rockies', 'abbreviation': 'COL', 'city': 'Colorado'},
        {'id': 116, 'name': 'Tigers', 'abbreviation': 'DET', 'city': 'Detroit'},
        {'id': 117, 'name': 'Astros', 'abbreviation': 'HOU', 'city': 'Houston'},
        {'id': 118, 'name': 'Royals', 'abbreviation': 'KC', 'city': 'Kansas City'},
        {'id': 108, 'name': 'Angels', 'abbreviation': 'LAA', 'city': 'Los Angeles'},
        {'id': 119, 'name': 'Dodgers', 'abbreviation': 'LAD', 'city': 'Los Angeles'},
        {'id': 146, 'name': 'Marlins', 'abbreviation': 'MIA', 'city': 'Miami'},
        {'id': 158, 'name': 'Brewers', 'abbreviation': 'MIL', 'city': 'Milwaukee'},
        {'id': 142, 'name': 'Twins', 'abbreviation': 'MIN', 'city': 'Minnesota'},
        {'id': 121, 'name': 'Mets', 'abbreviation': 'NYM', 'city': 'New York'},
        {'id': 147, 'name': 'Yankees', 'abbreviation': 'NYY', 'city': 'New York'},
        {'id': 133, 'name': 'Athletics', 'abbreviation': 'OAK', 'city': 'Oakland'},
        {'id': 143, 'name': 'Phillies', 'abbreviation': 'PHI', 'city': 'Philadelphia'},
        {'id': 134, 'name': 'Pirates', 'abbreviation': 'PIT', 'city': 'Pittsburgh'},
        {'id': 135, 'name': 'Padres', 'abbreviation': 'SD', 'city': 'San Diego'},
        {'id': 137, 'name': 'Giants', 'abbreviation': 'SF', 'city': 'San Francisco'},
        {'id': 136, 'name': 'Mariners', 'abbreviation': 'SEA', 'city': 'Seattle'},
        {'id': 138, 'name': 'Cardinals', 'abbreviation': 'STL', 'city': 'St. Louis'},
        {'id': 139, 'name': 'Rays', 'abbreviation': 'TB', 'city': 'Tampa Bay'},
        {'id': 140, 'name': 'Rangers', 'abbreviation': 'TEX', 'city': 'Texas'},
        {'id': 141, 'name': 'Blue Jays', 'abbreviation': 'TOR', 'city': 'Toronto'},
        {'id': 120, 'name': 'Nationals', 'abbreviation': 'WSH', 'city': 'Washington'}
    ]
    for team in teams:
        team['logo_url'] = get_team_logo_url(team['id'])
    return teams

@app.route('/api/games/today')
def get_todays_games():
    return get_live_games()

def get_live_games():
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        url = f'{MLB_API_BASE}/schedule?sportId=1&date={today}&hydrate=venue,linescore,probablePitcher,seriesStatus,decisions,weather'
        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            return get_fallback_games()

        data = response.json()
        games = []

        if 'dates' in data and len(data['dates']) > 0:
            for date_data in data['dates']:
                for game in date_data.get('games', []):
                    home_team_data = game.get('teams', {}).get('home', {}).get('team', {})
                    away_team_data = game.get('teams', {}).get('away', {}).get('team', {})

                    home_team_id = home_team_data.get('id')
                    away_team_id = away_team_data.get('id')

                    # Get venue information
                    venue = game.get('venue', {})
                    venue_name = venue.get('name', 'TBD')

                    # Get game time in ISO format (let frontend handle timezone conversion)
                    game_date = game.get('gameDate', '')

                    # Get additional game information
                    status_detail = game.get('status', {}).get('detailedState', 'Scheduled')
                    inning = game.get('linescore', {}).get('currentInningOrdinal', '')
                    inning_state = game.get('linescore', {}).get('inningState', '')

                    # Get live play-by-play data if game is in progress
                    live_data = {}
                    if game.get('status', {}).get('statusCode') in ['I', 'IR', 'IT', 'IW']:
                        # Fetch live game feed for current at-bat information
                        game_pk = game.get('gamePk')
                        try:
                            live_feed_url = f'{MLB_API_BASE}/game/{game_pk}/feed/live'
                            live_response = requests.get(live_feed_url, timeout=10)
                            print(f"[LIVE FEED] Game {game_pk}: HTTP {live_response.status_code}")

                            if live_response.status_code == 200:
                                live_data_json = live_response.json()
                                live_play = live_data_json.get('liveData', {})
                                plays = live_play.get('plays', {})
                                current_play = plays.get('currentPlay', {})

                                print(f"[LIVE FEED] Game {game_pk}: currentPlay exists = {current_play is not None and len(current_play) > 0}")

                                if current_play:
                                    # Get count
                                    count = current_play.get('count', {})
                                    balls = count.get('balls', 0)
                                    strikes = count.get('strikes', 0)
                                    outs = count.get('outs', 0)

                                    # Get current batter
                                    matchup = current_play.get('matchup', {})
                                    batter_data = matchup.get('batter', {})
                                    batter_name = batter_data.get('fullName', '')
                                    batter_id = batter_data.get('id', 0)

                                    # Get current pitcher
                                    pitcher_data = matchup.get('pitcher', {})
                                    pitcher_name = pitcher_data.get('fullName', '')
                                    pitcher_id = pitcher_data.get('id', 0)

                                    if batter_name and pitcher_name:
                                        live_data = {
                                            'balls': balls,
                                            'strikes': strikes,
                                            'outs': outs,
                                            'current_batter': batter_name,
                                            'current_batter_id': batter_id,
                                            'current_pitcher': pitcher_name,
                                            'current_pitcher_id': pitcher_id
                                        }
                                        print(f"[LIVE FEED] Game {game_pk}: {pitcher_name} vs {batter_name}, Count: {balls}-{strikes}, Outs: {outs}")
                                    else:
                                        print(f"[LIVE FEED] Game {game_pk}: currentPlay exists but missing batter/pitcher data")
                                else:
                                    print(f"[LIVE FEED] Game {game_pk}: No currentPlay data (likely between innings)")
                            else:
                                print(f"[LIVE FEED] Game {game_pk}: API returned {live_response.status_code}")
                        except Exception as e:
                            print(f"[LIVE FEED ERROR] Game {game_pk}: {e}")
                            live_data = {}

                    # Get probable pitchers
                    home_pitcher = ''
                    away_pitcher = ''
                    if 'probablePitchers' in game:
                        home_pitcher_data = game['probablePitchers'].get('home', {})
                        away_pitcher_data = game['probablePitchers'].get('away', {})
                        home_pitcher = home_pitcher_data.get('fullName', '')
                        away_pitcher = away_pitcher_data.get('fullName', '')

                    # Get series information (for playoffs)
                    series_info = {}
                    if 'seriesStatus' in game:
                        series_status = game['seriesStatus']
                        winning_team = series_status.get('winningTeam', {})
                        losing_team = series_status.get('losingTeam', {})
                        winning_team_id = winning_team.get('id')

                        # Determine which team is home/away and their wins
                        if winning_team_id == home_team_id:
                            home_wins = series_status.get('wins', 0)
                            away_wins = series_status.get('losses', 0)
                        else:
                            away_wins = series_status.get('wins', 0)
                            home_wins = series_status.get('losses', 0)

                        series_info = {
                            'series_description': series_status.get('shortName', ''),
                            'series_result': series_status.get('result', ''),
                            'series_game_number': series_status.get('gameNumber', 0),
                            'games_needed': series_status.get('totalGames', 0),
                            'home_wins': home_wins,
                            'away_wins': away_wins,
                            'is_tied': series_status.get('isTied', False)
                        }

                    # Get weather information
                    weather_info = {}
                    if 'weather' in game:
                        weather_data = game['weather']
                        weather_info = {
                            'condition': weather_data.get('condition', 'Unknown'),
                            'temp': weather_data.get('temp', 'N/A'),
                            'wind': weather_data.get('wind', 'N/A')
                        }

                    # Calculate win probability
                    home_score = game.get('teams', {}).get('home', {}).get('score', 0) or 0
                    away_score = game.get('teams', {}).get('away', {}).get('score', 0) or 0
                    game_status = get_game_status(game.get('status', {}))

                    win_probability = calculate_win_probability(
                        home_score,
                        away_score,
                        inning if inning else '1st',
                        inning_state if inning_state else 'Top',
                        game_status
                    )

                    game_info = {
                        'id': game.get('gamePk'),
                        'home_team': home_team_data.get('name', 'TBD'),
                        'away_team': away_team_data.get('name', 'TBD'),
                        'home_team_logo': get_team_logo_url(home_team_id) if home_team_id else '',
                        'away_team_logo': get_team_logo_url(away_team_id) if away_team_id else '',
                        'home_score': home_score,
                        'away_score': away_score,
                        'status': game_status,
                        'status_detail': status_detail,
                        'venue': venue_name,
                        'game_date': game_date,
                        'inning': inning,
                        'inning_state': inning_state,
                        'home_pitcher': home_pitcher,
                        'away_pitcher': away_pitcher,
                        'series': series_info,
                        'live_data': live_data,
                        'weather': weather_info,
                        'win_probability': round(win_probability, 1)
                    }
                    games.append(game_info)

        return jsonify(games if games else get_fallback_games_data())

    except Exception as e:
        print(f"Error fetching live games: {e}")
        return get_fallback_games()

def calculate_win_probability(home_score, away_score, inning, inning_state, status):
    """
    Calculate win probability for home team based on game situation.
    Uses a simplified model based on score differential and inning.
    """
    if status == 'final':
        return 100.0 if home_score > away_score else 0.0

    if status == 'scheduled':
        return 50.0  # Pre-game is 50-50

    # Calculate score differential
    score_diff = home_score - away_score

    # Determine inning number
    try:
        inning_num = int(inning.replace('st', '').replace('nd', '').replace('rd', '').replace('th', ''))
    except:
        inning_num = 1

    # Calculate innings remaining (estimate based on inning and state)
    if inning_state == 'Top':
        innings_remaining = 9.5 - inning_num
    elif inning_state == 'Middle':
        innings_remaining = 9.25 - inning_num
    else:  # Bottom
        innings_remaining = 9.0 - inning_num

    if innings_remaining < 0:
        innings_remaining = 0

    # Base probability on score differential
    # Each run is worth approximately 15% per inning remaining
    base_prob = 50.0

    if innings_remaining > 0:
        # Adjust based on score differential and time remaining
        adjustment = score_diff * (15.0 / (1 + innings_remaining * 0.3))
        base_prob += adjustment
    else:
        # Final inning or extras
        if score_diff > 0:
            base_prob = 90.0 + min(score_diff * 2, 10.0)
        elif score_diff < 0:
            base_prob = 10.0 - min(abs(score_diff) * 2, 10.0)
        else:
            base_prob = 50.0

    # Late inning adjustments
    if inning_num >= 7:
        base_prob += score_diff * 5.0

    # Clamp between 0.1 and 99.9
    return max(0.1, min(99.9, base_prob))

def get_game_status(status_data):
    status_code = status_data.get('statusCode', 'S')
    if status_code in ['I', 'IR', 'IT', 'IW']:
        return 'live'
    elif status_code in ['F', 'FR', 'FT']:
        return 'final'
    else:
        return 'scheduled'

def get_fallback_games():
    today = datetime.now().date()
    games = Game.query.filter_by(date=today).all()
    return jsonify([{
        'id': game.id,
        'home_team': game.home_team.name,
        'away_team': game.away_team.name,
        'home_team_logo': get_team_logo_url(game.home_team_id),
        'away_team_logo': get_team_logo_url(game.away_team_id),
        'home_score': game.home_score,
        'away_score': game.away_score,
        'status': game.status
    } for game in games])

def get_fallback_games_data():
    return []

def get_position_sort_order(position):
    """Return sort order for baseball positions (1-9 defensive positions, then P, then DH/OF)"""
    position_order = {
        'P': 1,      # Pitcher
        'TWP': 2,    # Two-Way Player
        'Y': 2,      # Two-Way Player (alternate code)
        'C': 3,      # Catcher
        '1B': 4,     # First Base
        '2B': 5,     # Second Base
        '3B': 6,     # Third Base
        'SS': 7,     # Shortstop
        'LF': 8,     # Left Field
        'CF': 9,     # Center Field
        'RF': 10,    # Right Field
        'OF': 11,    # Outfield (generic)
        'DH': 12,    # Designated Hitter
        'IF': 13,    # Infield (generic)
        'UT': 14,    # Utility
        'PH': 15,    # Pinch Hitter
        'PR': 16,    # Pinch Runner
    }
    return position_order.get(position, 99)  # Unknown positions go to end

@app.route('/api/players/<int:team_id>')
def get_team_players(team_id):
    return get_live_team_players(team_id)

def get_live_team_players(team_id):
    try:
        # Get roster with current season stats in one call
        current_year = datetime.now().year
        url = f'{MLB_API_BASE}/teams/{team_id}/roster?rosterType=active&season={current_year}&hydrate=person(stats(type=season,season={current_year}))'
        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            return get_fallback_players(team_id)

        data = response.json()
        players = []

        for player_data in data.get('roster', []):
            player = player_data.get('person', {})
            player_id = player.get('id')
            position = player_data.get('position', {}).get('abbreviation', 'UNK')

            # Get stats from hydrated response
            batting_avg = 0.0
            era = 0.0

            # Check if stats are included in the response
            if 'stats' in player and player['stats']:
                for stat_group in player['stats']:
                    # Include pitching stats for pitchers (P) and two-way players (TWP/Y)
                    if stat_group.get('group', {}).get('displayName') == 'pitching' and position in ['P', 'TWP', 'Y']:
                        splits = stat_group.get('splits', [])
                        if splits and 'stat' in splits[0]:
                            stat = splits[0]['stat']
                            era_value = stat.get('era', '0.00')
                            era = float(era_value) if isinstance(era_value, (int, float)) else float(era_value) if era_value not in ['---', '.---'] else 0.0
                    # Include hitting stats for non-pitchers and two-way players
                    elif stat_group.get('group', {}).get('displayName') == 'hitting' and position not in ['P']:
                        splits = stat_group.get('splits', [])
                        if splits and 'stat' in splits[0]:
                            stat = splits[0]['stat']
                            avg_value = stat.get('avg', '.000')
                            batting_avg = float(avg_value) if isinstance(avg_value, (int, float)) else float(avg_value) if avg_value not in ['---', '.---'] else 0.0

            player_info = {
                'id': player_id,
                'name': player.get('fullName', ''),
                'position': position,
                'batting_avg': round(batting_avg, 3),
                'era': round(era, 2)
            }
            players.append(player_info)

        # Sort players by position
        players.sort(key=lambda p: get_position_sort_order(p['position']))

        return jsonify(players if players else get_fallback_players_data(team_id))

    except Exception as e:
        print(f"Error fetching live players: {e}")
        return get_fallback_players(team_id)

def get_fallback_players(team_id):
    players = Player.query.filter_by(team_id=team_id).all()
    player_list = [{
        'id': player.id,
        'name': player.name,
        'position': player.position,
        'batting_avg': player.batting_avg,
        'era': player.era
    } for player in players]

    # Sort players by position
    player_list.sort(key=lambda p: get_position_sort_order(p['position']))

    return jsonify(player_list)

def get_fallback_players_data(team_id):
    fallback_players = {
        147: [  # Yankees
            {'id': 592450, 'name': 'Aaron Judge', 'position': 'RF', 'batting_avg': 0.311, 'era': 0.0},
            {'id': 543037, 'name': 'Gerrit Cole', 'position': 'P', 'batting_avg': 0.0, 'era': 2.63}
        ],
        111: [  # Red Sox
            {'id': 646240, 'name': 'Rafael Devers', 'position': '3B', 'batting_avg': 0.272, 'era': 0.0}
        ]
    }
    return fallback_players.get(team_id, [])

@app.route('/api/matchup/<int:pitcher_id>/<int:batter_id>')
def get_matchup(pitcher_id, batter_id):
    """Get pitcher vs batter matchup stats from MLB Stats API"""
    try:
        # Get current year for up-to-date stats
        current_year = datetime.now().year

        # Try to get live matchup data from MLB Stats API - no season parameter gets career totals
        url = f'{MLB_API_BASE}/people/{batter_id}/stats?stats=vsPlayer&opposingPlayerId={pitcher_id}&group=hitting'
        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()

            # Parse the stats from the API response - look for vsPlayerTotal for career totals
            if 'stats' in data and len(data['stats']) > 0:
                # Find the vsPlayerTotal stat group (career totals through current season)
                for stat_group in data['stats']:
                    if stat_group.get('type', {}).get('displayName') == 'vsPlayerTotal':
                        if 'splits' in stat_group and len(stat_group['splits']) > 0:
                            stats = stat_group['splits'][0]['stat']

                            at_bats = stats.get('atBats', 0)
                            hits = stats.get('hits', 0)
                            avg = stats.get('avg', '0.000')
                            home_runs = stats.get('homeRuns', 0)
                            strikeouts = stats.get('strikeOuts', 0)
                            doubles = stats.get('doubles', 0)
                            triples = stats.get('triples', 0)
                            walks = stats.get('baseOnBalls', 0)
                            rbi = stats.get('rbi', 0)
                            total_bases = stats.get('totalBases', 0)
                            obp = stats.get('obp', '.000')
                            slg = stats.get('slg', '.000')
                            ops = stats.get('ops', '.000')

                            # Convert avg to float if it's a string
                            if isinstance(avg, str):
                                avg = float(avg) if avg not in ['---', '.---'] else 0.0

                            return jsonify({
                                'at_bats': at_bats,
                                'hits': hits,
                                'avg': round(avg, 3),
                                'home_runs': home_runs,
                                'strikeouts': strikeouts,
                                'doubles': doubles,
                                'triples': triples,
                                'walks': walks,
                                'rbi': rbi,
                                'total_bases': total_bases,
                                'obp': obp,
                                'slg': slg,
                                'ops': ops
                            })

        # If live API fails or no data, try database fallback
        matchup = PitcherBatterMatchup.query.filter_by(
            pitcher_id=pitcher_id,
            batter_id=batter_id
        ).first()

        if matchup:
            avg = matchup.hits / matchup.at_bats if matchup.at_bats > 0 else 0
            return jsonify({
                'at_bats': matchup.at_bats,
                'hits': matchup.hits,
                'avg': round(avg, 3),
                'home_runs': matchup.home_runs,
                'strikeouts': matchup.strikeouts
            })
        else:
            return jsonify({'message': 'No matchup data found'}), 404

    except Exception as e:
        print(f"Error fetching matchup data: {e}")
        return jsonify({'message': 'No matchup data found'}), 404

@app.route('/api/game/<int:game_id>/lineups')
def get_game_lineups(game_id):
    """Get starting lineups for a specific game"""
    try:
        url = f'{MLB_API_BASE}/game/{game_id}/boxscore'
        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            return jsonify({'message': 'Lineup data not available'}), 404

        data = response.json()
        teams = data.get('teams', {})

        lineups = {
            'home': [],
            'away': []
        }

        # Process home team
        if 'home' in teams:
            home_team = teams['home']
            batting_order = home_team.get('battingOrder', [])
            players = home_team.get('players', {})

            for i, player_id in enumerate(batting_order[:9], 1):  # First 9 batters
                player_key = f'ID{player_id}'
                if player_key in players:
                    player = players[player_key]
                    person = player.get('person', {})
                    position = player.get('position', {})

                    lineups['home'].append({
                        'order': i,
                        'name': person.get('fullName', 'Unknown'),
                        'id': player_id,
                        'position': position.get('abbreviation', ''),
                        'jersey_number': player.get('jerseyNumber', '')
                    })

        # Process away team
        if 'away' in teams:
            away_team = teams['away']
            batting_order = away_team.get('battingOrder', [])
            players = away_team.get('players', {})

            for i, player_id in enumerate(batting_order[:9], 1):  # First 9 batters
                player_key = f'ID{player_id}'
                if player_key in players:
                    player = players[player_key]
                    person = player.get('person', {})
                    position = player.get('position', {})

                    lineups['away'].append({
                        'order': i,
                        'name': person.get('fullName', 'Unknown'),
                        'id': player_id,
                        'position': position.get('abbreviation', ''),
                        'jersey_number': player.get('jerseyNumber', '')
                    })

        return jsonify(lineups)

    except Exception as e:
        print(f"Error fetching lineup data: {e}")
        return jsonify({'message': 'Lineup data not available'}), 404

def initialize_sample_data():
    if Team.query.count() == 0:
        # Sample teams - all 30 MLB teams
        teams_data = [
            {'name': 'Diamondbacks', 'abbreviation': 'ARI', 'city': 'Arizona'},
            {'name': 'Braves', 'abbreviation': 'ATL', 'city': 'Atlanta'},
            {'name': 'Orioles', 'abbreviation': 'BAL', 'city': 'Baltimore'},
            {'name': 'Red Sox', 'abbreviation': 'BOS', 'city': 'Boston'},
            {'name': 'Cubs', 'abbreviation': 'CHC', 'city': 'Chicago'},
            {'name': 'White Sox', 'abbreviation': 'CWS', 'city': 'Chicago'},
            {'name': 'Reds', 'abbreviation': 'CIN', 'city': 'Cincinnati'},
            {'name': 'Guardians', 'abbreviation': 'CLE', 'city': 'Cleveland'},
            {'name': 'Rockies', 'abbreviation': 'COL', 'city': 'Colorado'},
            {'name': 'Tigers', 'abbreviation': 'DET', 'city': 'Detroit'},
            {'name': 'Astros', 'abbreviation': 'HOU', 'city': 'Houston'},
            {'name': 'Royals', 'abbreviation': 'KC', 'city': 'Kansas City'},
            {'name': 'Angels', 'abbreviation': 'LAA', 'city': 'Los Angeles'},
            {'name': 'Dodgers', 'abbreviation': 'LAD', 'city': 'Los Angeles'},
            {'name': 'Marlins', 'abbreviation': 'MIA', 'city': 'Miami'},
            {'name': 'Brewers', 'abbreviation': 'MIL', 'city': 'Milwaukee'},
            {'name': 'Twins', 'abbreviation': 'MIN', 'city': 'Minnesota'},
            {'name': 'Mets', 'abbreviation': 'NYM', 'city': 'New York'},
            {'name': 'Yankees', 'abbreviation': 'NYY', 'city': 'New York'},
            {'name': 'Athletics', 'abbreviation': 'OAK', 'city': 'Oakland'},
            {'name': 'Phillies', 'abbreviation': 'PHI', 'city': 'Philadelphia'},
            {'name': 'Pirates', 'abbreviation': 'PIT', 'city': 'Pittsburgh'},
            {'name': 'Padres', 'abbreviation': 'SD', 'city': 'San Diego'},
            {'name': 'Giants', 'abbreviation': 'SF', 'city': 'San Francisco'},
            {'name': 'Mariners', 'abbreviation': 'SEA', 'city': 'Seattle'},
            {'name': 'Cardinals', 'abbreviation': 'STL', 'city': 'St. Louis'},
            {'name': 'Rays', 'abbreviation': 'TB', 'city': 'Tampa Bay'},
            {'name': 'Rangers', 'abbreviation': 'TEX', 'city': 'Texas'},
            {'name': 'Blue Jays', 'abbreviation': 'TOR', 'city': 'Toronto'},
            {'name': 'Nationals', 'abbreviation': 'WSH', 'city': 'Washington'}
        ]

        for team_data in teams_data:
            team = Team(**team_data)
            db.session.add(team)

        db.session.commit()

        # Sample players
        players_data = [
            {'name': 'Aaron Judge', 'position': 'OF', 'team_id': 1, 'batting_avg': 0.311},
            {'name': 'Gerrit Cole', 'position': 'P', 'team_id': 1, 'era': 2.63},
            {'name': 'Rafael Devers', 'position': '3B', 'team_id': 2, 'batting_avg': 0.272},
            {'name': 'Chris Sale', 'position': 'P', 'team_id': 2, 'era': 3.58},
            {'name': 'Mookie Betts', 'position': 'OF', 'team_id': 3, 'batting_avg': 0.307},
            {'name': 'Walker Buehler', 'position': 'P', 'team_id': 3, 'era': 3.26}
        ]

        for player_data in players_data:
            player = Player(**player_data)
            db.session.add(player)

        db.session.commit()

        # Sample games for today
        today = datetime.now().date()
        games_data = [
            {'date': today, 'home_team_id': 1, 'away_team_id': 2, 'status': 'scheduled'},
            {'date': today, 'home_team_id': 3, 'away_team_id': 4, 'status': 'scheduled'}
        ]

        for game_data in games_data:
            game = Game(**game_data)
            db.session.add(game)

        db.session.commit()

        # Sample matchup data
        matchups_data = [
            {'pitcher_id': 2, 'batter_id': 3, 'at_bats': 15, 'hits': 4, 'home_runs': 1, 'strikeouts': 6},
            {'pitcher_id': 4, 'batter_id': 1, 'at_bats': 12, 'hits': 3, 'home_runs': 2, 'strikeouts': 4}
        ]

        for matchup_data in matchups_data:
            matchup = PitcherBatterMatchup(**matchup_data)
            db.session.add(matchup)

        db.session.commit()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        initialize_sample_data()

    # Get port from environment variable for production (Render, etc.)
    port = int(os.environ.get('PORT', 5000))
    # Only use debug mode in local development
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    app.run(debug=debug, host='0.0.0.0', port=port)