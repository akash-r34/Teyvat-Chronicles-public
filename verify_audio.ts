import https from 'https';

const audioUrls = [
  'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/SoundEffects/menu_select.mp3', // click
  'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/SoundEffects/p-ping.mp3', // hover
  'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/SoundEffects/menu_switch.mp3', // choiceClick
  'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=button-124476.mp3', // confirm
  'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/SoundEffects/blaster.mp3', // actionBtn
  'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', // bgm normal
  'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=cinematic-time-lapse-115672.mp3', // bgm serious
  'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/SoundEffects/sword.mp3', // combat
  'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/SoundEffects/squit.mp3', // magic
  'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/SoundEffects/explosion.mp3' // explosion
];

async function checkUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
        resolve(true);
      } else {
        console.error(`Failed: ${url} (Status: ${res.statusCode})`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.error(`Error checking ${url}:`, err.message);
      resolve(false);
    });
  });
}

async function run() {
  console.log('Verifying audio URLs...');
  let allGood = true;
  for (const url of audioUrls) {
    const ok = await checkUrl(url);
    if (!ok) {
      allGood = false;
    } else {
      console.log(`OK: ${url}`);
    }
  }
  if (allGood) {
    console.log('ALL AUDIO URLS ARE VALID!');
    process.exit(0);
  } else {
    console.error('SOME AUDIO URLS ARE BROKEN.');
    process.exit(1);
  }
}

run();
