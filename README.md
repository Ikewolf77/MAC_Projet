# Telegram bot for games rating

This project has been written in TypeScript. It allows users to search for games and rate them. They also have the possibility to like specific game tags in order to have recommendations of games with those tags. Finally the users can display games that are recommended for them, based on their ratings and liked tags.

## Databases

The bot needs two database containers in order the run:

- MangoDB: stores the raw games data, imported from the  `data` folder's CSV file

- Neo4J: stores the data related to users' interactions with the games (ratings and tag liking).

Those can be launched using the `docker-compose up` command which uses the `docker-compose.yml` file in the root folder.

*Make sure that you have docker and docker-compose installed on your machine.*

### Registering the bot

You first have to register it on Telegram. To do this, follow the official [documentation](https://core.telegram.org/bots).

- Register your bot on BotFather

- Register three commands using botfather's `/setcommands` with the value bellow:
  
  ```
  help - Show the help
  liketag - Like a specific tag
  recommendgames - Get a list of games you could be interested in
  ```

- Run `/setinline` and `/setinlinefeedback` for the bot to be able to answer inline queries

- Copy the token the botfather gave you and go to `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` to enable active polling on your bot. Don't forget to replace `<YOUR_TOKEN>` by your actual token

### Filling some data

- Create a `.env` file based on the `.env.exemple` provided file and fill in `DOCUMENTDB_HOST` and `GRAPHDB_HOST`, as well as your secret Telegram bot token.
- To fill in some data, run `npm run ts_import`. This will load the CSV data into MangoDB and create relations in Neo4J.
- In the `data` folder, we provide 3 CSV files, all containing games:
  - `steam_games_100.csv` (contains 100 entries and is the fastest to load in ~10 seconds)
  - `steam_games_1k.csv` (contains 1000 entries and requires a few minutes to load)
  - `steam_games.csv` (contains 48834 entries and takes forever to load)
  
  *These data have been gathered from this [dataset]([Steam games complete dataset | Kaggle](https://www.kaggle.com/trolukovich/steam-games-complete-dataset)).*

### Running the bot

After successfully completing the above steps, you can finally start the bot using the following command: `npm run ts-start`. You can now call the inline command of your bot in telegram using @bot_name (don't forget to replace "bot_name" with your bot's actual name), search and rate games. With /liketag, you can specify a tag you like in particular in order to get recommendations of games that have that tag. Finally, use /recommendgames to get a list a games that you could like, according to your ratings and likes.


