import * as dotenv from 'dotenv';
import parse from 'csv-parse';
import { promises as fs } from 'fs';
import cliProgress from 'cli-progress';
import { join } from 'path';

import DocumentDAO from "./DocumentDAO";
import GraphDAO from "./GraphDAO";
import { Movie, User } from "./Model";

dotenv.config();

const buildUser = (id: number, username: string, first_name: string, last_name: string, language_code: string, is_bot: boolean): User => ({
  id,
  username,
  first_name,
  last_name,
  language_code,
  is_bot
});

const shuffle = (array: any[]): any[] => {

  for(let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * i);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }

  return array;
};

const parseGames = async (): Promise<any[]> => new Promise((resolve) => {
  fs.readFile(join(__dirname, '../data/steam_games_100.csv')).then((baseGames) => {
    parse(baseGames, (err, data) => {
      resolve(data);
    });
  });
});

// const users: User[] = [
//   buildUser(220987852, 'ovesco', 'guillaume', '', 'fr', false),
//   buildUser(136451861, 'thrudhvangr', 'christopher', '', 'fr', false),
//   buildUser(136451862, 'NukedFace', 'marcus', '', 'fr', false),
//   buildUser(136451863, 'lauralol', 'laura', '', 'fr', false),
//   buildUser(136451864, 'Saumonlecitron', 'jean-michel', '', 'fr', false),
// ];

const graphDAO = new GraphDAO();
const documentDAO = new DocumentDAO();

(async () => {
  console.log('Starting mongo');
  await documentDAO.init();
  console.log('Preparing Neo4j');
  await graphDAO.prepare();

  // console.log('Writing users to neo4j');
  // await Promise.all(users.map((user) => graphDAO.upsertUser(user)));

  // Write games in mongo
  console.log('Parsing CSV and writing games to mongo');
  const parseGamesBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const parsedGames = await parseGames();
  parseGamesBar.start(parsedGames.length, 0);

  // TODO remove duplicate publishers

  await Promise.all(parsedGames.map(async (it: any) => {
    const [
      url,types,name,desc_snippet,recent_reviews,all_reviews,
      release_date,developer,publisher,popular_tags,game_details,
      languages,achievements,genre,game_description,mature_content,
      minimum_requirements,recommended_requirements,original_price,discount_price
    ] = it;
    await documentDAO.insertGame({
      url,types,name,desc_snippet,recent_reviews,all_reviews,
      release_date,developer,publisher,popular_tags,game_details,
      languages,achievements,genre,game_description,mature_content,
      minimum_requirements,recommended_requirements,original_price,discount_price
    });
    parseGamesBar.increment();
  }));
  parseGamesBar.stop();

  // Load them back to get their id along
  console.log('Loading games back in memory');
  const games = await documentDAO.getAllGames();

  // Retrieve all genres and actors from all movies, split them and assign a numeric id
  // console.log('Calculating genres and actors');
  // const genres = [...new Set(games.flatMap((it) => it.genre.split(',').map(it => it.trim())))].map((it, i) => [i, it]);
  const tags = [...new Set(games.flatMap((it) => it.popular_tags.split(',').map(it => it.trim().toLowerCase())))].map((it, i) => [i, it]);

  console.log('Handling game insertion in Neo4j');
  const gamesBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  gamesBar.start(games.length, 0);
  for (let game of games) {
    const gameTags = game.popular_tags.split(',').map(i => i.trim().toLowerCase());

    await graphDAO.upsertGame(game._id, game.name);

    // Update tag <-> game links
    await Promise.all(gameTags.map((name) => {
      const id = tags.find((it) => it[1] === name)[0] as number;
      return graphDAO.upsertTag(game._id, { id, name });
    }));
    gamesBar.increment();
  }
  gamesBar.stop();

  console.log('Done, closing sockets');
  await Promise.all([
    documentDAO.close(),
    graphDAO.close()
  ]);
})();
