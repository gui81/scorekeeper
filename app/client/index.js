/** options for the spinner package */
Meteor.Spinner.options = {
  // The number of lines to draw
  lines: 13,
  // The length of each line
  length: 5,
  // The line thickness
  width: 2,
  // The radius of the inner circle
  radius: 8,
  // Corner roundness (0..1)
  corners: 0.7,
  // The rotation offset
  rotate: 0,
  // 1: clockwise, -1: counterclockwise
  direction: 1,
  // #rgb or #rrggbb
  color: '#fff',
  // revolutions per second
  speed: 1,
  // Afterglow percentage
  trail: 60,
  // Whether to render a shadow
  shadow: true,
  // Whether to use hardware acceleration
  hwaccel: false,
  // The CSS class to assign to the spinner
  className: 'spinner',
  // The z-index (defaults to 2000000000)
  zIndex: 2e9,
  // Top position relative to parent in px
  top: '20px',
  // Left position relative to parent in px
  left: 'auto'
};

var pad = function(num, size) {
  var s = num + '';
  while (s.length < size) {
    s = '0' + s;
  }
  return s;
};

Handlebars.registerHelper('formatDate', function(datetime) {
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var dt = new Date(datetime);
  var d = dt.getDate();
  var m = monthNames[dt.getMonth()];
  var y = dt.getFullYear();
  var h = dt.getHours();
  var min = dt.getMinutes();
  var s = dt.getSeconds();
  return (y + m + d + ' ' + pad(h, 2) + ':' + pad(min, 2) + ':' + pad(s, 2));
});

Handlebars.registerHelper('findPlayerFromId', function(player_id) {
  var player = Players.findOne({_id: player_id});
  if (typeof player !== 'undefined') {
    return player.name;
  } else {
    return 'N/A';
  }
});

Handlebars.registerHelper('findPlayerFirstEloRatingFromId',
                          function(player_id) {
  var elo_rating = CombinedRatings.findOne({player_id: player_id},
                                           {sort: {date_time: 1}});
  if (typeof elo_rating !== 'undefined') {
    return elo_rating.rating;
  } else {
    return 'N/A';
  }
});

Template.game_form.helpers({
  matchForm: function() {
    return MatchFormSchema;
  }
});

Template.player_form.helpers({
  playerForm: function() {
    return PlayerFormSchema;
  }
});

var findPlayerLatestEloRatingFromId = function(player_id, collection) {
  var elo_rating = collection.findOne({player_id: player_id},
                                      {sort: {date_time: -1}});
  if (typeof elo_rating !== 'undefined') {
    return +elo_rating.rating.toFixed(0);
  } else {
    return 'N/A';
  }
};

var addIndPlayersArray = function(players, id, win, loss) {
  if (typeof players[id] !== 'undefined') {
    players[id] = ({
      wins: players[id].wins + win,
      losses: players[id].losses + loss
    });
  } else {
    if ((typeof id !== 'undefined') && (id)) {
      players[id] = ({
        wins: win,
        losses: loss
      });
    }
  }
};

var addTeamPlayersArray = function(players, o_id, d_id, win, loss) {
  if ((typeof players[o_id] !== 'undefined') &&
      (typeof players[o_id][d_id] !== 'undefined')) {
    players[o_id][d_id] = ({
      wins: players[o_id][d_id].wins + win,
      losses: players[o_id][d_id].losses + loss
    });
  } else {
    if ((typeof o_id !== 'undefined') &&
        (typeof d_id !== 'undefined') && (o_id) && (d_id)) {
      if (typeof players[o_id] === 'undefined') {
        players[o_id] = [];
      }
      players[o_id][d_id] = ({
        wins: win,
        losses: loss
      });
    }
  }
};

