import 'jsr:@std/dotenv/load';
import { getTotalWords, fetchZpdicWord } from './mod/zpdic-api.ts';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const main = async () => {
  const identifier = Deno.env.get('BSKY_ID');
  const password = Deno.env.get('BSKY_PASSWORD');
  const zpdicApiKey = Deno.env.get('ZPDIC_API_KEY');

  if (!identifier || !password || !zpdicApiKey) {
    console.error('cannot get env');
    return;
  }

  const numRes = await getTotalWords(zpdicApiKey);

  if (!numRes.success) {
    console.error(numRes.error);
    return;
  }

  const wRes = await fetchZpdicWord(zpdicApiKey, getRandomInt(0, numRes.data));

  if (!wRes.success) {
    console.error(wRes.error);
    return;
  }

  console.log(wRes.data);

  return;

};

if (import.meta.main) {
  main();
}
