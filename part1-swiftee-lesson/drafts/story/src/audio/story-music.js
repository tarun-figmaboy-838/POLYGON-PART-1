/* STORY MUSIC — the Momo + Polo story's background music, as a drop-in player.

   One music file holds five sections, one per mood. The player crossfades from one
   section to the next instead of restarting anything, loops four of them seamlessly,
   plays the last one once, and dips the music while a voice is speaking. This is the
   story's own music graph (src/story/story-intro.js: createAudio, A.mood, A.duck,
   A.fadeOut), taken out on its own.

     var music = StoryMusic.create({ src: 'story-music' });   // no extension: .ogg, else .mp3
     playButton.onclick = function () {
       music.unlock();           // inside a tap: browsers only allow sound after one
       music.mood('warm');       // starts once the file has loaded
     };
     music.mood('tension');      // later: crossfade to another section
     music.duck(true);           // a voice line starts: the music dips
     music.duck(false);          // ...and comes back when it ends
     music.fadeOut(1.2);         // the end: fade everything out over 1.2 s
     music.stop();               // stop and free the audio

   OPTIONS (all optional)
     src        the file's path without its extension (default 'story-music')
     sections   the section table (default: SECTIONS below, the story's own)
     level      how loud the music bed is, 0 to 1 (default 0.12: a bed under voices)
     duck       the music's level while a voice speaks, as a share of normal (0.55)
     context    an AudioContext to play through, if your page already has one
     output     an AudioNode to play into instead of the speakers (a game's music bus, so its
                mute button, its dip under voices and its hidden-tab pause reach the music too)
     url        the exact file to fetch first (a copy already held in memory, say); the
                src + extension rules still apply if it will not load or decode

   Every call is safe at any time: mood() before the file has loaded is kept and
   played when it arrives, and without Web Audio or with no file every call does
   nothing and the page carries on silently. */
