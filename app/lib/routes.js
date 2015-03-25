var subs = new SubsManager();

// something changed in iron-router when it moved from 0.6 to 0.7 that impacted
// the way waitOn works.  It seems that adding the action section with
// this.ready and this.render does the trick that waitOn alone did in the past
// to make sure the data for each subscription is passed to the client before
// the template gets rendered.  The comment from maxhilland on May 18 near the
// bottom of the following link helped me find the solution:
// https://github.com/EventedMind/iron-router/issues/265
// However, based on my testing, it doesn't seem like the data section is
// necessary
Router.configure({
  layoutTemplate: 'layout',
  loadingTemplate: 'loading',
  notFoundTemplate: 'notFound'
});

// in the post above, it was suggested to call if(this.ready()) in the data
// hook to actually get the loadingTemplate to work, so this is being done
// for the home route below
Router.map(function() {
  this.route('home', {
    path: '/',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
//    data: function() {
//      if (this.ready()) {
//        Players.find();
//        CombinedRatings.find();
//        SinglesRatings.find();
//        OffenseRatings.find();
//        DefenseRatings.find();
//      }
//    },
    waitOn: function() {
      return [subs.subscribe('players'),
              subs.subscribe('combined_ratings'),
              subs.subscribe('singles_ratings'),
              subs.subscribe('offense_ratings'),
              subs.subscribe('defense_ratings')];
    },
    action: function() {
      if (this.ready()) {
        this.render();
      }
    }
  });

  this.route('addmatch', {
    path: '/addmatch',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [subs.subscribe('matches'),
              subs.subscribe('players')];
    },
    action: function() {
      if (this.ready()) {
        this.render();
      }
    }
  });

  this.route('addplayer', {
    path: '/addplayer',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [subs.subscribe('players'),
              subs.subscribe('combined_ratings')];
    },
    action: function() {
      if (this.ready()) {
        this.render();
      }
    }
  });

  this.route('individualstats', {
    path: '/individualstats',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [subs.subscribe('matches'),
              subs.subscribe('players'),
              subs.subscribe('combined_ratings'),
              subs.subscribe('singles_ratings'),
              subs.subscribe('offense_ratings'),
              subs.subscribe('defense_ratings')];
    },
    action: function() {
      if (this.ready()) {
        this.render();
      }
    }
  });

  this.route('teamstats', {
    path: '/teamstats',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [subs.subscribe('matches'),
              subs.subscribe('players')];
    },
    action: function() {
      if (this.ready()) {
        this.render();
      }
    }
  });

  this.route('rules', {
    path: '/rules',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    }
  });

  // route with name 'notFound' that for example matches
  // '/non-sense/route/that-matches/nothing' and automatically renders
  // template 'notFound'
  // HINT: Define a global not found route as the very last route in your router
  this.route('notFound', {
    path: '*',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    }
  });
});
