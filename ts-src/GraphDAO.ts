import neo4j, { Driver, types, int } from 'neo4j-driver';

import {
  User,
  Genre,
  Added,
  Requested,
  Comment,
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

  async getMovieRated(userId: number, gameId: string): Promise<Rated | null> {
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

  async upsertUser(user: User) {
    return await this.run(`
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
    `, {
      userId: this.toInt(user.id),
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      languageCode: user.language_code,
      isBot: user.is_bot,
    });
  }

  async upsertAdded(userId: number, movieId: string, added: Added) {
    return await this.run(`
      MATCH (m:Movie{ id: $movieId })
      MATCH (u:User{ id: $userId })
      MERGE (u)-[r:ADDED]->(m)
        ON CREATE SET r.at = $at
        ON MATCH SET  r.at = $at
    `, {
      userId: this.toInt(userId),
      movieId,
      at: this.toDate(added.at),
    });
  }

  async upsertMovieUserLiked(userId: number, movieId: string, rated: Rated) {
    return await this.run(`
      MATCH (m:Movie{ id: $movieId })
      MATCH (u:User{ id: $userId })
      MERGE (u)-[r:LIKED]->(m)
        ON CREATE SET r.at = $at,
                      r.rank = $rank
        ON MATCH SET  r.at = $at,
                      r.rank = $rank
    `, {
      userId: this.toInt(userId),
      movieId,
      at: this.toDate(rated.at),
      rank: this.toInt(rated.rank)
    });
  }

  async upsertGenreLiked(userId: number, genreId: number, rated: Rated) {
    return await this.run(`
      MATCH (g:Genre{ id: $genreId })
      MATCH (u:User{ id: $userId })
      MERGE (u)-[r:LIKED]->(g)
      ON CREATE SET r.at = $at,
                    r.rank = $rank
      ON MATCH SET  r.at = $at,
                    r.rank = $rank
    `, {
      userId: this.toInt(userId),
      genreId: this.toInt(genreId),
      at: this.toDate(rated.at),
      rank: rated.rank
    });
  }

  async upsertActorLiked(userId: number, actorId: number, rated: Rated) {
    return await this.run(`
      MATCH (a:Actor{ id: $actorId })
      MATCH (u:User{ id: $userId })
      MERGE (u)-[r:LIKED]->(g)
      ON CREATE SET r.at = $at,
                    r.rank = $rank
      ON MATCH SET  r.at = $at,
                    r.rank = $rank
    `, {
      userId: this.toInt(userId),
      actorId: this.toInt(actorId),
      at: this.toDate(rated.at),
      rank: this.toInt(rated.rank)
    });
  }

  async upsertRequested(userId: number, movieId: string, requested: Requested) {
    return await this.run(`
      MATCH (m:Movie{ id: $movieId })
      MATCH (u:User{ id: $userId })
      MERGE (u)-[r:REQUESTED]->(m)
        ON CREATE SET r.at = $at
        ON MATCH SET  r.at = $at
    `, {
      userId: this.toInt(userId),
      movieId,
      at: this.toDate(requested.at),
    });
  }

  async upsertCommentAboutMovie(userId: number, movieId: string, comment: Comment) {
    return await this.run(`
      MATCH (m:Movie{ id: $movieId })
      MATCH (u:User{ id: $userId })
      MERGE (c:Comment{ id: $commentId })
        ON CREATE SET c.text = $commentText,
                      c.at = $commentAt
        ON MATCH SET  c.text = $commentText,
                      c.at = $commentAt
      MERGE (u)-[r:WROTE]->(c)
      MERGE (c)-[r:ABOUT]->(m)
    `, {
      userId: this.toInt(userId),
      movieId,
      commentId: this.toInt(comment.id),
      commentAt: this.toDate(comment.at),
      commentText: comment.text
    });
  }

  async upsertCommentAbountComment(userId: number, commentId: number, comment: Comment) {
    return await this.run(`
      MATCH (cc:Comment{ id: $commentId })
      MATCH (u:User{ id: $userId })
      MERGE (c:Comment{ id: $subCommentId })
        ON CREATE SET c.text = $subCommentText,
                      c.at = $subCommentAt
        ON MATCH SET  c.text = $subCommentText,
                      c.at = $subCommentAt
      MERGE (u)-[r:WROTE]->(c)
      MERGE (c)-[r:ABOUT]->(cc)
    `, {
      userId: this.toInt(userId),
      commentId: this.toInt(commentId),
      subCommentId: this.toInt(comment.id),
      subCommentAt: this.toDate(comment.at),
      subCommentText: comment.text
    });
  }

  async recommendGames(userId: number) {
    /*
    return await this.run(`
      match (u:User{id: $userId})-[l:LIKED]->(m:Movie)<-[:PLAYED_IN]-(a:Actor)-[:PLAYED_IN]->(m2:Movie)<-[l2:LIKED]-(u)
      where id(m) < id(m2) and l.rank > 3 and l2.rank > 3
      return a, count(*)
      order by count(*) desc
      limit 5
    `, {
      userId
    }).then((result) => result.records);
    */
   return await this.run(`
      match (u:User{id: $userId})-[r:RATED]->(g:Game)<-[:TAGGED]-(t:Tag)-[:TAGGED]->(g2:Game)
      return g2, r, count(*)
      order by r.rank desc
      limit 5
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
