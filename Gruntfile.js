module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      files: [
        'Gruntfile.js',
        'app/client/*.js',
        'app/collections/*.js',
        'app/lib/*.js',
        'app/server/*.js',
        'app/tests/*.js'
      ],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      // tasks: ['jshint', 'qunit']
      tasks: ['jshint']
    },
    closureLint: {
      app: {
        closureLinterPath : '/usr/local/bin/',
        command: 'gjslint',
        src: [
          'app/client/*.js',
          'app/collections/*.js',
          'app/lib/*.js',
          'app/sever/*.js',
          'app/tests/*.js'
        ],
        options: {
          stdout: true,
          strict: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-closure-linter');

  // grunt.registerTask('test', ['jshint', 'qunit']);
  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('gjslint', ['closureLint']);
};
