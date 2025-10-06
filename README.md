# ⚾ MLB Baseball Statistics Tracker

A full-stack web application for tracking MLB baseball statistics and analyzing pitcher vs batter matchups with Bootstrap frontend and Python Flask backend.

## Features

- **Today's Games**: View today's MLB games with scores and status
- **Pitcher vs Batter Matchups**: Compare historical performance between pitchers and batters
- **Team Information**: Browse MLB teams and their players
- **Player Statistics**: View batting averages and ERA statistics
- **Responsive Design**: Bootstrap-powered responsive UI

## Project Structure

```
baseball-stats-app/
├── backend/
│   ├── app.py              # Flask application with API endpoints
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── templates/
│   │   └── index.html     # Main HTML template
│   └── static/
│       ├── css/
│       │   └── styles.css # Custom styles
│       ├── js/
│       │   └── app.js     # JavaScript functionality
│       └── images/        # Static images
└── data/                  # Database storage
```

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Navigate to the baseball-stats-app directory:**
   ```bash
   cd baseball-stats-app
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv

   # On Windows:
   venv\Scripts\activate

   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```

5. **Open your browser and visit:**
   ```
   http://localhost:5000
   ```

## API Endpoints

- `GET /` - Main application page
- `GET /api/teams` - Get all MLB teams
- `GET /api/games/today` - Get today's games
- `GET /api/players/<team_id>` - Get players for a specific team
- `GET /api/matchup/<pitcher_id>/<batter_id>` - Get pitcher vs batter matchup stats

## Technology Stack

### Backend
- **Flask** - Python web framework
- **SQLAlchemy** - Database ORM
- **SQLite** - Database
- **Flask-CORS** - Cross-origin resource sharing

### Frontend
- **Bootstrap 5** - CSS framework
- **JavaScript (ES6+)** - Dynamic functionality
- **HTML5** - Markup
- **CSS3** - Custom styling

## Sample Data

The application comes with sample data including:
- 4 MLB teams (Yankees, Red Sox, Dodgers, Giants)
- Sample players with positions and statistics
- Today's scheduled games
- Historical pitcher vs batter matchup data

## Features in Detail

### Today's Games
- Displays games scheduled for the current date
- Shows team names, scores, and game status
- Real-time updates for live games

### Pitcher vs Batter Matchups
- Select teams and players from dropdown menus
- View historical statistics between specific pitcher-batter pairs
- Statistics include: At Bats, Hits, Batting Average, Home Runs, Strikeouts

### Team Management
- Browse all MLB teams
- View team rosters with player positions
- Display player statistics (batting average for hitters, ERA for pitchers)

## Customization

### Adding More Teams/Players
Edit the `initialize_sample_data()` function in `backend/app.py` to add more teams, players, and matchup data.

### Styling
Modify `frontend/static/css/styles.css` to customize the appearance.

### API Integration
The app is structured to easily integrate with real MLB APIs by replacing the sample data initialization with API calls.

## Development

To extend the application:

1. **Add new API endpoints** in `backend/app.py`
2. **Create new database models** using SQLAlchemy
3. **Update frontend** by modifying templates and JavaScript
4. **Add new features** by following the existing patterns

## Troubleshooting

- **Port 5000 already in use**: Change the port in `app.py`: `app.run(debug=True, port=5001)`
- **Database issues**: Delete the database file in the data directory to reset
- **Import errors**: Make sure all dependencies are installed with `pip install -r requirements.txt`

## License

This project is open source and available under the MIT License.