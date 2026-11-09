# Assumptions

Where the brief was not explicit, this is what I assumed and why.

## Identity

- **The student is identified only by `X-Student-Id`** (17-digit birth registration number).
  There is no login, as the brief says. It must be exactly 17 ASCII digits; anything else is
  `400`. The UI also accepts Bangla digits (`০-৯`) and spaces or dashes and normalises them
  before sending, because parents often type it that way.
- **The admin screen is not protected.** The brief says "no login", so anyone can create a
  class. In a real deployment this screen would sit behind authentication.

## Classes

- **Every shift is its own class** (`Class 6 - Morning Shift`, `Class 6 - Day Shift`), with its
  own seat count, as the brief describes. There is no separate "shift" entity.
- **Duplicate class names are allowed.** Two classes may share a name, and the id tells them
  apart. Rejecting duplicates could break automated tests that create the example class
  repeatedly.
- **Limits:** name 1–100 characters (trimmed); `totalSeats` a whole number from 1 to 10 000.
  Strings, fractions, negatives and missing fields are `400`.
- Classes cannot be edited or deleted. The brief has no endpoint for it, and changing seats
  under live holds would need its own rules.