var addGraph = function(collection, chart_dom) {
  // These lines are all chart setup.
  // Pick and choose which chart features you want to utilize.
  nv.addGraph(function() {
    var chart = nv.models.lineChart()
            // Adjust chart margins to give the axes some breathing room
            .margin({left: 75, right: 30})
            // We want nice looking tooltips and a guideline
            .useInteractiveGuideline(true)
            //how fast to transition lines
            .transitionDuration(350)
            //Show legend, allow users toggle lines
            .showLegend(true)
            //Show y-axis
            .showYAxis(true)
            //Show x-axis
            .showXAxis(true);

    // Chart x-axis settings
    chart.xAxis
        .tickFormat(function(d) {
          return d3.time.format('%x')(new Date(d));
        });

    // Chart y-axis settings
    chart.yAxis
        .axisLabel('Rating (Elo)')
        .tickFormat(d3.format('.0f'));

    // Done setting the chart up? Time to render it!
    var myData = getChartData(collection);

    // Select the <svg> element to render the chart in
    d3.select(chart_dom)
        // Populate the <svg> element with chart data...
        .datum(myData)
        // Finally, render the chart!
        .call(chart);

    // Update the chart when window resizes.
    nv.utils.windowResize(function() {
      chart.update();
    });
    return chart;
  });

  /*
   * populate data for players
   */
  function getChartData(collection) {
    // get top ten players, i.e. whose Elo Ratings are the highest
    var players = Players.find({});
    var player_ratings = [];
    players.forEach(function(player) {
      var rating = collection.findOne({player_id: player._id},
                                      {sort: {date_time: -1}});
      if (rating) {
        player_ratings.push({player_id: player._id, player_name: player.name,
                         rating: rating.rating});
      }
    });

    player_ratings.sort(function(a, b) {
      return (b.rating - a.rating);
    });
    // now limit the list to just 10 entries
    player_ratings.length = 10;

    var data = [];
    player_ratings.forEach(function(pl_r) {
      var ratings = collection.find({player_id: pl_r.player_id});
      var values = [];
      ratings.forEach(function(rating) {
        values.push({x: rating.date_time, y: rating.rating});
      });

      // sort ratings based on date_time so the charts are correctly displayed
      // in time
      values.sort(function(a, b) {
        return (a.x - b.x);
      });

      data.push({
        values: values,
        key: pl_r.player_name
      });
    });

    return data;
  }
};

var printObjectProperties = function(obj) {
  console.log('object:');
  for (var param in obj) {
    if (object.hasOwnProperty(param)) {
      console.log('  ' + param + ' = ' + obj[param]);
    }
  }
};

Template.header.events({
  'click #menu-toggle': function() {
    $('#wrapper').toggleClass('active');
  }
});

Template.sidebar.events({
  'click #link-scorekeeper': function() {
    $('#wrapper').toggleClass('active');
  },
  'click #link-addplayer': function() {
    $('#wrapper').toggleClass('active');
  },
  'click #link-addmatch': function() {
    $('#wrapper').toggleClass('active');
  },
  'click #link-individualstats': function() {
    $('#wrapper').toggleClass('active');
  },
  'click #link-teamstats': function() {
    $('#wrapper').toggleClass('active');
  },
  'click #link-rules': function() {
    $('#wrapper').toggleClass('active');
  }
});


/** after home template is rendered */
Template.home.rendered = function() {
  addGraph(CombinedRatings, '#combined_chart svg');
  addGraph(SinglesRatings, '#singles_chart svg');
  addGraph(OffenseRatings, '#offense_chart svg');
  addGraph(DefenseRatings, '#defense_chart svg');
};


/**  after individual_stats template is rendered */
Template.individualstats.rendered = function() {
  $('.footable').footable();
};


/** after team_stats template is rendered */
Template.teamstats.rendered = function() {
  $('.footable').footable();
};


/** after last_10_matches template is rendered */
Template.last_10_matches.rendered = function() {
  $('.footable').footable();
};


/** after last_10_players template is rendered */
Template.last_10_players.rendered = function() {
  $('.footable').footable();
};


/** after game_form template is rendered */
Template.game_form.rendered = function() {
  var players = Players.find({}).fetch();
  var names = [];
  players.forEach(function(player) {
    names.push(player.name);
  });

  $('.input_autocomplete').autocomplete({
    source: names
  });
};

