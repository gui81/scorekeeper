// using autoform, simple-schema, and Collections2 packages to validate inserts
// against schema to ensure data integrity
Matches = new Meteor.Collection('matches');
Players = new Meteor.Collection('players');
CombinedRatings = new Meteor.Collection('combined_ratings');  // all games counted
SinglesRatings = new Meteor.Collection('singles_ratings');  // just singles
OffenseRatings = new Meteor.Collection('offense_ratings');  // doubles offense
DefenseRatings = new Meteor.Collection('defense_ratings');  // doubles defense

var playerNames = function () {
  // if the value does not exist, then let's just return so that the optional
  // fields are handled correctly
  if (this.value == "undefined" || !this.value) {
    return;
  }
  // now try to find the player in our Collection
  var player = Players.findOne({name: this.value});
  // if player not found, or for some reason the name is not found, then return
  // a custom message
  if (!player || !player.name) {
    return "nameNotFound";
  }
};

// custom messages
SimpleSchema.messages({
  "nameNotFound": "Player name does not currently exist."
});

// here we are creating a SimpleSchema because date_time is in the Collection,
// but not in the form
MatchFormSchema = new SimpleSchema({
  ro: {
    type: String,
    label: "Red/Yellow Offense*",
    min: 2,
    custom: playerNames
  },
  rd: {
    type: String,
    label: "Red/Yellow Defense",
    optional: true,
    min: 2,
    custom: playerNames
  },
  bo: {
    type: String,
    label: "Blue/Black Offense*",
    min: 2,
    custom: playerNames
  },
  bd: {
    type: String,
    label: "Blue/Black Defense",
    optional: true,
    min: 2,
    custom: playerNames
  },
  rs: {
    type: Number,
    label: "Red/Yellow Score*",
    min: 0,
    max: 10
  },
  bs: {
    type: Number,
    label: "Blue/Black Score*",
    min: 0,
    max: 10
  }
});

PlayerFormSchema = new SimpleSchema({
  player_name: {
    type: String,
    label: "Name*",
    min: 2
  },
  rating: {
    type: Number,
    label: "Initial Rating*",
    allowedValues: [250, 750, 1250, 1750, 2250]
  }
});

