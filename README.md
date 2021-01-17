# Telegram bot for games rating

This project has been written in TypeScript. It allows users to search for games and rate them. They also have the possibility to like specific game tags in order to have recommendations of games with those tags. Finally the users can display games that are recommended for them, based on their ratings and liked tags.

## Databases

The bot needs two database containers in order the run:

- MangoDB: stores the raw games data, imported from the  `data` folder's CSV file

- Neo4J: stores the data related to users' interactions with the games (ratings and tag liking).

Those can be launched using the `docker-compose up` command which uses the `docker-compose.yml` file in the root folder.

*Make sure that you have docker and docker-compose installed on your machine.*

### Filling some data

- Create a `.env` file based on the `.env.exemple` provided file and fill in `DOCUMENTDB_HOST` and `GRAPHDB_HOST`, as well as your secret Telegram bot token.
- To fill in some data, run `npm run ts_import`. This will load data into MangoDB

### Registering the bot

You first have to register it on Telegram, for this follow the [documentation](https://core.telegram.org/bots).

- Register your bot on BotFather
- Register two commands:
  - `help` which provides some help
  - `recommendactors` which tries to recommend actors based on user preferences
- run `/setinline` and `/setinlinefeedback` for the bot to be able to answer inline queries
- copy the token the botfather gave you and go to `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
  to enable active polling on your bot. Don't forget to replace `<YOUR_TOKEN>` by your actual token

### Running your bot

You can run the bot either in javascript or in typescript:

- In javascript (`/src/index.js`) run `npm start`
- In typescript (`/ts-src/index.ts`) run `mpm run ts-start`
  This will make the bot run in active polling mode, which means the bot will 

## Profit
