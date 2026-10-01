/*
 * Rhyme Kingdom: story, characters and the build list.
 * Dialog lines are short so they read well on a phone.
 */
(function (root) {
  'use strict';

  const CAST = {
    kingFlow: { name: 'King Flow', role: 'King of the Mic', color: '#7b2cff' },
    queenCadence: { name: 'Queen Cadence', role: 'Voice of the Kingdom', color: '#ff3b5c' },
    djDuchess: { name: 'DJ Duchess', role: 'Keeper of the Decks', color: '#19d3c5' },
    princeBreaks: { name: 'Prince Breaks', role: 'Heir to the Floor', color: '#ff4a3d' },
    countessCanvas: { name: 'Countess Canvas', role: 'Royal Painter of the Wall', color: '#ff9a3c' },
    griot: { name: 'The Griot', role: 'Keeper of Knowledge', color: '#ffb100' },
    buzzkill: { name: 'Baron Buzzkill', role: 'Static’s Right-Hand Speaker', color: '#8e88a8', villain: true },
    lipsync: { name: 'Lady Lip-Sync', role: 'The Rhyme Biter', color: '#ff7ac8', villain: true },
    static: { name: 'King Static', role: 'Lord of Noise', color: '#9b1dff', villain: true },
  };

  // One chapter per area of the Block. Levels are 1-based and inclusive.
  const CHAPTERS = [
    { n: 1, title: 'The Block Party', host: 'kingFlow', from: 1, to: 5, track: 'block', bg: 'block' },
    { n: 2, title: 'The Record Shop', host: 'djDuchess', from: 6, to: 10, track: 'shop', bg: 'shop' },
    { n: 3, title: 'The Blacktop', host: 'princeBreaks', from: 11, to: 15, track: 'blacktop', bg: 'blacktop' },
    { n: 4, title: 'The Wall', host: 'countessCanvas', from: 16, to: 20, track: 'wall', bg: 'wall' },
    { n: 5, title: 'The Crown Arena', host: 'queenCadence', from: 21, to: 25, track: 'arena', bg: 'arena' },
  ];

  // Scenes shown before or after a level. Keys: before-<level>, after-<level>.
  const SCENES = {
    intro: [
      ['griot', 'Gather round. Hip-hop was born at a block party in the Bronx, back in 1973.'],
      ['griot', 'Every element got a royal: the MC, the DJ, the breaker and the writer. I keep the fifth one. Knowledge.'],
      ['static', 'And I’m the one who turned it all OFF. No beats. No rhymes. Just noise.'],
      ['griot', 'King Static stole the Crowns and buried our block in static.'],
      ['kingFlow', 'Not on my watch. Help me bring the music back, one beat at a time.'],
      ['kingFlow', 'Match 3 or more to clear the noise. Let’s get this block party started!'],
    ],
    'before-6': [
      ['djDuchess', 'The block is jumping again! Now King Static has my record shop locked in crates.'],
      ['djDuchess', 'Every record tells somebody’s story. Let’s dig them out.'],
    ],
    'before-10': [
      ['buzzkill', 'Music? Dancing? Smiling? Not while Baron Buzzkill is on duty.'],
      ['djDuchess', 'Somebody’s mad he can’t find the beat. Hit him with matches right next to him, and power-ups that reach him.'],
    ],
    'after-10': [
      ['buzzkill', 'Okay... okay. That beat is kind of fresh.'],
      ['djDuchess', 'Told you. Nobody stays a buzzkill once the needle drops.'],
    ],
    'before-11': [
      ['princeBreaks', 'Yo! King Static taped up the whole park. You can’t spin on a court full of tape.'],
      ['princeBreaks', 'When I dance, I’m free. Let’s free the Blacktop!'],
    ],
    'before-13': [
      ['princeBreaks', 'Those are the Crowns King Static stole! Clear the tiles under them and bring them down to the bottom row.'],
    ],
    'before-16': [
      ['countessCanvas', 'This wall held all our names, every color, every story. Now it’s static.'],
      ['countessCanvas', 'Static spreads if you leave it alone. Knock some out every turn!'],
    ],
    'before-20': [
      ['lipsync', 'Why write your own rhymes when you can borrow mine? Well. Everybody else’s.'],
      ['countessCanvas', 'Your voice is yours. Nobody gets to tape it shut.'],
    ],
    'after-20': [
      ['lipsync', 'Maybe... maybe I could write a verse of my own.'],
      ['countessCanvas', 'Pick up a pen. The wall has room for you too.'],
    ],
    'before-21': [
      ['queenCadence', 'The Crown Arena. This is where the whole Kingdom comes together.'],
      ['griot', 'King Static is waiting at the end of this road. Stay sharp, and keep your heart open.'],
    ],
    'before-25': [
      ['static', 'Every king needs a crowd. So why does NOBODY ever listen to ME?!'],
      ['kingFlow', 'Then step into the cypher. But first, we’re bringing the music back!'],
    ],
    'after-25': [
      ['static', '...I got loud because I felt like nobody heard me.'],
      ['griot', 'Feeling unheard is heavy. Naming it is how we set it down.'],
      ['queenCadence', 'Everybody gets a turn in the cypher. Even you.'],
      ['kingFlow', 'Welcome to the Kingdom, Static. DJ Duchess, drop the beat!'],
    ],
  };

  // Shown the first time a mechanic appears (level `intro` key).
  const INTROS = {
    spray: { title: 'Spray Can', art: 'pw:h', text: 'Line up 4 to make a Spray Can. Tap it or swap it to tag a whole row or column.' },
    floor: { title: 'Dance Floor', art: 'floor', text: 'Dark panels hide under some tiles. Make matches on top of them to light them up.' },
    boombox: { title: 'Boombox', art: 'pw:x', text: 'Match in an L or T shape to build a Boombox. It blasts everything around it.' },
    platinum: { title: 'Platinum Record', art: 'pw:d', text: 'Line up 5 to go Platinum. Swap it with a tile to clear every tile of that kind.' },
    crate: { title: 'Record Crates', art: 'crate:1', text: 'Crates break when you match right next to them. Some take two or three hits.' },
    flyer: { title: 'Flyer', art: 'pw:pl', text: 'Match 4 in a square to fold a Flyer. It flies to whatever you still need.' },
    boss: { title: 'Boss Battle', art: 'portrait:buzzkill', text: 'Match next to the boss and hit it with power-ups. Watch out: every few moves it strikes back.' },
    tape: { title: 'Taped Tiles', art: 'tape', text: 'Taped tiles can’t move. Match them, or hit them with a power-up, to rip the tape off.' },
    combo: { title: 'Combos', art: 'pw:v', text: 'Swap two power-ups into each other for a bigger effect. Try every pair!' },
    crown: { title: 'Crowns', art: 'crown', text: 'Bring each Crown down to the bottom row. The gold arrows show where they leave the board.' },
    static: { title: 'Static', art: 'static', text: 'Static breaks when you match next to it. If you don’t clear any on a move, it spreads.' },
  };

  // Build tasks for each area: one star each, in order of the AREAS art.
  const TIPS = [
    'Combos multiply: a Spray Can swapped into a Boombox clears three rows and three columns.',
    'Flyers seek out what you still need. Save one for the last crate.',
    'Two Platinum Records swapped together clear the entire board.',
    'Stuck? The Remix booster shuffles the board for free.',
    'Matches right next to a boss always land a hit.',
  ];

  root.RKStory = { CAST, CHAPTERS, SCENES, INTROS, TIPS };
})(typeof self !== 'undefined' ? self : this);