if (Meteor.isServer) {
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

  // define some constants for Elo Ratings
  // we are using the Bonzini USA values:
  //   http://www.bonziniusa.com/foosball/tournament/TournamentRankingSystem.html
  var K_RATING_COEFFICIENT = 50;
  var F_RATING_INTERVAL_SCALE_WEIGHT = 1000;

  var updateRating = function (date, player_id, rating, opponent_rating, rating_to_adjust, win, collection) {
    var S = (win ? 1 : 0);
    var We = winExpectancy(rating, opponent_rating);
    var Rn = rating_to_adjust + (K_RATING_COEFFICIENT * (S - We));

    collection.insert({
      date_time: date,
      player_id: player_id,
      rating: Rn
    });

    return Rn;
  };

  var winExpectancy = function (rating, opponent_rating) {
    var We = 1 / (
        Math.pow(10, (-(rating - opponent_rating) / F_RATING_INTERVAL_SCALE_WEIGHT)) + 1);
    return We;
  };

  /**
   *
   * @return {String} id of the record
   */
  var addPlayer = function (player_name, rating) {
    var id = Players.findOne({name: player_name});
    if (id) {
      // player already in database, no need to add again
      console.log("id already exists: " + id._id);
      return id._id;
    }

    // didn't find player above, so add one now
    id = Players.insert({
      date_time: Date.now(),
      name: player_name
    });

    // add a rating for each rating being tracked
    CombinedRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    SinglesRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    OffenseRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    DefenseRatings.insert({
      date_time: Date.now(),
      player_id: id,
      rating: rating
    });

    return id;
  };

  var getPlayerId = function (player_name) {
    var id = Players.findOne({name: player_name});
    if (id) {
      return id._id;
    } else {
      // it should never get here since the MatchFormSchema should handle
      // making sure the player exists first
      return undefined;
    }
  };

  var getPlayerName = function (player_id) {
    var name = Players.findOne({_id: player_id});
    if (name) {
      return name.name;
    } else {
      return undefined;
    }
  };

  Meteor.startup(function () {
    var updateAllRatings = function (doc, date) {
      var ro_id, rd_id, bo_id, bd_id;
      var last_ro_combined_rating, last_rd_combined_rating, last_bo_combined_rating, last_bd_combined_rating;
      var last_ro_singles_rating, last_bo_singles_rating;
      var last_ro_offense_rating, last_bo_offense_rating;
      var last_rd_defense_rating, last_bd_defense_rating;
      if (typeof doc.ro != "undefined") {
        ro_id = getPlayerId(doc.ro);
        last_ro_combined_rating = CombinedRatings.findOne({player_id: ro_id}, {sort: {date_time: -1}});
        last_ro_singles_rating = SinglesRatings.findOne({player_id: ro_id}, {sort: {date_time: -1}});
        last_ro_offense_rating = OffenseRatings.findOne({player_id: ro_id}, {sort: {date_time: -1}});
      }
      if (typeof doc.rd != "undefined") {
        rd_id = getPlayerId(doc.rd);
        last_rd_combined_rating = CombinedRatings.findOne({player_id: rd_id}, {sort: {date_time: -1}});
        last_rd_defense_rating = DefenseRatings.findOne({player_id: rd_id}, {sort: {date_time: -1}});
      }
      if (typeof doc.bo != "undefined") {
        bo_id = getPlayerId(doc.bo);
        last_bo_combined_rating = CombinedRatings.findOne({player_id: bo_id}, {sort: {date_time: -1}});
        last_bo_singles_rating = SinglesRatings.findOne({player_id: bo_id}, {sort: {date_time: -1}});
        last_bo_offense_rating = OffenseRatings.findOne({player_id: bo_id}, {sort: {date_time: -1}});
      }
      if (typeof doc.bd != "undefined") {
        bd_id = getPlayerId(doc.bd);
        last_bd_combined_rating = CombinedRatings.findOne({player_id: bd_id}, {sort: {date_time: -1}});
        last_bd_defense_rating = DefenseRatings.findOne({player_id: bd_id}, {sort: {date_time: -1}});
      }

      var red_won;
      if (parseInt(doc.rs) > parseInt(doc.bs)) {
        red_won = true;
      } else {
        red_won = false;
      }

      if ((typeof doc.rd != "undefined") &&
          (typeof doc.bd != "undefined")) {
        // 2 v 2
        var red_rating = (last_ro_combined_rating.rating + last_rd_combined_rating.rating) / 2.0;
        var blue_rating = (last_bo_combined_rating.rating + last_bd_combined_rating.rating) / 2.0;

        // update combined ratings
        updateRating(date, ro_id, red_rating, blue_rating, last_ro_combined_rating.rating, red_won, CombinedRatings);
        updateRating(date, rd_id, red_rating, blue_rating, last_rd_combined_rating.rating, red_won, CombinedRatings);
        updateRating(date, bo_id, blue_rating, red_rating, last_bo_combined_rating.rating, !red_won, CombinedRatings);
        updateRating(date, bd_id, blue_rating, red_rating, last_bd_combined_rating.rating, !red_won, CombinedRatings);

        // update doubles ratings, distinguishing between offense and defense
        updateRating(date, ro_id, red_rating, blue_rating, last_ro_offense_rating.rating, red_won, OffenseRatings);
        updateRating(date, rd_id, red_rating, blue_rating, last_rd_defense_rating.rating, red_won, DefenseRatings);
        updateRating(date, bo_id, blue_rating, red_rating, last_bo_offense_rating.rating, !red_won, OffenseRatings);
        updateRating(date, bd_id, blue_rating, red_rating, last_bd_defense_rating.rating, !red_won, DefenseRatings);
      } else if ((typeof doc.rd == "undefined") &&
          (typeof doc.bd == "undefined")) {
        // 1 v 1
        // update combined ratings
        updateRating(date, ro_id, last_ro_combined_rating.rating, last_bo_combined_rating.rating, last_ro_combined_rating.rating, red_won, CombinedRatings);
        updateRating(date, bo_id, last_bo_combined_rating.rating, last_ro_combined_rating.rating, last_bo_combined_rating.rating, !red_won, CombinedRatings);

        // update singles ratings
        updateRating(date, ro_id, last_ro_singles_rating.rating, last_bo_singles_rating.rating, last_ro_singles_rating.rating, red_won, SinglesRatings);
        updateRating(date, bo_id, last_bo_singles_rating.rating, last_ro_singles_rating.rating, last_bo_singles_rating.rating, !red_won, SinglesRatings);
      } else {
        // this is where I give more value to the single player, by not dividing
        // the team rating by 2, but instead by 1.5, since they are expected to
        // win
        if (typeof doc.rd != "undefined") {
          // 2 red v 1 blue
          // update combined ratings
          var red_rating2 = (last_ro_combined_rating.rating + last_rd_combined_rating.rating) / 1.5;
          updateRating(date, ro_id, red_rating2, last_bo_combined_rating.rating, last_ro_combined_rating.rating, red_won, CombinedRatings);
          updateRating(date, rd_id, red_rating2, last_bo_combined_rating.rating, last_rd_combined_rating.rating, red_won, CombinedRatings);
          updateRating(date, bo_id, last_bo_combined_rating.rating, red_rating2, last_bo_combined_rating.rating, !red_won, CombinedRatings);

          // update doubles ratings
          updateRating(date, ro_id, red_rating2, last_bo_singles_rating.rating, last_ro_offense_rating.rating, red_won, OffenseRatings);
          updateRating(date, rd_id, red_rating2, last_bo_singles_rating.rating, last_rd_defense_rating.rating, red_won, DefenseRatings);

          // update singles ratings
          updateRating(date, bo_id, last_bo_singles_rating.rating, red_rating2, last_bo_singles_rating.rating, !red_won, SinglesRatings);
        } else {
          // 1 red v 2 blue
          var blue_rating2 = (last_bo_combined_rating.rating + last_bd_combined_rating.rating) / 1.5;
          updateRating(date, ro_id, last_ro_combined_rating.rating, blue_rating2, last_ro_combined_rating.rating, red_won, CombinedRatings);
          updateRating(date, bo_id, blue_rating2, last_ro_combined_rating.rating, last_bo_combined_rating.rating, !red_won, CombinedRatings);
          updateRating(date, bd_id, blue_rating2, last_ro_combined_rating.rating, last_bd_combined_rating.rating, !red_won, CombinedRatings);

          // update singles ratings
          updateRating(date, ro_id, last_ro_singles_rating.rating, blue_rating2, last_ro_singles_rating.rating, red_won, SinglesRatings);

          // update doubles ratings
          updateRating(date, bo_id, blue_rating2, last_ro_singles_rating.rating, last_bo_offense_rating.rating, !red_won, OffenseRatings);
          updateRating(date, bd_id, blue_rating2, last_ro_singles_rating.rating, last_bd_defense_rating.rating, !red_won, DefenseRatings);
        }
      }
    };

    if (Meteor.settings.recalculate_ratings === "true") {
      console.log("recalculating ratings");

      CombinedRatings.remove({});
      SinglesRatings.remove({});
      OffenseRatings.remove({});
      DefenseRatings.remove({});

      var INITIAL_RATING = 1250;
      var players = Players.find({});
      players.forEach(function (player) {
        // add an initial rating for each rating being tracked
        CombinedRatings.insert({
          date_time: player.date_time,
          player_id: player._id,
          rating: INITIAL_RATING
        });

        SinglesRatings.insert({
          date_time: player.date_time,
          player_id: player._id,
          rating: INITIAL_RATING
        });

        OffenseRatings.insert({
          date_time: player.date_time,
          player_id: player._id,
          rating: INITIAL_RATING
        });

        DefenseRatings.insert({
          date_time: player.date_time,
          player_id: player._id,
          rating: INITIAL_RATING
        });
      });

      var matches = Matches.find({});
      matches.forEach(function (match) {
        var doc = ({
          ro: getPlayerName(match.ro_id),
          rd: getPlayerName(match.rd_id),
          bo: getPlayerName(match.bo_id),
          bd: getPlayerName(match.bd_id),
          rs: match.rs,
          bs: match.bs
        });
        updateAllRatings(doc, match.date_time);
      });
    }

    var insertMatch = function (doc) {
      var ro_id, rd_id, bo_id, bd_id;
      if (typeof doc.ro != "undefined") {
        ro_id = getPlayerId(doc.ro);
      }
      if (typeof doc.rd != "undefined") {
        rd_id = getPlayerId(doc.rd);
      }
      if (typeof doc.bo != "undefined") {
        bo_id = getPlayerId(doc.bo);
      }
      if (typeof doc.bd != "undefined") {
        bd_id = getPlayerId(doc.bd);
      }

      Matches.insert({
        date_time: Date.now(),
        ro_id: ro_id,
        rd_id: rd_id,
        bo_id: bo_id,
        bd_id: bd_id,
        rs: doc.rs,
        bs: doc.bs
      });
    };

    Meteor.methods({
      add_match: function (doc) {
        // check the form against the schema
        check(doc, MatchFormSchema);

        // after the form has been checked, insert the Match into the collection
        insertMatch(doc);

        // update all ratings
        updateAllRatings(doc, Date.now());
      },

      add_player: function (doc) {
        check(doc, PlayerFormSchema);
        addPlayer(doc.player_name, doc.rating);
      }
    });
  });
}
