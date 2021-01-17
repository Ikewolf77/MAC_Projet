export type Game = {
  _id: string;
  url: string;
  types: string;
  name: string;
  desc_snippet: string;
  recent_reviews: string;
  all_reviews: string;
  release_date: string;
  developer: string;
  publisher: string;
  popular_tags: string;
  game_details: string;
  languages: string;
  achievements: string;
  genre: string;
  game_description: string;
  mature_content: string;
  minimum_requirements: string;
  recommended_requirements: string;
  original_price: string;
  discount_price: string;
}

export type Tag = {
  id: number;
  name: string;
}

export type Rated = {
  at: Date;
  rank: number;
}

export const ratedValues = [1,2,3,4,5];

export type User = {
  username?: string;
  last_name?: string;
  first_name?: string;
  id: number;
  is_bot: boolean;
  language_code?: string;
}
