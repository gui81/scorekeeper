module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      files: [
        'Gruntfile.js',
        'app/collections/*.js',
        'app/lib/*.js',
        'app/scorekeeper.js',
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
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // grunt.registerTask('test', ['jshint', 'qunit']);
  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('default', ['jshint']);
};
