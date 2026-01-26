# Lunch Wheel 🍽️

A fun "wheel of fortune" style web app to decide where your team eats lunch. Spins once per day and remembers previous picks to avoid repeats!

## Features

- 🎡 Interactive spinning wheel animation
- 👥 Create/select a group (each group gets its own daily spin)
- 📅 One spin per day per group (prevents re-spins)
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
    group_name TEXT NOT NULL,
    pick_date DATE NOT NULL,
    spot_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One pick per day, per group
CREATE UNIQUE INDEX lunch_picks_group_date_unique
  ON lunch_picks (group_name, pick_date);

-- Create index for faster date lookups
CREATE INDEX idx_lunch_picks_group_date ON lunch_picks(group_name, pick_date DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE lunch_picks ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (adjust as needed)
CREATE POLICY "Allow all operations" ON lunch_picks
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

If you already created the older single-group table, migrate it like this:

```sql
ALTER TABLE lunch_picks ADD COLUMN IF NOT EXISTS group_name TEXT;
UPDATE lunch_picks SET group_name = 'Default' WHERE group_name IS NULL;
ALTER TABLE lunch_picks ALTER COLUMN group_name SET NOT NULL;

-- Drop the old unique constraint on pick_date if it exists
DROP INDEX IF EXISTS idx_lunch_picks_date;
DROP INDEX IF EXISTS lunch_picks_pick_date_key;

-- Add the per-group unique index
CREATE UNIQUE INDEX IF NOT EXISTS lunch_picks_group_date_unique
  ON lunch_picks (group_name, pick_date);

CREATE INDEX IF NOT EXISTS idx_lunch_picks_group_date
  ON lunch_picks (group_name, pick_date DESC);
```

### 3. Configure the App

Edit `app.js` and update these values at the top:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 4. Customize Lunch Spots

Edit the `DEFAULT_LUNCH_SPOTS` array in `app.js` to include your campus lunch options:

```javascript
const DEFAULT_LUNCH_SPOTS = [
  { name: 'The Grill', location: 'Food Hall' },
  { name: 'Pasta Place', location: 'Building 2' },
  { name: 'Sushi Bar', location: 'Food Hall' },
];
```

Each group can also manage its own spots in-app via the "Groups & Spots" button (stored in the browser’s local storage).

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

1. **Group Daily Spin**: Each group gets one spin per day
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