(function () {
  'use strict';

  /* The sections, in seconds of story-music.ogg / .mp3, as tools/story/build-story-music.cjs
     writes them. `gain` and `cutoff` shape each mood's level and brightness. */
  var SECTIONS = {
    warm:    { start: 0,  end: 24,   loop: true,  gain: 1,   cutoff: 12000 },  // curious music box over a soft pad
    playful: { start: 24, end: 36,   loop: true,  gain: 1,   cutoff: 12000 },  // the same chords, plucked, livelier
    tension: { start: 36, end: 48,   loop: true,  gain: 1.1, cutoff: 9000 },   // a minor turn, a low pulse
    hush:    { start: 48, end: 60,   loop: true,  gain: 0.7, cutoff: 4200 },   // one quiet chord, a falling line
    resolve: { start: 60, end: 76.5, loop: false, gain: 1,   cutoff: 12000 }   // the melody comes home, once
  };
  var DUCK_SECONDS = 0.28;

  function preferredExt() {
    try {
      var a = document.createElement('audio');
      return a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp3';
    } catch (e) { return 'mp3'; }
  }

  function create(opts) {
    opts = opts || {};
    var sections = opts.sections || SECTIONS;
    var level = opts.level == null ? 0.12 : opts.level;
    var duckLevel = opts.duck == null ? 0.55 : opts.duck;
    var src = opts.src || 'story-music';
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var noop = function () {};
    var silent = { unlock: noop, mood: noop, duck: noop, fadeOut: noop, stop: noop, ready: Promise.resolve(false),
      state: function () { return { loaded: false, section: null, audio: 'none' }; } };
    if (!Ctx && !opts.context) return silent;

    var ctx;
    try { ctx = opts.context || new Ctx(); } catch (e) { return silent; }
    var own = !opts.context;

    /* section sources -> mood filter -> mood level -> duck -> master -> limiter -> out */
    var master = ctx.createGain(); master.gain.value = 0.9;
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 10;
    limiter.ratio.value = 6; limiter.attack.value = 0.004; limiter.release.value = 0.2;
    master.connect(limiter); limiter.connect(opts.output || ctx.destination);
    var duckGain = ctx.createGain(); duckGain.gain.value = 1; duckGain.connect(master);
    var moodGain = ctx.createGain(); moodGain.gain.value = 0; moodGain.connect(duckGain);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.Q.value = 0.5; filter.frequency.value = 12000;
    filter.connect(moodGain);

    var buffer = null, section = null, current = null, currentGain = null, wanted = null, stopped = false, ext = preferredExt();

    function ramp(param, value, seconds) {
      var now = ctx.currentTime;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + seconds);
    }
    function decode(ab) {
      return new Promise(function (resolve, reject) {
        var p = ctx.decodeAudioData(ab, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      });
    }
    function get(e) {
      return fetch(src + '.' + e).then(function (r) {
        if (!r.ok) throw new Error(src + '.' + e + ' ' + r.status);
        return r.arrayBuffer();
      }).then(decode);
    }
    /* the Ogg first where it plays; if it will not decode here, the MP3 */
    var first = opts.url
      ? function () { return fetch(opts.url).then(function (r) { if (!r.ok) throw new Error(opts.url + ' ' + r.status); return r.arrayBuffer(); }).then(decode).catch(function () { return get(ext); }); }
      : function () { return get(ext); };
    var ready = (window.fetch ? first().catch(function (err) { if (ext === 'mp3') throw err; ext = 'mp3'; return get('mp3'); })
      : Promise.reject(new Error('no fetch')))
      .then(function (b) { buffer = b; if (wanted && !stopped) play(wanted); return true; })
      .catch(function (err) { if (window.console) console.warn('[story-music] no music:', err && err.message); return false; });

    /* ONE SECTION AT A TIME: the one playing fades out as the next fades in, from its start;
       level and brightness glide to the new mood. A tense turn is quicker (0.7 s). */
    function play(name) {
      var cfg = sections[name];
      if (!cfg || !buffer || stopped || section === name) return;
      section = name;
      var now = ctx.currentTime, fade = name === 'tension' ? 0.7 : 1.4;
      if (current) {
        currentGain.gain.cancelScheduledValues(now);
        currentGain.gain.setValueAtTime(currentGain.gain.value, now);
        currentGain.gain.linearRampToValueAtTime(0, now + fade);
        try { current.stop(now + fade + 0.05); } catch (e) {}
      }
      var s = ctx.createBufferSource();
      s.buffer = buffer;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + fade);
      s.connect(g); g.connect(filter);
      if (cfg.loop) { s.loop = true; s.loopStart = cfg.start; s.loopEnd = cfg.end; s.start(now, cfg.start); }
      else s.start(now, cfg.start, cfg.end - cfg.start);
      current = s; currentGain = g;
      ramp(moodGain.gain, level * (cfg.gain || 1), fade);
      ramp(filter.frequency, cfg.cutoff || 12000, fade);
    }

    return {
      /** Call inside a tap or click: it lets the page make sound. */
      unlock: function () {
        try { ctx.resume(); } catch (e) {}
        try { var b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
      },
      /** Crossfade to a section: 'warm', 'playful', 'tension', 'hush' or 'resolve'. */
      mood: function (name) { wanted = name; play(name); },
      /** true while a voice speaks (the music dips), false when it ends. */
      duck: function (down) { ramp(duckGain.gain, down ? duckLevel : 1, DUCK_SECONDS); },
      /** Fade the music out over `seconds` (default 1.2). */
      fadeOut: function (seconds) { ramp(moodGain.gain, 0, seconds == null ? 1.2 : seconds); },
      /** Stop at once and free the audio. */
      stop: function () {
        stopped = true;
        if (current) { try { current.stop(); } catch (e) {} }
        current = null; section = null;
        try { master.disconnect(); } catch (e) {}
        if (own) { try { ctx.close(); } catch (e) {} }
      },
      /** Resolves true once the music has loaded, false if it could not. */
      ready: ready,
      /** What is playing: for a debug readout or a test. */
      state: function () { return { loaded: !!buffer, section: section, format: ext, audio: ctx.state }; },
      context: ctx
    };
  }

  /** 'ogg' or 'mp3': the file this browser will play (for a loading bar that fetches only it). */
  window.StoryMusic = { create: create, SECTIONS: SECTIONS, ext: preferredExt };
})();
