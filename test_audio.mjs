import http from 'http';

const urls = [
  '/audio/bgm/peaceful_town.mp3',
  '/audio/bgm/market.mp3',
  '/audio/bgm/heroic.mp3',
  '/audio/bgm/mystery.mp3',
  '/audio/bgm/dungeon.mp3',
  '/audio/bgm/battle_jrpg_loop.mp3',
  '/audio/bgm/boss.mp3',
  '/audio/sfx/sword_swing.ogg',
  '/audio/sfx/sword_unsheathe.ogg',
  '/audio/sfx/magic_cast.ogg',
  '/audio/sfx/impact_hit.ogg',
  '/audio/sfx/explosion.ogg',
  '/audio/sfx/page_turn.ogg',
  '/audio/sfx/dramatic_sting.ogg'
];

async function checkUrl(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      resolve({ path, code: res.statusCode, contentType: res.headers["content-type"] });
    }).on('error', (e) => {
      resolve({ path, error: e.message });
    });
  });
}

(async () => {
  for(const url of urls) {
    const res = await checkUrl(url);
    console.log(res);
  }
})();
