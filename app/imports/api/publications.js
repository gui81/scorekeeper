import { Meteor } from 'meteor/meteor';
import {
  Matches,
  Players,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
} from './collections';

Meteor.publish('matches', function () {
  return Matches.find();
});

Meteor.publish('players', function () {
  return Players.find();
});

Meteor.publish('combined_ratings', function () {
  return CombinedRatings.find();
});

Meteor.publish('singles_ratings', function () {
  return SinglesRatings.find();
});

Meteor.publish('offense_ratings', function () {
  return OffenseRatings.find();
});

Meteor.publish('defense_ratings', function () {
  return DefenseRatings.find();
});
