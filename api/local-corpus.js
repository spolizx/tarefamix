const docs = [
  {
    id: 'tarefamix-overview',
    title: 'TarefaMix overview',
    content: `TarefaMix is a study and productivity organizer for school tasks and routines. It includes a planner, calendar, notes, reminders, focus timer, study assistant, educational games, and music controls. The app stores user data in the browser localStorage for a simple local-first experience.`
  },
  {
    id: 'auth-guide',
    title: 'Authentication guide',
    content: `Authentication is handled by the local front-end flow in auth.js. Users can sign in with email and password or continue with Google. The app is designed for local storage and device-first offline behavior. More advanced backend auth or multi-device sync can be layered later.`
  },
  {
    id: 'study-assistant',
    title: 'Study assistant capabilities',
    content: `The study assistant answers vocabulary, math, geometry, science, and general homework questions. It has a local rules engine for calculations and a fallback to AI when needed. Questions can be about fractions, percentages, geometry, independence of Brazil, photosynthesis, multiplication, and general study topics.`
  },
  {
    id: 'music-system',
    title: 'Music and audio system',
    content: `The music system supports ambient tones and noise generation using WebAudio. It has a local playlist, upload of multiple audio files, drag-and-drop support, import of .m3u lists, and an optional YouTube mode. For privacy and anti-ad experience, the app supports a no-ads mode that disables YouTube content and uses local files only.`
  },
  {
    id: 'games',
    title: 'Educational games',
    content: `The educational games page contains math practice drills for addition, subtraction, multiplication, division, and mixed exercises. It stores best scores in localStorage and is meant to be lightweight, fast, and browser-based.`
  },
  {
    id: 'reminders',
    title: 'Reminders and focus timer',
    title: 'Reminders and focus timer',
    content: `The reminder system allows daily study reminders based on a selected time. The focus timer supports duration presets and can be started and paused while the page stays open. Notifications are local and browser-based.`
  }
];

module.exports = { docs };
