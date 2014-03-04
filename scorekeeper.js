if (Meteor.isClient) {
  SimpleSchema.debug = true;

  var mForm = new AutoForm(MatchFormSchema);
  Template.game_form.helpers({
    matchForm: function() {
      return mForm;
    }
  });

  Template.individual_scores.helpers({
    score: function() {
      var cursor = Matches.find({});
      var players = {};
      // loop through Matches to find all individuals and tally up scores
      cursor.forEach(function(match) {
        var red_win = 0;
        var blue_win = 0;
        if (parseInt(match.rs) > parseInt(match.bs)) {
          red_win = 1;
        } else {
          blue_win = 1;
        }

        if (typeof players[match.ro] != "undefined") {
          players[match.ro] = ({
            wins: players[match.ro].wins + red_win,
            losses: players[match.ro].losses + blue_win
          });
        } else {
          if (typeof match.ro != "undefined") {
            players[match.ro] = ({
              wins: red_win,
              losses: blue_win
            });
          }
        }

        if (typeof players[match.rd] != "undefined") {
          players[match.rd] = ({
            wins: players[match.rd].wins + red_win,
            losses: players[match.rd].losses + blue_win
          });
        } else {
          if (typeof match.rd != "undefined") {
            players[match.rd] = ({
              wins: red_win,
              losses: blue_win
            });
          }
        }

        if (typeof players[match.bo] != "undefined") {
          players[match.bo] = ({
            wins: players[match.bo].wins + blue_win,
            losses: players[match.bo].losses + red_win
          });
        } else {
          if (typeof match.bo != "undefined") {
            players[match.bo] = ({
              wins: blue_win,
              losses: red_win
            });
          }
        }

        if (typeof players[match.bd] != "undefined") {
          players[match.bd] = ({
            wins: players[match.bd].wins + blue_win,
            losses: players[match.bd].losses + red_win
          })
        } else {
          if (typeof match.bd != "undefined") {
            players[match.bd] = ({
              wins: blue_win,
              losses: red_win
            });
          }
        }
      });

      // now create a list that can be used for display
      var p = [];
      for (var player in players) {
        p.push({
          name: player,
          wins: players[player].wins,
          losses: players[player].losses
        });
      }

      return p;
    }
  });

  Template.team_scores.helpers({
    score: function() {
      var cursor = Matches.find({});
      var teams = [];
      // loop through Matches to find all individuals and tally up scores
      cursor.forEach(function(match) {
        var red_win = 0;
        var blue_win = 0;
        if (parseInt(match.rs) > parseInt(match.bs)) {
          red_win = 1;
        } else {
          blue_win = 1;
        }

        teams.push({
          off_player: match.ro,
          def_player: match.rd,
          wins: red_win,
          losses: blue_win
        });
        teams.push({
          off_player: match.bo,
          def_player: match.bd,
          wins: blue_win,
          losses: red_win
        });
      });

      return teams;
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
