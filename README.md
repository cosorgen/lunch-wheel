# Lunch Wheel 🍽️

A fun "wheel of fortune" style web app to decide where your team eats lunch. Spins once per day and remembers previous picks to avoid repeats!

## Features

- 🎡 Interactive spinning wheel animation
- 📅 One spin per day (prevents re-spins)
- 🔄 Avoids yesterday's lunch spot
- 📜 Shows recent pick history
- 🌙 Automatic light/dark mode support
- 💾 Supabase backend for persistence

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once your project is ready, go to **Settings > API** to get your:
   - Project URL
   - Anon/Public key

### 2. Create Database Table

In your Supabase dashboard, go to **SQL Editor** and run:

```sql
-- Create the lunch picks table
CREATE TABLE lunch_picks (
    id BIGSERIAL PRIMARY KEY,
    pick_date DATE NOT NULL UNIQUE,
    spot_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster date lookups
CREATE INDEX idx_lunch_picks_date ON lunch_picks(pick_date DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE lunch_picks ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (adjust as needed)
CREATE POLICY "Allow all operations" ON lunch_picks
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### 3. Configure the App

Edit `app.js` and update these values at the top:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 4. Customize Lunch Spots

Edit the `LUNCH_SPOTS` array in `app.js` to include your campus lunch options:

```javascript
const LUNCH_SPOTS = [
  'The Grill',
  'Pasta Place',
  'Sushi Bar',
  // Add your spots here!
];
```

### 5. Run the App

You can serve the app with any static file server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js (npx)
npx serve

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## How It Works

1. **Daily Spin**: Each day, one person can spin the wheel to pick today's lunch spot
2. **No Repeats**: Yesterday's pick is excluded from the wheel
3. **Persistence**: All picks are stored in Supabase, so everyone sees the same result
4. **History**: View the past week's picks at the bottom of the page

## File Structure

```
lunch-game/
├── index.html    # Main HTML structure
├── styles.css    # Styling with CSS custom properties
├── app.js        # Minimal JavaScript for Supabase + wheel logic
└── README.md     # This file
```

## Browser Support

Uses modern web features:

- CSS Custom Properties
- `prefers-color-scheme` media query
- Popover API (HTML attribute `popover`)
- ES6+ JavaScript

Works in all modern browsers (Chrome, Firefox, Safari, Edge).

## License

MIT - Use it however you like!
