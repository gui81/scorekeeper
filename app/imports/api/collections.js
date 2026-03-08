import { Mongo } from 'meteor/mongo';

export const Matches = new Mongo.Collection('matches');
export const Players = new Mongo.Collection('players');
export const CombinedRatings = new Mongo.Collection('combined_ratings');
export const SinglesRatings = new Mongo.Collection('singles_ratings');
export const OffenseRatings = new Mongo.Collection('offense_ratings');
export const DefenseRatings = new Mongo.Collection('defense_ratings');
export const TeamRatings = new Mongo.Collection('team_ratings');