Template.game_form.helpers({
  red_singles_wins: function() {
    var matches = Matches.find({});
    var wins = 0;
    matches.forEach(function(match) {
      if ((match.ro_id) && (!match.rd_id) &&
          (parseInt(match.rs, 10) > parseInt(match.bs, 10))) {
        wins += 1;
      }
    });

    return wins;
  },

  red_doubles_wins: function() {
    var matches = Matches.find({});
    var wins = 0;
    matches.forEach(function(match) {
      if ((match.ro_id) && (match.rd_id) &&
          (parseInt(match.rs, 10) > parseInt(match.bs, 10))) {
        wins += 1;
      }
    });

    return wins;
  },

  blue_singles_wins: function() {
    var matches = Matches.find({});
    var wins = 0;
    matches.forEach(function(match) {
      if ((match.bo_id) && (!match.bd_id) &&
          (parseInt(match.bs, 10) > parseInt(match.rs, 10))) {
        wins += 1;
      }
    });

    return wins;
  },

  blue_doubles_wins: function() {
    var matches = Matches.find({});
    var wins = 0;
    matches.forEach(function(match) {
      if ((match.bo_id) && (match.bd_id) &&
          (parseInt(match.bs, 10) > parseInt(match.rs, 10))) {
        wins += 1;
      }
    });

    return wins;
  }
});

Template.last_10_matches.helpers({
  matches: function() {
    return Matches.find({}, {sort: {date_time: -1}, limit: 10});
  }
});

Template.last_10_players.helpers({
  players: function() {
    return Players.find({}, {sort: {date_time: -1}, limit: 10});
  }
});

Template.individualstats.helpers({
  score: function() {
    var cursor = Matches.find({});
    var players = {};
    // loop through Matches to find all individuals and tally up scores
    cursor.forEach(function(match) {
      var red_win = 0;
      var blue_win = 0;
      if (parseInt(match.rs, 10) > parseInt(match.bs, 10)) {
        red_win = 1;
      } else {
        blue_win = 1;
      }

      addIndPlayersArray(players, match.ro_id, red_win, blue_win);
      addIndPlayersArray(players, match.rd_id, red_win, blue_win);
      addIndPlayersArray(players, match.bo_id, blue_win, red_win);
      addIndPlayersArray(players, match.bd_id, blue_win, red_win);
    });

    // now create a list that can be used for display
    var p = [];
    for (var id in players) {
      if (players.hasOwnProperty(id)) {
        var per = (players[id].wins /
          (players[id].wins + players[id].losses));
        if (typeof id !== 'undefined') {
          var player = Players.findOne({_id: id});
          p.push({
            name: player.name,
            wins: players[id].wins,
            losses: players[id].losses,
            percent: +(per * 100).toFixed(0) + '%',
            combined_rating: findPlayerLatestEloRatingFromId(id,
                                                             CombinedRatings),
            singles_rating: findPlayerLatestEloRatingFromId(id,
                                                            SinglesRatings),
            offense_rating: findPlayerLatestEloRatingFromId(id,
                                                            OffenseRatings),
            defense_rating: findPlayerLatestEloRatingFromId(id,
                                                            DefenseRatings)
          });
        }
      }
    }

    return p;
  }
});

Template.teamstats.helpers({
  score: function() {
    var cursor = Matches.find({});
    var players = {};

    // loop through Matches to find all teams and tally up scores
    cursor.forEach(function(match) {
      var red_win = 0;
      var blue_win = 0;
      if (parseInt(match.rs, 10) > parseInt(match.bs, 10)) {
        red_win = 1;
      } else {
        blue_win = 1;
      }

      addTeamPlayersArray(players, match.ro_id, match.rd_id,
                          red_win, blue_win);
      addTeamPlayersArray(players, match.bo_id, match.bd_id,
                          blue_win, red_win);
    });

    var teams = [];
    for (var o_id in players) {
      if (!players.hasOwnProperty(o_id)) {
        continue;
      }
      for (var d_id in players[o_id]) {
        if (!players[o_id].hasOwnProperty(d_id)) {
          continue;
        }
        var per = (players[o_id][d_id].wins /
          (players[o_id][d_id].wins + players[o_id][d_id].losses));
        var o_player = Players.findOne({_id: o_id});
        var d_player = Players.findOne({_id: d_id});
        teams.push({
          off_player: o_player.name,
          def_player: d_player.name,
          wins: players[o_id][d_id].wins,
          losses: players[o_id][d_id].losses,
          percent: +(per * 100).toFixed(0) + '%'
        });
      }
    }

    return teams;
  }
});
