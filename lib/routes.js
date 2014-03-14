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
    }
  });

  this.route('image_404', {
    path: '/404.png'
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
      return [Meteor.subscribe('players')];
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
              Meteor.subscribe('players')];
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
