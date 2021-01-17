import * as dotenv from 'dotenv';

dotenv.config();

import { Telegraf } from 'telegraf';
import { InlineKeyboardMarkup, InlineQueryResultArticle } from 'telegraf/typings/telegram-types';

import DocumentDAO from './DocumentDAO';
import GraphDAO from './GraphDAO';
import {Rated, ratedValues} from './Model';

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
      ratedValues.map((v) => ({
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
    const rated = await graphDAO.getGameRated(ctx.from.id, ctx.chosenInlineResult.result_id);
    if (rated !== null) {
      ctx.editMessageReplyMarkup(buildRateKeyboard(ctx.chosenInlineResult.result_id, rated));
    }
  }
});

// Callback called when we click on the "reply_markup" (rated starts reply) from the game
bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery && ctx.from) {
    const [rank, gameId] = ctx.callbackQuery.data.split('__');
    console.log(rank, gameId);

    const rated: Rated = {
      rank: parseInt(rank, 10),
      at: new Date()
    };

    await graphDAO.upsertGameRated({
      first_name: 'unknown',
      last_name: 'unknown',
      language_code: 'fr',
      is_bot: false,
      username: 'unknown',
      ...ctx.from,
    }, gameId, rated);
    ctx.editMessageReplyMarkup(buildRateKeyboard(gameId, rated));
  }
});


bot.command('help', (ctx) => {
  ctx.reply(`
This is a game rating bot (project in the MAC course at the HEIG-VD)

Call the bot using '@' and you'll be able to search for games to rate.
You can like a specific tag using /likeTag in order to get recommendation from them.
Use /recommendGames to display a list a games you could be interested in, according to your game ratings and liked tags.
  `);
});

bot.command('start', (ctx) => {
  ctx.reply('HEIG-VD Mac project about games rating, written in TypeScript.');
});

bot.command('recommendGames', (ctx) => {
  if (!ctx.from || !ctx.from.id) {
    ctx.reply('We cannot guess who you are');
  } else {
    graphDAO.recommendGamesFromLikedTags(ctx.from.id).then((records) => {
      if (records.length === 0) {
        graphDAO.recommendGames(ctx.from.id).then((records2) => {
          if (records2.length === 0) {
            ctx.reply("You haven't rated enough games to have recommendations");
          } else {
            const gamesList = records2.map((record) => {
              const name = record.get('g2').properties.name;
              const count = record.get('count(*)').toInt();
              return `${name} (${count})`;
            }).join("\n\t");
            ctx.reply(`Based on your ratings, we recommend the following games:\n\t${gamesList}`);
          }
        });
      }
      else {
        const gamesList = records.map((record) => {
          const name = record.get('g2').properties.name;
          const count = record.get('count(*)').toInt();
          return `${name} (${count})`;
        }).join("\n\t");
        ctx.reply(`Based on your ratings and liked tags, we recommend the following games:\n\t${gamesList}`);
      }
    });
  }
});

bot.command('likeTag', (ctx) => {
  (async () => {
    let tagName = ctx.update.message.text.substr(ctx.update.message.text.indexOf(' ') + 1);
    // No args (tagname) detected
    if(tagName === ctx.update.message.text) {
      ctx.reply('No tag detected, use /likeTag <tagName>');
    }
    // Add the relation it tag exists
    else{
      const tag = await graphDAO.getTagByName(tagName.toLowerCase());

      // Tag exists => upsert the liked relation between the user and tag
      if (tag !== null) {
        await graphDAO.upsertTagLiked({
          first_name: 'unknown',
          last_name: 'unknown',
          language_code: 'fr',
          is_bot: false,
          username: 'unknown',
          ...ctx.from,
        }, tag.id);

        ctx.reply(`You liked the tag "${tagName}"`);

      }
      // Tag doesn't exists => wrong tag name entered by user
      else{
        ctx.reply(`The tag "${tagName}" doesn't exists`);
      }
    }
  })();
});

// Initialize mongo connexion
// before starting bot
documentDAO.init().then(() => {
  bot.startPolling();
});
