
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

const GOOGLE_REDIRECT_URI =
 "https://round-lab-f54f.psanchesnle.workers.dev/api/auth/google/callback";

function googleCalendarConfigured(env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.CALENDAR_SESSION_SECRET &&
    env.Memory
  );
}

export {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_REDIRECT_URI,
  googleCalendarConfigured
};
