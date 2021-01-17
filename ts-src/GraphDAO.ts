import neo4j, { Driver, types, int } from 'neo4j-driver';

import {
  User,
  Rated,
  Tag
} from './Model';

class GraphDAO {

  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(`bolt://${process.env.GRAPHDB_HOST}`);
  }

  async prepare() {
    await this.run("CREATE CONSTRAINT ON (n:Movie) ASSERT n.id IS UNIQUE", {});
    await this.run("CREATE CONSTRAINT ON (u:User) ASSERT u.id IS UNIQUE", {});
  }

  async close() {
    await this.driver.close();
  }

  async upsertGameRated(user: User, gameId: string, rated: Rated) {
    await this.run(`
      MATCH (g:Game {id: $gameId})
        MERGE (u:User {id: $userId})
          ON CREATE SET u.isBot = $isBot,
                        u.firstName = $firstName,
                        u.lastName = $lastName,
                        u.username = $username,
                        u.languageCode = $languageCode
          ON MATCH SET  u.isBot = $isBot,
                        u.firstName = $firstName,
                        u.lastName = $lastName,
                        u.username = $username,
                        u.languageCode = $languageCode
        MERGE (u)-[r:RATED]->(g)
          ON CREATE SET r.rank = $ratedRank,
                        r.at = $ratedAt
          ON MATCH SET  r.rank = $ratedRank,
                        r.at = $ratedAt
    `, {
      gameId,
      isBot: user.is_bot,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
      username: user.username,
      userId: this.toInt(user.id),
      ratedRank: rated.rank,
      ratedAt: this.toDate(rated.at),
    });
  }

  async upsertTagLiked(user: User, tagId: number) {
    await this.run(`
      MATCH (t:Tag { id: $tagId })
        MERGE (u:User {id: $userId})
          ON CREATE SET u.isBot = $isBot,
                        u.firstName = $firstName,
                        u.lastName = $lastName,
                        u.username = $username,
                        u.languageCode = $languageCode
          ON MATCH SET  u.isBot = $isBot,
                        u.firstName = $firstName,
                        u.lastName = $lastName,
                        u.username = $username,
                        u.languageCode = $languageCode
        MERGE (u)-[:LIKED]->(t)
    `, {
      tagId,
      isBot: user.is_bot,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
      username: user.username,
      userId: this.toInt(user.id),
    });
  }

  async getTagByName(tagName: string): Promise<Tag | null> {
    return await this.run(`
      MATCH (t:Tag{name: $tagName}) RETURN t
    `, {
      tagName
    }).then((res) => {
      if (res.records.length === 0) return null;
      else {
        const record = res.records[0].get('t');
        return {
          id: record.properties.id,
          name: record.properties.name,
        }
      }
    });
  }

  async getGameRated(userId: number, gameId: string): Promise<Rated | null> {
    return await this.run('MATCH (:User{id: $userId})-[r:RATED]-(:Game{id: $gameId}) RETURN r', {
      userId,
      gameId,
    }).then((res) => {
      if (res.records.length === 0) return null;
      else {
        const record = res.records[0].get('r');
        return {
          rank: record.properties.rank,
          at: record.properties.at,
        }
      }
    });
  }

  async upsertGame(gameId: string, gameName: string) {
    return await this.run('MERGE (g:Game{id: $gameId}) ON CREATE SET g.name = $gameName RETURN g', {
      gameId,
      gameName,
    })
  }

  async upsertTag(gameId: string, tag: Tag) {
    return await this.run(`
      MATCH (g:Game{ id: $gameId })
      MERGE (p:Tag{id: $tagId})
        ON CREATE SET p.name = $tagName
      MERGE (p)-[r:TAGGED]->(g)
    `, {
      gameId,
      tagId: tag.id,
      tagName: tag.name,
    })
  }

  async recommendGames(userId: number) {
   return await this.run(`
      match (u:User{id: $userId})-[r:RATED]->(g:Game)<-[:TAGGED]-(t:Tag)-[:TAGGED]->(g2:Game)
      return g2, r, count(*)
      order by r.rank desc, count(*) desc
      limit 10
    `, {
      userId
    }).then((result) => result.records);
  }

  async recommendGamesFromLikedTags(userId: number) {
    return await this.run(`
    match (u:User{id: $userId})-[r:RATED]->(g:Game)<-[:TAGGED]-(t1:Tag)-[:TAGGED]->(g2:Game)
      match (u)-[l:LIKED]->(t1)-[:TAGGED]->(g2)
      return g2, r, count(*)
      order by r.rank desc, count(*) desc
      limit 10
    `, {
      userId
    }).then((result) => result.records);
  }

  private toDate(value: Date) {
    return types.DateTime.fromStandardDate(value);
  }

  private toInt(value: number | string) {
    return int(value);
  }

  private async run(query: string, params: any) {
    const session = this.driver.session();
    const result = await session.run(query, params);
    await session.close();
    return result;
  }
}

export default GraphDAO;
