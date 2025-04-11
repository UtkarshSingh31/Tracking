from flask import Flask, request, jsonify # type: ignore
from flask_cors import CORS # type: ignore
import sqlite3
from datetime import datetime, timedelta
import csv
import os

app = Flask(__name__)
CORS(app)

# Configuration
USER_DB = os.path.join(os.getcwd(), 'user.db')
LOG_FILE = os.path.join(os.getcwd(), 'student_activity.csv')
os.environ['TZ'] = 'Asia/Kolkata'  # IST timezone

def init_user_db():
    """Initialize database for user credentials"""
    conn = sqlite3.connect(USER_DB)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (user_id TEXT PRIMARY KEY, 
                  email TEXT NOT NULL)''')
    conn.commit()
    conn.close()

def convert_to_ist(utc_time):
    """Convert UTC to Indian Standard Time (UTC+5:30)"""
    try:
        if utc_time in ["Unknown", "In Progress", None]:
            return utc_time
            
        dt = datetime.fromisoformat(utc_time.replace('Z', '+00:00'))
        return (dt + timedelta(hours=5, minutes=30)).isoformat()
    except Exception as e:
        print(f"Time conversion error: {e}")
        return utc_time

@app.route("/save-credentials", methods=["POST"])
def save_credentials():
    """Save user credentials to SQLite database"""
    try:
        data = request.json
        user_id = data.get('user_id')
        email = data.get('email')
        
        if not user_id or not email:
            return jsonify({"error": "Missing user_id or email"}), 400

        conn = sqlite3.connect(USER_DB)
        c = conn.cursor()
        c.execute('''INSERT OR REPLACE INTO users 
                     VALUES (?, ?)''', (user_id, email))
        conn.commit()
        conn.close()
        
        return jsonify({"message": "Credentials saved successfully"}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get-email", methods=["GET"])
def get_email():
    user_id = request.args.get('user_id')
    conn = sqlite3.connect(USER_DB)
    c = conn.cursor()
    c.execute('SELECT email FROM users WHERE user_id = ?', (user_id,))
    result = c.fetchone()
    conn.close()
    return jsonify({"email": result[0] if result else ""})

@app.route("/log-activity", methods=["POST"])
def log_activity():
    """Log activity to CSV file with database-linked email"""
    try:
        data = request.json
        user_id = data.get('user_id')
        
        # Get email from database
        email = "Unknown"
        if user_id:
            conn = sqlite3.connect(USER_DB)
            c = conn.cursor()
            c.execute('''SELECT email FROM users WHERE user_id = ?''', (user_id,))
            result = c.fetchone()
            email = result[0] if result else "Unknown"
            conn.close()

        # Prepare CSV data
        csv_data = {
            'user_id': user_id or "Unknown",
            'email': email,
            'url': data.get('url', 'Unknown'),
            'start_time': convert_to_ist(data.get('start_time', 'Unknown')),
            'end_time': convert_to_ist(data.get('end_time', 'In Progress')),
            'activity_type': data.get('activity_type', 'Unknown')
        }

        # Write to CSV
        file_exists = os.path.isfile(LOG_FILE)
        with open(LOG_FILE, 'a', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=csv_data.keys())
            if not file_exists:
                writer.writeheader()
            writer.writerow(csv_data)

        return jsonify({"message": "Activity logged successfully"}), 200

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    if not os.path.exists(USER_DB):
        init_user_db()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))