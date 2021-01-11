import * as dotenv from 'dotenv';

dotenv.config();

import { Telegraf } from 'telegraf';
import { InlineKeyboardMarkup, InlineQueryResultArticle } from 'telegraf/typings/telegram-types';

import DocumentDAO from './DocumentDAO';
import GraphDAO from './GraphDAO';
import {Rated, ratededValues} from './Model';

const bot = new Telegraf(process.env.BOT_TOKEN);
const graphDAO = new GraphDAO();
const documentDAO = new DocumentDAO();

function stripMargin(template: TemplateStringsArray, ...expressions: any[]) {
  const result = template.reduce((accumulator, part, i) => {
      return accumulator + expressions[i - 1] + part;
  });
  return result.replace(/(\n|\r|\r\n)\s*\|/g, '$1');
}

function buildRateKeyboard(movieId: string, currentLike?: Rated): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      ratededValues.map((v) => ({
        text: currentLike && currentLike.rank === v ? "★".repeat(v) : "☆".repeat(v),
        callback_data: v + '__' + movieId, // payload that will be retrieved when button is pressed
      })),
    ],
  }
}

// User is using the inline query mode on the bot
bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery;
  if (query) {
    const games = await documentDAO.getGames(query.query);
    const answer: InlineQueryResultArticle[] = games.map((game) => ({
      id: game._id,
      type: 'article',
      title: game.name,
      description: game.desc_snippet,
      reply_markup: buildRateKeyboard(game._id),
      input_message_content: {
        message_text: stripMargin`
          |Name -> ${game.name}
          |Tags -> ${game.popular_tags}
          |Release date -> ${game.release_date}
          |Details -> ${game.desc_snippet}
        `
      },
    }));
    ctx.answerInlineQuery(answer);
  }
});

// User chose a movie from the list displayed in the inline query
// Used to update the keyboard and show filled stars if user already rated it
bot.on('chosen_inline_result', async (ctx) => {
  if (ctx.from && ctx.chosenInlineResult) {
    const rated = await graphDAO.getMovieRated(ctx.from.id, ctx.chosenInlineResult.result_id);
    if (rated !== null) {
      ctx.editMessageReplyMarkup(buildRateKeyboard(ctx.chosenInlineResult.result_id, rated));
    }
  }
});

// Callback called when we click on the "reply_markup" (rated starts reply) from the game
bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery && ctx.from) {
    const [rank, movieId] = ctx.callbackQuery.data.split('__');
    console.log(rank, movieId);
    const rated: Rated = {
      rank: parseInt(rank, 10),
      at: new Date()
    };
    await graphDAO.upsertMovieRated({
      first_name: 'unknown',
      last_name: 'unknown',
      language_code: 'fr',
      is_bot: false,
      username: 'unknown',
      ...ctx.from,
    }, movieId, rated);
    ctx.editMessageReplyMarkup(buildRateKeyboard(movieId, rated));
  }
});


bot.command('help', (ctx) => {
  ctx.reply(`
A demo for the project given in the MAC course at the HEIG-VD.

A user can display a movie and set a reaction to this movie (like, dislike).
When asked, the bot will provide a recommendation based on the movies he liked or disliked.

Use inline queries to display a movie, then use the inline keyboard of the resulting message to react.
Use the command /recommendactor to get a personalized recommendation.
  `);
});

bot.command('start', (ctx) => {
  ctx.reply('HEIG-VD Mac project example bot in javascript');
});

bot.command('recommendactor', (ctx) => {
  if (!ctx.from || !ctx.from.id) {
    ctx.reply('We cannot guess who you are');
  } else {
    graphDAO.recommendActors(ctx.from.id).then((records) => {
      if (records.length === 0) ctx.reply("You haven't liked enough movies to have recommendations");
      else {
        const actorsList = records.map((record) => {
          const name = record.get('a').properties.name;
          const count = record.get('count(*)').toInt();
          return `${name} (${count})`;
        }).join("\n\t");
        ctx.reply(`Based your like and dislike we recommend the following actor(s):\n\t${actorsList}`);
      }
    });
  }
});

bot.command('all', (ctx) => {
  if (!ctx.from || !ctx.from.id) {
    ctx.reply('We cannot guess who you are');
  } else {
    (async () => {
      /*
      const games = await documentDAO.getAllGames();
      let text = '';
      text += `There is : ${games.length} games.\n\t`;
      let i = 1;
      for (const game of games) {
        text += `${i}. ${game.name}\n\t`
        if(++i == 10) {
          break;
        }
      }
      console.log(games);
      await ctx.reply(text);*/

      const games = await documentDAO.getRandomGames(3);
      let text = '';
      text += `There is : ${games.length} games.\n\t`;
      let i = 1;
      for (const game of games) {
        text += `${i}. ${game.name}\n\t`
        if(++i == 3) {
          break;
        }
      }
      console.log(games);
      await ctx.reply(text);

    })();
  }
});


// Initialize mongo connexion
// before starting bot
documentDAO.init().then(() => {
  bot.startPolling();
});
