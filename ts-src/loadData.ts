import * as dotenv from 'dotenv';
import parse from 'csv-parse';
import { promises as fs } from 'fs';
import cliProgress from 'cli-progress';
import { join } from 'path';

import DocumentDAO from "./DocumentDAO";
import GraphDAO from "./GraphDAO";

dotenv.config();

const parseGames = async (): Promise<any[]> => new Promise((resolve) => {
  fs.readFile(join(__dirname, '../data/steam_games_100.csv')).then((baseGames) => {
    parse(baseGames, (err, data) => {
      resolve(data);
    });
  });
});

const graphDAO = new GraphDAO();
const documentDAO = new DocumentDAO();

(async () => {
  console.log('Starting mongo');
  await documentDAO.init();
  console.log('Preparing Neo4j');
  await graphDAO.prepare();

  // Write games in mongo
  console.log('Parsing CSV and writing games to mongo');
  const parseGamesBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const parsedGames = await parseGames();
  parseGamesBar.start(parsedGames.length, 0);

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
