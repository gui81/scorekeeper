Router.configure({
  layoutTemplate: 'layout',
  loadingTemplate: 'loading',
  notFoundTemplate: 'notFound'
});

Router.map(function() {
  this.route('home', {
    path: '/',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [Meteor.subscribe('players'),
              Meteor.subscribe('combined_ratings'),
              Meteor.subscribe('singles_ratings'),
              Meteor.subscribe('offense_ratings'),
              Meteor.subscribe('defense_ratings')];
    }
  });

  this.route('addmatch', {
    path: '/addmatch',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [Meteor.subscribe('matches'),
              Meteor.subscribe('players')];
    }
  });

  this.route('addplayer', {
    path: '/addplayer',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [Meteor.subscribe('players'),
              Meteor.subscribe('combined_ratings')];
    }
  });

  this.route('individual_stats', {
    path: '/individual_stats',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [Meteor.subscribe('matches'),
              Meteor.subscribe('players'),
              Meteor.subscribe('combined_ratings'),
              Meteor.subscribe('singles_ratings'),
              Meteor.subscribe('offense_ratings'),
              Meteor.subscribe('defense_ratings')];
    }
  });

  this.route('team_stats', {
    path: '/team_stats',
    yieldTemplates: {
      'header': { to: 'header' },
      'sidebar': { to: 'sidebar' }
    },
    waitOn: function() {
      return [Meteor.subscribe('matches'),
              Meteor.subscribe('players')];
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
